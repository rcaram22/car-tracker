import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { NotFound } from './components/NotFound';
import { HomePage } from './features/listings/HomePage';
import { ListingDetailPage } from './features/listings/ListingDetailPage';
import {
  EditListingPage,
  NewListingPage,
} from './features/listings/ListingFormPages';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/listings/new', element: <NewListingPage /> },
      { path: '/listings/:id', element: <ListingDetailPage /> },
      { path: '/listings/:id/edit', element: <EditListingPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL,
});
