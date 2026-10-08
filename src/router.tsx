import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { NotFound } from './components/NotFound';
import {
  EditListingPage,
  NewListingPage,
} from './features/listings/ListingFormPages';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <p className="p-4">Home</p> },
      { path: '/listings/new', element: <NewListingPage /> },
      { path: '/listings/:id/edit', element: <EditListingPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
