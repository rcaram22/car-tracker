import { readStorage, writeStorage } from '../lib/storage';
import type { TableName } from './remote';

// Records changed locally that Firestore has not confirmed yet. Survives
// reloads so rejected or interrupted writes get retried, and remote snapshots
// never overwrite or delete them in the meantime.
const KEY = 'car-tracker:outbox';

let dirty: Set<string> | null = null;
const latest = new Map<string, number>();
let seq = 0;

const keyOf = (table: TableName, id: string) => `${table}:${id}`;

function entries(): Set<string> {
  if (!dirty) {
    try {
      dirty = new Set(JSON.parse(readStorage(KEY) ?? '[]') as string[]);
    } catch {
      dirty = new Set();
    }
  }
  return dirty;
}

function save() {
  writeStorage(KEY, JSON.stringify([...entries()]));
}

export function markDirty(table: TableName, ids: string[]): number {
  const token = ++seq;
  ids.forEach((id) => {
    entries().add(keyOf(table, id));
    latest.set(keyOf(table, id), token);
  });
  save();
  return token;
}

// Only the most recent write for a record may clear it: an older write
// finishing late must not hide a newer one that is still pending.
export function markClean(table: TableName, ids: string[], token: number) {
  ids.forEach((id) => {
    const key = keyOf(table, id);
    if (latest.get(key) !== token) return;
    entries().delete(key);
    latest.delete(key);
  });
  save();
}

export function isDirty(table: TableName, id: string): boolean {
  return entries().has(keyOf(table, id));
}

export function dirtyIds(table: TableName): string[] {
  const prefix = `${table}:`;
  return [...entries()]
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}

export function resetOutboxForTests() {
  dirty = null;
  latest.clear();
}
