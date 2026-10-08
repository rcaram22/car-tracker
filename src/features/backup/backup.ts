import { exportAll, replaceAll, type DbSnapshot } from '../../db/repository';
import {
  TRACKED_FIELDS,
  isListingStatus,
  type Listing,
  type ListingEvent,
  type Note,
  type Photo,
  type TrackedField,
} from '../../domain/listing';
import { readStorage, writeStorage } from '../../lib/storage';

export const BACKUP_VERSION = 2;
export const EXPORTED_EVENT = 'car-tracker:exported';
export const NUDGE_AFTER_DAYS = 14;
const LAST_EXPORT_KEY = 'car-tracker:lastExportAt';
const DAY_MS = 86_400_000;

type BackupPhoto = Omit<Photo, 'data'> & { data: string };

export interface BackupFile {
  app: 'car-tracker';
  version: number;
  exportedAt: number;
  listings: Listing[];
  notes: Note[];
  photos: BackupPhoto[];
  events: ListingEvent[];
}

export class BackupError extends Error {}

export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function toBackup(s: DbSnapshot, exportedAt = Date.now()): BackupFile {
  return {
    app: 'car-tracker',
    version: BACKUP_VERSION,
    exportedAt,
    listings: s.listings,
    notes: s.notes,
    photos: s.photos.map((p) => ({ ...p, data: bufferToBase64(p.data) })),
    events: s.events,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasStrings = (v: unknown, keys: string[]) =>
  isRecord(v) && keys.every((k) => typeof v[k] === 'string');

export function fromBackup(raw: unknown): DbSnapshot {
  if (!isRecord(raw) || raw.app !== 'car-tracker') {
    throw new BackupError('El archivo no es un backup de Car Tracker.');
  }
  if (raw.version !== 1 && raw.version !== BACKUP_VERSION) {
    throw new BackupError(
      `Versión de backup no soportada: ${String(raw.version)}.`,
    );
  }
  const { listings, notes, photos } = raw;
  const events = raw.version === 1 ? [] : raw.events;
  if (
    !Array.isArray(listings) ||
    !Array.isArray(notes) ||
    !Array.isArray(photos) ||
    !Array.isArray(events)
  ) {
    throw new BackupError('El backup está incompleto.');
  }
  if (
    !listings.every(
      (l) =>
        hasStrings(l, ['id', 'model']) && isListingStatus((l as Listing).status),
    ) ||
    !notes.every((n) => hasStrings(n, ['id', 'listingId', 'text'])) ||
    !photos.every((p) => hasStrings(p, ['id', 'listingId', 'type', 'data'])) ||
    !events.every(
      (e) =>
        hasStrings(e, ['id', 'listingId']) &&
        TRACKED_FIELDS.includes((e as ListingEvent).field as TrackedField) &&
        typeof (e as ListingEvent).at === 'number',
    )
  ) {
    throw new BackupError('El backup tiene datos inválidos.');
  }
  try {
    return {
      listings: listings as Listing[],
      notes: notes as Note[],
      events: events as ListingEvent[],
      photos: (photos as BackupPhoto[]).map((p) => ({
        ...p,
        data: base64ToBuffer(p.data),
      })),
    };
  } catch {
    throw new BackupError('El backup tiene fotos dañadas.');
  }
}

export async function importBackupText(
  text: string,
  confirm: () => boolean,
): Promise<'imported' | 'cancelled'> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es un JSON válido.');
  }
  const snapshot = fromBackup(raw);
  if (!confirm()) return 'cancelled';
  await replaceAll(snapshot);
  return 'imported';
}

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportBackup(): Promise<void> {
  const file = toBackup(await exportAll());
  const date = new Date().toLocaleDateString('sv-SE');
  downloadJson(file, `car-tracker-${date}.json`);
  writeStorage(LAST_EXPORT_KEY, String(file.exportedAt));
  window.dispatchEvent(new Event(EXPORTED_EVENT));
}

export function getLastExportAt(): number | undefined {
  const v = Number(readStorage(LAST_EXPORT_KEY));
  return v > 0 ? v : undefined;
}

export function shouldNudge(lastExportAt: number | undefined, now: number) {
  return (
    lastExportAt === undefined || now - lastExportAt > NUDGE_AFTER_DAYS * DAY_MS
  );
}
