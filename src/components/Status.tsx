import {
  LISTING_STATUSES,
  STATUS_LABELS,
  type ListingStatus,
} from '../domain/listing';
import { inputCls } from './ui';

const STYLES: Record<ListingStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  seen: 'bg-green-100 text-green-800',
  discarded: 'bg-gray-200 text-gray-600',
  sold: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface SelectProps {
  id?: string;
  value: ListingStatus;
  onChange: (value: ListingStatus) => void;
}

export function StatusSelect({ id, value, onChange }: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ListingStatus)}
      className={inputCls}
    >
      {LISTING_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
