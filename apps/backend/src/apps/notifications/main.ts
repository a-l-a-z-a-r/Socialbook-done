import { NestFactory } from '@nestjs/core';
import { applyCommonAppMiddleware, getPort } from '../app-bootstrap';
import { NotificationsApiModule } from './notifications.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsApiModule);
  applyCommonAppMiddleware(
    app,
    {
      title: 'Socialbook Notifications API',
      description: 'Notifications service',
      path: 'api/docs/notifications',
    },
    'notifications',
  );

  await app.listen(getPort(), '0.0.0.0');
}

bootstrap();
