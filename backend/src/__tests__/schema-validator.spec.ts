import { validateAgainstSchema } from '../schema/schema-validator';

describe('validateAgainstSchema', () => {
  it('accepts valid review commented payloads', () => {
    expect(
      validateAgainstSchema('events/review-commented.schema.json', {
        reviewId: 'review-1',
        commentId: 'comment-1',
        user: 'mila',
        message: 'Nice review',
        targetUser: 'jon',
      }),
    ).toEqual({ valid: true });
  });

  it('rejects payloads with extra fields', () => {
    expect(
      validateAgainstSchema('events/review-commented.schema.json', {
        reviewId: 'review-1',
        commentId: 'comment-1',
        user: 'mila',
        message: 'Nice review',
        targetUser: 'jon',
        extra: true,
      }),
    ).toEqual({ valid: false, error: 'extra is not allowed' });
  });

  it('rejects invalid booklist update actions', () => {
    expect(
      validateAgainstSchema('events/booklist-updated.schema.json', {
        ownerId: 'jon',
        targetUser: 'mila',
        booklistId: 'list-1',
        booklistName: 'Favorites',
        action: 'deleted',
        message: 'updated the booklist: Favorites',
      }),
    ).toEqual({ valid: false, error: 'action must be one of "created", "item_added"' });
  });
});
