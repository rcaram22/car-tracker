import { describe, expect, it } from 'vitest';
import { fromDoc, toDoc } from './firestoreSync';

describe('firestore mapping', () => {
  it('round-trips photo bytes', () => {
    const photo = {
      id: 'p1',
      listingId: 'l1',
      data: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
      type: 'image/jpeg',
      order: 0,
      createdAt: 1,
    };
    const back = fromDoc('photos', toDoc('photos', photo)) as typeof photo;
    expect(Array.from(new Uint8Array(back.data))).toEqual([1, 2, 3]);
    expect(back).toMatchObject({ id: 'p1', listingId: 'l1', order: 0 });
  });

  it('passes other records through unchanged', () => {
    const note = { id: 'n1', listingId: 'l1', text: 'hola', createdAt: 1 };
    expect(fromDoc('notes', toDoc('notes', note))).toEqual(note);
  });
});
