import { useNavigate, useParams } from 'react-router';
import { NotFound } from '../../components/NotFound';
import { useListing, usePhotos } from '../../db/hooks';
import {
  createListing,
  syncPhotos,
  updateListing,
} from '../../db/repository';
import { listingTitle } from '../../domain/format';
import { coverIndex } from '../photos/photoDrafts';
import { ListingForm } from './ListingForm';

export function NewListingPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Nueva publicación</h1>
      <ListingForm
        submitLabel="Crear"
        onCancel={() => navigate('/')}
        onSubmit={async (input, photos) => {
          const id = await createListing(input);
          await syncPhotos(id, photos.items, coverIndex(photos));
          navigate(`/listings/${id}`, { replace: true });
        }}
      />
    </div>
  );
}

export function EditListingPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const listing = useListing(id);
  const photos = usePhotos(id);

  if (listing === undefined || photos === undefined) {
    return <p className="p-4 text-gray-500 dark:text-gray-400">Cargando…</p>;
  }
  if (listing === null) {
    return <NotFound message="No encontramos esa publicación." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Editar {listingTitle(listing)}</h1>
      <ListingForm
        key={listing.id}
        initial={listing}
        initialPhotos={photos}
        submitLabel="Guardar"
        onCancel={() => navigate(`/listings/${id}`)}
        onSubmit={async (input, drafts) => {
          await updateListing(id, input);
          await syncPhotos(id, drafts.items, coverIndex(drafts));
          navigate(`/listings/${id}`, { replace: true });
        }}
      />
    </div>
  );
}
