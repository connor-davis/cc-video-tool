import {
  ErrorComponent,
  createRouter,
  useRouter,
} from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import type { RouterAuthContext } from '@/lib/auth-types';
import { routeTree } from '@/routeTree.gen';

type AppRouterContext = {
  auth: RouterAuthContext;
};

const router = createRouter({
  routeTree,
  context: {
    auth: {
      isAuthenticated: false,
      user: null,
    },
  } satisfies AppRouterContext,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultStructuralSharing: true,
  scrollRestoration: true,
  defaultErrorComponent: RouterErrorBoundary,
});

function RouterErrorBoundary({ error }: { error: Error }) {
  const appRouter = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-xs">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The route failed to render. You can retry the current navigation or
            head back home.
          </p>
        </div>

        <ErrorComponent error={error} />

        <div className="flex gap-3">
          <Button onClick={() => appRouter.invalidate()}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => appRouter.navigate({ to: '/' })}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export { router };
