import { RouterProvider } from '@tanstack/react-router';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import {
  AuthProvider,
  useAuth,
  useConvexAuthBridge,
} from '@/components/auth/auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { getClientEnv } from '@/lib/env';
import { router } from '@/router';

import './index.css';

const convex = new ConvexReactClient(getClientEnv('VITE_CONVEX_URL'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthBridge}>
          <AppRouter />
          <Toaster />
        </ConvexProviderWithAuth>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);

function AppRouter() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <AuthLoadingScreen />;
  }

  return (
    <RouterProvider context={{ auth: auth.routerContext }} router={router} />
  );
}
