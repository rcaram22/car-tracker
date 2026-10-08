import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, DEFAULT_SORT } from '../../domain/sortFilter';
import { parseHomeParams, toHomeParams } from './homeState';

describe('home URL state', () => {
  it('parses empty params to defaults', () => {
    expect(parseHomeParams(new URLSearchParams())).toEqual({
      view: 'grid',
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
    });
  });

  it('serializes defaults to empty params', () => {
    expect(
      toHomeParams({
        view: 'grid',
        filters: DEFAULT_FILTERS,
        sort: DEFAULT_SORT,
      }).toString(),
    ).toBe('');
  });

  it('round-trips a custom state', () => {
    const state = {
      view: 'table' as const,
      filters: {
        q: 'gris',
        statuses: ['new' as const, 'sold' as const],
        minRating: 3,
        minPrice: 8000,
        maxPrice: 10000,
      },
      sort: { field: 'price' as const, dir: 'asc' as const },
    };
    expect(parseHomeParams(toHomeParams(state))).toEqual(state);
  });

  it('ignores unknown statuses and sort fields', () => {
    const s = parseHomeParams(
      new URLSearchParams('status=new,bogus&sort=nope'),
    );
    expect(s.filters.statuses).toEqual(['new']);
    expect(s.sort).toEqual(DEFAULT_SORT);
  });

  it('keeps an explicitly empty status list', () => {
    expect(
      parseHomeParams(new URLSearchParams('status=')).filters.statuses,
    ).toEqual([]);
  });
});
