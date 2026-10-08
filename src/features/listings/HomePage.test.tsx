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
    const row = (
      await screen.findByRole('cell', { name: 'Golf Alfa' })
    ).closest('tr')!;
    expect(row).toHaveTextContent('$ 9,000');
    expect(row).toHaveTextContent('??');
  });

  it('finds listings by words in their notes', async () => {
    const id = await repo.createListing({ model: 'Golf Delta', status: 'new' });
    await repo.addNote(id, 'Escape modificado');
    renderRoute(<HomePage />);
    await screen.findByText(/Golf Alfa/);
    await userEvent.type(screen.getByLabelText('Buscar'), 'escape');
    expect(await screen.findByText(/Golf Delta/)).toBeInTheDocument();
    expect(screen.queryByText(/Golf Alfa/)).toBeNull();
  });
});
