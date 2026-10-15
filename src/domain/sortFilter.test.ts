import { describe, expect, it } from 'vitest';
import type { Listing } from './listing';
import {
  DEFAULT_FILTERS,
  compareEmptiesLast,
  filterListings,
  sortListings,
} from './sortFilter';

let seq = 0;
const make = (p: Partial<Listing>): Listing => ({
  id: String(++seq),
  model: 'Golf Mk4 2.0',
  status: 'new',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('filterListings', () => {
  it('hides discarded and sold by default', () => {
    const ls = [
      make({ status: 'new' }),
      make({ status: 'contacted' }),
      make({ status: 'seen' }),
      make({ status: 'discarded' }),
      make({ status: 'sold' }),
    ];
    expect(filterListings(ls, DEFAULT_FILTERS).map((l) => l.status)).toEqual([
      'new',
      'contacted',
      'seen',
    ]);
  });

  it('searches model, color and condition ignoring accents and case', () => {
    const a = make({ color: 'Gris claro' });
    const b = make({ condition: 'Interior OK. Razonable' });
    const c = make({ model: 'Golf Mk4 1.6' });
    const f = { ...DEFAULT_FILTERS };
    expect(filterListings([a, b, c], { ...f, q: 'GRIS' })).toEqual([a]);
    expect(filterListings([a, b, c], { ...f, q: 'razonáble' })).toEqual([b]);
    expect(filterListings([a, b, c], { ...f, q: '1.6' })).toEqual([c]);
  });

  it('searches the pasted description and the year', () => {
    const a = make({ description: 'Tiene INTAKE de alto flujo' });
    const b = make({ year: 2005 });
    const f = { ...DEFAULT_FILTERS };
    expect(filterListings([a, b], { ...f, q: 'intake' })).toEqual([a]);
    expect(filterListings([a, b], { ...f, q: '2005' })).toEqual([b]);
  });

  it('searches notes passed per listing', () => {
    const a = make({});
    const b = make({});
    const notes = { [b.id]: 'Escape deportivo, ruidoso' };
    expect(
      filterListings([a, b], { ...DEFAULT_FILTERS, q: 'escape' }, notes),
    ).toEqual([b]);
  });

  it('requires every word, across different fields', () => {
    const a = make({ description: 'Escape nuevo' });
    const b = make({ description: 'Escape nuevo e intake' });
    const c = make({ color: 'Azul' });
    const notes = { [c.id]: 'cambiar escape' };
    const f = { ...DEFAULT_FILTERS };
    expect(filterListings([a, b, c], { ...f, q: 'escape intake' }, notes)).toEqual([b]);
    expect(filterListings([a, b, c], { ...f, q: 'azul escape' }, notes)).toEqual([c]);
    expect(filterListings([a, b, c], { ...f, q: 'turbo' }, notes)).toEqual([]);
  });

  it('filters by min rating and price range, excluding unknown prices', () => {
    const cheap = make({ price: 7500, rating: 2 });
    const mid = make({ price: 9000, rating: 4 });
    const noPrice = make({ rating: 5 });
    const f = { ...DEFAULT_FILTERS };
    expect(
      filterListings([cheap, mid, noPrice], { ...f, minRating: 4 }),
    ).toEqual([mid, noPrice]);
    expect(
      filterListings([cheap, mid, noPrice], {
        ...f,
        minPrice: 8000,
        maxPrice: 9500,
      }),
    ).toEqual([mid]);
  });
});

describe('sorting', () => {
  it('compareEmptiesLast keeps undefined last in both directions', () => {
    const vals = [3, undefined, 1, 2];
    expect([...vals].sort((a, b) => compareEmptiesLast(a, b, 'asc'))).toEqual(
      [1, 2, 3, undefined],
    );
    expect(
      [...vals].sort((a, b) => compareEmptiesLast(a, b, 'desc')),
    ).toEqual([3, 2, 1, undefined]);
  });

  it('sorts strings with spanish collation', () => {
    const ls = [make({ color: 'verde' }), make({ color: 'Azul' }), make({})];
    expect(
      sortListings(ls, { field: 'color', dir: 'asc' }).map((l) => l.color),
    ).toEqual(['Azul', 'verde', undefined]);
  });

  it('sorts by total, with unknown prices last', () => {
    const ls = [
      make({ price: 9000, extraCost: 2000 }),
      make({ extraCost: 500 }),
      make({ price: 10500 }),
    ];
    expect(
      sortListings(ls, { field: 'total', dir: 'desc' }).map((l) => [
        l.price,
        l.extraCost,
      ]),
    ).toEqual([
      [9000, 2000],
      [10500, undefined],
      [undefined, 500],
    ]);
  });

  it('sorts status by pipeline order', () => {
    const ls = [
      make({ status: 'sold' }),
      make({ status: 'new' }),
      make({ status: 'seen' }),
    ];
    expect(
      sortListings(ls, { field: 'status', dir: 'asc' }).map((l) => l.status),
    ).toEqual(['new', 'seen', 'sold']);
  });
});
