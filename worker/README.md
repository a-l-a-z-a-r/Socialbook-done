# Socialbook RabbitMQ Worker

Worker that consumes notification-producing events and forwards them to the notifications API.

## Run locally

```bash
npm install
RABBITMQ_URL=amqp://admin:HelloWorld123@localhost:5672 npm start
```

## Environment variables

- `RABBITMQ_URL`: RabbitMQ connection string.
- `RABBITMQ_EXCHANGE`: Exchange name (default: `socialbook.events`).
- `RABBITMQ_QUEUE`: Queue name (default: `socialbook.comments`).
- `RABBITMQ_ROUTING_KEYS`: Comma-separated routing keys (default: `review.commented,booklist.updated`).
- `RABBITMQ_ROUTING_KEY`: Legacy single routing key fallback.
