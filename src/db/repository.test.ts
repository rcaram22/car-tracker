import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from './repository';

const base = { model: 'Golf Mk4 2.0', status: 'new' as const };
const img = (n: number) => ({
  data: new Uint8Array([n]).buffer as ArrayBuffer,
  type: 'image/jpeg',
});
const bytes = (p: { data: ArrayBuffer }) => Array.from(new Uint8Array(p.data));

beforeEach(() => repo.clearAll());

describe('listings', () => {
  it('creates and reads a listing with timestamps', async () => {
    const id = await repo.createListing({ ...base, price: 9375 });
    const l = await repo.getListing(id);
    expect(l).toMatchObject({ id, model: 'Golf Mk4 2.0', price: 9375 });
    expect(l!.createdAt).toBeGreaterThan(0);
    expect(l!.updatedAt).toBe(l!.createdAt);
  });

  it('clears a field when patched with undefined', async () => {
    const id = await repo.createListing({ ...base, rating: 4 });
    await repo.updateListing(id, { rating: undefined });
    expect((await repo.getListing(id))!.rating).toBeUndefined();
  });

  it('deleteListing cascades photos and notes', async () => {
    const id = await repo.createListing(base);
    const other = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1)], 0);
    await repo.syncPhotos(other, [img(9)], 0);
    await repo.addNote(id, 'hola');
    await repo.deleteListing(id);
    const snap = await repo.exportAll();
    expect(snap.listings.map((l) => l.id)).toEqual([other]);
    expect(snap.photos).toHaveLength(1);
    expect(snap.notes).toHaveLength(0);
  });
});

describe('syncPhotos', () => {
  it('adds photos in order and sets the cover', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1), img(2), img(3)], 1);
    const photos = await repo.listPhotos(id);
    expect(photos.map(bytes)).toEqual([[1], [2], [3]]);
    expect((await repo.getListing(id))!.coverPhotoId).toBe(photos[1].id);
  });

  it('keeps, reorders and drops existing photos', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1), img(2), img(3)], 0);
    const [p1, , p3] = await repo.listPhotos(id);
    await repo.syncPhotos(id, [{ ...p3 }, img(4), { ...p1 }], 2);
    const photos = await repo.listPhotos(id);
    expect(photos.map(bytes)).toEqual([[3], [4], [1]]);
    expect(photos[0].id).toBe(p3.id);
    expect((await repo.getListing(id))!.coverPhotoId).toBe(p1.id);
  });

  it('clears the cover when coverIndex is -1', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1)], 0);
    await repo.syncPhotos(id, [], -1);
    expect(await repo.listPhotos(id)).toEqual([]);
    expect((await repo.getListing(id))!.coverPhotoId).toBeUndefined();
  });
});

describe('notes', () => {
  it('adds, lists oldest first and deletes', async () => {
    const id = await repo.createListing(base);
    const n1 = await repo.addNote(id, 'primera');
    await new Promise((r) => setTimeout(r, 2));
    await repo.addNote(id, 'segunda');
    expect((await repo.listNotes(id)).map((n) => n.text)).toEqual([
      'primera',
      'segunda',
    ]);
    await repo.deleteNote(n1);
    expect((await repo.listNotes(id)).map((n) => n.text)).toEqual(['segunda']);
  });
});

describe('snapshot', () => {
  it('replaceAll swaps the whole dataset', async () => {
    await repo.createListing(base);
    const snap = await repo.exportAll();
    await repo.createListing({ ...base, model: 'Otro' });
    await repo.replaceAll(snap);
    const after = await repo.exportAll();
    expect(after.listings).toHaveLength(1);
    expect(after.listings[0].model).toBe('Golf Mk4 2.0');
  });
});
