# Car Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-only React app to track used-car listings with pasted photos, a fixed data sheet, star rating, tracking status, notes, grid/table views, JSON backup and one-time CSV import.

**Architecture:** Vite SPA. All persistence goes through `src/db/repository.ts` (Dexie over IndexedDB); components read through `useLiveQuery` hooks in `src/db/hooks.ts`, so a future backend replaces only `src/db/`. Pure logic (formatting, sort/filter, URL state, photo drafts, backup/CSV mapping) lives in plain modules with unit tests; React components stay thin.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Dexie 4 + `dexie-react-hooks`, `@tanstack/react-table` v8, `react-router` v7 (data router), PapaParse, Vitest + Testing Library + jsdom + `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-10-08-car-tracker-design.md`

## Global Constraints

- No backend, no network calls besides opening listing URLs in a new tab.
- Only files under `src/db/` import Dexie.
- UI copy in Spanish; code, identifiers and commit messages in English.
- Missing values always render as `??`.
- Sorting puts empty values last regardless of direction.
- Default visible statuses: `new`, `contacted`, `seen` (hide `discarded`, `sold`).
- Photos are compressed on add: longest side max 1600 px, JPEG quality 0.85.
- Photos are stored as `{ data: ArrayBuffer, type: string }` (not `Blob`) so they structured-clone reliably in IndexedDB and in `fake-indexeddb` under jsdom; this is the spec's "photo blob".
- Only `model` is required on a listing.
- Backup file: `car-tracker-YYYY-MM-DD.json`, `app: 'car-tracker'`, `version: 1`; photo bytes as base64 with `type` alongside.
- Backup nudge after 14 days without export.
- Commits in this repo use the personal identity already set in repo-local git config (`ramirocaramdeluca@gmail.com`). Do not change git config.
- Node >= 20.

## Review Focus

1. Pasting plain text into the description textarea must paste the text normally; the global photo-paste handler may only intercept clipboard events that contain image files. → test in Task 8 (`PhotoDropzone.test.tsx`).
2. An image that fails to decode (HEIC, corrupt file) must show an error toast while the other images in the same paste/drop are still added. → test in Task 8.
3. Importing a JSON that is not a valid v1 backup (random JSON, `{}`, other version, not JSON at all) must fail with a readable message and leave existing data untouched. → test in Task 6 (`backup.test.ts`).
4. Removing the cover photo in the form makes the next photo (or previous, if it was last) the cover; removing all photos leaves no cover. → tests in Task 5 (`photoDrafts.test.ts`) and Task 3 (`repository.test.ts`).
5. The real spreadsheet CSV (UTF-8 BOM, `Año` with accent, `$ 9,375.00` prices, `??` cells, `250,000` km) imports with correct numbers and empties. → test in Task 6 (`csvImport.test.ts`).

---

## File Structure

```
car-tracker/
  index.html
  package.json, tsconfig.json, vite.config.ts, .gitignore
  src/
    main.tsx                     app bootstrap, storage.persist()
    index.css                    tailwind import
    router.tsx                   route table
    test/setup.ts                fake-indexeddb, jest-dom, URL.createObjectURL shim
    test/render.tsx              renderRoute helper (memory data router + toasts)
    domain/listing.ts            types, statuses, labels
    domain/format.ts             parseNumberInput, formatters, colorToHex
    domain/sortFilter.ts         Filters, SortState, filterListings, sortListings
    db/schema.ts                 Dexie instance
    db/repository.ts             all data access
    db/hooks.ts                  useLiveQuery wrappers
    lib/storage.ts               try/catch localStorage helpers
    lib/useObjectUrl.ts          ArrayBuffer -> object URL hook
    components/ui.ts             shared Tailwind class strings
    components/Toast.tsx         ToastProvider, useToast
    components/StarRating.tsx
    components/Status.tsx        StatusBadge, StatusSelect
    components/Layout.tsx
    components/NotFound.tsx
    features/photos/compressImage.ts
    features/photos/photoDrafts.ts
    features/photos/PhotoDropzone.tsx
    features/photos/PhotoDraftList.tsx
    features/photos/PhotoGallery.tsx      gallery + lightbox + PhotoImg
    features/listings/homeState.ts        URL <-> HomeState, useHomeState
    features/listings/ListingForm.tsx
    features/listings/ListingFormPages.tsx  NewListingPage, EditListingPage
    features/listings/FiltersBar.tsx
    features/listings/ListingCard.tsx
    features/listings/ListingGrid.tsx
    features/listings/ListingTable.tsx
    features/listings/HomePage.tsx
    features/listings/ListingDetailPage.tsx
    features/notes/NotesPanel.tsx
    features/backup/backup.ts             toBackup/fromBackup/import/export
    features/backup/csvImport.ts
    features/backup/BackupMenu.tsx
    features/backup/BackupNudge.tsx
```

Tests sit next to the file they test as `*.test.ts(x)`.

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json` (via npm), `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/index.css`, `src/test/setup.ts`, `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run dev`, `npm run build`, `npm test -- --run`, `npm run typecheck`; Vitest jsdom env with `fake-indexeddb/auto`, jest-dom matchers, and `URL.createObjectURL` shim available in every test.

- [ ] **Step 1: Init package and install deps**

Run from `~/Dev/car-tracker`:

```bash
npm init -y
npm pkg set type=module private=true --json
npm pkg delete main
npm pkg set scripts.dev="vite" scripts.build="tsc && vite build" scripts.preview="vite preview" scripts.test="vitest" scripts.typecheck="tsc"
npm i react react-dom react-router dexie dexie-react-hooks @tanstack/react-table papaparse
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/papaparse tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom fake-indexeddb
```

(The installs take a while; run them in background.)

- [ ] **Step 2: Write config files**

`.gitignore`:

```
node_modules
dist
*.local
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Car Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:

```css
@import 'tailwindcss';

body {
  @apply bg-gray-50 text-gray-900 antialiased;
}
```

`src/main.tsx` (placeholder; replaced in Task 7):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h1 className="p-4 text-2xl font-bold">Car Tracker</h1>
  </StrictMode>,
);
```

`src/test/setup.ts`:

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock';
  URL.revokeObjectURL = () => {};
}
```

- [ ] **Step 3: Write smoke test**

`src/smoke.test.ts`:

```ts
import { expect, it } from 'vitest';

it('has indexedDB and object URLs in the test env', () => {
  expect(indexedDB).toBeDefined();
  expect(URL.createObjectURL(new Blob(['x']))).toMatch(/^blob:/);
});
```

- [ ] **Step 4: Verify**

Run: `npm test -- --run` → Expected: 1 passed.
Run: `npm run build` → Expected: exits 0, writes `dist/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react app with tailwind and vitest"
```

---

### Task 2: Domain types and formatting

**Files:**
- Create: `src/domain/listing.ts`, `src/domain/format.ts`
- Test: `src/domain/format.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `listing.ts`: `LISTING_STATUSES`, `type ListingStatus`, `STATUS_LABELS: Record<ListingStatus, string>`, `DEFAULT_VISIBLE_STATUSES: ListingStatus[]`, `isListingStatus(v: unknown): v is ListingStatus`, `type Rating = 1|2|3|4|5`, `interface Listing`, `type ListingInput`, `interface Photo`, `interface PhotoData`, `interface Note`
  - `format.ts`: `MISSING = '??'`, `parseNumberInput(raw?: string): number | undefined`, `formatPrice(n?: number): string`, `formatKm(n?: number): string`, `formatValue(v?: string | number): string`, `listingTitle(l: Pick<Listing,'model'|'year'|'color'>): string`, `formatDate(ms: number): string`, `formatDateTime(ms: number): string`, `colorToHex(color?: string): string`, `normalizeText(s: string): string`

- [ ] **Step 1: Write domain types**

`src/domain/listing.ts`:

```ts
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
```

- [ ] **Step 2: Write failing tests**

`src/domain/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  colorToHex,
  formatKm,
  formatPrice,
  formatValue,
  listingTitle,
  parseNumberInput,
} from './format';

describe('parseNumberInput', () => {
  it.each([
    ['$ 9,375.00', 9375],
    ['$12,990.00', 12990],
    ['250,000', 250000],
    ['250.000', 250000],
    ['361,565', 361565],
    ['8.500', 8500],
    ['2005', 2005],
    ['  104322 ', 104322],
  ])('parses %s', (raw, expected) => {
    expect(parseNumberInput(raw)).toBe(expected);
  });

  it.each([undefined, '', '   ', '??', '$', 'abc'])(
    'returns undefined for %s',
    (raw) => {
      expect(parseNumberInput(raw)).toBeUndefined();
    },
  );
});

describe('formatters', () => {
  it('formats present values', () => {
    expect(formatPrice(9375)).toBe('$ 9,375');
    expect(formatKm(250000)).toBe('250,000 km');
    expect(formatValue(2005)).toBe('2005');
  });

  it('renders missing values as ??', () => {
    expect(formatPrice(undefined)).toBe('??');
    expect(formatKm(undefined)).toBe('??');
    expect(formatValue(undefined)).toBe('??');
    expect(formatValue('')).toBe('??');
  });

  it('builds the listing title', () => {
    expect(
      listingTitle({ model: 'Golf Mk4 2.0', year: 2005, color: 'Gris claro' }),
    ).toBe('Golf Mk4 2.0 · 2005 · Gris claro');
    expect(listingTitle({ model: 'Golf Mk4 1.6' })).toBe('Golf Mk4 1.6 · ??');
  });
});

