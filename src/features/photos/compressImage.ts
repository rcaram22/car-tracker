import type { PhotoData } from '../../domain/listing';

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
const MIN_JPEG_QUALITY = 0.5;
const MAX_BYTES = 900_000;

export function fitWithin(w: number, h: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export async function compressImage(file: Blob): Promise<PhotoData> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
        'image/jpeg',
        quality,
      ),
    );
  let quality = JPEG_QUALITY;
  let blob = await encode(quality);
  // Photos sync as single Firestore documents, which are capped near 1 MiB.
  while (blob.size > MAX_BYTES && quality > MIN_JPEG_QUALITY) {
    quality -= 0.1;
    blob = await encode(quality);
  }
  return { data: await blob.arrayBuffer(), type: 'image/jpeg' };
}
