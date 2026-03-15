import { LockIcon, SignInIcon } from '@phosphor-icons/react';
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useState } from 'react';

import { toast } from 'sonner';

import { getAuthSuccessPath, useAuth } from '@/components/auth/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    invitationToken:
      typeof search.invitationToken === 'string'
        ? search.invitationToken
        : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/app' });
    }
  },
  component: SignInRoute,
});

function SignInRoute() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { invitationToken } = Route.useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await signIn({
        email,
        password,
        invitationToken,
      });

      await navigate({ to: getAuthSuccessPath(result) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to sign in.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      badge="WorkOS sign in"
      title="Sign in with your own UI"
      description="This form authenticates with WorkOS User Management through Convex-backed REST endpoints."
      footer={
        <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
          <span>Need an account?</span>
          <Link
            to="/sign-up"
            search={{ invitationToken: undefined }}
            className="font-medium text-primary hover:underline"
          >
            Create one
          </Link>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <FieldContent>
              <Input
                id="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <FieldDescription>
                Email verification, organization selection, and TOTP MFA are
                handled as follow-up steps when WorkOS requires them. Password
                entry alone does not finish authentication.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-3">
          <Button disabled={isSubmitting} type="submit">
            <SignInIcon data-icon="inline-start" />
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>

          <Link
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            to="/forgot-password"
          >
            <LockIcon data-icon="inline-start" />
            Forgot your password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
