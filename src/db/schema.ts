import Dexie, { type EntityTable } from 'dexie';
import type {
  Listing,
  ListingEvent,
  Note,
  Photo,
} from '../domain/listing';
import type { Job } from '../domain/jobs';
import { MIGRATED_SCORE } from '../domain/score';

export type CarTrackerDb = Dexie & {
  listings: EntityTable<Listing, 'id'>;
  photos: EntityTable<Photo, 'id'>;
  notes: EntityTable<Note, 'id'>;
  events: EntityTable<ListingEvent, 'id'>;
  jobs: EntityTable<Job, 'id'>;
};

export function defineSchema(d: Dexie): CarTrackerDb {
  d.version(1).stores({
    listings: 'id, status, rating, price, updatedAt',
    photos: 'id, listingId, [listingId+order]',
    notes: 'id, listingId, createdAt',
  });

  d.version(2).stores({
    events: 'id, listingId, at',
  });

  d.version(3)
    .stores({})
    .upgrade((tx) =>
      tx
        .table('listings')
        .toCollection()
        .modify((l: Listing) => {
          if (l.rating !== undefined) l.rating = MIGRATED_SCORE;
        }),
    );

  d.version(4).stores({
    jobs: 'id, priority',
  });

  return d as CarTrackerDb;
}

export const db = defineSchema(new Dexie('car-tracker'));
