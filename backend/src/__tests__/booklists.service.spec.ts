import { BooklistsService } from '../booklists/booklists.service';

const makeQuery = <T,>(result: T) => {
  const query: any = {
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn(() => query),
  };
  if (result !== undefined) {
    query.exec = jest.fn().mockResolvedValue(result);
  }
  return query;
};

describe('BooklistsService', () => {
  const createService = (booklistModel: any, itemModel: any = {}, overrides: Record<string, any> = {}) => {
    const friendsService = overrides.friendsService || { listFollowers: jest.fn().mockResolvedValue([]) };
    const queueService = overrides.queueService || { publishBooklistUpdated: jest.fn() };
    return {
      service: new BooklistsService(booklistModel as any, itemModel as any, friendsService as any, queueService as any),
      friendsService,
      queueService,
    };
  };

  it('creates booklists with defaults', async () => {
    const created = { id: '1', _id: '1', ownerId: 'owner', name: 'Favorites', visibility: 'public' };
    const model = { create: jest.fn().mockResolvedValue(created) };
    const { service } = createService(model);

    await service.create('owner', { name: 'Favorites' });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner', name: 'Favorites', visibility: 'public' }),
    );
  });

  it('returns empty lists for missing owner', async () => {
    const model = { find: jest.fn() };
    const { service } = createService(model);

    await expect(service.findPublicByOwner('')).resolves.toEqual([]);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('searches public lists with sanitized query', async () => {
    const model = { find: jest.fn(() => makeQuery([{ id: '1' }])) };
    const { service } = createService(model);

    await expect(service.searchPublicLists('   ')).resolves.toEqual([]);
    await expect(service.searchPublicLists('romance?')).resolves.toEqual([{ id: '1' }]);
  });

  it('adds items and increments totals', async () => {
    const itemModel = { create: jest.fn().mockResolvedValue({ id: 'item' }) };
    const booklistModel = {
      findById: jest.fn().mockResolvedValue({ _id: 'list', ownerId: 'owner', name: 'Favorites', visibility: 'public' }),
      updateOne: jest.fn(),
    };
    const { service } = createService(booklistModel, itemModel);

    await service.addItem('list', 'owner', { bookId: 'book-1' });

    expect(itemModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ booklistId: 'list', bookId: 'book-1', addedById: 'owner' }),
    );
    expect(booklistModel.updateOne).toHaveBeenCalled();
  });

  it('deletes lists only for owners', async () => {
    const list = { ownerId: 'owner' };
    const booklistModel = {
      findById: jest.fn().mockResolvedValue(list),
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    const itemModel = { deleteMany: jest.fn().mockResolvedValue({}) };
    const { service } = createService(booklistModel, itemModel);

    await expect(service.deleteList('list', 'owner')).resolves.toBe(true);
    await expect(service.deleteList('list', 'other')).resolves.toBe(false);
  });

  it('publishes notifications when a public booklist is created', async () => {
    const created = { _id: 'list-1', ownerId: 'owner', name: 'Favorites', visibility: 'public' };
    const booklistModel = { create: jest.fn().mockResolvedValue(created) };
    const friendsService = { listFollowers: jest.fn().mockResolvedValue(['mila', 'alex']) };
    const queueService = { publishBooklistUpdated: jest.fn().mockResolvedValue(undefined) };
    const { service } = createService(booklistModel, {}, { friendsService, queueService });

    await service.create('owner', { name: 'Favorites', visibility: 'public' });

    expect(queueService.publishBooklistUpdated).toHaveBeenCalledTimes(2);
    expect(queueService.publishBooklistUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner',
        targetUser: 'mila',
        booklistId: 'list-1',
        action: 'created',
      }),
    );
  });
});
