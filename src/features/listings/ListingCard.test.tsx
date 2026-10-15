import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { ListingCard } from './ListingCard';

const img = (n: number) => ({
  data: new Uint8Array([n]).buffer as ArrayBuffer,
  type: 'image/jpeg',
});

async function seed(photoCount: number, coverIndex: number) {
  const id = await repo.createListing({ model: 'Golf', status: 'new' });
  await repo.syncPhotos(
    id,
    Array.from({ length: photoCount }, (_, i) => img(i)),
    coverIndex,
  );
  return (await repo.getListing(id))!;
}

beforeEach(() => repo.clearAll());

describe('ListingCard carousel', () => {
  it('starts on the cover and wraps around in both directions', async () => {
    const listing = await seed(3, 1);
    const { router } = renderRoute(<ListingCard listing={listing} />);
    expect(await screen.findByAltText('Foto 2 de 3')).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Foto siguiente' });
    const prev = screen.getByRole('button', { name: 'Foto anterior' });
    await userEvent.click(next);
    expect(await screen.findByAltText('Foto 3 de 3')).toBeInTheDocument();
    await userEvent.click(next);
    expect(await screen.findByAltText('Foto 1 de 3')).toBeInTheDocument();
    await userEvent.click(prev);
    expect(await screen.findByAltText('Foto 3 de 3')).toBeInTheDocument();

    expect(router.state.location.pathname).toBe('/');
  });

  it('shows no arrows with a single photo', async () => {
    const listing = await seed(1, 0);
    renderRoute(<ListingCard listing={listing} />);
    expect(await screen.findByAltText('Foto 1 de 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).toBeNull();
  });

  it('still opens the detail when clicking the card', async () => {
    const listing = await seed(2, 0);
    const { router } = renderRoute(<ListingCard listing={listing} />);
    await userEvent.click(await screen.findByText(/Golf/));
    expect(router.state.location.pathname).toBe(`/listings/${listing.id}`);
  });

  it('changes photo on swipe without opening the detail', async () => {
    const listing = await seed(3, 0);
    const { router } = renderRoute(<ListingCard listing={listing} />);
    const photo = await screen.findByAltText('Foto 1 de 3');
    const area = photo.parentElement!;
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(area, { touches: [{ clientX: from, clientY: 0 }] });
      fireEvent.touchEnd(area, {
        touches: [],
        changedTouches: [{ clientX: to, clientY: 5 }],
      });
      fireEvent.click(area);
    };
    swipe(200, 100);
    expect(await screen.findByAltText('Foto 2 de 3')).toBeInTheDocument();
    swipe(100, 200);
    expect(await screen.findByAltText('Foto 1 de 3')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('ListingCard details', () => {
  it('opens the listing URL in a new tab without opening the detail', async () => {
    const id = await repo.createListing({
      model: 'Golf',
      status: 'new',
      url: 'https://example.com/item/1',
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { router } = renderRoute(
      <ListingCard listing={(await repo.getListing(id))!} />,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Abrir publicación' }),
    );
    expect(open).toHaveBeenCalledWith(
      'https://example.com/item/1',
      '_blank',
      'noopener,noreferrer',
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('hides the link button without a URL', async () => {
    const id = await repo.createListing({ model: 'Golf', status: 'new' });
    renderRoute(<ListingCard listing={(await repo.getListing(id))!} />);
    await screen.findByText(/Golf/);
    expect(screen.queryByRole('button', { name: 'Abrir publicación' })).toBeNull();
  });

  it('shows the total only when there is a setup estimate', async () => {
    const withExtra = await repo.createListing({
      model: 'Golf A',
      status: 'new',
      price: 9000,
      extraCost: 1500,
    });
    const without = await repo.createListing({
      model: 'Golf B',
      status: 'new',
      price: 9000,
    });
    renderRoute(
      <>
        <ListingCard listing={(await repo.getListing(withExtra))!} />
        <ListingCard listing={(await repo.getListing(without))!} />
      </>,
    );
    expect(
      await screen.findByText('Total $ 10,500 (+$ 1,500)'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Total/)).toHaveLength(1);
  });
});
