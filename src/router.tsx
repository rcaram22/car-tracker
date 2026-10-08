import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { NotFound } from './components/NotFound';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <p className="p-4">Home</p> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
