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
  return (
    COLOR_HEX.find(([name]) => c === name || c.startsWith(`${name} `))?.[1] ??
    '#e5e7eb'
  );
}
