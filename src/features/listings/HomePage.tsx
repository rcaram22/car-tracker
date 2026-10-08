import { useMemo } from 'react';
import { Link } from 'react-router';
import { btnPrimary, inputCls } from '../../components/ui';
import { useListings } from '../../db/hooks';
import { filterListings, sortListings } from '../../domain/sortFilter';
import { BackupMenu } from '../backup/BackupMenu';
import { BackupNudge } from '../backup/BackupNudge';
import { FiltersBar } from './FiltersBar';
import { useHomeState, type ViewMode } from './homeState';
import { ListingGrid } from './ListingGrid';
import { ListingTable } from './ListingTable';

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: 'grid', label: 'Grilla' },
  { mode: 'table', label: 'Tabla' },
];

export function HomePage() {
  const listings = useListings();
  const [state, update] = useHomeState();

  const visible = useMemo(
    () =>
      listings
        ? sortListings(filterListings(listings, state.filters), state.sort)
        : [],
    [listings, state.filters, state.sort],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">Autos</h1>
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar modelo, color, condición…"
          value={state.filters.q}
          onChange={(e) =>
            update({ filters: { ...state.filters, q: e.target.value } })
          }
          className={`${inputCls} sm:!w-72`}
        />
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
          {VIEWS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={state.view === mode}
              onClick={() => update({ view: mode })}
              className={`px-3 py-2 text-sm ${
                state.view === mode
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to="/listings/new" className={btnPrimary}>
          + Nueva
        </Link>
        <BackupMenu />
      </header>

      <BackupNudge hasListings={!!listings?.length} />

      <FiltersBar
        filters={state.filters}
        sort={state.sort}
        onFilters={(filters) => update({ filters })}
        onSort={(sort) => update({ sort })}
      />

      {listings === undefined ? (
        <p className="text-gray-500">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-white p-8 text-center text-gray-500">
          {listings.length === 0
            ? 'Todavía no cargaste ninguna publicación.'
            : 'Ninguna publicación coincide con los filtros.'}
        </p>
      ) : state.view === 'grid' ? (
        <ListingGrid listings={visible} />
      ) : (
        <ListingTable
          listings={visible}
          sort={state.sort}
          onSort={(sort) => update({ sort })}
        />
      )}

      <p className="text-sm text-gray-500">
        {visible.length} de {listings?.length ?? 0}
      </p>
    </div>
  );
}
