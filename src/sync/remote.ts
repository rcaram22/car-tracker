import type { Listing, ListingEvent, Note, Photo } from '../domain/listing';

export interface TableRecords {
  listings: Listing;
  photos: Photo;
  notes: Note;
  events: ListingEvent;
}

export type TableName = keyof TableRecords;

export const TABLES: TableName[] = ['listings', 'photos', 'notes', 'events'];

export interface RemoteSink {
  put<T extends TableName>(table: T, records: TableRecords[T][]): void;
  remove(table: TableName, ids: string[]): void;
}

let sink: RemoteSink | null = null;

export function setRemoteSink(next: RemoteSink | null): void {
  sink = next;
}

export function pushPut<T extends TableName>(
  table: T,
  records: TableRecords[T][],
): void {
  if (records.length) sink?.put(table, records);
}

export function pushRemove(table: TableName, ids: string[]): void {
  if (ids.length) sink?.remove(table, ids);
}
