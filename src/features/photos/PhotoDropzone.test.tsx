import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { compressImage } from './compressImage';
import { PhotoDropzone } from './PhotoDropzone';

vi.mock('./compressImage', () => ({ compressImage: vi.fn() }));
const compress = vi.mocked(compressImage);

function paste(files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  window.dispatchEvent(event);
  return event;
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

beforeEach(() => {
  compress.mockReset();
  compress.mockImplementation(async () => ({
    data: new ArrayBuffer(1),
    type: 'image/jpeg',
  }));
});

describe('PhotoDropzone', () => {
  it('adds pasted images', async () => {
    const onAdd = vi.fn();
    render(<PhotoDropzone onAdd={onAdd} />, { wrapper: ToastProvider });
    const event = paste([png('a.png'), png('b.png')]);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0]).toHaveLength(2);
  });

  it('lets plain-text paste through untouched', () => {
    const onAdd = vi.fn();
    render(<PhotoDropzone onAdd={onAdd} />, { wrapper: ToastProvider });
    const event = paste([]);
    expect(event.defaultPrevented).toBe(false);
    expect(onAdd).not.toHaveBeenCalled();
    expect(compress).not.toHaveBeenCalled();
  });

  it('adds the good images and reports the ones that fail to decode', async () => {
    compress
      .mockResolvedValueOnce({ data: new ArrayBuffer(1), type: 'image/jpeg' })
      .mockRejectedValueOnce(new Error('decode'));
    const onAdd = vi.fn();
    render(<PhotoDropzone onAdd={onAdd} />, { wrapper: ToastProvider });
    paste([png('ok.png'), new File(['x'], 'bad.heic', { type: 'image/heic' })]);
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0]).toHaveLength(1);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo leer 1 imagen',
    );
  });
});
