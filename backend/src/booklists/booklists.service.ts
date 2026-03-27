import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booklist, BooklistDocument } from './booklist.schema';
import { BooklistItem, BooklistItemDocument } from './booklist-item.schema';
import { FriendsService } from '../friends/friends.service';
import { QueueService } from '../queue/queue.service';

type CreateBooklistPayload = {
  name: string;
  description?: string;
  visibility?: 'public' | 'private' | 'unlisted';
  coverUrl?: string;
};

type AddBooklistItemPayload = {
  bookId: string;
  notes?: string;
  position?: number;
};

@Injectable()
export class BooklistsService {
  constructor(
    @InjectModel(Booklist.name) private readonly booklistModel: Model<BooklistDocument>,
    @InjectModel(BooklistItem.name) private readonly itemModel: Model<BooklistItemDocument>,
    private readonly friendsService: FriendsService,
    private readonly queueService: QueueService,
  ) {}

  async create(ownerId: string, payload: CreateBooklistPayload) {
    const created = await this.booklistModel.create({
      ownerId,
      name: payload.name,
      description: payload.description,
      visibility: payload.visibility ?? 'public',
      coverUrl: payload.coverUrl,
      totalItems: 0,
    });
    await this.publishBooklistUpdate(created, 'created');
    return created;
  }

  async findByOwner(ownerId: string) {
    return this.booklistModel.find({ ownerId }).sort({ updatedAt: -1 }).lean().exec();
  }

  async findPublicByOwner(ownerId: string) {
    if (!ownerId) return [];
    return this.booklistModel
      .find({ ownerId, visibility: 'public' })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }

  async searchPublicLists(query: string, limit = 12) {
    const normalized = query.trim();
    if (!normalized) return [];
    const regex = new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return this.booklistModel
      .find({
        visibility: 'public',
        $or: [{ name: regex }, { description: regex }, { ownerId: regex }],
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async addItem(booklistId: string, addedById: string, payload: AddBooklistItemPayload) {
    const booklist = await this.booklistModel.findById(booklistId);
    if (!booklist) {
      return null;
    }

    const item = await this.itemModel.create({
      booklistId,
      bookId: payload.bookId,
      addedById,
      position: payload.position ?? 0,
      notes: payload.notes,
    });

    await this.booklistModel.updateOne({ _id: booklistId }, { $inc: { totalItems: 1 } });
    await this.publishBooklistUpdate(booklist, 'item_added');
    return item;
  }

  async listItems(booklistId: string) {
    return this.itemModel.find({ booklistId }).sort({ position: 1, addedAt: -1 }).lean().exec();
  }

  async deleteList(booklistId: string, ownerId: string) {
    const list = await this.booklistModel.findById(booklistId);
    if (!list || list.ownerId !== ownerId) {
      return false;
    }
    await this.itemModel.deleteMany({ booklistId });
    await this.booklistModel.deleteOne({ _id: booklistId });
    return true;
  }

  private async publishBooklistUpdate(
    booklist: Pick<Booklist, 'ownerId' | 'name' | 'visibility'> & { _id?: unknown },
    action: 'created' | 'item_added',
  ) {
    if (booklist.visibility !== 'public') {
      return;
    }

    const followers = await this.friendsService.listFollowers(booklist.ownerId);
    if (followers.length === 0) {
      return;
    }

    const booklistId =
      typeof booklist._id === 'string'
        ? booklist._id
        : (booklist._id as { toString?: () => string } | undefined)?.toString?.();

    if (!booklistId) {
      return;
    }

    const message =
      action === 'created'
        ? `created a new booklist: ${booklist.name}`
        : `updated the booklist: ${booklist.name}`;

    await Promise.all(
      followers
        .filter((targetUser) => targetUser && targetUser !== booklist.ownerId)
        .map((targetUser) =>
          this.queueService.publishBooklistUpdated({
            ownerId: booklist.ownerId,
            targetUser,
            booklistId,
            booklistName: booklist.name,
            action,
            message,
          }),
        ),
    );
  }
}
