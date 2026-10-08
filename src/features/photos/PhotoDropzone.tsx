import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import type { PhotoData } from '../../domain/listing';
import { compressImage } from './compressImage';

const isImage = (f: File) => f.type.startsWith('image/');

export function PhotoDropzone({
  onAdd,
  onBusyChange,
}: {
  onAdd: (photos: PhotoData[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(0);
  const busy = pending > 0;

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter(isImage);
      if (!images.length) return;
      setPending((n) => n + 1);
      const results = await Promise.allSettled(
        images.map((f) => compressImage(f)),
      );
      setPending((n) => n - 1);
      const ok = results.flatMap((r) =>
        r.status === 'fulfilled' ? [r.value] : [],
      );
      const failed = results.length - ok.length;
      if (failed) {
        toast(
          `No se pudo leer ${failed} imagen${failed > 1 ? 'es' : ''}`,
          'error',
        );
      }
      if (ok.length) onAdd(ok);
    },
    [onAdd, toast],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(isImage);
      if (!files.length) return;
      e.preventDefault();
      void handleFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFiles]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void handleFiles(Array.from(e.dataTransfer.files));
      }}
      className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-600 dark:text-gray-300"
    >
      <p>
        Pegá fotos con{' '}
        <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1">Ctrl/Cmd+V</kbd>, arrastralas
        acá o{' '}
        <label className="cursor-pointer text-blue-600 dark:text-blue-400 underline">
          elegí archivos
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void handleFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </label>
      </p>
      {busy && <p className="mt-2 text-gray-500 dark:text-gray-400">Procesando fotos…</p>}
    </div>
  );
}
