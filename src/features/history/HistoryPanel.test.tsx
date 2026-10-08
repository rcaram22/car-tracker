import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { HistoryPanel } from './HistoryPanel';

let id: string;
beforeEach(async () => {
  await repo.clearAll();
  id = await repo.createListing({ model: 'Golf', status: 'new', price: 9500 });
});

describe('HistoryPanel', () => {
  it('shows an empty state when nothing changed', async () => {
    renderRoute(<HistoryPanel listingId={id} />);
    expect(
      await screen.findByText('Sin cambios registrados.'),
    ).toBeInTheDocument();
  });

  it('lists price and status changes with formatted values', async () => {
    await repo.updateListing(id, { price: 9000 });
    await repo.updateListing(id, { status: 'contacted', price: undefined });
    renderRoute(<HistoryPanel listingId={id} />);
    const rows = await screen.findAllByRole('row');
    const text = rows.map((r) => r.textContent);
    expect(text.some((t) => t?.includes('$ 9,500') && t.includes('$ 9,000'))).toBe(true);
    expect(text.some((t) => t?.includes('$ 9,000') && t.includes('??'))).toBe(true);
    expect(text.some((t) => t?.includes('Nueva') && t.includes('Contactado'))).toBe(true);
  });

  it('deletes a row after confirmation and leaves the listing intact', async () => {
    await repo.updateListing(id, { price: 9000 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute(<HistoryPanel listingId={id} />);
    const cell = await screen.findByRole('cell', { name: '$ 9,000' });
    await userEvent.click(
      within(cell.closest('tr')!).getByRole('button', { name: 'Borrar cambio' }),
    );
    expect(
      await screen.findByText('Sin cambios registrados.'),
    ).toBeInTheDocument();
    await waitFor(async () =>
      expect((await repo.getListing(id))!.price).toBe(9000),
    );
  });
});
