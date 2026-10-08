import { inputCls } from '../../components/ui';
import { parseNumberInput } from '../../domain/format';
import {
  LISTING_STATUSES,
  STATUS_LABELS,
  type ListingStatus,
} from '../../domain/listing';
import {
  SORT_FIELDS,
  SORT_LABELS,
  type Filters,
  type SortField,
  type SortState,
} from '../../domain/sortFilter';

interface Props {
  filters: Filters;
  sort: SortState;
  onFilters: (f: Filters) => void;
  onSort: (s: SortState) => void;
}

export function FiltersBar({ filters, sort, onFilters, onSort }: Props) {
  const toggleStatus = (s: ListingStatus) =>
    onFilters({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : LISTING_STATUSES.filter(
            (x) => x === s || filters.statuses.includes(x),
          ),
    });

  const small = `${inputCls} !py-1`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg bg-white p-3 text-sm shadow-sm">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Estado</legend>
        {LISTING_STATUSES.map((s) => {
          const on = filters.statuses.includes(s);
          return (
            <label
              key={s}
              className={`cursor-pointer rounded-full border px-2.5 py-1 ${
                on
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-500'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => toggleStatus(s)}
              />
              {STATUS_LABELS[s]}
            </label>
          );
        })}
      </fieldset>

      <label className="flex items-center gap-1.5">
        Estrellas
        <select
          value={filters.minRating ?? ''}
          onChange={(e) =>
            onFilters({
              ...filters,
              minRating: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className={`${small} !w-auto`}
        >
          <option value="">Cualquiera</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}+
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        Precio
        <input
          aria-label="Precio mínimo"
          inputMode="numeric"
          placeholder="desde"
          value={filters.minPrice ?? ''}
          onChange={(e) =>
            onFilters({ ...filters, minPrice: parseNumberInput(e.target.value) })
          }
          className={`${small} !w-24`}
        />
        <input
          aria-label="Precio máximo"
          inputMode="numeric"
          placeholder="hasta"
          value={filters.maxPrice ?? ''}
          onChange={(e) =>
            onFilters({ ...filters, maxPrice: parseNumberInput(e.target.value) })
          }
          className={`${small} !w-24`}
        />
      </div>

      <label className="flex items-center gap-1.5 sm:ml-auto">
        Ordenar por
        <select
          value={sort.field}
          onChange={(e) =>
            onSort({ ...sort, field: e.target.value as SortField })
          }
          className={`${small} !w-auto`}
        >
          {SORT_FIELDS.map((f) => (
            <option key={f} value={f}>
              {SORT_LABELS[f]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={
            sort.dir === 'asc' ? 'Orden ascendente' : 'Orden descendente'
          }
          onClick={() =>
            onSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
          }
          className="rounded border border-gray-300 px-2 py-1"
        >
          {sort.dir === 'asc' ? '↑' : '↓'}
        </button>
      </label>
    </div>
  );
}
