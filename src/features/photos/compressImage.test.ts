import { describe, expect, it } from 'vitest';
import { fitWithin } from './compressImage';

describe('fitWithin', () => {
  it('scales the longest side down to 1600 keeping aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 2400)).toEqual({ width: 720, height: 1600 });
  });

  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
