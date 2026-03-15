import {
  ArrowLeftIcon,
  LightningIcon,
  MapTrifoldIcon,
  PackageIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';
import { Link, createFileRoute } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/about')({
  component: AboutRoute,
});

function AboutRoute() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">About this rebuild</Badge>
            <Badge variant="secondary">File-based routing</Badge>
          </div>
          <CardTitle className="text-3xl">
            Why this version is cleaner
          </CardTitle>
          <CardDescription className="max-w-3xl text-base">
            The app no longer depends on missing intermediary page files. Each
            route owns its component locally, while the shared shell lives in
            the root route and the router configuration stays in one dedicated
            module.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back to home
          </Link>
        </CardContent>
      </Card>

      <section className="grid gap-6 md:grid-cols-2">
        {[
          {
            title: 'Typed router registration',
            description:
              'The new `src/router.ts` registers the router so `Link`, params, and route navigation stay strongly typed across the app.',
            icon: ShieldCheckIcon,
          },
          {
            title: 'Sensible defaults',
            description:
              'Intent preloading and scroll restoration now apply globally instead of being left to per-route guesswork.',
            icon: LightningIcon,
          },
          {
            title: 'Inline route ownership',
            description:
              'This page and the home page are defined directly in their route files to match your requested organization.',
            icon: MapTrifoldIcon,
          },
          {
            title: 'Expanded component library',
            description:
              'The project now includes the full shadcn component set, so future screens can be composed without extra install passes.',
            icon: PackageIcon,
          },
        ].map(({ title, description, icon: Icon }) => (
          <Card key={title} size="sm">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon weight="fill" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Separator />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Next natural steps</CardTitle>
          <CardDescription>
            This structure is ready for real features like transcript jobs,
            upload flows, or query-backed route loaders.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>- Add route loaders once the app has actual server data.</p>
          <p>- Introduce validated search params for filterable screens.</p>
          <p>- Split non-critical routes lazily when the route tree grows.</p>
        </CardContent>
      </Card>
    </div>
  );
}