describe('colorToHex', () => {
  it('maps spanish color names, preferring shade qualifiers', () => {
    expect(colorToHex('Gris claro')).toBe('#d1d5db');
    expect(colorToHex('Gris oscuro')).toBe('#4b5563');
    expect(colorToHex('Negro')).toBe('#1f2937');
    expect(colorToHex('Azul')).toBe('#1e40af');
  });

  it('falls back to neutral gray', () => {
    expect(colorToHex(undefined)).toBe('#e5e7eb');
    expect(colorToHex('Bordó oscuro')).toBe('#7f1d1d');
    expect(colorToHex('Champagne')).toBe('#e5e7eb');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- --run src/domain/format.test.ts`
Expected: FAIL, cannot resolve `./format`.

- [ ] **Step 4: Implement**

`src/domain/format.ts`:

```ts
import type { Listing } from './listing';

export const MISSING = '??';

const numberFormat = new Intl.NumberFormat('en-US');

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Drops a trailing 1-2 digit decimal part ("9,375.00") but keeps 3-digit
// groups ("250.000"), so both en-US and es thousand separators parse.
export function parseNumberInput(raw?: string): number | undefined {
  if (raw === undefined) return undefined;
  const digits = raw
    .replace(/[$\s]/g, '')
    .replace(/[.,]\d{1,2}$/, '')
    .replace(/\D/g, '');
  return digits === '' ? undefined : Number(digits);
}

export function formatPrice(n?: number): string {
  return n === undefined ? MISSING : `$ ${numberFormat.format(n)}`;
}

export function formatKm(n?: number): string {
  return n === undefined ? MISSING : `${numberFormat.format(n)} km`;
}

export function formatValue(v?: string | number): string {
  return v === undefined || v === '' ? MISSING : String(v);
}

export function listingTitle(
  l: Pick<Listing, 'model' | 'year' | 'color'>,
): string {
  return [l.model, l.year ?? MISSING, l.color]
    .filter((v) => v !== undefined && v !== '')
    .join(' · ');
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('es-UY');
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('es-UY', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const COLOR_HEX: [string, string][] = [
  ['gris claro', '#d1d5db'],
  ['gris oscuro', '#4b5563'],
  ['gris', '#9ca3af'],
  ['plata', '#cbd5e1'],
  ['negro', '#1f2937'],
  ['blanco', '#f9fafb'],
  ['azul', '#1e40af'],
  ['verde', '#166534'],
  ['rojo', '#b91c1c'],
  ['bordo', '#7f1d1d'],
  ['amarillo', '#facc15'],
];

export function colorToHex(color?: string): string {
  if (!color) return '#e5e7eb';
  const c = normalizeText(color);
  return COLOR_HEX.find(([name]) => c === name || c.startsWith(`${name} `))?.[1]
    ?? '#e5e7eb';
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- --run src/domain/format.test.ts` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: add listing domain types and formatting helpers"
```

---

### Task 3: Database schema, repository and hooks

**Files:**
- Create: `src/db/schema.ts`, `src/db/repository.ts`, `src/db/hooks.ts`
- Test: `src/db/repository.test.ts`

**Interfaces:**
- Consumes: types from `src/domain/listing.ts`
- Produces (`repository.ts`):
  - `listListings(): Promise<Listing[]>`
  - `getListing(id: string): Promise<Listing | undefined>`
  - `createListing(input: ListingInput): Promise<string>`
  - `updateListing(id: string, patch: Partial<ListingInput>): Promise<void>` (keys set to `undefined` clear the field)
  - `deleteListing(id: string): Promise<void>` (cascades photos + notes)
  - `listPhotos(listingId: string): Promise<Photo[]>` (by `order`)
  - `getPhoto(id: string): Promise<Photo | undefined>`
  - `interface PhotoDraftInput { id?: string; data: ArrayBuffer; type: string }`
  - `syncPhotos(listingId: string, drafts: PhotoDraftInput[], coverIndex: number): Promise<void>`
  - `listNotes(listingId: string): Promise<Note[]>` (oldest first)
  - `addNote(listingId: string, text: string): Promise<string>`
  - `deleteNote(id: string): Promise<void>`
  - `interface DbSnapshot { listings: Listing[]; photos: Photo[]; notes: Note[] }`
  - `exportAll(): Promise<DbSnapshot>`, `replaceAll(s: DbSnapshot): Promise<void>`, `clearAll(): Promise<void>`
- Produces (`hooks.ts`): `useListings(): Listing[] | undefined`, `useListing(id): Listing | null | undefined` (`undefined` = loading, `null` = not found), `usePhotos(listingId): Photo[] | undefined`, `usePhoto(id?): Photo | undefined`, `useNotes(listingId): Note[] | undefined`

- [ ] **Step 1: Write schema**

`src/db/schema.ts`:

```ts
import Dexie, { type EntityTable } from 'dexie';
import type { Listing, Note, Photo } from '../domain/listing';

export const db = new Dexie('car-tracker') as Dexie & {
  listings: EntityTable<Listing, 'id'>;
  photos: EntityTable<Photo, 'id'>;
  notes: EntityTable<Note, 'id'>;
};

db.version(1).stores({
  listings: 'id, status, rating, price, updatedAt',
  photos: 'id, listingId, [listingId+order]',
  notes: 'id, listingId, createdAt',
});
```

- [ ] **Step 2: Write failing tests**

`src/db/repository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from './repository';

const base = { model: 'Golf Mk4 2.0', status: 'new' as const };
const img = (n: number) => ({
  data: new Uint8Array([n]).buffer as ArrayBuffer,
  type: 'image/jpeg',
});
const bytes = (p: { data: ArrayBuffer }) => Array.from(new Uint8Array(p.data));

beforeEach(() => repo.clearAll());

describe('listings', () => {
  it('creates and reads a listing with timestamps', async () => {
    const id = await repo.createListing({ ...base, price: 9375 });
    const l = await repo.getListing(id);
    expect(l).toMatchObject({ id, model: 'Golf Mk4 2.0', price: 9375 });
    expect(l!.createdAt).toBeGreaterThan(0);
    expect(l!.updatedAt).toBe(l!.createdAt);
  });

  it('clears a field when patched with undefined', async () => {
    const id = await repo.createListing({ ...base, rating: 4 });
    await repo.updateListing(id, { rating: undefined });
    expect((await repo.getListing(id))!.rating).toBeUndefined();
  });

  it('deleteListing cascades photos and notes', async () => {
    const id = await repo.createListing(base);
    const other = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1)], 0);
    await repo.syncPhotos(other, [img(9)], 0);
    await repo.addNote(id, 'hola');
    await repo.deleteListing(id);
    const snap = await repo.exportAll();
    expect(snap.listings.map((l) => l.id)).toEqual([other]);
    expect(snap.photos).toHaveLength(1);
    expect(snap.notes).toHaveLength(0);
  });
});

describe('syncPhotos', () => {
  it('adds photos in order and sets the cover', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1), img(2), img(3)], 1);
    const photos = await repo.listPhotos(id);
    expect(photos.map(bytes)).toEqual([[1], [2], [3]]);
    expect((await repo.getListing(id))!.coverPhotoId).toBe(photos[1].id);
  });

  it('keeps, reorders and drops existing photos', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1), img(2), img(3)], 0);
    const [p1, , p3] = await repo.listPhotos(id);
    await repo.syncPhotos(id, [{ ...p3 }, img(4), { ...p1 }], 2);
    const photos = await repo.listPhotos(id);
    expect(photos.map(bytes)).toEqual([[3], [4], [1]]);
    expect(photos[0].id).toBe(p3.id);
    expect((await repo.getListing(id))!.coverPhotoId).toBe(p1.id);
  });

  it('clears the cover when coverIndex is -1', async () => {
    const id = await repo.createListing(base);
    await repo.syncPhotos(id, [img(1)], 0);
    await repo.syncPhotos(id, [], -1);
    expect(await repo.listPhotos(id)).toEqual([]);
    expect((await repo.getListing(id))!.coverPhotoId).toBeUndefined();
  });
});

describe('notes', () => {
  it('adds, lists oldest first and deletes', async () => {
    const id = await repo.createListing(base);
    const n1 = await repo.addNote(id, 'primera');
    await new Promise((r) => setTimeout(r, 2));
    await repo.addNote(id, 'segunda');
    expect((await repo.listNotes(id)).map((n) => n.text)).toEqual([
      'primera',
      'segunda',
    ]);
    await repo.deleteNote(n1);
    expect((await repo.listNotes(id)).map((n) => n.text)).toEqual(['segunda']);
  });
});

describe('snapshot', () => {
  it('replaceAll swaps the whole dataset', async () => {
    await repo.createListing(base);
    const snap = await repo.exportAll();
    await repo.createListing({ ...base, model: 'Otro' });
    await repo.replaceAll(snap);
    const after = await repo.exportAll();
    expect(after.listings).toHaveLength(1);
    expect(after.listings[0].model).toBe('Golf Mk4 2.0');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- --run src/db` → Expected: FAIL, cannot resolve `./repository`.

- [ ] **Step 4: Implement repository**

`src/db/repository.ts`:

```ts
import type {
  Listing,
  ListingInput,
  Note,
  Photo,
} from '../domain/listing';
import { db } from './schema';

const now = () => Date.now();
const newId = () => crypto.randomUUID();

export function listListings(): Promise<Listing[]> {
  return db.listings.toArray();
}

export function getListing(id: string): Promise<Listing | undefined> {
  return db.listings.get(id);
}

export async function createListing(input: ListingInput): Promise<string> {
  const id = newId();
  const t = now();
  await db.listings.add({ ...input, id, createdAt: t, updatedAt: t });
  return id;
}

export async function updateListing(
  id: string,
  patch: Partial<ListingInput>,
): Promise<void> {
  await db.listings.update(id, { ...patch, updatedAt: now() });
}

export async function deleteListing(id: string): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, db.notes, async () => {
    await db.photos.where('listingId').equals(id).delete();
    await db.notes.where('listingId').equals(id).delete();
    await db.listings.delete(id);
  });
}

export function listPhotos(listingId: string): Promise<Photo[]> {
  return db.photos.where('listingId').equals(listingId).sortBy('order');
}

export function getPhoto(id: string): Promise<Photo | undefined> {
  return db.photos.get(id);
}

export interface PhotoDraftInput {
  id?: string;
  data: ArrayBuffer;
  type: string;
}

export async function syncPhotos(
  listingId: string,
  drafts: PhotoDraftInput[],
  coverIndex: number,
): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, async () => {
    const keep = new Set(drafts.flatMap((d) => (d.id ? [d.id] : [])));
    const existing = await db.photos
      .where('listingId')
      .equals(listingId)
      .primaryKeys();
    await db.photos.bulkDelete(existing.filter((id) => !keep.has(id)));

    const t = now();
    const ids: string[] = [];
    for (const [order, d] of drafts.entries()) {
      if (d.id) {
        await db.photos.update(d.id, { order });
        ids.push(d.id);
      } else {
        const id = newId();
        await db.photos.add({
          id,
          listingId,
          data: d.data,
          type: d.type,
          order,
          createdAt: t,
        });
        ids.push(id);
      }
    }
    await db.listings.update(listingId, { coverPhotoId: ids[coverIndex] });
  });
}

export function listNotes(listingId: string): Promise<Note[]> {
  return db.notes.where('listingId').equals(listingId).sortBy('createdAt');
}

export async function addNote(listingId: string, text: string): Promise<string> {
  const id = newId();
  await db.notes.add({ id, listingId, text, createdAt: now() });
  return id;
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export interface DbSnapshot {
  listings: Listing[];
  photos: Photo[];
  notes: Note[];
}

export async function exportAll(): Promise<DbSnapshot> {
  const [listings, photos, notes] = await Promise.all([
    db.listings.toArray(),
    db.photos.toArray(),
    db.notes.toArray(),
  ]);
  return { listings, photos, notes };
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, db.notes, async () => {
    await Promise.all([db.listings.clear(), db.photos.clear(), db.notes.clear()]);
  });
}

export async function replaceAll(s: DbSnapshot): Promise<void> {
  await db.transaction('rw', db.listings, db.photos, db.notes, async () => {
    await Promise.all([db.listings.clear(), db.photos.clear(), db.notes.clear()]);
    await db.listings.bulkAdd(s.listings);
    await db.photos.bulkAdd(s.photos);
    await db.notes.bulkAdd(s.notes);
  });
}
```

- [ ] **Step 5: Implement hooks**

`src/db/hooks.ts`:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from './repository';

export function useListings() {
  return useLiveQuery(() => repo.listListings(), []);
}

export function useListing(id: string) {
  return useLiveQuery(async () => (await repo.getListing(id)) ?? null, [id]);
}

export function usePhotos(listingId: string) {
  return useLiveQuery(() => repo.listPhotos(listingId), [listingId]);
}

export function usePhoto(id?: string) {
  return useLiveQuery(
    () => (id ? repo.getPhoto(id) : undefined),
    [id],
  );
}

export function useNotes(listingId: string) {
  return useLiveQuery(() => repo.listNotes(listingId), [listingId]);
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- --run src/db` → Expected: all pass.
Run: `npm run typecheck` → Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/db
git commit -m "feat: add dexie schema, repository and live query hooks"
```

---

### Task 4: Sorting, filtering and home URL state

**Files:**
- Create: `src/domain/sortFilter.ts`, `src/lib/storage.ts`, `src/features/listings/homeState.ts`
- Test: `src/domain/sortFilter.test.ts`, `src/features/listings/homeState.test.ts`

**Interfaces:**
- Consumes: `Listing`, `ListingStatus`, `LISTING_STATUSES`, `DEFAULT_VISIBLE_STATUSES`, `isListingStatus` (Task 2); `normalizeText`, `parseNumberInput` (Task 2)
- Produces:
  - `sortFilter.ts`: `SORT_FIELDS`, `type SortField`, `SORT_LABELS: Record<SortField,string>`, `interface SortState { field: SortField; dir: 'asc'|'desc' }`, `DEFAULT_SORT`, `interface Filters { q: string; statuses: ListingStatus[]; minRating?: number; minPrice?: number; maxPrice?: number }`, `DEFAULT_FILTERS`, `filterListings(listings, filters): Listing[]`, `compareEmptiesLast(a, b, dir): number`, `sortListings(listings, sort): Listing[]`
  - `storage.ts`: `readStorage(key: string): string | null`, `writeStorage(key: string, value: string): void`
  - `homeState.ts`: `type ViewMode = 'grid'|'table'`, `interface HomeState { view; filters; sort }`, `parseHomeParams(p: URLSearchParams): HomeState`, `toHomeParams(s: HomeState): URLSearchParams`, `useHomeState(): readonly [HomeState, (patch: Partial<HomeState>) => void]`

- [ ] **Step 1: Write failing tests**

`src/domain/sortFilter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Listing } from './listing';
import {
  DEFAULT_FILTERS,
  compareEmptiesLast,
  filterListings,
  sortListings,
} from './sortFilter';

let seq = 0;
const make = (p: Partial<Listing>): Listing => ({
  id: String(++seq),
  model: 'Golf Mk4 2.0',
  status: 'new',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('filterListings', () => {
  it('hides discarded and sold by default', () => {
    const ls = [
      make({ status: 'new' }),
      make({ status: 'contacted' }),
      make({ status: 'seen' }),
      make({ status: 'discarded' }),
      make({ status: 'sold' }),
    ];
    expect(filterListings(ls, DEFAULT_FILTERS).map((l) => l.status)).toEqual([
      'new',
      'contacted',
      'seen',
    ]);
  });

  it('searches model, color and condition ignoring accents and case', () => {
    const a = make({ color: 'Gris claro' });
    const b = make({ condition: 'Interior OK. Razonable' });
    const c = make({ model: 'Golf Mk4 1.6' });
    const f = { ...DEFAULT_FILTERS };
    expect(filterListings([a, b, c], { ...f, q: 'GRIS' })).toEqual([a]);
    expect(filterListings([a, b, c], { ...f, q: 'razonáble' })).toEqual([b]);
    expect(filterListings([a, b, c], { ...f, q: '1.6' })).toEqual([c]);
  });

  it('filters by min rating and price range, excluding unknown prices', () => {
    const cheap = make({ price: 7500, rating: 2 });
    const mid = make({ price: 9000, rating: 4 });
    const noPrice = make({ rating: 5 });
    const f = { ...DEFAULT_FILTERS };
    expect(filterListings([cheap, mid, noPrice], { ...f, minRating: 4 })).toEqual(
      [mid, noPrice],
    );
    expect(
      filterListings([cheap, mid, noPrice], { ...f, minPrice: 8000, maxPrice: 9500 }),
    ).toEqual([mid]);
  });
});

describe('sorting', () => {
  it('compareEmptiesLast keeps undefined last in both directions', () => {
    const vals = [3, undefined, 1, 2];
    expect([...vals].sort((a, b) => compareEmptiesLast(a, b, 'asc'))).toEqual([
      1, 2, 3, undefined,
    ]);
    expect([...vals].sort((a, b) => compareEmptiesLast(a, b, 'desc'))).toEqual([
      3, 2, 1, undefined,
    ]);
  });

  it('sorts strings with spanish collation', () => {
    const ls = [make({ color: 'verde' }), make({ color: 'Azul' }), make({})];
    expect(
      sortListings(ls, { field: 'color', dir: 'asc' }).map((l) => l.color),
    ).toEqual(['Azul', 'verde', undefined]);
  });

  it('sorts status by pipeline order', () => {
    const ls = [make({ status: 'sold' }), make({ status: 'new' }), make({ status: 'seen' })];
    expect(
      sortListings(ls, { field: 'status', dir: 'asc' }).map((l) => l.status),
    ).toEqual(['new', 'seen', 'sold']);
  });
});
```

`src/features/listings/homeState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, DEFAULT_SORT } from '../../domain/sortFilter';
import { parseHomeParams, toHomeParams } from './homeState';

describe('home URL state', () => {
  it('parses empty params to defaults', () => {
    expect(parseHomeParams(new URLSearchParams())).toEqual({
      view: 'grid',
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
    });
  });

  it('serializes defaults to empty params', () => {
    expect(
      toHomeParams({ view: 'grid', filters: DEFAULT_FILTERS, sort: DEFAULT_SORT })
        .toString(),
    ).toBe('');
  });

  it('round-trips a custom state', () => {
    const state = {
      view: 'table' as const,
      filters: {
        q: 'gris',
        statuses: ['new' as const, 'sold' as const],
        minRating: 3,
        minPrice: 8000,
        maxPrice: 10000,
      },
      sort: { field: 'price' as const, dir: 'asc' as const },
    };
    expect(parseHomeParams(toHomeParams(state))).toEqual(state);
  });

  it('ignores unknown statuses and sort fields', () => {
    const s = parseHomeParams(new URLSearchParams('status=new,bogus&sort=nope'));
    expect(s.filters.statuses).toEqual(['new']);
    expect(s.sort).toEqual(DEFAULT_SORT);
  });

  it('keeps an explicitly empty status list', () => {
    expect(parseHomeParams(new URLSearchParams('status=')).filters.statuses).toEqual(
      [],
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/domain/sortFilter.test.ts src/features/listings/homeState.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement sortFilter**

`src/domain/sortFilter.ts`:

```ts
import { normalizeText } from './format';
import {
  DEFAULT_VISIBLE_STATUSES,
  LISTING_STATUSES,
  type Listing,
  type ListingStatus,
} from './listing';

export const SORT_FIELDS = [
  'model',
  'color',
  'year',
  'km',
  'price',
  'condition',
  'rating',
  'status',
  'updatedAt',
] as const;

export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_LABELS: Record<SortField, string> = {
  model: 'Modelo',
  color: 'Color',
  year: 'Año',
  km: 'Km',
  price: 'Precio',
  condition: 'Condición',
  rating: 'Estrellas',
  status: 'Estado',
  updatedAt: 'Actualizado',
};

export interface SortState {
  field: SortField;
  dir: 'asc' | 'desc';
}

export const DEFAULT_SORT: SortState = { field: 'updatedAt', dir: 'desc' };

export interface Filters {
  q: string;
  statuses: ListingStatus[];
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  statuses: DEFAULT_VISIBLE_STATUSES,
};

export function filterListings(listings: Listing[], f: Filters): Listing[] {
  const q = normalizeText(f.q);
  return listings.filter(
    (l) =>
      f.statuses.includes(l.status) &&
      (f.minRating === undefined || (l.rating ?? 0) >= f.minRating) &&
      (f.minPrice === undefined ||
        (l.price !== undefined && l.price >= f.minPrice)) &&
      (f.maxPrice === undefined ||
        (l.price !== undefined && l.price <= f.maxPrice)) &&
      (q === '' ||
        [l.model, l.color, l.condition].some(
          (v) => v !== undefined && normalizeText(v).includes(q),
        )),
  );
}

type SortValue = string | number | undefined;

export function compareEmptiesLast(
  a: SortValue,
  b: SortValue,
  dir: SortState['dir'],
): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const c =
    typeof a === 'string' && typeof b === 'string'
      ? a.localeCompare(b, 'es', { sensitivity: 'base' })
      : Number(a) - Number(b);
  return dir === 'asc' ? c : -c;
}

function sortValue(l: Listing, field: SortField): SortValue {
  if (field === 'status') return LISTING_STATUSES.indexOf(l.status);
  const v = l[field];
  return v === '' ? undefined : v;
}

export function sortListings(listings: Listing[], sort: SortState): Listing[] {
  return [...listings].sort((a, b) =>
    compareEmptiesLast(
      sortValue(a, sort.field),
      sortValue(b, sort.field),
      sort.dir,
    ),
  );
}
```

- [ ] **Step 4: Implement storage and homeState**

`src/lib/storage.ts`:

```ts
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, blocked); state still lives in the URL
  }
}
```

`src/features/listings/homeState.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { parseNumberInput } from '../../domain/format';
import { DEFAULT_VISIBLE_STATUSES, isListingStatus } from '../../domain/listing';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  SORT_FIELDS,
  type Filters,
  type SortField,
  type SortState,
} from '../../domain/sortFilter';
import { readStorage, writeStorage } from '../../lib/storage';

export type ViewMode = 'grid' | 'table';

export interface HomeState {
  view: ViewMode;
  filters: Filters;
  sort: SortState;
}

const STORAGE_KEY = 'car-tracker:home';

const num = (p: URLSearchParams, key: string) =>
  parseNumberInput(p.get(key) ?? undefined);

export function parseHomeParams(p: URLSearchParams): HomeState {
  const status = p.get('status');
  const field = p.get('sort');
  const filters: Filters = {
    q: p.get('q') ?? DEFAULT_FILTERS.q,
    statuses:
      status === null
        ? DEFAULT_VISIBLE_STATUSES
        : status.split(',').filter(isListingStatus),
  };
  const minRating = num(p, 'minRating');
  const minPrice = num(p, 'minPrice');
  const maxPrice = num(p, 'maxPrice');
  if (minRating !== undefined) filters.minRating = minRating;
  if (minPrice !== undefined) filters.minPrice = minPrice;
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;

  return {
    view: p.get('view') === 'table' ? 'table' : 'grid',
    filters,
    sort: SORT_FIELDS.includes(field as SortField)
      ? { field: field as SortField, dir: p.get('dir') === 'asc' ? 'asc' : 'desc' }
      : DEFAULT_SORT,
  };
}

export function toHomeParams(s: HomeState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.view !== 'grid') p.set('view', s.view);
  if (s.filters.q) p.set('q', s.filters.q);
  if (s.filters.statuses.join(',') !== DEFAULT_VISIBLE_STATUSES.join(',')) {
    p.set('status', s.filters.statuses.join(','));
  }
  if (s.filters.minRating !== undefined) p.set('minRating', String(s.filters.minRating));
  if (s.filters.minPrice !== undefined) p.set('minPrice', String(s.filters.minPrice));
  if (s.filters.maxPrice !== undefined) p.set('maxPrice', String(s.filters.maxPrice));
  if (s.sort.field !== DEFAULT_SORT.field || s.sort.dir !== DEFAULT_SORT.dir) {
    p.set('sort', s.sort.field);
    p.set('dir', s.sort.dir);
  }
  return p;
}

export function useHomeState() {
  const [params, setParams] = useSearchParams();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (params.toString()) return;
    const saved = readStorage(STORAGE_KEY);
    if (saved) setParams(new URLSearchParams(saved), { replace: true });
  }, [params, setParams]);

  const state = useMemo(() => parseHomeParams(params), [params]);

  const update = useCallback(
    (patch: Partial<HomeState>) => {
      const next = toHomeParams({ ...state, ...patch });
      writeStorage(STORAGE_KEY, next.toString());
      setParams(next, { replace: true });
    },
    [state, setParams],
  );

  return [state, update] as const;
}
```

The `sort` round-trip test uses `dir: 'asc'`, and `parseHomeParams` reads `dir` only when `sort` is present, which `toHomeParams` always writes together.

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- --run src/domain src/features/listings` → Expected: all pass.
Run: `npm run typecheck` → Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/domain src/lib src/features/listings
git commit -m "feat: add listing filters, sorting and URL-backed home state"
```

---

### Task 5: Photo compression and draft state

**Files:**
- Create: `src/features/photos/compressImage.ts`, `src/features/photos/photoDrafts.ts`
- Test: `src/features/photos/compressImage.test.ts`, `src/features/photos/photoDrafts.test.ts`

**Interfaces:**
- Consumes: `PhotoData` (Task 2)
- Produces:
  - `compressImage.ts`: `MAX_SIDE = 1600`, `JPEG_QUALITY = 0.85`, `fitWithin(w: number, h: number, max?: number): { width: number; height: number }`, `compressImage(file: Blob): Promise<PhotoData>` (rejects if the image cannot be decoded)
  - `photoDrafts.ts`: `interface PhotoDraft { key: string; id?: string; data: ArrayBuffer; type: string }`, `interface PhotoDraftState { items: PhotoDraft[]; coverKey?: string }`, `EMPTY_DRAFTS`, `addDrafts(s, added: PhotoDraft[])`, `removeDraft(s, key)`, `moveDraft(s, key, delta: -1 | 1)`, `setCoverDraft(s, key)`, `coverIndex(s): number`, `draftsFromPhotos(photos: Photo[], coverPhotoId?: string): PhotoDraftState`

- [ ] **Step 1: Write failing tests**

`src/features/photos/compressImage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fitWithin } from './compressImage';

