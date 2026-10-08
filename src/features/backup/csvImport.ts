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
