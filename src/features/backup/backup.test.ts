import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import {
  BackupError,
  base64ToBuffer,
  bufferToBase64,
  fromBackup,
  importBackupText,
  shouldNudge,
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
  return id;
}

const emptyBackup = () =>
  JSON.stringify(toBackup({ listings: [], photos: [], notes: [] }));

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
      version: 1,
      exportedAt: 123,
    });
    const back = fromBackup(json);
    expect(back.listings).toEqual(snap.listings);
    expect(back.notes).toEqual(snap.notes);
    expect(Array.from(new Uint8Array(back.photos[0].data))).toEqual([
      0, 255, 7,
    ]);
  });

  it.each([
    ['empty object', {}],
    ['other app', { app: 'x', version: 1, listings: [], notes: [], photos: [] }],
    [
      'future version',
      { app: 'car-tracker', version: 2, listings: [], notes: [], photos: [] },
    ],
    ['missing arrays', { app: 'car-tracker', version: 1 }],
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

describe('shouldNudge', () => {
  const day = 86_400_000;
  it('nudges when never exported or older than 14 days', () => {
    expect(shouldNudge(undefined, 0)).toBe(true);
    expect(shouldNudge(0, 15 * day)).toBe(true);
    expect(shouldNudge(0, 13 * day)).toBe(false);
  });
});
