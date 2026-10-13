import {
  Bytes,
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../db/schema';
import type { Photo } from '../domain/listing';
import { readStorage, writeStorage } from '../lib/storage';
import { dirtyIds, isDirty, markClean, markDirty } from './outbox';
import {
  setRemoteSink,
  TABLES,
  type TableName,
  type TableRecords,
} from './remote';

const MIGRATED_KEY = 'car-tracker:cloud-migrated';
const BATCH_SIZE = 400;
// Firestore caps a document at 1 MiB, field names and metadata included.
export const MAX_PHOTO_BYTES = 1_000_000;

type AnyRecord = TableRecords[TableName];

export function toDoc(table: TableName, record: AnyRecord): DocumentData {
  if (table !== 'photos') return record;
  const photo = record as Photo;
  return { ...photo, data: Bytes.fromUint8Array(new Uint8Array(photo.data)) };
}

export function fromDoc(table: TableName, data: DocumentData): AnyRecord {
  if (table !== 'photos') return data as AnyRecord;
  const bytes = (data.data as Bytes).toUint8Array();
  return {
    ...data,
    data: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
  } as Photo;
}

function chunks<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function writeRecords(
  fs: Firestore,
  table: TableName,
  records: AnyRecord[],
): Promise<void> {
  const ref = (id: string) => doc(fs, table, id);
  if (table === 'photos') {
    // One write per photo: a batch is capped at 10 MiB and fails as a whole.
    await Promise.all(
      (records as Photo[]).map((p) =>
        p.data.byteLength > MAX_PHOTO_BYTES
          ? Promise.reject(new Error(`Photo ${p.id} is too large to sync`))
          : setDoc(ref(p.id), toDoc(table, p)),
      ),
    );
    return;
  }
  await Promise.all(
    chunks(records).map((chunk) => {
      const batch = writeBatch(fs);
      chunk.forEach((r) => batch.set(ref(r.id), toDoc(table, r)));
      return batch.commit();
    }),
  );
}

async function deleteRecords(
  fs: Firestore,
  table: TableName,
  ids: string[],
): Promise<void> {
  await Promise.all(
    chunks(ids).map((chunk) => {
      const batch = writeBatch(fs);
      chunk.forEach((id) => batch.delete(doc(fs, table, id)));
      return batch.commit();
    }),
  );
}

function localTable(table: TableName) {
  return db.table<AnyRecord, string>(table);
}

// Re-sends every pending record as it is stored locally right now.
async function flush(fs: Firestore): Promise<void> {
  await Promise.all(
    TABLES.map(async (table) => {
      const ids = dirtyIds(table);
      if (!ids.length) return;
      const token = markDirty(table, ids);
      const found = await localTable(table).bulkGet(ids);
      const records = found.filter((r): r is AnyRecord => r !== undefined);
      const present = new Set(records.map((r) => r.id));
      await Promise.all([
        writeRecords(fs, table, records),
        deleteRecords(
          fs,
          table,
          ids.filter((id) => !present.has(id)),
        ),
      ]);
      markClean(table, ids, token);
    }),
  );
}

function listen(
  fs: Firestore,
  table: TableName,
  onError: (e: unknown) => void,
): Unsubscribe {
  const local = localTable(table);
  let reconciled = false;
  let queue = Promise.resolve();
  return onSnapshot(
    collection(fs, table),
    { includeMetadataChanges: true },
    (snap) => {
      const changes = snap.docChanges();
      const puts = changes
        .filter((c) => c.type !== 'removed')
        .map((c) => fromDoc(table, c.doc.data()));
      const removed = changes
        .filter((c) => c.type === 'removed')
        .map((c) => c.doc.id);
      // Only a server-confirmed snapshot can prove a local record was deleted
      // elsewhere; a cache snapshot may just be incomplete.
      const reconcile = !reconciled && !snap.metadata.fromCache;
      if (reconcile) reconciled = true;
      const remoteIds = reconcile ? new Set(snap.docs.map((d) => d.id)) : null;
      queue = queue
        .then(() =>
          db.transaction('rw', local, async () => {
            let dels = removed;
            if (remoteIds) {
              const localIds = await local.toCollection().primaryKeys();
              dels = [...dels, ...localIds.filter((id) => !remoteIds.has(id))];
            }
            // Unconfirmed local changes win over whatever the server has.
            const keep = (id: string) => !isDirty(table, id);
            await local.bulkPut(puts.filter((r) => keep(r.id)));
            await local.bulkDelete(dels.filter(keep));
          }),
        )
        .catch(onError);
    },
    onError,
  );
}

export function startSync(
  fs: Firestore,
  onError: (e: unknown) => void,
): () => void {
  const send = (table: TableName, ids: string[], write: Promise<void>) => {
    const token = markDirty(table, ids);
    write.then(() => markClean(table, ids, token)).catch(onError);
  };
  setRemoteSink({
    put: (table, records) =>
      send(
        table,
        records.map((r) => r.id),
        writeRecords(fs, table, records),
      ),
    remove: (table, ids) => send(table, ids, deleteRecords(fs, table, ids)),
  });

  let flushing: Promise<void> | null = null;
  const retry = () => {
    flushing ??= flush(fs)
      .catch(onError)
      .finally(() => (flushing = null));
  };

  let unsubs: Unsubscribe[] = [];
  let stopped = false;
  void (async () => {
    // First sign-in on this device: queue everything stored locally so it gets
    // uploaded and the (possibly empty) remote state cannot wipe it.
    if (!readStorage(MIGRATED_KEY)) {
      for (const table of TABLES) {
        markDirty(table, await localTable(table).toCollection().primaryKeys());
      }
      writeStorage(MIGRATED_KEY, '1');
    }
    if (stopped) return;
    unsubs = TABLES.map((t) => listen(fs, t, onError));
    retry();
  })().catch(onError);

  window.addEventListener('online', retry);
  return () => {
    stopped = true;
    window.removeEventListener('online', retry);
    unsubs.forEach((u) => u());
    setRemoteSink(null);
  };
}
