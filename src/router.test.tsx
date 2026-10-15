import { expect, it } from 'vitest';

it('serves the app under the configured base path', async () => {
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}`);
  const { router } = await import('./router');
  const leaf = router.state.matches.at(-1)!;
  expect(leaf.route.path).toBe('/');
});
