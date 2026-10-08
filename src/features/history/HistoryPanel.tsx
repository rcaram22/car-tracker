import { useToast } from '../../components/Toast';
import { useEvents } from '../../db/hooks';
import { deleteEvent } from '../../db/repository';
import { formatDateTime, formatPrice, MISSING } from '../../domain/format';
import {
  isListingStatus,
  STATUS_LABELS,
  type ListingEvent,
  type TrackedField,
} from '../../domain/listing';

const FIELD_LABELS: Record<TrackedField, string> = {
  price: 'Precio',
  status: 'Estado',
};

function formatEventValue(e: ListingEvent, v: ListingEvent['from']): string {
  if (e.field === 'price') return formatPrice(v as number | undefined);
  return isListingStatus(v) ? STATUS_LABELS[v] : MISSING;
}

export function HistoryPanel({ listingId }: { listingId: string }) {
  const events = useEvents(listingId);
  const toast = useToast();

  const remove = async (id: string) => {
    if (!window.confirm('¿Borrar este cambio del historial?')) return;
    try {
      await deleteEvent(id);
    } catch {
      toast('No se pudo borrar el cambio', 'error');
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Historial</h2>
      {events?.length === 0 && (
        <p className="text-sm text-gray-500">Sin cambios registrados.</p>
      )}
      {!!events?.length && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Campo</th>
                <th className="px-3 py-2 font-medium">Antes</th>
                <th className="px-3 py-2 font-medium">Después</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {formatDateTime(e.at)}
                  </td>
                  <td className="px-3 py-2">{FIELD_LABELS[e.field]}</td>
                  <td className="px-3 py-2">{formatEventValue(e, e.from)}</td>
                  <td className="px-3 py-2">{formatEventValue(e, e.to)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      aria-label="Borrar cambio"
                      onClick={() => void remove(e.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
