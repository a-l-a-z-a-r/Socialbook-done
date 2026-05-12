import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { DatabaseModule } from '../../database/database.module';
import { FriendsModule } from '../../friends/friends.module';
import { BooklistsClientService } from './booklists-client.service';
import { SocialController } from './social.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FriendsModule,
  ],
  controllers: [SocialController],
  providers: [KeycloakAuthGuard, BooklistsClientService],
})
export class SocialApiModule {}
