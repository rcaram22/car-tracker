import { describe, expect, it } from 'vitest';
import {
  EMPTY_DRAFTS,
  addDrafts,
  coverIndex,
  moveDraft,
  removeDraft,
  setCoverDraft,
  type PhotoDraft,
} from './photoDrafts';

const d = (key: string): PhotoDraft => ({
  key,
  data: new ArrayBuffer(1),
  type: 'image/jpeg',
});
const keys = (s: { items: PhotoDraft[] }) => s.items.map((i) => i.key);

describe('photo drafts', () => {
  it('first added photo becomes the cover', () => {
    const s = addDrafts(EMPTY_DRAFTS, [d('a'), d('b')]);
    expect(s.coverKey).toBe('a');
    expect(coverIndex(s)).toBe(0);
    expect(addDrafts(s, [d('c')]).coverKey).toBe('a');
  });

  it('removing the cover moves it to the next photo', () => {
    const s = addDrafts(EMPTY_DRAFTS, [d('a'), d('b'), d('c')]);
    const r = removeDraft(s, 'a');
    expect(keys(r)).toEqual(['b', 'c']);
    expect(r.coverKey).toBe('b');
  });

  it('removing the last photo when it is the cover moves cover back', () => {
    const s = setCoverDraft(addDrafts(EMPTY_DRAFTS, [d('a'), d('b')]), 'b');
    expect(removeDraft(s, 'b').coverKey).toBe('a');
  });

  it('removing every photo leaves no cover', () => {
    const s = removeDraft(addDrafts(EMPTY_DRAFTS, [d('a')]), 'a');
    expect(s.coverKey).toBeUndefined();
    expect(coverIndex(s)).toBe(-1);
  });

  it('moves photos and ignores out-of-range moves', () => {
    const s = addDrafts(EMPTY_DRAFTS, [d('a'), d('b'), d('c')]);
    expect(keys(moveDraft(s, 'c', -1))).toEqual(['a', 'c', 'b']);
    expect(keys(moveDraft(s, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(keys(moveDraft(s, 'c', 1))).toEqual(['a', 'b', 'c']);
  });
});
