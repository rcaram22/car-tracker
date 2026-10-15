import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { ScoreBadge } from '../../components/ScoreBadge';
import { StatusBadge } from '../../components/Status';
import {
  MISSING,
  formatDate,
  formatKm,
  formatPrice,
  formatValue,
  listingTotal,
} from '../../domain/format';
import type { Listing } from '../../domain/listing';
import {
  SORT_FIELDS,
  SORT_LABELS,
  type SortField,
  type SortState,
} from '../../domain/sortFilter';

const col = createColumnHelper<Listing>();

const columns = [
  col.accessor('model', { header: SORT_LABELS.model }),
  col.accessor('color', {
    header: SORT_LABELS.color,
    cell: (c) => formatValue(c.getValue()),
  }),
  col.accessor('year', {
    header: SORT_LABELS.year,
    cell: (c) => formatValue(c.getValue()),
  }),
  col.accessor('km', {
    header: SORT_LABELS.km,
    cell: (c) => formatKm(c.getValue()),
  }),
  col.accessor('price', {
    header: SORT_LABELS.price,
    cell: (c) => formatPrice(c.getValue()),
  }),
  col.accessor('extraCost', {
    header: SORT_LABELS.extraCost,
    cell: (c) => formatPrice(c.getValue()),
  }),
  col.accessor((l) => listingTotal(l), {
    id: 'total',
    header: SORT_LABELS.total,
    cell: (c) => formatPrice(c.getValue()),
  }),
  col.accessor('condition', {
    header: SORT_LABELS.condition,
    cell: (c) => formatValue(c.getValue()),
  }),
  col.accessor('rating', {
    header: SORT_LABELS.rating,
    cell: (c) => <ScoreBadge value={c.getValue()} size="sm" />,
  }),
  col.accessor('status', {
    header: SORT_LABELS.status,
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  col.accessor('updatedAt', {
    header: SORT_LABELS.updatedAt,
    cell: (c) => formatDate(c.getValue()),
  }),
  col.display({
    id: 'url',
    header: 'Link',
    cell: (c) =>
      c.row.original.url ? (
        <a
          href={c.row.original.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 dark:text-blue-400 underline"
        >
          Ver ↗
        </a>
      ) : (
        MISSING
      ),
  }),
];

const isSortField = (id: string): id is SortField =>
  SORT_FIELDS.includes(id as SortField);

interface Props {
  listings: Listing[];
  sort: SortState;
  onSort: (s: SortState) => void;
}

export function ListingTable({ listings, sort, onSort }: Props) {
  const navigate = useNavigate();
  const table = useReactTable({
    data: listings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (l) => l.id,
  });

  const toggle = (field: SortField) =>
    onSort(
      sort.field === field
        ? { field, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const id = h.column.id;
                const label = flexRender(
                  h.column.columnDef.header,
                  h.getContext(),
                );
                return (
                  <th
                    key={h.id}
                    className="whitespace-nowrap px-3 py-2 font-medium"
                  >
                    {isSortField(id) ? (
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className="hover:text-gray-900 dark:hover:text-white"
                      >
                        {label}
                        {sort.field === id && (sort.dir === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/listings/${row.id}`)}
              className="cursor-pointer border-t border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
