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
    await userEvent.click(
      within(item).getByRole('button', { name: 'Borrar nota' }),
    );
    expect(await screen.findByText('Sin notas todavía.')).toBeInTheDocument();
  });
});
