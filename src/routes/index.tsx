import {
  ArrowRightIcon,
  CheckCircleIcon,
  CompassIcon,
  PaletteIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { Link, createFileRoute } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="border-primary/10 bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader>
            <CardAction>
              <Badge>Reimplemented</Badge>
            </CardAction>
            <CardTitle className="text-3xl sm:text-4xl">
              TanStack Router is now the app shell, not an afterthought.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base">
              The broken route indirection is replaced with inline file-based
              route components, typed router registration, intent preloading,
              and a shadcn-powered UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Inline route components</Badge>
              <Badge variant="secondary">Intent preload</Badge>
              <Badge variant="secondary">Scroll restoration</Badge>
              <Badge variant="secondary">shadcn add --all</Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/about"
                className={buttonVariants({ variant: 'default', size: 'lg' })}
              >
                <CompassIcon data-icon="inline-start" />
                Explore the route details
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  window.open(
                    'https://tanstack.com/router/latest/docs/framework/react/overview',
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                <ArrowRightIcon data-icon="inline-start" />
                Router docs
              </Button>
            </div>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            The route UI lives in this file, matching your requested structure.
          </CardFooter>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>What changed</CardTitle>
            <CardDescription>
              Three focused improvements anchor the new setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[
              {
                title: 'Router registration',
                description:
                  'A dedicated router module now provides type-safe navigation and global defaults.',
                icon: StackIcon,
              },
              {
                title: 'Route colocation',
                description:
                  'The route components stay inside `index.tsx`, `about.tsx`, and `__root.tsx`.',
                icon: CheckCircleIcon,
              },
              {
                title: 'UI foundation',
                description:
                  'Every shadcn component was installed so the app can expand without more setup churn.',
                icon: PaletteIcon,
              },
            ].map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-2xl border p-3"
              >
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon weight="fill" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: 'Navigation',
            description:
              'Header links use TanStack Router `Link` so navigation remains semantic and type-safe.',
          },
          {
            title: 'Error handling',
            description:
              'The router now owns a default error boundary and the root route owns not-found UX.',
          },
          {
            title: 'Theming',
            description:
              'Your existing theme provider stays in place, with quick light, dark, and system controls in the shell.',
          },
        ].map(({ title, description }) => (
          <Card key={title} size="sm">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link
                to="/about"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  '-ml-2'
                )}
              >
                Learn more
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );
}
