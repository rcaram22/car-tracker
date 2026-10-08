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
    expect(
      await screen.findByText('No encontramos esa publicación.'),
    ).toBeInTheDocument();
  });

  it('shows the data sheet with ?? for missing values and updates the score inline', async () => {
    const id = await repo.createListing({
      model: 'Golf Mk4 2.0',
      status: 'new',
      price: 9375,
    });
    renderDetail(id);
    expect(
      await screen.findByRole('heading', { name: /Golf Mk4 2.0/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('$ 9,375').length).toBeGreaterThan(0);
    expect(screen.getAllByText('??').length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText('Puntaje'), '9{Enter}');
    await waitFor(async () =>
      expect((await repo.getListing(id))!.rating).toBe(9),
    );
    expect(await screen.findByLabelText('Puntaje 9.0')).toBeInTheDocument();
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
