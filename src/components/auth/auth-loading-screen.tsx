import { Spinner } from '@/components/ui/spinner';

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-8 text-card-foreground shadow-xs">
        <Spinner className="size-6" />
        <div className="text-center">
          <p className="font-medium">Restoring your session</p>
          <p className="text-sm text-muted-foreground">
            Checking WorkOS and Convex authentication state.
          </p>
        </div>
      </div>
    </div>
  );
}
