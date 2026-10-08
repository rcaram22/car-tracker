import { useEffect, useState } from 'react';
import type { Photo } from '../../domain/listing';
import { useObjectUrl } from '../../lib/useObjectUrl';

export function PhotoImg({
  photo,
  className,
}: {
  photo: Photo;
  className?: string;
}) {
  const url = useObjectUrl(photo.data, photo.type);
  return url ? (
    <img src={url} alt="" className={className} />
  ) : (
    <div className={className} />
  );
}

export function PhotoGallery({
  photos,
  coverPhotoId,
}: {
  photos: Photo[];
  coverPhotoId?: string;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      photos.findIndex((p) => p.id === coverPhotoId),
    ),
  );
  const [open, setOpen] = useState(false);

  if (!photos.length) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
        Sin fotos
      </div>
    );
  }

  const safeIndex = Math.min(index, photos.length - 1);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full"
        aria-label="Ver foto en grande"
      >
        <PhotoImg
          photo={photos[safeIndex]}
          className="aspect-[4/3] w-full rounded-lg bg-gray-100 dark:bg-gray-700 object-cover"
        />
      </button>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Foto ${i + 1}`}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded ${
                i === safeIndex
                  ? 'ring-2 ring-blue-500'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <PhotoImg photo={p} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <Lightbox
          photos={photos}
          index={safeIndex}
          onIndex={setIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

interface LightboxProps {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

function Lightbox({ photos, index, onIndex, onClose }: LightboxProps) {
  const go = (delta: number) =>
    onIndex((index + delta + photos.length) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        onIndex((index - 1 + photos.length) % photos.length);
      }
      if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose]);

  const navBtn =
    'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-4 py-3 text-2xl text-white hover:bg-white/30';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="contents">
        <PhotoImg
          photo={photos[index]}
          className="max-h-full max-w-full object-contain"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => go(-1)}
              className={`${navBtn} left-4`}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => go(1)}
              className={`${navBtn} right-4`}
            >
              ›
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute right-4 top-4 text-3xl text-white"
      >
        ✕
      </button>
      <span className="absolute bottom-4 text-sm text-white/80">
        {index + 1} / {photos.length}
      </span>
    </div>
  );
}
