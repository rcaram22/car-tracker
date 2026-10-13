import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../db/repository';
import { setRemoteSink, type TableName } from './remote';

const base = { model: 'Golf Mk4 2.0', status: 'new' as const };
const img = (n: number) => ({
  data: new Uint8Array([n]).buffer as ArrayBuffer,
  type: 'image/jpeg',
});

let puts: { table: TableName; ids: string[] }[];
let removes: { table: TableName; ids: string[] }[];

beforeEach(async () => {
  await repo.clearAll();
  puts = [];
  removes = [];
  setRemoteSink({
    put: (table, records) =>
      puts.push({ table, ids: records.map((r) => r.id) }),
    remove: (table, ids) => removes.push({ table, ids }),
  });
});

afterEach(() => setRemoteSink(null));

describe('remote push', () => {
  it('pushes the updated listing and its history events', async () => {
    const id = await repo.createListing({ ...base, price: 100 });
    puts = [];
    await repo.updateListing(id, { price: 90 });
    const [event] = await repo.listEvents(id);
    expect(puts).toEqual([
      { table: 'listings', ids: [id] },
      { table: 'events', ids: [event.id] },
    ]);
  });

  it('pushes removal of a listing and everything attached to it', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1)], 0);
    const noteId = await repo.addNote(id, 'hola');
    const [photo] = await repo.listPhotos(id);
    await repo.deleteListing(id);
    expect(removes).toEqual(
      [
        { table: 'photos', ids: [photo.id] },
        { table: 'notes', ids: [noteId] },
        { table: 'events', ids: [] },
        { table: 'listings', ids: [id] },
      ].filter((r) => r.ids.length),
    );
  });

  it('pushes only new or reordered photos, plus the cover change', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1), img(2)], 0);
    const [a, b] = await repo.listPhotos(id);
    puts = [];
    await repo.syncPhotos(id, [{ ...b }, { ...a }, img(3)], 0);
    const photos = await repo.listPhotos(id);
    expect(puts).toEqual([
      { table: 'photos', ids: [b.id, a.id, photos[2].id] },
      { table: 'listings', ids: [id] },
    ]);
  });

  it('replaceAll removes records missing from the snapshot', async () => {
    const keep = await repo.createListing(base);
    const drop = await repo.createListing(base);
    const snap = await repo.exportAll();
    snap.listings = snap.listings.filter((l) => l.id === keep);
    removes = [];
    await repo.replaceAll(snap);
    expect(removes).toEqual([{ table: 'listings', ids: [drop] }]);
  });
});
