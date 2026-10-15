import { describe, expect, it } from 'vitest';
import {
  colorToHex,
  formatKm,
  formatPrice,
  formatValue,
  listingTitle,
  listingTotal,
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

describe('listingTotal', () => {
  it('adds the setup estimate to the price', () => {
    expect(listingTotal({ price: 9000, extraCost: 1500 })).toBe(10500);
  });

  it('counts a missing setup estimate as zero', () => {
    expect(listingTotal({ price: 9000 })).toBe(9000);
  });

  it('is unknown without a price', () => {
    expect(listingTotal({ extraCost: 1500 })).toBeUndefined();
  });
});
