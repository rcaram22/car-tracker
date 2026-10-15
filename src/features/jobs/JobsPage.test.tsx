import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { JobsPage } from './JobsPage';

beforeEach(() => repo.clearAll());

const row = (description: string) =>
  screen.getByDisplayValue(description).closest('tr')!;

describe('JobsPage', () => {
  it('loads the initial list from an empty catalog', async () => {
    renderRoute(<JobsPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /Cargar mi lista inicial/ }),
    );
    expect(await screen.findByDisplayValue('Cubiertas')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(13);
  });

  it('saves amount and priority edits', async () => {
    await repo.seedJobs();
    renderRoute(<JobsPage />);
    await screen.findByDisplayValue('Cubiertas');
    const amount = within(row('Cubiertas')).getByLabelText('Monto');
    await userEvent.clear(amount);
    await userEvent.type(amount, '450');
    fireEvent.blur(amount);
    await userEvent.selectOptions(
      within(row('Escape')).getByLabelText('Prioridad'),
      'high',
    );
    await waitFor(async () => {
      const jobs = await repo.listJobs();
      expect(jobs.find((j) => j.description === 'Cubiertas')!.amount).toBe(450);
      expect(jobs.find((j) => j.description === 'Escape')!.priority).toBe('high');
    });
  });

  it('adds and deletes jobs', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute(<JobsPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: '+ Agregar trabajo' }),
    );
    expect(await screen.findByDisplayValue('Nuevo trabajo')).toBeInTheDocument();
    await userEvent.click(
      within(row('Nuevo trabajo')).getByRole('button', { name: 'Borrar trabajo' }),
    );
    await waitFor(async () => expect(await repo.listJobs()).toEqual([]));
  });
});
