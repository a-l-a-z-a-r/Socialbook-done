import amqplib from 'amqplib';
import { validateAgainstSchema } from './schema-validator.js';

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://admin:HelloWorld123@rabbitmq-service-api.rabbitmq.svc.cluster.local:5672';
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'socialbook.events';
const QUEUE = process.env.RABBITMQ_QUEUE || 'socialbook.notifications';
const ROUTING_KEYS = (process.env.RABBITMQ_ROUTING_KEYS || process.env.RABBITMQ_ROUTING_KEY || 'review.commented,booklist.updated')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const NOTIFICATIONS_API_URL =
  process.env.NOTIFICATIONS_API_URL || 'http://socialbook-notifications:5000/internal/notifications';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  // Simple reconnect loop for a demo worker.
  while (true) {
    try {
      const connection = await amqplib.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await channel.assertQueue(QUEUE, { durable: true });
      for (const routingKey of ROUTING_KEYS) {
        await channel.bindQueue(QUEUE, EXCHANGE, routingKey);
      }

      console.log(`[worker] connected. queue=${QUEUE} routing=${ROUTING_KEYS.join(',')}`);

      await channel.consume(
        QUEUE,
        async (msg) => {
          if (!msg) return;
          const body = msg.content.toString();
          try {
            const payload = JSON.parse(body);
            const schemaPath = payload?.booklistId
              ? 'events/booklist-updated.schema.json'
              : 'events/review-commented.schema.json';
            const payloadValidation = validateAgainstSchema(schemaPath, payload);
            if (!payloadValidation.valid) {
              throw new Error(payloadValidation.error);
            }
            const notificationPayload = {
              targetUser: payload?.targetUser,
              actor: payload?.ownerId || payload?.user,
              message: payload?.message,
              reviewId: payload?.reviewId,
              booklistId: payload?.booklistId,
              commentId: payload?.commentId,
              type: payload?.booklistId ? 'booklist.updated' : 'review.commented',
            };
            const notificationValidation = validateAgainstSchema(
              'api/create-notification-request.schema.json',
              notificationPayload,
            );
            if (!notificationValidation.valid) {
              throw new Error(notificationValidation.error);
            }
            const response = await fetch(NOTIFICATIONS_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify(notificationPayload),
            });
            if (!response.ok) {
              throw new Error(`notifications API returned ${response.status}`);
            }
            console.log('[worker] notification saved');
            channel.ack(msg);
          } catch (err) {
            console.error('[worker] failed to handle message', err.message || err);
            channel.nack(msg, false, true);
          }
        },
        { noAck: false },
      );

      return;
    } catch (err) {
      console.error('[worker] connection failed, retrying in 5s:', err.message || err);
      await sleep(5000);
    }
  }
};

run();
