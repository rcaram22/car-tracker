import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { ScoreBadge } from '../../components/ScoreBadge';
import { StatusBadge } from '../../components/Status';
import { usePhoto, usePhotoCount, usePhotos } from '../../db/hooks';
import {
  colorToHex,
  formatKm,
  formatPrice,
  listingTitle,
  listingTotal,
} from '../../domain/format';
import type { Listing } from '../../domain/listing';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { useSwipe } from '../../lib/useSwipe';

export function ListingCard({ listing }: { listing: Listing }) {
  const cover = usePhoto(listing.coverPhotoId);
  const count = usePhotoCount(listing.id) ?? 0;
  const [offset, setOffset] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  // Only the cover is read until the user starts browsing, so the grid stays light
  const photos = usePhotos(listing.id, browsing);

  const coverIndex = cover?.order ?? 0;
  const index = count ? (((coverIndex + offset) % count) + count) % count : 0;
  const shown = photos?.[index] ?? cover;
  const url = useObjectUrl(shown?.data, shown?.type);

  const browse = (delta: number) => {
    setBrowsing(true);
    setOffset((o) => o + delta);
  };
  const step = (delta: number) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    browse(delta);
  };
  const swipe = useSwipe(browse);

  const arrow =
    'absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-2.5 py-1 text-lg leading-none text-white opacity-0 transition hover:bg-black/60 group-hover/photo:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100';

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition hover:shadow-md"
    >
      <div
        {...(count > 1 ? swipe : {})}
        className="group/photo relative flex aspect-[4/3] touch-pan-y items-center justify-center overflow-hidden"
        style={url ? undefined : { backgroundColor: colorToHex(listing.color) }}
      >
        {url ? (
          <img
            src={url}
            alt={`Foto ${index + 1} de ${count}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="rounded bg-white/80 px-2 py-0.5 text-xs text-gray-600">
            Sin fotos
          </span>
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={step(-1)}
              className={`${arrow} left-2`}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={step(1)}
              className={`${arrow} right-2`}
            >
              ›
            </button>
            <div className="absolute bottom-2 flex gap-1 opacity-0 transition group-hover/photo:opacity-100 [@media(hover:none)]:opacity-100">
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === index ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold group-hover:text-blue-700">
            {listingTitle(listing)}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {listing.url && (
              <button
                type="button"
                aria-label="Abrir publicación"
                title="Abrir publicación"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(listing.url, '_blank', 'noopener,noreferrer');
                }}
                className="rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
              >
                ↗
              </button>
            )}
            <StatusBadge status={listing.status} />
          </div>
        </div>
        <p className="text-lg font-bold">{formatPrice(listing.price)}</p>
        {listing.extraCost !== undefined && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total {formatPrice(listingTotal(listing))} (+
            {formatPrice(listing.extraCost)})
          </p>
        )}
        <div className="mt-auto flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{formatKm(listing.km)}</span>
          <ScoreBadge value={listing.rating} size="sm" />
        </div>
      </div>
    </Link>
  );
}
