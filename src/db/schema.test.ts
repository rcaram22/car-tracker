import Dexie from 'dexie';
import { expect, it } from 'vitest';
import { defineSchema } from './schema';

it('migrates old 1-5 star ratings to an 8.5 score', async () => {
  const old = new Dexie('migration-test');
  old.version(2).stores({
    listings: 'id, status, rating, price, updatedAt',
    photos: 'id, listingId, [listingId+order]',
    notes: 'id, listingId, createdAt',
    events: 'id, listingId, at',
  });
  await old.table('listings').bulkAdd([
    { id: 'a', model: 'Golf', status: 'new', rating: 4 },
    { id: 'b', model: 'Golf', status: 'new' },
  ]);
  old.close();

  const db = defineSchema(new Dexie('migration-test'));
  const [a, b] = await db.listings.bulkGet(['a', 'b']);
  expect(a!.rating).toBe(8.5);
  expect(b!.rating).toBeUndefined();
  db.close();
});
