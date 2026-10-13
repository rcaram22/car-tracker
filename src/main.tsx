import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/Toast';
import { AuthGate } from './features/auth/AuthGate';
import { router } from './router';
import './index.css';

void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </ToastProvider>
  </StrictMode>,
);
