import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { parseNumberInput } from '../../domain/format';
import {
  DEFAULT_VISIBLE_STATUSES,
  isListingStatus,
} from '../../domain/listing';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  SORT_FIELDS,
  type Filters,
  type SortField,
  type SortState,
} from '../../domain/sortFilter';
import { readStorage, writeStorage } from '../../lib/storage';

export type ViewMode = 'grid' | 'table';

export interface HomeState {
  view: ViewMode;
  filters: Filters;
  sort: SortState;
}

const STORAGE_KEY = 'car-tracker:home';

const num = (p: URLSearchParams, key: string) =>
  parseNumberInput(p.get(key) ?? undefined);

export function parseHomeParams(p: URLSearchParams): HomeState {
  const status = p.get('status');
  const field = p.get('sort');
  const filters: Filters = {
    q: p.get('q') ?? DEFAULT_FILTERS.q,
    statuses:
      status === null
        ? DEFAULT_VISIBLE_STATUSES
        : status.split(',').filter(isListingStatus),
  };
  const minRating = num(p, 'minRating');
  const minPrice = num(p, 'minPrice');
  const maxPrice = num(p, 'maxPrice');
  if (minRating !== undefined) filters.minRating = minRating;
  if (minPrice !== undefined) filters.minPrice = minPrice;
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;

  return {
    view: p.get('view') === 'table' ? 'table' : 'grid',
    filters,
    sort: SORT_FIELDS.includes(field as SortField)
      ? {
          field: field as SortField,
          dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
        }
      : DEFAULT_SORT,
  };
}

export function toHomeParams(s: HomeState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.view !== 'grid') p.set('view', s.view);
  if (s.filters.q) p.set('q', s.filters.q);
  if (s.filters.statuses.join(',') !== DEFAULT_VISIBLE_STATUSES.join(',')) {
    p.set('status', s.filters.statuses.join(','));
  }
  if (s.filters.minRating !== undefined) {
    p.set('minRating', String(s.filters.minRating));
  }
  if (s.filters.minPrice !== undefined) {
    p.set('minPrice', String(s.filters.minPrice));
  }
  if (s.filters.maxPrice !== undefined) {
    p.set('maxPrice', String(s.filters.maxPrice));
  }
  if (s.sort.field !== DEFAULT_SORT.field || s.sort.dir !== DEFAULT_SORT.dir) {
    p.set('sort', s.sort.field);
    p.set('dir', s.sort.dir);
  }
  return p;
}

export function useHomeState() {
  const [params, setParams] = useSearchParams();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (params.toString()) return;
    const saved = readStorage(STORAGE_KEY);
    if (saved) setParams(new URLSearchParams(saved), { replace: true });
  }, [params, setParams]);

  const state = useMemo(() => parseHomeParams(params), [params]);

  const update = useCallback(
    (patch: Partial<HomeState>) => {
      const next = toHomeParams({ ...state, ...patch });
      writeStorage(STORAGE_KEY, next.toString());
      setParams(next, { replace: true });
    },
    [state, setParams],
  );

  return [state, update] as const;
}