describe('fitWithin', () => {
  it('scales the longest side down to 1600 keeping aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 2400)).toEqual({ width: 720, height: 1600 });
  });

  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
```

`src/features/photos/photoDrafts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DRAFTS,
  addDrafts,
  coverIndex,
  moveDraft,
  removeDraft,
  setCoverDraft,
  type PhotoDraft,
} from './photoDrafts';

const d = (key: string): PhotoDraft => ({
  key,
  data: new ArrayBuffer(1),
  type: 'image/jpeg',
});
const keys = (s: { items: PhotoDraft[] }) => s.items.map((i) => i.key);

describe('photo drafts', () => {
  it('first added photo becomes the cover', () => {
    const s = addDrafts(EMPTY_DRAFTS, [d('a'), d('b')]);
    expect(s.coverKey).toBe('a');
    expect(coverIndex(s)).toBe(0);
    expect(addDrafts(s, [d('c')]).coverKey).toBe('a');
  });

  it('removing the cover moves it to the next photo', () => {
    const s = addDrafts(EMPTY_DRAFTS, [d('a'), d('b'), d('c')]);
    const r = removeDraft(s, 'a');
    expect(keys(r)).toEqual(['b', 'c']);
    expect(r.coverKey).toBe('b');
  });

  it('removing the last photo when it is the cover moves cover back', () => {
    const s = setCoverDraft(addDrafts(EMPTY_DRAFTS, [d('a'), d('b')]), 'b');
    expect(removeDraft(s, 'b').coverKey).toBe('a');
  });

  it('removing every photo leaves no cover', () => {
    const s = removeDraft(addDrafts(EMPTY_DRAFTS, [d('a')]), 'a');
    expect(s.coverKey).toBeUndefined();
    expect(coverIndex(s)).toBe(-1);
  });

  it('moves photos and ignores out-of-range moves', () => {
    const s = addDrafts(EMPTY_DRAFTS, [d('a'), d('b'), d('c')]);
    expect(keys(moveDraft(s, 'c', -1))).toEqual(['a', 'c', 'b']);
    expect(keys(moveDraft(s, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(keys(moveDraft(s, 'c', 1))).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/features/photos` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/features/photos/compressImage.ts`:

```ts
import type { PhotoData } from '../../domain/listing';

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;

export function fitWithin(w: number, h: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export async function compressImage(file: Blob): Promise<PhotoData> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
  return { data: await blob.arrayBuffer(), type: 'image/jpeg' };
}
```

`src/features/photos/photoDrafts.ts`:

```ts
import type { Photo } from '../../domain/listing';

export interface PhotoDraft {
  key: string;
  id?: string;
  data: ArrayBuffer;
  type: string;
}

export interface PhotoDraftState {
  items: PhotoDraft[];
  coverKey?: string;
}

export const EMPTY_DRAFTS: PhotoDraftState = { items: [] };

export function addDrafts(
  s: PhotoDraftState,
  added: PhotoDraft[],
): PhotoDraftState {
  const items = [...s.items, ...added];
  return { items, coverKey: s.coverKey ?? items[0]?.key };
}

export function removeDraft(s: PhotoDraftState, key: string): PhotoDraftState {
  const idx = s.items.findIndex((i) => i.key === key);
  const items = s.items.filter((i) => i.key !== key);
  const coverKey =
    s.coverKey === key ? (items[idx] ?? items[idx - 1])?.key : s.coverKey;
  return { items, coverKey };
}

export function moveDraft(
  s: PhotoDraftState,
  key: string,
  delta: -1 | 1,
): PhotoDraftState {
  const from = s.items.findIndex((i) => i.key === key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= s.items.length) return s;
  const items = [...s.items];
  [items[from], items[to]] = [items[to], items[from]];
  return { ...s, items };
}

export function setCoverDraft(s: PhotoDraftState, key: string): PhotoDraftState {
  return { ...s, coverKey: key };
}

export function coverIndex(s: PhotoDraftState): number {
  return s.items.findIndex((i) => i.key === s.coverKey);
}

export function draftsFromPhotos(
  photos: Photo[],
  coverPhotoId?: string,
): PhotoDraftState {
  return {
    items: photos.map((p) => ({ key: p.id, id: p.id, data: p.data, type: p.type })),
    coverKey: coverPhotoId ?? photos[0]?.id,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --run src/features/photos` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/photos
git commit -m "feat: add image compression and photo draft state"
```

---

### Task 6: Backup (JSON) and spreadsheet CSV import logic

**Files:**
- Create: `src/features/backup/backup.ts`, `src/features/backup/csvImport.ts`
- Test: `src/features/backup/backup.test.ts`, `src/features/backup/csvImport.test.ts`

**Interfaces:**
- Consumes: repository `exportAll`, `replaceAll`, `createListing`, `addNote`, `clearAll`, `DbSnapshot` (Task 3); `parseNumberInput`, `normalizeText` (Task 2); `readStorage`, `writeStorage` (Task 4)
- Produces:
  - `backup.ts`: `BACKUP_VERSION = 1`, `interface BackupFile`, `class BackupError extends Error`, `bufferToBase64(buf: ArrayBuffer): string`, `base64ToBuffer(b64: string): ArrayBuffer`, `toBackup(s: DbSnapshot, exportedAt?: number): BackupFile`, `fromBackup(raw: unknown): DbSnapshot` (throws `BackupError`), `importBackupText(text: string, confirm: () => boolean): Promise<'imported' | 'cancelled'>`, `exportBackup(): Promise<void>`, `EXPORTED_EVENT = 'car-tracker:exported'`, `getLastExportAt(): number | undefined`, `NUDGE_AFTER_DAYS = 14`, `shouldNudge(lastExportAt: number | undefined, now: number): boolean`
  - `csvImport.ts`: `interface CsvRow { input: ListingInput; note?: string }`, `parseSpreadsheetCsv(text: string): { rows: CsvRow[]; skipped: number }`, `importCsvRows(rows: CsvRow[]): Promise<number>`

- [ ] **Step 1: Write failing tests**

`src/features/backup/backup.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import {
  BackupError,
  base64ToBuffer,
  bufferToBase64,
  fromBackup,
  importBackupText,
  shouldNudge,
  toBackup,
} from './backup';

beforeEach(() => repo.clearAll());

async function seed() {
  const id = await repo.createListing({ model: 'Golf Mk4 2.0', status: 'new' });
  await repo.syncPhotos(
    id,
    [{ data: new Uint8Array([0, 255, 7]).buffer as ArrayBuffer, type: 'image/jpeg' }],
    0,
  );
  await repo.addNote(id, 'Tiene deuda');
  return id;
}

describe('base64', () => {
  it('round-trips bytes including large buffers', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    const back = new Uint8Array(base64ToBuffer(bufferToBase64(big.buffer)));
    expect(back).toEqual(big);
  });
});

describe('toBackup / fromBackup', () => {
  it('round-trips a snapshot through JSON', async () => {
    await seed();
    const snap = await repo.exportAll();
    const json = JSON.parse(JSON.stringify(toBackup(snap, 123)));
    expect(json).toMatchObject({ app: 'car-tracker', version: 1, exportedAt: 123 });
    const back = fromBackup(json);
    expect(back.listings).toEqual(snap.listings);
    expect(back.notes).toEqual(snap.notes);
    expect(Array.from(new Uint8Array(back.photos[0].data))).toEqual([0, 255, 7]);
  });

  it.each([
    ['empty object', {}],
    ['other app', { app: 'x', version: 1, listings: [], notes: [], photos: [] }],
    ['future version', { app: 'car-tracker', version: 2, listings: [], notes: [], photos: [] }],
    ['missing arrays', { app: 'car-tracker', version: 1 }],
    ['bad listing', { app: 'car-tracker', version: 1, listings: [{ id: 1 }], notes: [], photos: [] }],
    ['bad base64', {
      app: 'car-tracker', version: 1, listings: [], notes: [],
      photos: [{ id: 'p', listingId: 'l', order: 0, createdAt: 0, type: 'image/jpeg', data: '%%%' }],
    }],
  ])('rejects %s', (_, raw) => {
    expect(() => fromBackup(raw)).toThrow(BackupError);
  });
});

describe('importBackupText', () => {
  it('leaves existing data untouched when the file is invalid', async () => {
    await seed();
    await expect(importBackupText('not json', () => true)).rejects.toThrow(BackupError);
    await expect(importBackupText('{}', () => true)).rejects.toThrow(BackupError);
    expect((await repo.exportAll()).listings).toHaveLength(1);
  });

  it('does nothing when the user cancels', async () => {
    await seed();
    const text = JSON.stringify(toBackup({ listings: [], photos: [], notes: [] }));
    expect(await importBackupText(text, () => false)).toBe('cancelled');
    expect((await repo.exportAll()).listings).toHaveLength(1);
  });

  it('replaces everything on confirm', async () => {
    await seed();
    const text = JSON.stringify(toBackup({ listings: [], photos: [], notes: [] }));
    expect(await importBackupText(text, () => true)).toBe('imported');
    expect((await repo.exportAll()).listings).toHaveLength(0);
  });
});

describe('shouldNudge', () => {
  const day = 86_400_000;
  it('nudges when never exported or older than 14 days', () => {
    expect(shouldNudge(undefined, 0)).toBe(true);
    expect(shouldNudge(0, 15 * day)).toBe(true);
    expect(shouldNudge(0, 13 * day)).toBe(false);
  });
});
```

`src/features/backup/csvImport.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import { importCsvRows, parseSpreadsheetCsv } from './csvImport';

const SHEET = [
  '﻿Modelo,Color,Año,KMs,Precio,Link,Estado,Comentarios',
  'Golf Mk4 2.0,Gris claro,2005,"250,000","$ 9,375.00",https://www.facebook.com/marketplace/item/1,Interior OK. Razonable,Con deuda. Parabrisa polarizado.',
  'Golf Mk4 1.6,Azul,??,??,"$ 7,500.00",Facebook,,',
  'Golf Mk4 2.0,Verde,2000,"361,565","$ 8,000.00",,"Caminado, gastado y sucio adentro",Ta caro',
  ',Negro,2001,,,,,',
].join('\n');

beforeEach(() => repo.clearAll());

describe('parseSpreadsheetCsv', () => {
  it('maps the real spreadsheet format', () => {
    const { rows, skipped } = parseSpreadsheetCsv(SHEET);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      input: {
        model: 'Golf Mk4 2.0',
        color: 'Gris claro',
        year: 2005,
        km: 250000,
        price: 9375,
        url: 'https://www.facebook.com/marketplace/item/1',
        condition: 'Interior OK. Razonable',
        status: 'new',
      },
      note: 'Con deuda. Parabrisa polarizado.',
    });
  });

  it('turns ?? and empty cells into undefined and drops non-URL links', () => {
    const { rows } = parseSpreadsheetCsv(SHEET);
    expect(rows[1].input).toEqual({
      model: 'Golf Mk4 1.6',
      color: 'Azul',
      year: undefined,
      km: undefined,
      price: 7500,
      url: undefined,
      condition: undefined,
      status: 'new',
    });
    expect(rows[1].note).toBeUndefined();
  });

  it('keeps quoted commas inside fields', () => {
    expect(parseSpreadsheetCsv(SHEET).rows[2].input.condition).toBe(
      'Caminado, gastado y sucio adentro',
    );
  });

  it('ignores fully blank rows', () => {
    expect(parseSpreadsheetCsv(`${SHEET}\n,,,,,,,\n\n`).rows).toHaveLength(3);
  });
});

describe('importCsvRows', () => {
  it('appends listings and adds comments as first note', async () => {
    await repo.createListing({ model: 'Existente', status: 'seen' });
    const n = await importCsvRows(parseSpreadsheetCsv(SHEET).rows);
    expect(n).toBe(3);
    const snap = await repo.exportAll();
    expect(snap.listings).toHaveLength(4);
    expect(snap.notes.map((x) => x.text).sort()).toEqual([
      'Con deuda. Parabrisa polarizado.',
      'Ta caro',
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/features/backup` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement backup**

`src/features/backup/backup.ts`:

```ts
import { exportAll, replaceAll, type DbSnapshot } from '../../db/repository';
import {
  isListingStatus,
  type Listing,
  type Note,
  type Photo,
} from '../../domain/listing';
import { readStorage, writeStorage } from '../../lib/storage';

export const BACKUP_VERSION = 1;
export const EXPORTED_EVENT = 'car-tracker:exported';
export const NUDGE_AFTER_DAYS = 14;
const LAST_EXPORT_KEY = 'car-tracker:lastExportAt';
const DAY_MS = 86_400_000;

type BackupPhoto = Omit<Photo, 'data'> & { data: string };

export interface BackupFile {
  app: 'car-tracker';
  version: number;
  exportedAt: number;
  listings: Listing[];
  notes: Note[];
  photos: BackupPhoto[];
}

export class BackupError extends Error {}

export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function toBackup(s: DbSnapshot, exportedAt = Date.now()): BackupFile {
  return {
    app: 'car-tracker',
    version: BACKUP_VERSION,
    exportedAt,
    listings: s.listings,
    notes: s.notes,
    photos: s.photos.map((p) => ({ ...p, data: bufferToBase64(p.data) })),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasStrings = (v: unknown, keys: string[]) =>
  isRecord(v) && keys.every((k) => typeof v[k] === 'string');

export function fromBackup(raw: unknown): DbSnapshot {
  if (!isRecord(raw) || raw.app !== 'car-tracker') {
    throw new BackupError('El archivo no es un backup de Car Tracker.');
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new BackupError(`Versión de backup no soportada: ${String(raw.version)}.`);
  }
  const { listings, notes, photos } = raw;
  if (!Array.isArray(listings) || !Array.isArray(notes) || !Array.isArray(photos)) {
    throw new BackupError('El backup está incompleto.');
  }
  if (
    !listings.every(
      (l) => hasStrings(l, ['id', 'model']) && isListingStatus((l as Listing).status),
    ) ||
    !notes.every((n) => hasStrings(n, ['id', 'listingId', 'text'])) ||
    !photos.every((p) => hasStrings(p, ['id', 'listingId', 'type', 'data']))
  ) {
    throw new BackupError('El backup tiene datos inválidos.');
  }
  try {
    return {
      listings: listings as Listing[],
      notes: notes as Note[],
      photos: (photos as BackupPhoto[]).map((p) => ({
        ...p,
        data: base64ToBuffer(p.data),
      })),
    };
  } catch {
    throw new BackupError('El backup tiene fotos dañadas.');
  }
}

export async function importBackupText(
  text: string,
  confirm: () => boolean,
): Promise<'imported' | 'cancelled'> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es un JSON válido.');
  }
  const snapshot = fromBackup(raw);
  if (!confirm()) return 'cancelled';
  await replaceAll(snapshot);
  return 'imported';
}

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportBackup(): Promise<void> {
  const file = toBackup(await exportAll());
  const date = new Date().toLocaleDateString('sv-SE');
  downloadJson(file, `car-tracker-${date}.json`);
  writeStorage(LAST_EXPORT_KEY, String(file.exportedAt));
  window.dispatchEvent(new Event(EXPORTED_EVENT));
}

export function getLastExportAt(): number | undefined {
  const v = Number(readStorage(LAST_EXPORT_KEY));
  return v > 0 ? v : undefined;
}

export function shouldNudge(lastExportAt: number | undefined, now: number) {
  return lastExportAt === undefined || now - lastExportAt > NUDGE_AFTER_DAYS * DAY_MS;
}
```

`sv-SE` locale formats dates as `YYYY-MM-DD` in local time.

- [ ] **Step 4: Implement CSV import**

`src/features/backup/csvImport.ts`:

```ts
import Papa from 'papaparse';
import { addNote, createListing } from '../../db/repository';
import { normalizeText, parseNumberInput } from '../../domain/format';
import type { ListingInput } from '../../domain/listing';

export interface CsvRow {
  input: ListingInput;
  note?: string;
}

const clean = (v?: string) => {
  const t = v?.trim();
  return !t || t === '??' ? undefined : t;
};

export function parseSpreadsheetCsv(text: string): {
  rows: CsvRow[];
  skipped: number;
} {
  const { data } = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => normalizeText(h.replace(/^﻿/, '')),
  });

  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const r of data) {
    const model = clean(r.modelo);
    if (!model) {
      skipped++;
      continue;
    }
    const link = clean(r.link);
    rows.push({
      input: {
        model,
        color: clean(r.color),
        year: parseNumberInput(clean(r.ano)),
        km: parseNumberInput(clean(r.kms)),
        price: parseNumberInput(clean(r.precio)),
        url: link && /^https?:\/\//i.test(link) ? link : undefined,
        condition: clean(r.estado),
        status: 'new',
      },
      note: clean(r.comentarios),
    });
  }
  return { rows, skipped };
}

export async function importCsvRows(rows: CsvRow[]): Promise<number> {
  for (const { input, note } of rows) {
    const id = await createListing(input);
    if (note) await addNote(id, note);
  }
  return rows.length;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- --run src/features/backup` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/backup
git commit -m "feat: add JSON backup and spreadsheet CSV import logic"
```

---

### Task 7: Shared UI, layout and router shell

**Files:**
- Create: `src/components/ui.ts`, `src/components/Toast.tsx`, `src/components/StarRating.tsx`, `src/components/Status.tsx`, `src/components/Layout.tsx`, `src/components/NotFound.tsx`, `src/lib/useObjectUrl.ts`, `src/router.tsx`, `src/test/render.tsx`
- Modify: `src/main.tsx` (replace placeholder)
- Delete: `src/smoke.test.ts`
- Test: `src/components/StarRating.test.tsx`

**Interfaces:**
- Consumes: `Rating`, `ListingStatus`, `LISTING_STATUSES`, `STATUS_LABELS` (Task 2)
- Produces:
  - `ui.ts`: `inputCls`, `btnPrimary`, `btnSecondary`, `btnDanger` (string constants)
  - `Toast.tsx`: `ToastProvider`, `useToast(): (message: string, kind?: 'info' | 'error') => void`
  - `StarRating.tsx`: `StarRating({ value?: Rating; onChange?: (v: Rating | undefined) => void; size?: 'sm' | 'md' })` — clicking the current value clears it
  - `Status.tsx`: `StatusBadge({ status })`, `StatusSelect({ id?, value, onChange })`
  - `NotFound.tsx`: `NotFound({ message? })`
  - `useObjectUrl.ts`: `useObjectUrl(data?: ArrayBuffer, type?: string): string | undefined`
  - `router.tsx`: `routes: RouteObject[]`, `router` — Layout with children; tasks 8–10 replace placeholder elements
  - `test/render.tsx`: `renderRoute(element, { path?, initialEntry? }): { router, ...RenderResult }`

- [ ] **Step 1: Write failing test**

`src/components/StarRating.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('sets the clicked value', async () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '3 estrellas' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('clears when clicking the current value', async () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '3 estrellas' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('is read-only without onChange', () => {
    render(<StarRating value={4} />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText('4 de 5 estrellas')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/components` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement shared components**

`src/components/ui.ts`:

```ts
export const inputCls =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const btn =
  'inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50';

export const btnPrimary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
export const btnSecondary = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
export const btnDanger = `${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`;
```

`src/components/Toast.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

type ToastKind = 'info' | 'error';
type ShowToast = (message: string, kind?: ToastKind) => void;

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<ShowToast>(() => {});
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback<ShowToast>((message, kind = 'info') => {
    const id = ++nextId;
    setItems((i) => [...i, { id, message, kind }]);
    setTimeout(() => setItems((i) => i.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-md px-4 py-3 text-sm text-white shadow-lg ${
              t.kind === 'error' ? 'bg-red-600' : 'bg-gray-900'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
```

`src/components/StarRating.tsx`:

```tsx
import type { Rating } from '../domain/listing';

const VALUES: Rating[] = [1, 2, 3, 4, 5];

interface Props {
  value?: Rating;
  onChange?: (value: Rating | undefined) => void;
  size?: 'sm' | 'md';
}

export function StarRating({ value, onChange, size = 'md' }: Props) {
  const text = size === 'sm' ? 'text-sm' : 'text-2xl';
  const star = (n: Rating) => (
    <span className={value !== undefined && n <= value ? 'text-amber-400' : 'text-gray-300'}>
      ★
    </span>
  );

  if (!onChange) {
    return (
      <span
        role="img"
        aria-label={value ? `${value} de 5 estrellas` : 'Sin calificar'}
        className={`inline-flex leading-none ${text}`}
      >
        {VALUES.map((n) => (
          <span key={n} aria-hidden>
            {star(n)}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label="Calificación" className={`inline-flex leading-none ${text}`}>
      {VALUES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? undefined : n)}
          className="px-0.5 hover:scale-110"
        >
          {star(n)}
        </button>
      ))}
    </div>
  );
}
```

`src/components/Status.tsx`:

```tsx
import {
  LISTING_STATUSES,
  STATUS_LABELS,
  type ListingStatus,
} from '../domain/listing';
import { inputCls } from './ui';

const STYLES: Record<ListingStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  seen: 'bg-green-100 text-green-800',
  discarded: 'bg-gray-200 text-gray-600',
  sold: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface SelectProps {
  id?: string;
  value: ListingStatus;
  onChange: (value: ListingStatus) => void;
}

export function StatusSelect({ id, value, onChange }: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ListingStatus)}
      className={inputCls}
    >
      {LISTING_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
```

`src/components/NotFound.tsx`:

```tsx
import { Link } from 'react-router';

export function NotFound({ message = 'No encontramos esa página.' }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="mb-4 text-gray-600">{message}</p>
      <Link to="/" className="text-blue-600 underline">
        Volver al listado
      </Link>
    </div>
  );
}
```

`src/components/Layout.tsx`:

```tsx
import { Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
```

`src/lib/useObjectUrl.ts`:

```ts
import { useEffect, useState } from 'react';

export function useObjectUrl(data?: ArrayBuffer, type?: string) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!data) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(new Blob([data], { type }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, type]);

  return url;
}
```

- [ ] **Step 4: Router, bootstrap and test helper**

`src/router.tsx`:

```tsx
import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { NotFound } from './components/NotFound';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <p className="p-4">Home</p> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

`src/main.tsx` (replace whole file):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/Toast';
import { router } from './router';
import './index.css';

void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
```

`src/test/render.tsx`:

```tsx
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Toast';

export function renderRoute(
  element: ReactElement,
  { path = '/', initialEntry = '/' }: { path?: string; initialEntry?: string } = {},
) {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <p>other page</p> },
    ],
    { initialEntries: [initialEntry] },
  );
  const result = render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return { router, ...result };
}
```

Delete `src/smoke.test.ts` (its checks are covered by real tests now):

```bash
git rm src/smoke.test.ts
```

- [ ] **Step 5: Verify**

Run: `npm test -- --run` → Expected: all pass.
Run: `npm run build` → Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared UI components, toasts and router shell"
```

---

### Task 8: Listing form with photo paste, create and edit pages

**Files:**
- Create: `src/features/photos/PhotoDropzone.tsx`, `src/features/photos/PhotoDraftList.tsx`, `src/features/listings/ListingForm.tsx`, `src/features/listings/ListingFormPages.tsx`
- Modify: `src/router.tsx` (add `/listings/new`, `/listings/:id/edit`)
- Test: `src/features/photos/PhotoDropzone.test.tsx`, `src/features/listings/ListingForm.test.tsx`

**Interfaces:**
- Consumes: `compressImage` + photo draft functions (Task 5); `createListing`, `updateListing`, `syncPhotos` (Task 3); `useListing`, `usePhotos` (Task 3); `parseNumberInput` (Task 2); `useToast`, `StarRating`, `StatusSelect`, `inputCls`, `btnPrimary`, `btnSecondary`, `NotFound`, `useObjectUrl`, `renderRoute` (Task 7)
- Produces:
  - `PhotoDropzone({ onAdd: (photos: PhotoData[]) => void })` — listens to window `paste` while mounted
  - `PhotoDraftList({ state: PhotoDraftState; onChange: (fn: (s: PhotoDraftState) => PhotoDraftState) => void })`
  - `ListingForm({ initial?: Listing; initialPhotos?: Photo[]; submitLabel: string; onSubmit: (input: ListingInput, photos: PhotoDraftState) => Promise<void>; onCancel: () => void })`
  - `NewListingPage`, `EditListingPage` (route components)

- [ ] **Step 1: Write failing tests**

`src/features/photos/PhotoDropzone.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { compressImage } from './compressImage';
import { PhotoDropzone } from './PhotoDropzone';

vi.mock('./compressImage', () => ({ compressImage: vi.fn() }));
const compress = vi.mocked(compressImage);

function paste(files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  window.dispatchEvent(event);
  return event;
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

beforeEach(() => {
  compress.mockReset();
  compress.mockImplementation(async () => ({
    data: new ArrayBuffer(1),
    type: 'image/jpeg',
  }));
});

describe('PhotoDropzone', () => {
  it('adds pasted images', async () => {
    const onAdd = vi.fn();
    render(<PhotoDropzone onAdd={onAdd} />, { wrapper: ToastProvider });
    const event = paste([png('a.png'), png('b.png')]);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0]).toHaveLength(2);
  });

  it('lets plain-text paste through untouched', () => {
    const onAdd = vi.fn();
    render(<PhotoDropzone onAdd={onAdd} />, { wrapper: ToastProvider });
    const event = paste([]);
    expect(event.defaultPrevented).toBe(false);
    expect(onAdd).not.toHaveBeenCalled();
    expect(compress).not.toHaveBeenCalled();
  });

  it('adds the good images and reports the ones that fail to decode', async () => {
    compress
      .mockResolvedValueOnce({ data: new ArrayBuffer(1), type: 'image/jpeg' })
      .mockRejectedValueOnce(new Error('decode'));
    const onAdd = vi.fn();
    render(<PhotoDropzone onAdd={onAdd} />, { wrapper: ToastProvider });
    paste([png('ok.png'), new File(['x'], 'bad.heic', { type: 'image/heic' })]);
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0]).toHaveLength(1);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo leer 1 imagen',
    );
  });
});
```

`src/features/listings/ListingForm.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../../test/render';
import { compressImage } from '../photos/compressImage';
import { ListingForm } from './ListingForm';

vi.mock('../photos/compressImage', () => ({ compressImage: vi.fn() }));

beforeEach(() => {
  vi.mocked(compressImage).mockResolvedValue({
    data: new ArrayBuffer(1),
    type: 'image/jpeg',
  });
});

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderRoute(
    <ListingForm submitLabel="Guardar" onSubmit={onSubmit} onCancel={() => {}} />,
  );
  return onSubmit;
}

describe('ListingForm', () => {
  it('requires model', async () => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('El modelo es obligatorio')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits parsed values with empty fields as undefined', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf Mk4 2.0');
    await userEvent.type(screen.getByLabelText('Precio (USD)'), '9,375.00');
    await userEvent.type(screen.getByLabelText('Kilómetros'), '250.000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [input, photos] = onSubmit.mock.calls[0];
    expect(input).toEqual({
      model: 'Golf Mk4 2.0',
      color: undefined,
      year: undefined,
      km: 250000,
      price: 9375,
      url: undefined,
      condition: undefined,
      description: undefined,
      rating: undefined,
      status: 'new',
    });
    expect(photos.items).toEqual([]);
  });

  it('adds pasted photos as drafts with the first as cover', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf');
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    window.dispatchEvent(event);
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const photos = onSubmit.mock.calls[0][1];
    expect(photos.items).toHaveLength(1);
    expect(photos.coverKey).toBe(photos.items[0].key);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/features/photos/PhotoDropzone.test.tsx src/features/listings/ListingForm.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement PhotoDropzone and PhotoDraftList**

`src/features/photos/PhotoDropzone.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import type { PhotoData } from '../../domain/listing';
import { compressImage } from './compressImage';

const isImage = (f: File) => f.type.startsWith('image/');

export function PhotoDropzone({ onAdd }: { onAdd: (photos: PhotoData[]) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter(isImage);
      if (!images.length) return;
      setBusy(true);
      const results = await Promise.allSettled(images.map((f) => compressImage(f)));
      setBusy(false);
      const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const failed = results.length - ok.length;
      if (failed) {
        toast(`No se pudo leer ${failed} imagen${failed > 1 ? 'es' : ''}`, 'error');
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
        Pegá fotos con <kbd className="rounded bg-gray-100 px-1">Ctrl/Cmd+V</kbd>,
        arrastralas acá o{' '}
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
```

`src/features/photos/PhotoDraftList.tsx`:

```tsx
import { useObjectUrl } from '../../lib/useObjectUrl';
import {
  moveDraft,
  removeDraft,
  setCoverDraft,
  type PhotoDraft,
  type PhotoDraftState,
} from './photoDrafts';

interface Props {
  state: PhotoDraftState;
  onChange: (fn: (s: PhotoDraftState) => PhotoDraftState) => void;
}

export function PhotoDraftList({ state, onChange }: Props) {
  if (!state.items.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {state.items.map((d, i) => (
        <DraftThumb
          key={d.key}
          draft={d}
          isCover={d.key === state.coverKey}
          isFirst={i === 0}
          isLast={i === state.items.length - 1}
          onRemove={() => onChange((s) => removeDraft(s, d.key))}
          onMove={(delta) => onChange((s) => moveDraft(s, d.key, delta))}
          onCover={() => onChange((s) => setCoverDraft(s, d.key))}
        />
      ))}
    </ul>
  );
}

interface ThumbProps {
  draft: PhotoDraft;
  isCover: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onCover: () => void;
}

function DraftThumb({ draft, isCover, isFirst, isLast, onRemove, onMove, onCover }: ThumbProps) {
  const url = useObjectUrl(draft.data, draft.type);
  const iconBtn = 'rounded px-1.5 py-0.5 hover:bg-gray-200 disabled:opacity-30';
  return (
    <li
      className={`relative overflow-hidden rounded-lg border-2 bg-white ${
        isCover ? 'border-blue-500' : 'border-transparent'
      }`}
    >
      {url && <img src={url} alt="" className="aspect-square w-full object-cover" />}
      {isCover && (
        <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white">
          Portada
        </span>
      )}
      <div className="flex items-center justify-between p-1 text-sm">
        <button type="button" aria-label="Mover a la izquierda" disabled={isFirst} onClick={() => onMove(-1)} className={iconBtn}>
          ←
        </button>
        {!isCover && (
          <button type="button" onClick={onCover} className={`${iconBtn} text-xs`}>
            Usar de portada
          </button>
        )}
        <button type="button" aria-label="Quitar foto" onClick={onRemove} className={`${iconBtn} text-red-600`}>
          ✕
        </button>
        <button type="button" aria-label="Mover a la derecha" disabled={isLast} onClick={() => onMove(1)} className={iconBtn}>
          →
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Implement ListingForm**

`src/features/listings/ListingForm.tsx`:

```tsx
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { StarRating } from '../../components/StarRating';
import { StatusSelect } from '../../components/Status';
import { useToast } from '../../components/Toast';
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui';
import { parseNumberInput } from '../../domain/format';
import type {
  Listing,
  ListingInput,
  ListingStatus,
  Photo,
  PhotoData,
  Rating,
} from '../../domain/listing';
import { PhotoDraftList } from '../photos/PhotoDraftList';
import { PhotoDropzone } from '../photos/PhotoDropzone';
import {
  addDrafts,
  draftsFromPhotos,
  EMPTY_DRAFTS,
  type PhotoDraftState,
} from '../photos/photoDrafts';

interface FieldState {
  model: string;
  color: string;
  year: string;
  km: string;
  price: string;
  url: string;
  condition: string;
  description: string;
  rating?: Rating;
  status: ListingStatus;
}

type TextField = Exclude<keyof FieldState, 'rating' | 'status' | 'description'>;

const TEXT_FIELDS: { key: TextField; label: string; numeric?: boolean; wide?: boolean }[] = [
  { key: 'model', label: 'Modelo *' },
  { key: 'color', label: 'Color' },
  { key: 'year', label: 'Año', numeric: true },
  { key: 'km', label: 'Kilómetros', numeric: true },
  { key: 'price', label: 'Precio (USD)', numeric: true },
  { key: 'condition', label: 'Condición' },
  { key: 'url', label: 'Link a la publicación', wide: true },
];

const toFields = (l?: Listing): FieldState => ({
  model: l?.model ?? '',
  color: l?.color ?? '',
  year: l?.year?.toString() ?? '',
  km: l?.km?.toString() ?? '',
  price: l?.price?.toString() ?? '',
  url: l?.url ?? '',
  condition: l?.condition ?? '',
  description: l?.description ?? '',
  rating: l?.rating,
  status: l?.status ?? 'new',
});

const blankToUndefined = (s: string) => (s.trim() === '' ? undefined : s.trim());

const toInput = (f: FieldState): ListingInput => ({
  model: f.model.trim(),
  color: blankToUndefined(f.color),
  year: parseNumberInput(f.year),
  km: parseNumberInput(f.km),
  price: parseNumberInput(f.price),
  url: blankToUndefined(f.url),
  condition: blankToUndefined(f.condition),
  description: f.description.trim() === '' ? undefined : f.description,
  rating: f.rating,
  status: f.status,
});

interface Props {
  initial?: Listing;
  initialPhotos?: Photo[];
  submitLabel: string;
  onSubmit: (input: ListingInput, photos: PhotoDraftState) => Promise<void>;
  onCancel: () => void;
}

export function ListingForm({ initial, initialPhotos, submitLabel, onSubmit, onCancel }: Props) {
  const toast = useToast();
  const [fields, setFields] = useState(() => toFields(initial));
  const [photos, setPhotos] = useState(() =>
    initialPhotos ? draftsFromPhotos(initialPhotos, initial?.coverPhotoId) : EMPTY_DRAFTS,
  );
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const allowNav = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowNav.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Tenés cambios sin guardar. ¿Salir igual?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof FieldState>(key: K, value: FieldState[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    if (key === 'model') setError(undefined);
  };

  const changePhotos = (fn: (s: PhotoDraftState) => PhotoDraftState) => {
    setPhotos(fn);
    setDirty(true);
  };

  const addPhotos = (added: PhotoData[]) =>
    changePhotos((s) =>
      addDrafts(s, added.map((p) => ({ key: crypto.randomUUID(), ...p }))),
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fields.model.trim()) {
      setError('El modelo es obligatorio');
      return;
    }
    setSubmitting(true);
    allowNav.current = true;
    try {
      await onSubmit(toInput(fields), photos);
    } catch {
      allowNav.current = false;
      toast('No se pudo guardar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map(({ key, label, numeric, wide }) => (
          <Field key={key} id={`f-${key}`} label={label} wide={wide}>
            <input
              id={`f-${key}`}
              value={fields[key]}
              inputMode={numeric ? 'numeric' : undefined}
              type={key === 'url' ? 'url' : 'text'}
              onChange={(e) => set(key, e.target.value)}
              className={inputCls}
              aria-invalid={key === 'model' && !!error}
            />
            {key === 'model' && error && <p className="text-sm text-red-600">{error}</p>}
          </Field>
        ))}
        <Field id="f-status" label="Estado">
          <StatusSelect id="f-status" value={fields.status} onChange={(v) => set('status', v)} />
        </Field>
        <Field label="Calificación">
          <StarRating value={fields.rating} onChange={(v) => set('rating', v)} />
        </Field>
        <Field id="f-description" label="Descripción de la publicación" wide>
          <textarea
            id="f-description"
            rows={6}
            value={fields.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Pegá acá el texto de la publicación"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Fotos</h2>
        <PhotoDropzone onAdd={addPhotos} />
        <PhotoDraftList state={photos} onChange={changePhotos} />
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  wide,
  children,
}: {
  id?: string;
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      {id ? (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Implement pages and routes**

`src/features/listings/ListingFormPages.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router';
import { NotFound } from '../../components/NotFound';
import { useListing, usePhotos } from '../../db/hooks';
import { createListing, syncPhotos, updateListing } from '../../db/repository';
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
    return <p className="p-4 text-gray-500">Cargando…</p>;
  }
  if (listing === null) return <NotFound message="No encontramos esa publicación." />;

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
```

`src/router.tsx` — replace the `children` array with:

```tsx
    children: [
      { path: '/', element: <p className="p-4">Home</p> },
      { path: '/listings/new', element: <NewListingPage /> },
      { path: '/listings/:id/edit', element: <EditListingPage /> },
      { path: '*', element: <NotFound /> },
    ],
```

and add the import:

```tsx
import { EditListingPage, NewListingPage } from './features/listings/ListingFormPages';
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- --run` → Expected: all pass.
Run: `npm run typecheck` → Expected: exits 0.

- [ ] **Step 7: Manual check**

Run `npm run dev`, open `/listings/new`, paste a screenshot (Cmd+V) with focus outside inputs and again with focus inside the description textarea: both add a photo. Copy plain text and paste into the description: text appears, no photo added. Fill model, click Crear: navigates to `/listings/<id>` (shows "No encontramos esa página" until Task 10; that is expected).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add listing form with photo paste and create/edit pages"
```

---

### Task 9: Home page with grid and table views

**Files:**
- Create: `src/features/listings/FiltersBar.tsx`, `src/features/listings/ListingCard.tsx`, `src/features/listings/ListingGrid.tsx`, `src/features/listings/ListingTable.tsx`, `src/features/listings/HomePage.tsx`
- Modify: `src/router.tsx` (`/` → `<HomePage />`)
- Test: `src/features/listings/HomePage.test.tsx`

**Interfaces:**
- Consumes: `useListings`, `usePhoto` (Task 3); `filterListings`, `sortListings`, `SORT_FIELDS`, `SORT_LABELS`, `Filters`, `SortState`, `SortField` (Task 4); `useHomeState`, `ViewMode` (Task 4); formatters + `colorToHex`, `listingTitle` (Task 2); `StarRating`, `StatusBadge`, `inputCls`, `btnPrimary`, `useObjectUrl`, `renderRoute` (Task 7)
- Produces: `HomePage`, `ListingGrid({ listings })`, `ListingCard({ listing })`, `ListingTable({ listings, sort, onSort })`, `FiltersBar({ filters, sort, onFilters, onSort })`

- [ ] **Step 1: Write failing test**

`src/features/listings/HomePage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { HomePage } from './HomePage';

beforeEach(async () => {
  await repo.clearAll();
  await repo.createListing({ model: 'Golf Alfa', status: 'new', price: 9000 });
  await repo.createListing({ model: 'Golf Beta', status: 'discarded' });
  await repo.createListing({ model: 'Golf Gamma', status: 'sold' });
});

describe('HomePage', () => {
  it('hides discarded and sold listings by default', async () => {
    renderRoute(<HomePage />);
    expect(await screen.findByText(/Golf Alfa/)).toBeInTheDocument();
    expect(screen.queryByText(/Golf Beta/)).toBeNull();
    expect(screen.queryByText(/Golf Gamma/)).toBeNull();
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
  });

  it('shows discarded listings when that status is toggled on', async () => {
    renderRoute(<HomePage />);
    await screen.findByText(/Golf Alfa/);
    await userEvent.click(screen.getByLabelText('Descartado'));
    expect(await screen.findByText(/Golf Beta/)).toBeInTheDocument();
  });

  it('switches to the table view with missing values as ??', async () => {
    const { router } = renderRoute(<HomePage />);
    await screen.findByText(/Golf Alfa/);
    await userEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    expect(router.state.location.search).toBe('?view=table');
    const row = (await screen.findByRole('cell', { name: 'Golf Alfa' })).closest('tr')!;
    expect(row).toHaveTextContent('$ 9,000');
    expect(row).toHaveTextContent('??');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/features/listings/HomePage.test.tsx` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement FiltersBar**

`src/features/listings/FiltersBar.tsx`:

```tsx
import { inputCls } from '../../components/ui';
import { parseNumberInput } from '../../domain/format';
import {
  LISTING_STATUSES,
  STATUS_LABELS,
  type ListingStatus,
} from '../../domain/listing';
import {
  SORT_FIELDS,
  SORT_LABELS,
  type Filters,
  type SortField,
  type SortState,
} from '../../domain/sortFilter';

interface Props {
  filters: Filters;
  sort: SortState;
  onFilters: (f: Filters) => void;
  onSort: (s: SortState) => void;
}

export function FiltersBar({ filters, sort, onFilters, onSort }: Props) {
  const toggleStatus = (s: ListingStatus) =>
    onFilters({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : LISTING_STATUSES.filter((x) => x === s || filters.statuses.includes(x)),
    });

  const small = `${inputCls} !py-1`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg bg-white p-3 text-sm shadow-sm">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Estado</legend>
        {LISTING_STATUSES.map((s) => {
          const on = filters.statuses.includes(s);
          return (
            <label
              key={s}
              className={`cursor-pointer rounded-full border px-2.5 py-1 ${
                on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleStatus(s)} />
              {STATUS_LABELS[s]}
            </label>
          );
        })}
      </fieldset>

      <label className="flex items-center gap-1.5">
        Estrellas
        <select
          value={filters.minRating ?? ''}
          onChange={(e) =>
            onFilters({ ...filters, minRating: e.target.value ? Number(e.target.value) : undefined })
          }
          className={`${small} !w-auto`}
        >
          <option value="">Cualquiera</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}+
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        Precio
        <input
          aria-label="Precio mínimo"
          inputMode="numeric"
          placeholder="desde"
          value={filters.minPrice ?? ''}
          onChange={(e) => onFilters({ ...filters, minPrice: parseNumberInput(e.target.value) })}
          className={`${small} !w-24`}
        />
        <input
          aria-label="Precio máximo"
          inputMode="numeric"
          placeholder="hasta"
          value={filters.maxPrice ?? ''}
          onChange={(e) => onFilters({ ...filters, maxPrice: parseNumberInput(e.target.value) })}
          className={`${small} !w-24`}
        />
      </div>

      <label className="flex items-center gap-1.5 sm:ml-auto">
        Ordenar por
        <select
          value={sort.field}
          onChange={(e) => onSort({ ...sort, field: e.target.value as SortField })}
          className={`${small} !w-auto`}
        >
          {SORT_FIELDS.map((f) => (
            <option key={f} value={f}>
              {SORT_LABELS[f]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={sort.dir === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
          onClick={() => onSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {sort.dir === 'asc' ? '↑' : '↓'}
        </button>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Implement grid and card**

`src/features/listings/ListingCard.tsx`:

```tsx
import { Link } from 'react-router';
import { StarRating } from '../../components/StarRating';
import { StatusBadge } from '../../components/Status';
import { usePhoto } from '../../db/hooks';
import { colorToHex, formatKm, formatPrice, listingTitle } from '../../domain/format';
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
        className="flex aspect-[4/3] items-center justify-center"
        style={url ? undefined : { backgroundColor: colorToHex(listing.color) }}
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="rounded bg-white/80 px-2 py-0.5 text-xs text-gray-600">Sin fotos</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold group-hover:text-blue-700">{listingTitle(listing)}</h3>
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
```

`src/features/listings/ListingGrid.tsx`:

```tsx
import type { Listing } from '../../domain/listing';
import { ListingCard } from './ListingCard';

export function ListingGrid({ listings }: { listings: Listing[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement table**

`src/features/listings/ListingTable.tsx`:

```tsx
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { StarRating } from '../../components/StarRating';
import { StatusBadge } from '../../components/Status';
import {
  MISSING,
  formatDate,
  formatKm,
  formatPrice,
  formatValue,
} from '../../domain/format';
import type { Listing } from '../../domain/listing';
import {
  SORT_FIELDS,
  SORT_LABELS,
  type SortField,
  type SortState,
} from '../../domain/sortFilter';

const col = createColumnHelper<Listing>();

const columns = [
  col.accessor('model', { header: SORT_LABELS.model }),
  col.accessor('color', { header: SORT_LABELS.color, cell: (c) => formatValue(c.getValue()) }),
  col.accessor('year', { header: SORT_LABELS.year, cell: (c) => formatValue(c.getValue()) }),
  col.accessor('km', { header: SORT_LABELS.km, cell: (c) => formatKm(c.getValue()) }),
  col.accessor('price', { header: SORT_LABELS.price, cell: (c) => formatPrice(c.getValue()) }),
  col.accessor('condition', {
    header: SORT_LABELS.condition,
    cell: (c) => formatValue(c.getValue()),
  }),
  col.accessor('rating', {
    header: SORT_LABELS.rating,
    cell: (c) => <StarRating value={c.getValue()} size="sm" />,
  }),
  col.accessor('status', {
    header: SORT_LABELS.status,
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  col.accessor('updatedAt', {
    header: SORT_LABELS.updatedAt,
    cell: (c) => formatDate(c.getValue()),
  }),
  col.display({
    id: 'url',
    header: 'Link',
    cell: (c) =>
      c.row.original.url ? (
        <a
          href={c.row.original.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 underline"
        >
          Ver ↗
        </a>
      ) : (
        MISSING
      ),
  }),
];

const isSortField = (id: string): id is SortField => SORT_FIELDS.includes(id as SortField);

interface Props {
  listings: Listing[];
  sort: SortState;
  onSort: (s: SortState) => void;
}

export function ListingTable({ listings, sort, onSort }: Props) {
  const navigate = useNavigate();
  const table = useReactTable({
    data: listings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (l) => l.id,
  });

  const toggle = (field: SortField) =>
    onSort(
      sort.field === field
        ? { field, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const id = h.column.id;
                const label = flexRender(h.column.columnDef.header, h.getContext());
                return (
                  <th key={h.id} className="whitespace-nowrap px-3 py-2 font-medium">
                    {isSortField(id) ? (
                      <button type="button" onClick={() => toggle(id)} className="hover:text-gray-900">
                        {label}
                        {sort.field === id && (sort.dir === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/listings/${row.id}`)}
              className="cursor-pointer border-t border-gray-100 hover:bg-blue-50"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Implement HomePage and route**

`src/features/listings/HomePage.tsx`:

```tsx
import { useMemo } from 'react';
import { Link } from 'react-router';
import { btnPrimary, inputCls } from '../../components/ui';
import { useListings } from '../../db/hooks';
import { filterListings, sortListings } from '../../domain/sortFilter';
import { FiltersBar } from './FiltersBar';
import { useHomeState, type ViewMode } from './homeState';
import { ListingGrid } from './ListingGrid';
import { ListingTable } from './ListingTable';

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: 'grid', label: 'Grilla' },
  { mode: 'table', label: 'Tabla' },
];

export function HomePage() {
  const listings = useListings();
  const [state, update] = useHomeState();

  const visible = useMemo(
    () => (listings ? sortListings(filterListings(listings, state.filters), state.sort) : []),
    [listings, state.filters, state.sort],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">Autos</h1>
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar modelo, color, condición…"
          value={state.filters.q}
          onChange={(e) => update({ filters: { ...state.filters, q: e.target.value } })}
          className={`${inputCls} sm:!w-72`}
        />
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
          {VIEWS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={state.view === mode}
              onClick={() => update({ view: mode })}
              className={`px-3 py-2 text-sm ${
                state.view === mode ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to="/listings/new" className={btnPrimary}>
          + Nueva
        </Link>
      </header>

      <FiltersBar
        filters={state.filters}
        sort={state.sort}
        onFilters={(filters) => update({ filters })}
        onSort={(sort) => update({ sort })}
      />

      {listings === undefined ? (
        <p className="text-gray-500">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-white p-8 text-center text-gray-500">
          {listings.length === 0
            ? 'Todavía no cargaste ninguna publicación.'
            : 'Ninguna publicación coincide con los filtros.'}
        </p>
      ) : state.view === 'grid' ? (
        <ListingGrid listings={visible} />
      ) : (
        <ListingTable listings={visible} sort={state.sort} onSort={(sort) => update({ sort })} />
      )}

      <p className="text-sm text-gray-500">
        {visible.length} de {listings?.length ?? 0}
      </p>
    </div>
  );
}
```

`src/router.tsx` — replace the `/` placeholder element and add the import:

```tsx
      { path: '/', element: <HomePage /> },
```

```tsx
import { HomePage } from './features/listings/HomePage';
```

- [ ] **Step 7: Run to verify pass**

Run: `npm test -- --run` → Expected: all pass.
Run: `npm run typecheck` → Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add home page with filters, grid and sortable table"
```

---

### Task 10: Listing detail page with gallery and notes

**Files:**
- Create: `src/features/photos/PhotoGallery.tsx`, `src/features/notes/NotesPanel.tsx`, `src/features/listings/ListingDetailPage.tsx`
- Modify: `src/router.tsx` (add `/listings/:id`)
- Test: `src/features/notes/NotesPanel.test.tsx`, `src/features/listings/ListingDetailPage.test.tsx`

**Interfaces:**
- Consumes: `useListing`, `usePhotos`, `useNotes` (Task 3); `updateListing`, `deleteListing`, `addNote`, `deleteNote` (Task 3); formatters (Task 2); `StarRating`, `StatusSelect`, `NotFound`, `useToast`, `btnSecondary`, `btnDanger`, `btnPrimary`, `inputCls`, `useObjectUrl`, `renderRoute` (Task 7)
- Produces: `PhotoGallery({ photos: Photo[]; coverPhotoId?: string })`, `PhotoImg({ photo, className })`, `NotesPanel({ listingId })`, `ListingDetailPage`

- [ ] **Step 1: Write failing tests**

`src/features/notes/NotesPanel.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { NotesPanel } from './NotesPanel';

let id: string;
beforeEach(async () => {
  await repo.clearAll();
  id = await repo.createListing({ model: 'Golf', status: 'new' });
});

describe('NotesPanel', () => {
  it('adds a note and clears the textarea', async () => {
    renderRoute(<NotesPanel listingId={id} />);
    expect(await screen.findByText('Sin notas todavía.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nueva nota'), 'Llamar el lunes');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar nota' }));
    expect(await screen.findByText('Llamar el lunes')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva nota')).toHaveValue('');
  });

  it('deletes a note after confirmation', async () => {
    await repo.addNote(id, 'Borrame');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute(<NotesPanel listingId={id} />);
    const item = (await screen.findByText('Borrame')).closest('li')!;
    await userEvent.click(within(item).getByRole('button', { name: 'Borrar nota' }));
    expect(await screen.findByText('Sin notas todavía.')).toBeInTheDocument();
  });
});
```

`src/features/listings/ListingDetailPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { ListingDetailPage } from './ListingDetailPage';

beforeEach(() => repo.clearAll());

const renderDetail = (id: string) =>
  renderRoute(<ListingDetailPage />, {
    path: '/listings/:id',
    initialEntry: `/listings/${id}`,
  });

describe('ListingDetailPage', () => {
  it('shows not found for an unknown id', async () => {
    renderDetail('nope');
    expect(await screen.findByText('No encontramos esa publicación.')).toBeInTheDocument();
  });

  it('shows the data sheet with ?? for missing values and updates rating inline', async () => {
    const id = await repo.createListing({ model: 'Golf Mk4 2.0', status: 'new', price: 9375 });
    renderDetail(id);
    expect(await screen.findByRole('heading', { name: /Golf Mk4 2.0/ })).toBeInTheDocument();
    expect(screen.getAllByText('$ 9,375').length).toBeGreaterThan(0);
    expect(screen.getAllByText('??').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
    await waitFor(async () => expect((await repo.getListing(id))!.rating).toBe(4));
  });

  it('deletes after confirmation and goes home', async () => {
    const id = await repo.createListing({ model: 'Golf', status: 'new' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { router } = renderDetail(id);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await repo.getListing(id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/features/notes src/features/listings/ListingDetailPage.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement PhotoGallery**

`src/features/photos/PhotoGallery.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Photo } from '../../domain/listing';
import { useObjectUrl } from '../../lib/useObjectUrl';

export function PhotoImg({ photo, className }: { photo: Photo; className?: string }) {
  const url = useObjectUrl(photo.data, photo.type);
  return url ? <img src={url} alt="" className={className} /> : <div className={className} />;
}

export function PhotoGallery({ photos, coverPhotoId }: { photos: Photo[]; coverPhotoId?: string }) {
  const [index, setIndex] = useState(() =>
    Math.max(0, photos.findIndex((p) => p.id === coverPhotoId)),
  );
  const [open, setOpen] = useState(false);

  if (!photos.length) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-gray-100 text-gray-400">
        Sin fotos
      </div>
    );
  }

  const safeIndex = Math.min(index, photos.length - 1);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(true)} className="block w-full" aria-label="Ver foto en grande">
        <PhotoImg photo={photos[safeIndex]} className="aspect-[4/3] w-full rounded-lg bg-gray-100 object-cover" />
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
                i === safeIndex ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <PhotoImg photo={p} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <Lightbox photos={photos} index={safeIndex} onIndex={setIndex} onClose={() => setOpen(false)} />
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
  const go = (delta: number) => onIndex((index + delta + photos.length) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose]);

  const navBtn = 'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-4 py-3 text-2xl text-white hover:bg-white/30';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="contents">
        <PhotoImg photo={photos[index]} className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Anterior" onClick={() => go(-1)} className={`${navBtn} left-4`}>
              ‹
            </button>
            <button type="button" aria-label="Siguiente" onClick={() => go(1)} className={`${navBtn} right-4`}>
              ›
            </button>
          </>
        )}
      </div>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute right-4 top-4 text-3xl text-white">
        ✕
      </button>
      <span className="absolute bottom-4 text-sm text-white/80">
        {index + 1} / {photos.length}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Implement NotesPanel**

`src/features/notes/NotesPanel.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/Toast';
import { btnPrimary, inputCls } from '../../components/ui';
import { useNotes } from '../../db/hooks';
import { addNote, deleteNote } from '../../db/repository';
import { formatDateTime } from '../../domain/format';

export function NotesPanel({ listingId }: { listingId: string }) {
  const notes = useNotes(listingId);
  const toast = useToast();
  const [text, setText] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      await addNote(listingId, t);
      setText('');
    } catch {
      toast('No se pudo guardar la nota', 'error');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Borrar esta nota?')) return;
    try {
      await deleteNote(id);
    } catch {
      toast('No se pudo borrar la nota', 'error');
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Notas</h2>
      {notes?.length === 0 && <p className="text-sm text-gray-500">Sin notas todavía.</p>}
      <ul className="space-y-2">
        {notes?.map((n) => (
          <li key={n.id} className="rounded-lg bg-white p-3 shadow-sm">
            <p className="whitespace-pre-wrap">{n.text}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <time>{formatDateTime(n.createdAt)}</time>
              <button
                type="button"
                aria-label="Borrar nota"
                onClick={() => void remove(n.id)}
                className="text-red-600 hover:underline"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          aria-label="Nueva nota"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribí una nota para vos…"
          className={inputCls}
        />
        <button type="submit" disabled={!text.trim()} className={btnPrimary}>
          Agregar nota
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 5: Implement ListingDetailPage and route**

`src/features/listings/ListingDetailPage.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFound } from '../../components/NotFound';
import { StarRating } from '../../components/StarRating';
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
  if (listing === null) return <NotFound message="No encontramos esa publicación." />;

  const patch = (p: Partial<ListingInput>) =>
    updateListing(id, p).catch(() => toast('No se pudo guardar', 'error'));

  const remove = async () => {
    if (!window.confirm('¿Borrar esta publicación con sus fotos y notas?')) return;
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
          <p className="text-xl font-semibold text-gray-700">{formatPrice(listing.price)}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/listings/${id}/edit`} className={btnSecondary}>
            Editar
          </Link>
          <button type="button" onClick={() => void remove()} className={btnDanger}>
            Borrar
          </button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <PhotoGallery key={photos.map((p) => p.id).join()} photos={photos} coverPhotoId={listing.coverPhotoId} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-3 shadow-sm">
            <StarRating value={listing.rating} onChange={(rating) => void patch({ rating })} />
            <div className="w-48">
              <StatusSelect value={listing.status} onChange={(status) => void patch({ status })} />
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
                <a href={listing.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
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
```

`src/router.tsx` — add before the `/listings/:id/edit` entry, plus the import:

```tsx
      { path: '/listings/:id', element: <ListingDetailPage /> },
```

```tsx
import { ListingDetailPage } from './features/listings/ListingDetailPage';
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- --run` → Expected: all pass.
Run: `npm run typecheck` → Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add listing detail page with gallery, inline rating and notes"
```

---

### Task 11: Backup menu, backup nudge and final verification

**Files:**
- Create: `src/features/backup/BackupMenu.tsx`, `src/features/backup/BackupNudge.tsx`
- Modify: `src/features/listings/HomePage.tsx` (render menu + nudge)
- Test: `src/features/backup/BackupMenu.test.tsx`

**Interfaces:**
- Consumes: `exportBackup`, `importBackupText`, `BackupError`, `getLastExportAt`, `shouldNudge`, `EXPORTED_EVENT` (Task 6); `parseSpreadsheetCsv`, `importCsvRows` (Task 6); `useToast`, `btnSecondary`, `renderRoute` (Task 7); `formatDate` (Task 2)
- Produces: `BackupMenu()`, `BackupNudge({ hasListings: boolean })`

- [ ] **Step 1: Write failing test**

`src/features/backup/BackupMenu.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { BackupMenu } from './BackupMenu';

beforeEach(async () => {
  await repo.clearAll();
  await repo.createListing({ model: 'Golf', status: 'new' });
});

function upload(label: string, content: string, name: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([content], name)] } });
}

describe('BackupMenu', () => {
  it('shows a readable error and keeps data when the backup is invalid', async () => {
    renderRoute(<BackupMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    upload('Archivo de backup', '{"hello":1}', 'x.json');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo no es un backup de Car Tracker.',
    );
    expect((await repo.exportAll()).listings).toHaveLength(1);
  });

  it('imports the spreadsheet CSV and reports the count', async () => {
    renderRoute(<BackupMenu />);
    upload(
      'Archivo CSV',
      'Modelo,Color,Año,KMs,Precio,Link,Estado,Comentarios\nGolf Mk4 1.6,Azul,??,??,"$ 7,500.00",,,',
      'planilla.csv',
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Importadas 1 publicaciones');
    expect((await repo.exportAll()).listings).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run src/features/backup/BackupMenu.test.tsx` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement BackupMenu**

`src/features/backup/BackupMenu.tsx`:

```tsx
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
        window.confirm('Esto reemplaza TODOS los datos actuales por los del backup. ¿Continuar?'),
      );
      if (result === 'imported') toast('Backup importado');
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'No se pudo importar el backup', 'error');
    }
  };

  const onCsv = async (file: File) => {
    try {
      const { rows, skipped } = parseSpreadsheetCsv(await file.text());
      const n = await importCsvRows(rows);
      toast(
        `Importadas ${n} publicaciones${skipped ? `, ${skipped} filas sin modelo salteadas` : ''}`,
      );
    } catch {
      toast('No se pudo importar el CSV', 'error');
    }
  };

  const item = 'block w-full px-4 py-2 text-left text-sm hover:bg-gray-100';

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
        <div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button role="menuitem" type="button" className={item} onClick={() => void onExport()}>
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
```

- [ ] **Step 4: Implement BackupNudge**

`src/features/backup/BackupNudge.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../domain/format';
import { EXPORTED_EVENT, exportBackup, getLastExportAt, shouldNudge } from './backup';

export function BackupNudge({ hasListings }: { hasListings: boolean }) {
  const toast = useToast();
  const [lastExportAt, setLastExportAt] = useState(getLastExportAt);
  const [now] = useState(Date.now);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onExported = () => setLastExportAt(getLastExportAt());
    window.addEventListener(EXPORTED_EVENT, onExported);
    return () => window.removeEventListener(EXPORTED_EVENT, onExported);
  }, []);

  if (!hasListings || dismissed || !shouldNudge(lastExportAt, now)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      <span>
        {lastExportAt
          ? `Tu último backup es del ${formatDate(lastExportAt)}.`
          : 'Todavía no exportaste ningún backup.'}{' '}
        Los datos viven solo en este navegador.
      </span>
      <div className="flex gap-3">
        <button
          type="button"
          className="font-medium underline"
          onClick={() => exportBackup().catch(() => toast('No se pudo exportar el backup', 'error'))}
        >
          Exportar ahora
        </button>
        <button type="button" className="text-amber-700" onClick={() => setDismissed(true)}>
          Más tarde
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire into HomePage**

In `src/features/listings/HomePage.tsx`, add imports:

```tsx
import { BackupMenu } from '../backup/BackupMenu';
import { BackupNudge } from '../backup/BackupNudge';
```

Inside `<header>`, right after the `+ Nueva` `<Link>`, add:

```tsx
        <BackupMenu />
```

Right after `</header>`, before `<FiltersBar`, add:

```tsx
      <BackupNudge hasListings={!!listings?.length} />
```

- [ ] **Step 6: Run full verification**

Run: `npm test -- --run` → Expected: all pass.
Run: `npm run build` → Expected: exits 0.

- [ ] **Step 7: Manual end-to-end check**

Run `npm run dev` and in the browser:
1. Export the spreadsheet as CSV (with a helper column holding real URLs under the `Link` header if links are wanted) and import it via `⋯ → Importar planilla (CSV)`: 14 listings appear, comments show as notes on each detail page.
2. Grid ↔ Tabla toggle; sort by Precio both ways — `??` prices stay at the bottom; reload keeps view/sort/filters.
3. Open a listing, paste 2 screenshots in Editar, set the second as Portada, save: grid shows the second as cover; detail gallery opens on it; lightbox arrows/Esc work.
4. Rate with stars and change Estado to Descartado on the detail page: it disappears from the default home list.
5. Export backup, delete a listing, import the backup: the listing is back with photos and notes.
6. Edit a listing, change a field, click ← Volver: the unsaved-changes confirm appears.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add backup menu, CSV import UI and backup reminder"
```
