import { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../domain/format';
import {
  EXPORTED_EVENT,
  exportBackup,
  getLastExportAt,
  shouldNudge,
} from './backup';

export function BackupNudge({ hasListings }: { hasListings: boolean }) {
  const toast = useToast();
  const [lastExportAt, setLastExportAt] = useState(getLastExportAt);
  const [now] = useState(Date.now);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onExported = () => setLastExportAt(getLastExportAt());
    window.addEventListener(EXPORTED_EVENT, onExported);
    return () => window.removeEventListener(EXPORTED_EVENT, onExported);
  }, []);

  if (!hasListings || dismissed || !shouldNudge(lastExportAt, now)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      <span>
        {lastExportAt
          ? `Tu último backup es del ${formatDate(lastExportAt)}.`
          : 'Todavía no exportaste ningún backup.'}{' '}
        Los datos viven solo en este navegador.
      </span>
      <div className="flex gap-3">
        <button
          type="button"
          className="font-medium underline"
          onClick={() =>
            exportBackup().catch(() =>
              toast('No se pudo exportar el backup', 'error'),
            )
          }
        >
          Exportar ahora
        </button>
        <button
          type="button"
          className="text-amber-700"
          onClick={() => setDismissed(true)}
        >
          Más tarde
        </button>
      </div>
    </div>
  );
}
