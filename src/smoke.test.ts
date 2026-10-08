import { expect, it } from 'vitest';

it('has indexedDB and object URLs in the test env', () => {
  expect(indexedDB).toBeDefined();
  expect(URL.createObjectURL(new Blob(['x']))).toMatch(/^blob:/);
});
