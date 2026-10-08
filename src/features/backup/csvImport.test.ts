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
