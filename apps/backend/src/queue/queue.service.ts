import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqplib = require('amqplib');
import { Channel, Connection, ConsumeMessage } from 'amqplib';
import { validateAgainstSchema } from '../schema/schema-validator';

type ReviewCreatedPayload = {
  user?: string;
  book?: string;
  rating?: number;
  review?: string;
  status?: string;
  created_at?: string;
  coverUrl?: string;
};

type ImportRequestedPayload = {
  query: string;
  source?: string;
  requestedBy?: string;
};

type ReviewCommentedPayload = {
  reviewId: string;
  commentId: string;
  parentCommentId?: string;
  user: string;
  message: string;
  targetUser: string;
};

type BooklistUpdatedPayload = {
  ownerId: string;
  targetUser: string;
  booklistId: string;
  booklistName: string;
  action: 'created' | 'item_added';
  message: string;
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  private readonly exchange = 'socialbook.events';
  private readonly queues = {
    notifications: 'socialbook.notifications',
    recommendations: 'socialbook.recommendations',
    imports: 'socialbook.imports',
    fanout: 'socialbook.feed-fanout',
    comments: 'socialbook.comments',
  };
  private readonly routingKeys = {
    reviewCreated: 'review.created',
    importRequested: 'import.requested',
    commentCreated: 'review.commented',
    booklistUpdated: 'booklist.updated',
  };

  private getRabbitUrl() {
    return (
      process.env.RABBITMQ_URL ||
      'amqp://admin:HelloWorld123@rabbitmq-service-api.rabbitmq.svc.cluster.local:5672'
    );
  }

  async onModuleInit() {
    try {
      await this.connect();
      await this.startConsumers();
    } catch (err) {
      this.logger.warn(`RabbitMQ unavailable: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      this.logger.warn(`RabbitMQ shutdown issue: ${(err as Error).message}`);
    }
  }

  async publishReviewCreated(payload: ReviewCreatedPayload) {
    return this.publish(
      this.routingKeys.reviewCreated,
      payload,
      'events/review-created.schema.json',
    );
  }

  async publishReviewCommented(payload: ReviewCommentedPayload) {
    return this.publish(
      this.routingKeys.commentCreated,
      payload,
      'events/review-commented.schema.json',
    );
  }

  async enqueueImport(payload: ImportRequestedPayload) {
    return this.publish(
      this.routingKeys.importRequested,
      payload,
      'events/import-requested.schema.json',
    );
  }

  async publishBooklistUpdated(payload: BooklistUpdatedPayload) {
    return this.publish(
      this.routingKeys.booklistUpdated,
      payload,
      'events/booklist-updated.schema.json',
    );
  }

  private async connect() {
    if (this.connection) return;
    const url = this.getRabbitUrl();
    this.logger.log(`Connecting to RabbitMQ at ${url}`);
    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    await this.channel.assertQueue(this.queues.notifications, { durable: true });
    await this.channel.assertQueue(this.queues.recommendations, { durable: true });
    await this.channel.assertQueue(this.queues.imports, { durable: true });
    await this.channel.assertQueue(this.queues.fanout, { durable: true });
    await this.channel.assertQueue(this.queues.comments, { durable: true });
    await this.channel.bindQueue(this.queues.notifications, this.exchange, this.routingKeys.reviewCreated);
    await this.channel.bindQueue(this.queues.notifications, this.exchange, this.routingKeys.booklistUpdated);
    await this.channel.bindQueue(this.queues.recommendations, this.exchange, this.routingKeys.reviewCreated);
    await this.channel.bindQueue(this.queues.fanout, this.exchange, this.routingKeys.reviewCreated);
    await this.channel.bindQueue(this.queues.imports, this.exchange, this.routingKeys.importRequested);
    await this.channel.bindQueue(this.queues.comments, this.exchange, this.routingKeys.commentCreated);
  }

  private async publish(
    routingKey: string,
    payload: Record<string, unknown>,
    schemaPath: string,
  ) {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not ready; skipping publish.');
      return;
    }
    const validation = validateAgainstSchema(schemaPath, payload);
    if (!validation.valid) {
      this.logger.warn(`Invalid payload for ${routingKey}: ${validation.error}`);
      return;
    }
    const body = Buffer.from(JSON.stringify(payload));
    this.channel.publish(this.exchange, routingKey, body, { persistent: true });
  }

  private async startConsumers() {
    if (!this.channel) return;
    await this.channel.consume(this.queues.notifications, (msg: ConsumeMessage | null) =>
      this.handleMessage(msg, 'notifications'),
    );
    await this.channel.consume(this.queues.recommendations, (msg: ConsumeMessage | null) =>
      this.handleMessage(msg, 'recommendations'),
    );
    await this.channel.consume(this.queues.imports, (msg: ConsumeMessage | null) =>
      this.handleMessage(msg, 'imports'),
    );
    await this.channel.consume(this.queues.fanout, (msg: ConsumeMessage | null) =>
      this.handleMessage(msg, 'fanout'),
    );
    await this.channel.consume(this.queues.comments, (msg: ConsumeMessage | null) =>
      this.handleMessage(msg, 'comments'),
    );
  }

  private handleMessage(message: ConsumeMessage | null, queue: string) {
    if (!message || !this.channel) return;
    try {
      const payload = JSON.parse(message.content.toString());
      const schemaPath =
        queue === 'notifications'
          ? this.getNotificationsSchema(payload as Record<string, unknown>)
          : this.getQueueSchema(queue);
      if (schemaPath) {
        const validation = validateAgainstSchema(schemaPath, payload);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }
      this.logger.log(`[${queue}] ${JSON.stringify(payload)}`);
      this.channel.ack(message);
    } catch (err) {
      this.logger.error(`[${queue}] failed to process message`, err as Error);
      this.channel.nack(message, false, false);
    }
  }

  private getQueueSchema(queue: string) {
    if (queue === 'notifications') {
      return null;
    }
    if (queue === 'recommendations' || queue === 'fanout') {
      return 'events/review-created.schema.json';
    }
    if (queue === 'imports') {
      return 'events/import-requested.schema.json';
    }
    if (queue === 'comments') {
      return 'events/review-commented.schema.json';
    }
    return null;
  }

  private getNotificationsSchema(payload: Record<string, unknown>) {
    if (payload.booklistId) {
      return 'events/booklist-updated.schema.json';
    }
    return 'events/review-created.schema.json';
  }
}
