import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { SetupPanel } from './SetupPanel';

let id: string;
beforeEach(async () => {
  await repo.clearAll();
  await repo.seedJobs();
  id = await repo.createListing({
    model: 'Golf',
    status: 'new',
    price: 9000,
    extraCost: 100,
  });
});

async function renderPanel() {
  const listing = (await repo.getListing(id))!;
  return renderRoute(<SetupPanel listing={listing} />);
}

describe('SetupPanel', () => {
  it('saves checked jobs on the listing', async () => {
    await renderPanel();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Cubiertas/ }));
    await waitFor(async () =>
      expect((await repo.getListing(id))!.jobIds).toEqual(['seed-cubiertas']),
    );
  });

  it('sums checked jobs and other costs', async () => {
    await repo.updateListing(id, { jobIds: ['seed-cubiertas', 'seed-parabrisas'] });
    await renderPanel();
    await screen.findByRole('checkbox', { name: /Cubiertas/ });
    expect(screen.getByText('Trabajos marcados').nextElementSibling).toHaveTextContent(
      '$ 500',
    );
    expect(screen.getByText('Otros gastos').nextElementSibling).toHaveTextContent(
      '$ 100',
    );
    expect(
      screen.getByText('Total puesta a punto').nextElementSibling,
    ).toHaveTextContent('$ 600');
  });

  it('points to the catalog when it is empty', async () => {
    await repo.clearAll();
    id = await repo.createListing({ model: 'Golf', status: 'new' });
    await renderPanel();
    expect(
      await screen.findByRole('link', { name: /catálogo de trabajos/ }),
    ).toHaveAttribute('href', '/jobs');
  });
});
