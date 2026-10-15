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
      extraCost: undefined,
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

  it('blocks saving while pasted photos are still processing', async () => {
    let finish!: (v: { data: ArrayBuffer; type: string }) => void;
    vi.mocked(compressImage).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf');
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    window.dispatchEvent(event);
    const save = screen.getByRole('button', { name: 'Guardar' });
    await waitFor(() => expect(save).toBeDisabled());
    await userEvent.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
    finish({ data: new ArrayBuffer(1), type: 'image/jpeg' });
    await waitFor(() => expect(save).toBeEnabled());
  });

  it('submits the score with comma decimals', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf');
    await userEvent.type(screen.getByLabelText('Puntaje (1–10)'), '8,5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].rating).toBe(8.5);
  });

  it('rejects a score outside 0.5 steps', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf');
    await userEvent.type(screen.getByLabelText('Puntaje (1–10)'), '8.3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      screen.getByText('El puntaje va de 1 a 10, en saltos de 0.5'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the setup estimate', async () => {
    const onSubmit = setup();
    await userEvent.type(screen.getByLabelText('Modelo *'), 'Golf');
    await userEvent.type(
      screen.getByLabelText('Otros gastos (USD)'),
      '1,500',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].extraCost).toBe(1500);
  });
});
