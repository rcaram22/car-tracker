import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../../test/render';
import { compressImage } from '../photos/compressImage';
import { ListingForm } from './ListingForm';

vi.mock('../photos/compressImage', () => ({ compressImage: vi.fn() }));

beforeEach(() => {
  vi.mocked(compressImage).mockResolvedValue({
    data: new ArrayBuffer(1),
    type: 'image/jpeg',
  });
});

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderRoute(
    <ListingForm
      submitLabel="Guardar"
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  );
  return onSubmit;
}

describe('ListingForm', () => {
  it('requires model', async () => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('El modelo es obligatorio')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits parsed values with empty fields as undefined', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf Mk4 2.0');
    await userEvent.type(screen.getByLabelText('Precio (USD)'), '9,375.00');
    await userEvent.type(screen.getByLabelText('Kilómetros'), '250.000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [input, photos] = onSubmit.mock.calls[0];
    expect(input).toEqual({
      model: 'Golf Mk4 2.0',
      color: undefined,
      year: undefined,
      km: 250000,
      price: 9375,
      url: undefined,
      condition: undefined,
      description: undefined,
      rating: undefined,
      status: 'new',
    });
    expect(photos.items).toEqual([]);
  });

  it('adds pasted photos as drafts with the first as cover', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf');
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    window.dispatchEvent(event);
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const photos = onSubmit.mock.calls[0][1];
    expect(photos.items).toHaveLength(1);
    expect(photos.coverKey).toBe(photos.items[0].key);
  });
});
