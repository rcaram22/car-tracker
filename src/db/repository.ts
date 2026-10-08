import type { Listing, ListingInput, Note, Photo } from '../domain/listing';
import { db } from './schema';

const now = () => Date.now();
const newId = () => crypto.randomUUID();

export function listListings(): Promise<Listing[]> {
  return db.listings.toArray();
}

export function getListing(id: string): Promise<Listing | undefined> {
  return db.listings.get(id);
}

export async function createListing(input: ListingInput): Promise<string> {
  const id = newId();
  const t = now();
  await db.listings.add({ ...input, id, createdAt: t, updatedAt: t });
  return id;
}

export async function updateListing(
  id: string,
  patch: Partial<ListingInput>,
): Promise<void> {
  await db.listings.update(id, { ...patch, updatedAt: now() });
}

export async function deleteListing(id: string): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, db.notes, async () => {
    await db.photos.where('listingId').equals(id).delete();
    await db.notes.where('listingId').equals(id).delete();
    await db.listings.delete(id);
  });
}

export function listPhotos(listingId: string): Promise<Photo[]> {
  return db.photos.where('listingId').equals(listingId).sortBy('order');
}

export function getPhoto(id: string): Promise<Photo | undefined> {
  return db.photos.get(id);
}

export interface PhotoDraftInput {
  id?: string;
  data: ArrayBuffer;
  type: string;
}

export async function syncPhotos(
  listingId: string,
  drafts: PhotoDraftInput[],
  coverIndex: number,
): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, async () => {
    const keep = new Set(drafts.flatMap((d) => (d.id ? [d.id] : [])));
    const existing = await db.photos
      .where('listingId')
      .equals(listingId)
      .primaryKeys();
    await db.photos.bulkDelete(existing.filter((id) => !keep.has(id)));

    const t = now();
    const ids: string[] = [];
    for (const [order, d] of drafts.entries()) {
      if (d.id) {
        // update()/modify() deep-clone the record and turn ArrayBuffer into {}
        const existing = await db.photos.get(d.id);
        if (existing) await db.photos.put({ ...existing, order });
        ids.push(d.id);
      } else {
        const id = newId();
        await db.photos.add({
          id,
          listingId,
          data: d.data,
          type: d.type,
          order,
          createdAt: t,
        });
        ids.push(id);
      }
    }
    await db.listings.update(listingId, { coverPhotoId: ids[coverIndex] });
  });
}

export function listNotes(listingId: string): Promise<Note[]> {
  return db.notes.where('listingId').equals(listingId).sortBy('createdAt');
}

export async function addNote(
  listingId: string,
  text: string,
): Promise<string> {
  const id = newId();
  await db.notes.add({ id, listingId, text, createdAt: now() });
  return id;
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export interface DbSnapshot {
  listings: Listing[];
  photos: Photo[];
  notes: Note[];
}

export async function exportAll(): Promise<DbSnapshot> {
  const [listings, photos, notes] = await Promise.all([
    db.listings.toArray(),
    db.photos.toArray(),
    db.notes.toArray(),
  ]);
  return { listings, photos, notes };
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, db.notes, async () => {
    await Promise.all([
      db.listings.clear(),
      db.photos.clear(),
      db.notes.clear(),
    ]);
  });
}

export async function replaceAll(s: DbSnapshot): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, db.notes, async () => {
    await Promise.all([
      db.listings.clear(),
      db.photos.clear(),
      db.notes.clear(),
    ]);
    await db.listings.bulkAdd(s.listings);
    await db.photos.bulkAdd(s.photos);
    await db.notes.bulkAdd(s.notes);
  });
}
