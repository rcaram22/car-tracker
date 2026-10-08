import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Toast';

export function renderRoute(
  element: ReactElement,
  {
    path = '/',
    initialEntry = '/',
  }: { path?: string; initialEntry?: string } = {},
) {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <p>other page</p> },
    ],
    { initialEntries: [initialEntry] },
  );
  const result = render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return { router, ...result };
}
