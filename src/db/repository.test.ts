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

describe('history', () => {
  it('records nothing on create', async () => {
    const id = await repo.createListing({ ...base, price: 9500 });
    expect(await repo.listEvents(id)).toEqual([]);
  });

  it('records real price and status changes, newest first', async () => {
    const id = await repo.createListing({ ...base, price: 9500 });
    await repo.updateListing(id, { price: 9000 });
    await new Promise((r) => setTimeout(r, 2));
    await repo.updateListing(id, { status: 'contacted' });
    const events = await repo.listEvents(id);
    expect(events.map(({ field, from, to }) => ({ field, from, to }))).toEqual([
      { field: 'status', from: 'new', to: 'contacted' },
      { field: 'price', from: 9500, to: 9000 },
    ]);
    expect(events[0].at).toBeGreaterThan(0);
  });

  it('ignores unchanged values and untracked fields', async () => {
    const id = await repo.createListing({ ...base, price: 9500 });
    await repo.updateListing(id, {
      ...base,
      price: 9500,
      color: 'Azul',
      rating: 3,
    });
    expect(await repo.listEvents(id)).toEqual([]);
  });

  it('records a cleared price', async () => {
    const id = await repo.createListing({ ...base, price: 9500 });
    await repo.updateListing(id, { price: undefined });
    const [e] = await repo.listEvents(id);
    expect(e).toMatchObject({ field: 'price', from: 9500 });
    expect(e.to).toBeUndefined();
  });

  it('deleteEvent removes one row without touching the listing', async () => {
    const id = await repo.createListing({ ...base, price: 9500 });
    await repo.updateListing(id, { price: 9000 });
    await repo.updateListing(id, { status: 'seen' });
    const [latest, older] = await repo.listEvents(id);
    await repo.deleteEvent(older.id);
    expect((await repo.listEvents(id)).map((e) => e.id)).toEqual([latest.id]);
    expect(await repo.getListing(id)).toMatchObject({
      price: 9000,
      status: 'seen',
    });
  });

  it('deleteListing removes its history', async () => {
    const id = await repo.createListing({ ...base, price: 9500 });
    await repo.updateListing(id, { price: 9000 });
    await repo.deleteListing(id);
    expect((await repo.exportAll()).events).toEqual([]);
  });
});

describe('jobs catalog', () => {
  it('seeds the initial list once, even if run twice', async () => {
    await repo.seedJobs();
    await repo.seedJobs();
    const jobs = await repo.listJobs();
    expect(jobs).toHaveLength(12);
    expect(jobs[0]).toMatchObject({ description: 'Cubiertas', amount: 500 });
  });

  it('adds, updates and deletes a job', async () => {
    const id = await repo.addJob();
    await repo.updateJob(id, { description: 'Embrague', amount: 400, priority: 'high' });
    expect(await repo.listJobs()).toEqual([
      expect.objectContaining({ id, description: 'Embrague', amount: 400, priority: 'high' }),
    ]);
    await repo.updateJob(id, { amount: undefined });
    expect((await repo.listJobs())[0].amount).toBeUndefined();
    await repo.deleteJob(id);
    expect(await repo.listJobs()).toEqual([]);
  });

  it('is part of the snapshot', async () => {
    await repo.seedJobs();
    const snap = await repo.exportAll();
    expect(snap.jobs).toHaveLength(12);
    await repo.clearAll();
    expect(await repo.listJobs()).toEqual([]);
    await repo.replaceAll(snap);
    expect(await repo.listJobs()).toHaveLength(12);
  });
});
