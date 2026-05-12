import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booklist, BooklistSchema } from './booklist.schema';
import { BooklistItem, BooklistItemSchema } from './booklist-item.schema';
import { BooklistsController } from './booklists.controller';
import { BooklistsService } from './booklists.service';
import { FriendsModule } from '../friends/friends.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    FriendsModule,
    QueueModule,
    MongooseModule.forFeature([
      { name: Booklist.name, schema: BooklistSchema },
      { name: BooklistItem.name, schema: BooklistItemSchema },
    ]),
  ],
  controllers: [BooklistsController],
  providers: [BooklistsService],
  exports: [BooklistsService],
})
export class BooklistsModule {}
