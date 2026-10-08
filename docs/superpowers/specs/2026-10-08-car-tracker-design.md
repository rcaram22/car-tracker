# Car Tracker — Design

Date: 2026-10-08

## Goal

A local-only React app to track used-car listings (currently Golf Mk4) that replaces a spreadsheet. Each listing gets a fixed data sheet, pasted photos and description, a 1–5 star rating, a tracking status, and personal notes. No backend for now; the data layer is isolated so one can be added later.

## Non-goals

- Fetching photos/description automatically from listing URLs (Facebook Marketplace requires login, blocks CORS, and its image URLs expire). Photos and description are pasted manually.
- Multi-user, auth, sync across devices (JSON export/import covers backup).
- Mobile-first design (must be usable on mobile, optimized for desktop).

## Stack

- Vite + React + TypeScript
- Dexie (IndexedDB) for persistence
- Tailwind CSS
- TanStack Table for the table view
- React Router
- Vitest + Testing Library + fake-indexeddb for tests

Project location: `~/Dev/car-tracker`.

## Data model

```ts
type ListingStatus = 'new' | 'contacted' | 'seen' | 'discarded' | 'sold';

interface Listing {
  id: string;            // crypto.randomUUID()
  model: string;         // required, e.g. "Golf Mk4 2.0"
  color?: string;
  year?: number;         // undefined renders as "??"
  km?: number;
  price?: number;        // USD
  url?: string;
  condition?: string;    // spreadsheet column "Estado"
  description?: string;  // pasted listing text
  rating?: 1 | 2 | 3 | 4 | 5;
  status: ListingStatus; // default 'new'
  coverPhotoId?: string;
  createdAt: number;     // epoch ms
  updatedAt: number;
}

interface Photo {
  id: string;
  listingId: string;
  blob: Blob;            // compressed JPEG
  order: number;
  createdAt: number;
}

interface Note {
  id: string;
  listingId: string;
  text: string;
  createdAt: number;
}
```

Status labels (UI, Spanish): `new` Nueva · `contacted` Contactado · `seen` Visto en persona · `discarded` Descartado · `sold` Vendida.

Dexie stores: `listings: 'id, status, rating, price, updatedAt'`, `photos: 'id, listingId, [listingId+order]'`, `notes: 'id, listingId, createdAt'`.

Photos live in their own table so list views never load blobs except the cover.

## Architecture

```
src/
  db/
    schema.ts        Dexie instance + types
    repository.ts    the only module that touches Dexie; async CRUD API
  features/
    listings/        HomePage (grid/table toggle), ListingGrid, ListingTable,
                     ListingForm, ListingDetailPage, filters
    photos/          PhotoDropzone (paste + drag & drop), PhotoGallery, Lightbox,
                     compressImage
    notes/           NotesPanel
    backup/          exportJson, importJson, importCsv
  components/        StarRating, StatusBadge, ConfirmDialog, shared UI
```

`repository.ts` exposes functions such as `listListings()`, `getListing(id)`, `createListing(data, photos)`, `updateListing(id, patch)`, `deleteListing(id)` (cascades photos and notes in one transaction), `addPhotos`, `reorderPhotos`, `deletePhoto`, `setCover`, `addNote`, `deleteNote`, `exportAll()`, `importAll(data)`. Components read via `useLiveQuery` wrappers defined next to the repository, so swapping Dexie for an HTTP client later touches only `db/`.

## Routes

- `/` — home, grid or table
- `/listings/new` — create
- `/listings/:id` — detail
- `/listings/:id/edit` — edit

## Home

- Header: text search (model, color, condition), `Grilla | Tabla` toggle, `+ Nueva`, `⋯` menu (export backup, import backup, import CSV).
- Filters: status multi-select (default hides `discarded` and `sold`), minimum stars, price range.
- View mode, sort and filters are kept in URL search params and mirrored to localStorage (wrapped in try/catch) so they survive reloads.
- Grid: cards with cover photo (placeholder tinted by car color when missing), title `Model · Year · Color`, price, km, stars, status badge. Click opens detail.
- Table: columns Model, Color, Year, Km, Price, Condition, Rating, Status, Updated. Sortable by any column; empty values always sort last regardless of direction. Click row opens detail. Link column opens the listing URL in a new tab without navigating.

## Detail

- Gallery: large photo + thumbnails, lightbox with keyboard navigation.
- Data sheet with all fields; missing values shown as `??`. "Ver publicación" link opens in a new tab.
- Rating and status editable inline.
- Description rendered preserving line breaks.
- Notes: chronological list with date, textarea to add, delete per note.
- `Editar` and `Borrar` (confirmation; cascades photos and notes).

## Create / edit form

- Fields from the data model; only `model` is required. Numeric fields accept thousand separators on input.
- Photo zone: Ctrl/Cmd+V anywhere on the form adds clipboard images; drag & drop and file picker also supported. Thumbnails can be reordered, deleted, and marked as cover. First photo is the cover by default.
- Images are compressed on add: longest side max 1600px, JPEG quality 0.85, via canvas.
- Unsaved-changes guard when leaving the form.

## Backup and import

- Export: downloads `car-tracker-YYYY-MM-DD.json` with all listings, notes and photos (photos as base64 data URLs) plus a `version` field.
- Import JSON: validates `version` and shape, asks for confirmation, then replaces all data in one transaction.
- Import CSV: one-time load from the spreadsheet. Expected headers: `Modelo, Color, Año, KMs, Precio, Link, Estado, Comentarios`. `??` and empty cells become undefined; `$`, commas and spaces are stripped from numbers; `Estado` maps to `condition`; a non-empty `Comentarios` becomes the listing's first note. Imported rows get status `new` and no rating. Rows are appended, not replaced. A summary of imported/skipped rows is shown.

Note: Google Sheets CSV export drops hyperlinks shown as "Facebook"; the `Link` column must contain the actual URL (e.g. via `=HYPERLINK` source or a helper column) for URLs to import. Rows without a URL import fine.

## Error handling

- Repository calls wrapped; failures surface as a toast, never a blank screen.
- Unknown listing id on detail/edit routes shows a not-found state with a link home.
- Storage: call `navigator.storage.persist()` on first load to reduce eviction risk; show a periodic nudge to export a backup if the last export is older than 14 days.
- Non-image paste/drop items are ignored silently; images that fail to decode show a toast.

## Testing

- Unit: `compressImage` sizing logic, CSV parsing/mapping (using the real spreadsheet rows as fixtures), sort comparator with empties-last, export/import round-trip.
- Repository: CRUD and cascade delete against `fake-indexeddb`.
- Component: form validation, paste-to-add photo, filters hiding discarded/sold by default.
