import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import {
  BackupError,
  base64ToBuffer,
  bufferToBase64,
  fromBackup,
  importBackupText,
  toBackup,
} from './backup';

beforeEach(() => repo.clearAll());

async function seed() {
  const id = await repo.createListing({ model: 'Golf Mk4 2.0', status: 'new' });
  await repo.syncPhotos(
    id,
    [
      {
        data: new Uint8Array([0, 255, 7]).buffer as ArrayBuffer,
        type: 'image/jpeg',
      },
    ],
    0,
  );
  await repo.addNote(id, 'Tiene deuda');
  await repo.updateListing(id, { price: 9000 });
  return id;
}

const emptyBackup = () =>
  JSON.stringify(toBackup({ listings: [], photos: [], notes: [], events: [] }));

describe('base64', () => {
  it('round-trips bytes including large buffers', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    const back = new Uint8Array(base64ToBuffer(bufferToBase64(big.buffer)));
    expect(back).toEqual(big);
  });
});

describe('toBackup / fromBackup', () => {
  it('round-trips a snapshot through JSON', async () => {
    await seed();
    const snap = await repo.exportAll();
    const json = JSON.parse(JSON.stringify(toBackup(snap, 123)));
    expect(json).toMatchObject({
      app: 'car-tracker',
      version: 3,
      exportedAt: 123,
    });
    const back = fromBackup(json);
    expect(back.listings).toEqual(snap.listings);
    expect(back.notes).toEqual(snap.notes);
    expect(back.events).toHaveLength(1);
    expect(back.events).toEqual(snap.events);
    expect(Array.from(new Uint8Array(back.photos[0].data))).toEqual([
      0, 255, 7,
    ]);
  });

  it.each([
    ['empty object', {}],
    [
      'other app',
      { app: 'x', version: 1, listings: [], notes: [], photos: [] },
    ],
    [
      'future version',
      {
        app: 'car-tracker',
        version: 4,
        listings: [],
        notes: [],
        photos: [],
        events: [],
      },
    ],
    ['missing arrays', { app: 'car-tracker', version: 1 }],
    [
      'v2 without events',
      { app: 'car-tracker', version: 2, listings: [], notes: [], photos: [] },
    ],
    [
      'out of range score',
      {
        app: 'car-tracker',
        version: 3,
        listings: [{ id: 'l', model: 'Golf', status: 'new', rating: 12 }],
        notes: [],
        photos: [],
        events: [],
      },
    ],
    [
      'bad event',
      {
        app: 'car-tracker',
        version: 2,
        listings: [],
        notes: [],
        photos: [],
        events: [{ id: 'e', listingId: 'l', field: 'color', at: 0 }],
      },
    ],
    [
      'bad listing',
      {
        app: 'car-tracker',
        version: 1,
        listings: [{ id: 1 }],
        notes: [],
        photos: [],
      },
    ],
    [
      'bad base64',
      {
        app: 'car-tracker',
        version: 1,
        listings: [],
        notes: [],
        photos: [
          {
            id: 'p',
            listingId: 'l',
            order: 0,
            createdAt: 0,
            type: 'image/jpeg',
            data: '%%%',
          },
        ],
      },
    ],
  ])('rejects %s', (_, raw) => {
    expect(() => fromBackup(raw)).toThrow(BackupError);
  });

  it('still imports v1 backups, with empty history', () => {
    const snap = fromBackup({
      app: 'car-tracker',
      version: 1,
      exportedAt: 0,
      listings: [{ id: 'l', model: 'Golf', status: 'new' }],
      notes: [],
      photos: [],
    });
    expect(snap.listings).toHaveLength(1);
    expect(snap.events).toEqual([]);
  });

  it.each([1, 2])('turns v%s star ratings into an 8.5 score', (version) => {
    const snap = fromBackup({
      app: 'car-tracker',
      version,
      exportedAt: 0,
      listings: [
        { id: 'a', model: 'Golf', status: 'new', rating: 3 },
        { id: 'b', model: 'Golf', status: 'new' },
      ],
      notes: [],
      photos: [],
      events: [],
    });
    expect(snap.listings.map((l) => l.rating)).toEqual([8.5, undefined]);
  });
});

describe('importBackupText', () => {
  it('leaves existing data untouched when the file is invalid', async () => {
    await seed();
    await expect(importBackupText('not json', () => true)).rejects.toThrow(
      BackupError,
    );
    await expect(importBackupText('{}', () => true)).rejects.toThrow(
      BackupError,
    );
    expect((await repo.exportAll()).listings).toHaveLength(1);
  });

  it('does nothing when the user cancels', async () => {
    await seed();
    expect(await importBackupText(emptyBackup(), () => false)).toBe(
      'cancelled',
    );
    expect((await repo.exportAll()).listings).toHaveLength(1);
  });

  it('replaces everything on confirm', async () => {
    await seed();
    expect(await importBackupText(emptyBackup(), () => true)).toBe('imported');
    expect((await repo.exportAll()).listings).toHaveLength(0);
  });
});
