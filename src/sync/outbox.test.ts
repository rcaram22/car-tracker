import { beforeEach, describe, expect, it } from 'vitest';
import {
  dirtyIds,
  isDirty,
  markClean,
  markDirty,
  resetOutboxForTests,
} from './outbox';

beforeEach(() => resetOutboxForTests());

describe('outbox', () => {
  it('tracks dirty records per table until confirmed', () => {
    const token = markDirty('listings', ['a', 'b']);
    markDirty('notes', ['a']);
    expect(dirtyIds('listings')).toEqual(['a', 'b']);
    markClean('listings', ['a'], token);
    expect(isDirty('listings', 'a')).toBe(false);
    expect(isDirty('listings', 'b')).toBe(true);
    expect(isDirty('notes', 'a')).toBe(true);
  });

  it('keeps a record dirty when an older write confirms after a newer one', () => {
    const first = markDirty('listings', ['a']);
    const second = markDirty('listings', ['a']);
    markClean('listings', ['a'], first);
    expect(isDirty('listings', 'a')).toBe(true);
    markClean('listings', ['a'], second);
    expect(isDirty('listings', 'a')).toBe(false);
  });

  it('survives a reload', () => {
    markDirty('photos', ['p']);
    resetOutboxForTests();
    expect(dirtyIds('photos')).toEqual(['p']);
  });
});
