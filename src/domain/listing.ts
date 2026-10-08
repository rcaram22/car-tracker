export const LISTING_STATUSES = [
  'new',
  'contacted',
  'seen',
  'discarded',
  'sold',
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const STATUS_LABELS: Record<ListingStatus, string> = {
  new: 'Nueva',
  contacted: 'Contactado',
  seen: 'Visto en persona',
  discarded: 'Descartado',
  sold: 'Vendida',
};

export const DEFAULT_VISIBLE_STATUSES: ListingStatus[] = [
  'new',
  'contacted',
  'seen',
];

export function isListingStatus(v: unknown): v is ListingStatus {
  return LISTING_STATUSES.includes(v as ListingStatus);
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Listing {
  id: string;
  model: string;
  color?: string;
  year?: number;
  km?: number;
  price?: number;
  url?: string;
  condition?: string;
  description?: string;
  rating?: Rating;
  status: ListingStatus;
  coverPhotoId?: string;
  createdAt: number;
  updatedAt: number;
}

export type ListingInput = Omit<
  Listing,
  'id' | 'createdAt' | 'updatedAt' | 'coverPhotoId'
>;

export interface PhotoData {
  data: ArrayBuffer;
  type: string;
}

export interface Photo extends PhotoData {
  id: string;
  listingId: string;
  order: number;
  createdAt: number;
}

export interface Note {
  id: string;
  listingId: string;
  text: string;
  createdAt: number;
}
