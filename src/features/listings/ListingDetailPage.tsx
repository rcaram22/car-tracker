import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../../components/NotFound';
import { ScoreBadge } from '../../components/ScoreBadge';
import { ScoreInput } from '../../components/ScoreInput';
import { StatusSelect } from '../../components/Status';
import { useToast } from '../../components/Toast';
import { btnDanger, btnSecondary } from '../../components/ui';
import { useListing, usePhotos } from '../../db/hooks';
import { deleteListing, updateListing } from '../../db/repository';
import {
  MISSING,
  formatDate,
  formatKm,
  formatPrice,
  formatValue,
  listingTitle,
} from '../../domain/format';
import type { ListingInput } from '../../domain/listing';
import { HistoryPanel } from '../history/HistoryPanel';
import { NotesPanel } from '../notes/NotesPanel';
import { PhotoGallery } from '../photos/PhotoGallery';

export function ListingDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const listing = useListing(id);
  const photos = usePhotos(id);

  if (listing === undefined || photos === undefined) {
    return <p className="p-4 text-gray-500">Cargando…</p>;
  }
  if (listing === null) {
    return <NotFound message="No encontramos esa publicación." />;
  }

  const patch = (p: Partial<ListingInput>) =>
    updateListing(id, p).catch(() => toast('No se pudo guardar', 'error'));

  const remove = async () => {
    if (!window.confirm('¿Borrar esta publicación con sus fotos y notas?')) {
      return;
    }
    try {
      await deleteListing(id);
      navigate('/', { replace: true });
    } catch {
      toast('No se pudo borrar', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Volver
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{listingTitle(listing)}</h1>
          <p className="text-xl font-semibold text-gray-700">
            {formatPrice(listing.price)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/listings/${id}/edit`} className={btnSecondary}>
            Editar
          </Link>
          <button
            type="button"
            onClick={() => void remove()}
            className={btnDanger}
          >
            Borrar
          </button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <PhotoGallery
          key={photos.map((p) => p.id).join()}
          photos={photos}
          coverPhotoId={listing.coverPhotoId}
        />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <ScoreBadge value={listing.rating} />
              <ScoreInput
                key={listing.rating ?? 'none'}
                value={listing.rating}
                onSave={(rating) => void patch({ rating })}
              />
            </div>
            <div className="w-48">
              <StatusSelect
                value={listing.status}
                onChange={(status) => void patch({ status })}
              />
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-white p-4 text-sm shadow-sm">
            <Row label="Modelo">{listing.model}</Row>
            <Row label="Color">{formatValue(listing.color)}</Row>
            <Row label="Año">{formatValue(listing.year)}</Row>
            <Row label="Kilómetros">{formatKm(listing.km)}</Row>
            <Row label="Precio">{formatPrice(listing.price)}</Row>
            <Row label="Condición">{formatValue(listing.condition)}</Row>
            <Row label="Publicación">
              {listing.url ? (
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  Ver publicación ↗
                </a>
              ) : (
                MISSING
              )}
            </Row>
            <Row label="Creada">{formatDate(listing.createdAt)}</Row>
            <Row label="Actualizada">{formatDate(listing.updatedAt)}</Row>
          </dl>
        </div>
      </div>

      {listing.description && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Descripción</h2>
          <p className="whitespace-pre-wrap rounded-lg bg-white p-4 text-sm shadow-sm">
            {listing.description}
          </p>
        </section>
      )}

      <HistoryPanel listingId={id} />

      <NotesPanel listingId={id} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
