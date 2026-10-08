import Dexie, { type EntityTable } from 'dexie';
import type { Listing, Note, Photo } from '../domain/listing';

export const db = new Dexie('car-tracker') as Dexie & {
  listings: EntityTable<Listing, 'id'>;
  photos: EntityTable<Photo, 'id'>;
  notes: EntityTable<Note, 'id'>;
};

db.version(1).stores({
  listings: 'id, status, rating, price, updatedAt',
  photos: 'id, listingId, [listingId+order]',
  notes: 'id, listingId, createdAt',
});
