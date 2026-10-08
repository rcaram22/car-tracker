import { Link } from 'react-router';
import { StarRating } from '../../components/StarRating';
import { StatusBadge } from '../../components/Status';
import { usePhoto } from '../../db/hooks';
import {
  colorToHex,
  formatKm,
  formatPrice,
  listingTitle,
} from '../../domain/format';
import type { Listing } from '../../domain/listing';
import { useObjectUrl } from '../../lib/useObjectUrl';

export function ListingCard({ listing }: { listing: Listing }) {
  const cover = usePhoto(listing.coverPhotoId);
  const url = useObjectUrl(cover?.data, cover?.type);

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
        style={url ? undefined : { backgroundColor: colorToHex(listing.color) }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="rounded bg-white/80 px-2 py-0.5 text-xs text-gray-600">
            Sin fotos
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold group-hover:text-blue-700">
            {listingTitle(listing)}
          </h3>
          <StatusBadge status={listing.status} />
        </div>
        <p className="text-lg font-bold">{formatPrice(listing.price)}</p>
        <div className="mt-auto flex items-center justify-between text-sm text-gray-500">
          <span>{formatKm(listing.km)}</span>
          <StarRating value={listing.rating} size="sm" />
        </div>
      </div>
    </Link>
  );
}
