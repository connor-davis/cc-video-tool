import { UserPlusIcon } from '@phosphor-icons/react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/sign-up')({
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
  component: SignUpRoute,
});

function SignUpRoute() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { invitationToken } = Route.useSearch();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await signUp({
        firstName,
        lastName,
        email,
        password,
        invitationToken,
      });

      await navigate({ to: getAuthSuccessPath(result) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to sign up.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      badge="WorkOS onboarding"
      title="Create your account"
      description="New users are created in WorkOS, then the same custom flow walks through verification and optional MFA."
      footer={
        <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
          <span>Already have an account?</span>
          <Link
            to="/sign-in"
            search={{ invitationToken: undefined }}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {invitationToken ? (
          <Alert>
            <AlertTitle>Invitation detected</AlertTitle>
            <AlertDescription>
              This sign-up flow will carry the invitation token into WorkOS when
              authentication completes.
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="first-name">First name</FieldLabel>
              <FieldContent>
                <Input
                  id="first-name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="last-name">Last name</FieldLabel>
              <FieldContent>
                <Input
                  id="last-name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </FieldContent>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="sign-up-email"
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
            <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
            <FieldContent>
              <Input
                id="sign-up-password"
                autoComplete="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <FieldDescription>
                After account creation, WorkOS can require email verification
                before the first session is issued.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

        <Button disabled={isSubmitting} type="submit">
          <UserPlusIcon data-icon="inline-start" />
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
