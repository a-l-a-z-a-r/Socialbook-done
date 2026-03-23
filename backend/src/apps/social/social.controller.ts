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
import { FriendsService } from '../../friends/friends.service';
import { FriendDto } from '../../dto/app.dto';
import { BooklistsClientService } from './booklists-client.service';

type AuthRequest = {
  user?: Record<string, unknown>;
};

@Controller()
export class SocialController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly booklistsClientService: BooklistsClientService,
  ) {}

  @UseGuards(KeycloakAuthGuard)
  @Get('friends')
  async listFriends(@Req() req: AuthRequest) {
    const ownerId =
      (req.user?.preferred_username as string) || (req.user?.username as string);
    if (!ownerId) {
      throw new HttpException({ error: 'Missing owner' }, HttpStatus.FORBIDDEN);
    }
    const friends = await this.friendsService.listFriends(ownerId);
    return { friends };
  }

  @UseGuards(KeycloakAuthGuard)
  @Post('friends')
  async addFriend(@Body() body: FriendDto, @Req() req: AuthRequest) {
    const ownerId =
      (req.user?.preferred_username as string) || (req.user?.username as string);
    if (!ownerId) {
      throw new HttpException({ error: 'Missing owner' }, HttpStatus.FORBIDDEN);
    }
    if (!body?.friendId) {
      throw new HttpException({ error: 'Missing friend' }, HttpStatus.BAD_REQUEST);
    }
    if (body.friendId === ownerId) {
      throw new HttpException({ error: 'Cannot add yourself' }, HttpStatus.BAD_REQUEST);
    }
    const friend = await this.friendsService.addFriend(ownerId, body.friendId);
    return { ok: true, friend };
  }

  @UseGuards(KeycloakAuthGuard)
  @Get('friends/:friendId/booklists')
  async getFriendBooklists(@Param('friendId') friendId: string) {
    if (!friendId) {
      throw new HttpException({ error: 'Missing friend' }, HttpStatus.BAD_REQUEST);
    }
    const lists = await this.booklistsClientService.listPublicByOwner(friendId);
    return { booklists: lists };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'social', time: new Date().toISOString() };
  }

  @Get('social/health')
  serviceHealth() {
    return { status: 'ok', service: 'social', time: new Date().toISOString() };
  }
}
