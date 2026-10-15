import { listingTotal, normalizeText } from './format';
import {
  DEFAULT_VISIBLE_STATUSES,
  LISTING_STATUSES,
  type Listing,
  type ListingStatus,
} from './listing';

export const SORT_FIELDS = [
  'model',
  'color',
  'year',
  'km',
  'price',
  'extraCost',
  'total',
  'condition',
  'rating',
  'status',
  'updatedAt',
] as const;

export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_LABELS: Record<SortField, string> = {
  model: 'Modelo',
  color: 'Color',
  year: 'Año',
  km: 'Km',
  price: 'Precio',
  extraCost: 'Puesta a punto',
  total: 'Total',
  condition: 'Condición',
  rating: 'Puntaje',
  status: 'Estado',
  updatedAt: 'Actualizado',
};

export interface SortState {
  field: SortField;
  dir: 'asc' | 'desc';
}

export const DEFAULT_SORT: SortState = { field: 'updatedAt', dir: 'desc' };

export interface Filters {
  q: string;
  statuses: ListingStatus[];
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  statuses: DEFAULT_VISIBLE_STATUSES,
};

function searchableText(l: Listing, notes?: string): string {
  return normalizeText(
    [l.model, l.color, l.condition, l.year, l.description, notes]
      .filter((v) => v !== undefined)
      .join(' '),
  );
}

export function filterListings(
  listings: Listing[],
  f: Filters,
  notesByListing: Record<string, string> = {},
): Listing[] {
  const words = normalizeText(f.q).split(/\s+/).filter(Boolean);
  return listings.filter(
    (l) =>
      f.statuses.includes(l.status) &&
      (f.minRating === undefined || (l.rating ?? 0) >= f.minRating) &&
      (f.minPrice === undefined ||
        (l.price !== undefined && l.price >= f.minPrice)) &&
      (f.maxPrice === undefined ||
        (l.price !== undefined && l.price <= f.maxPrice)) &&
      (words.length === 0 ||
        ((text) => words.every((w) => text.includes(w)))(
          searchableText(l, notesByListing[l.id]),
        )),
  );
}

type SortValue = string | number | undefined;

export function compareEmptiesLast(
  a: SortValue,
  b: SortValue,
  dir: SortState['dir'],
): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const c =
    typeof a === 'string' && typeof b === 'string'
      ? a.localeCompare(b, 'es', { sensitivity: 'base' })
      : Number(a) - Number(b);
  return dir === 'asc' ? c : -c;
}

function sortValue(l: Listing, field: SortField): SortValue {
  if (field === 'status') return LISTING_STATUSES.indexOf(l.status);
  if (field === 'total') return listingTotal(l);
  const v = l[field];
  return v === '' ? undefined : v;
}

export function sortListings(listings: Listing[], sort: SortState): Listing[] {
  return [...listings].sort((a, b) =>
    compareEmptiesLast(
      sortValue(a, sort.field),
      sortValue(b, sort.field),
      sort.dir,
    ),
  );
}
