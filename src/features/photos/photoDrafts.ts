import type { Photo } from '../../domain/listing';

export interface PhotoDraft {
  key: string;
  id?: string;
  data: ArrayBuffer;
  type: string;
}

export interface PhotoDraftState {
  items: PhotoDraft[];
  coverKey?: string;
}

export const EMPTY_DRAFTS: PhotoDraftState = { items: [] };

export function addDrafts(
  s: PhotoDraftState,
  added: PhotoDraft[],
): PhotoDraftState {
  const items = [...s.items, ...added];
  return { items, coverKey: s.coverKey ?? items[0]?.key };
}

export function removeDraft(s: PhotoDraftState, key: string): PhotoDraftState {
  const idx = s.items.findIndex((i) => i.key === key);
  const items = s.items.filter((i) => i.key !== key);
  const coverKey =
    s.coverKey === key ? (items[idx] ?? items[idx - 1])?.key : s.coverKey;
  return { items, coverKey };
}

export function moveDraft(
  s: PhotoDraftState,
  key: string,
  delta: -1 | 1,
): PhotoDraftState {
  const from = s.items.findIndex((i) => i.key === key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= s.items.length) return s;
  const items = [...s.items];
  [items[from], items[to]] = [items[to], items[from]];
  return { ...s, items };
}

export function setCoverDraft(
  s: PhotoDraftState,
  key: string,
): PhotoDraftState {
  return { ...s, coverKey: key };
}

export function coverIndex(s: PhotoDraftState): number {
  return s.items.findIndex((i) => i.key === s.coverKey);
}

export function draftsFromPhotos(
  photos: Photo[],
  coverPhotoId?: string,
): PhotoDraftState {
  return {
    items: photos.map((p) => ({
      key: p.id,
      id: p.id,
      data: p.data,
      type: p.type,
    })),
    coverKey: coverPhotoId ?? photos[0]?.id,
  };
}
