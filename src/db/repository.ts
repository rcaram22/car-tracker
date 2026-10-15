import {
  TRACKED_FIELDS,
  type Listing,
  type ListingEvent,
  type ListingInput,
  type Note,
  type Photo,
} from '../domain/listing';
import { SEED_JOBS, sortJobs, type Job } from '../domain/jobs';
import { pushPut, pushRemove, TABLES } from '../sync/remote';
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
  const listing = { ...input, id, createdAt: t, updatedAt: t };
  await db.listings.add(listing);
  pushPut('listings', [listing]);
  return id;
}

export async function updateListing(
  id: string,
  patch: Partial<ListingInput>,
): Promise<void> {
  let events: ListingEvent[] = [];
  await db.transaction('rw', db.listings, db.events, async () => {
    const current = await db.listings.get(id);
    if (!current) return;
    const at = now();
    events = TRACKED_FIELDS.filter(
      (field) => field in patch && patch[field] !== current[field],
    ).map((field) => ({
      id: newId(),
      listingId: id,
      field,
      from: current[field],
      to: patch[field],
      at,
    }));
    await db.listings.update(id, { ...patch, updatedAt: at });
    await db.events.bulkAdd(events);
  });
  const updated = await db.listings.get(id);
  if (updated) pushPut('listings', [updated]);
  pushPut('events', events);
}

export async function deleteListing(id: string): Promise<void> {
  const children = [db.photos, db.notes, db.events] as const;
  const childIds = await db.transaction(
    'rw',
    [db.listings, ...children],
    async () => {
      const ids = await Promise.all(
        children.map((t) => t.where('listingId').equals(id).primaryKeys()),
      );
      await Promise.all(children.map((t, i) => t.bulkDelete(ids[i])));
      await db.listings.delete(id);
      return ids;
    },
  );
  pushRemove('photos', childIds[0]);
  pushRemove('notes', childIds[1]);
  pushRemove('events', childIds[2]);
  pushRemove('listings', [id]);
}

export function listPhotos(listingId: string): Promise<Photo[]> {
  return db.photos.where('listingId').equals(listingId).sortBy('order');
}

export function countPhotos(listingId: string): Promise<number> {
  return db.photos.where('listingId').equals(listingId).count();
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
  const removed: string[] = [];
  const saved: Photo[] = [];
  await db.transaction('rw', db.listings, db.photos, async () => {
    const keep = new Set(drafts.flatMap((d) => (d.id ? [d.id] : [])));
    const existing = await db.photos
      .where('listingId')
      .equals(listingId)
      .primaryKeys();
    removed.push(...existing.filter((id) => !keep.has(id)));
    await db.photos.bulkDelete(removed);

    const t = now();
    const ids: string[] = [];
    for (const [order, d] of drafts.entries()) {
      if (d.id) {
        // update()/modify() deep-clone the record and turn ArrayBuffer into {}
        const existing = await db.photos.get(d.id);
        if (existing && existing.order !== order) {
          const photo = { ...existing, order };
          await db.photos.put(photo);
          saved.push(photo);
        }
        ids.push(d.id);
      } else {
        const photo: Photo = {
          id: newId(),
          listingId,
          data: d.data,
          type: d.type,
          order,
          createdAt: t,
        };
        await db.photos.add(photo);
        saved.push(photo);
        ids.push(photo.id);
      }
    }
    await db.listings.update(listingId, { coverPhotoId: ids[coverIndex] });
  });
  pushRemove('photos', removed);
  pushPut('photos', saved);
  const listing = await db.listings.get(listingId);
  if (listing) pushPut('listings', [listing]);
}

export function listNotes(listingId: string): Promise<Note[]> {
  return db.notes.where('listingId').equals(listingId).sortBy('createdAt');
}

export function listAllNotes(): Promise<Note[]> {
  return db.notes.toArray();
}

export async function addNote(
  listingId: string,
  text: string,
): Promise<string> {
  const note = { id: newId(), listingId, text, createdAt: now() };
  await db.notes.add(note);
  pushPut('notes', [note]);
  return note.id;
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
  pushRemove('notes', [id]);
}

export function listEvents(listingId: string): Promise<ListingEvent[]> {
  return db.events.where('listingId').equals(listingId).reverse().sortBy('at');
}

export async function deleteEvent(id: string): Promise<void> {
  await db.events.delete(id);
  pushRemove('events', [id]);
}

export async function listJobs(): Promise<Job[]> {
  return sortJobs(await db.jobs.toArray());
}

export async function seedJobs(): Promise<void> {
  const existing = await db.jobs.bulkGet(SEED_JOBS.map((j) => j.id));
  const t = now();
  const missing = SEED_JOBS.flatMap((j, i) =>
    existing[i] ? [] : [{ ...j, createdAt: t + i }],
  );
  await db.jobs.bulkAdd(missing);
  pushPut('jobs', missing);
}

export async function addJob(): Promise<string> {
  const job: Job = {
    id: newId(),
    description: 'Nuevo trabajo',
    priority: 'medium',
    createdAt: now(),
  };
  await db.jobs.add(job);
  pushPut('jobs', [job]);
  return job.id;
}

export async function updateJob(
  id: string,
  patch: Partial<Omit<Job, 'id' | 'createdAt'>>,
): Promise<void> {
  const current = await db.jobs.get(id);
  if (!current) return;
  const job = { ...current, ...patch };
  await db.jobs.put(job);
  pushPut('jobs', [job]);
}

export async function deleteJob(id: string): Promise<void> {
  await db.jobs.delete(id);
  pushRemove('jobs', [id]);
}

export interface DbSnapshot {
  listings: Listing[];
  photos: Photo[];
  notes: Note[];
  events: ListingEvent[];
  jobs: Job[];
}

export async function exportAll(): Promise<DbSnapshot> {
  const [listings, photos, notes, events, jobs] = await Promise.all([
    db.listings.toArray(),
    db.photos.toArray(),
    db.notes.toArray(),
    db.events.toArray(),
    db.jobs.toArray(),
  ]);
  return { listings, photos, notes, events, jobs };
}

export async function clearAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.listings, db.photos, db.notes, db.events, db.jobs],
    async () => {
      await Promise.all([
        db.listings.clear(),
        db.photos.clear(),
        db.notes.clear(),
        db.events.clear(),
        db.jobs.clear(),
      ]);
    },
  );
}

export async function replaceAll(s: DbSnapshot): Promise<void> {
  const before = await Promise.all(
    TABLES.map((t) =>
      db.table<unknown, string>(t).toCollection().primaryKeys(),
    ),
  );
  await db.transaction(
    'rw',
    [db.listings, db.photos, db.notes, db.events, db.jobs],
    async () => {
      await Promise.all([
        db.listings.clear(),
        db.photos.clear(),
        db.notes.clear(),
        db.events.clear(),
        db.jobs.clear(),
      ]);
      await db.listings.bulkAdd(s.listings);
      await db.photos.bulkAdd(s.photos);
      await db.notes.bulkAdd(s.notes);
      await db.events.bulkAdd(s.events);
      await db.jobs.bulkAdd(s.jobs);
    },
  );

  TABLES.forEach((table, i) => {
    const keep = new Set(s[table].map((r) => r.id));
    pushRemove(
      table,
      before[i].filter((id) => !keep.has(id)),
    );
    pushPut(table, s[table]);
  });
}
