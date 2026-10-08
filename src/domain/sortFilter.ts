import { normalizeText } from './format';
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
  condition: 'Condición',
  rating: 'Estrellas',
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

export function filterListings(listings: Listing[], f: Filters): Listing[] {
  const q = normalizeText(f.q);
  return listings.filter(
    (l) =>
      f.statuses.includes(l.status) &&
      (f.minRating === undefined || (l.rating ?? 0) >= f.minRating) &&
      (f.minPrice === undefined ||
        (l.price !== undefined && l.price >= f.minPrice)) &&
      (f.maxPrice === undefined ||
        (l.price !== undefined && l.price <= f.maxPrice)) &&
      (q === '' ||
        [l.model, l.color, l.condition].some(
          (v) => v !== undefined && normalizeText(v).includes(q),
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
