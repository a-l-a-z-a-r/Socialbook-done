import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    NotificationsModule,
  ],
  controllers: [NotificationsController],
  providers: [KeycloakAuthGuard],
})
export class NotificationsApiModule {}
