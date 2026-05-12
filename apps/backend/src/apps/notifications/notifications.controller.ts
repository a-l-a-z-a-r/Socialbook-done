import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { NotificationsService } from '../../notifications/notifications.service';
import { validateAgainstSchema } from '../../schema/schema-validator';

type AuthRequest = {
  user?: Record<string, unknown>;
};

type CreateNotificationDto = {
  targetUser?: string;
  actor?: string;
  message?: string;
  reviewId?: string;
  booklistId?: string;
  commentId?: string;
  type?: string;
};

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(KeycloakAuthGuard)
  @Get('notifications')
  async listNotifications(@Req() req: AuthRequest) {
    const ownerId =
      (req.user?.preferred_username as string) || (req.user?.username as string);
    if (!ownerId) {
      throw new HttpException({ error: 'Missing owner' }, HttpStatus.FORBIDDEN);
    }
    const notifications = await this.notificationsService.listByUser(ownerId);
    return { notifications };
  }

  @UseGuards(KeycloakAuthGuard)
  @Post('notifications/:notificationId/read')
  async markNotificationRead(
    @Param('notificationId') notificationId: string,
    @Req() req: AuthRequest,
  ) {
    const ownerId =
      (req.user?.preferred_username as string) || (req.user?.username as string);
    if (!ownerId) {
      throw new HttpException({ error: 'Missing owner' }, HttpStatus.FORBIDDEN);
    }
    if (!notificationId) {
      throw new HttpException({ error: 'Missing notification' }, HttpStatus.BAD_REQUEST);
    }
    const updated = await this.notificationsService.markRead(notificationId, ownerId);
    if (!updated) {
      throw new HttpException({ error: 'Notification not found' }, HttpStatus.NOT_FOUND);
    }
    return updated;
  }

  @Post('internal/notifications')
  async createNotification(@Body() body: CreateNotificationDto) {
    const validation = validateAgainstSchema('api/create-notification-request.schema.json', body);
    if (!validation.valid) {
      throw new HttpException({ error: validation.error }, HttpStatus.BAD_REQUEST);
    }
    const targetUser = body.targetUser as string;

    const notification = await this.notificationsService.create({
      user: targetUser,
      actor: body.actor,
      message: body.message,
      reviewId: body.reviewId,
      booklistId: body.booklistId,
      commentId: body.commentId,
      type: body.type,
    });

    return { ok: true, notification };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'notifications', time: new Date().toISOString() };
  }

  @Get('notifications/health')
  serviceHealth() {
    return { status: 'ok', service: 'notifications', time: new Date().toISOString() };
  }
}
