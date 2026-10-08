import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import type { PhotoData } from '../../domain/listing';
import { compressImage } from './compressImage';

const isImage = (f: File) => f.type.startsWith('image/');

export function PhotoDropzone({
  onAdd,
}: {
  onAdd: (photos: PhotoData[]) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter(isImage);
      if (!images.length) return;
      setBusy(true);
      const results = await Promise.allSettled(
        images.map((f) => compressImage(f)),
      );
      setBusy(false);
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
      className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600"
    >
      <p>
        Pegá fotos con{' '}
        <kbd className="rounded bg-gray-100 px-1">Ctrl/Cmd+V</kbd>, arrastralas
        acá o{' '}
        <label className="cursor-pointer text-blue-600 underline">
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
      {busy && <p className="mt-2 text-gray-500">Procesando fotos…</p>}
    </div>
  );
}
