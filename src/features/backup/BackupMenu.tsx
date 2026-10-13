import { useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { btnSecondary } from '../../components/ui';
import { BackupError, exportBackup, importBackupText } from './backup';
import { importCsvRows, parseSpreadsheetCsv } from './csvImport';

export function BackupMenu() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    setOpen(false);
    try {
      await exportBackup();
      toast('Backup exportado');
    } catch {
      toast('No se pudo exportar el backup', 'error');
    }
  };

  const onJson = async (file: File) => {
    try {
      const result = await importBackupText(await file.text(), () =>
        window.confirm(
          'Esto reemplaza TODOS los datos actuales por los del backup. ¿Continuar?',
        ),
      );
      if (result === 'imported') toast('Backup importado');
    } catch (e) {
      toast(
        e instanceof BackupError ? e.message : 'No se pudo importar el backup',
        'error',
      );
    }
  };

  const onCsv = async (file: File) => {
    try {
      const { rows, skipped } = parseSpreadsheetCsv(await file.text());
      const n = await importCsvRows(rows);
      toast(
        `Importadas ${n} publicaciones${
          skipped ? `, ${skipped} filas sin modelo salteadas` : ''
        }`,
      );
    } catch {
      toast('No se pudo importar el CSV', 'error');
    }
  };

  const item =
    'block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700';

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Más opciones"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={btnSecondary}
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg"
        >
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => void onExport()}
          >
            Exportar backup (JSON)
          </button>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              jsonInput.current?.click();
            }}
          >
            Importar backup (JSON)
          </button>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              csvInput.current?.click();
            }}
          >
            Importar planilla (CSV)
          </button>
        </div>
      )}
      <input
        ref={jsonInput}
        type="file"
        accept="application/json,.json"
        aria-label="Archivo de backup"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onJson(f);
        }}
      />
      <input
        ref={csvInput}
        type="file"
        accept="text/csv,.csv"
        aria-label="Archivo CSV"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onCsv(f);
        }}
      />
    </div>
  );
}
