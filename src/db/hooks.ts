import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from './repository';

export function useListings() {
  return useLiveQuery(() => repo.listListings(), []);
}

export function useListing(id: string) {
  return useLiveQuery(async () => (await repo.getListing(id)) ?? null, [id]);
}

export function usePhotos(listingId: string) {
  return useLiveQuery(() => repo.listPhotos(listingId), [listingId]);
}

export function usePhoto(id?: string) {
  return useLiveQuery(() => (id ? repo.getPhoto(id) : undefined), [id]);
}

export function useNotes(listingId: string) {
  return useLiveQuery(() => repo.listNotes(listingId), [listingId]);
}
