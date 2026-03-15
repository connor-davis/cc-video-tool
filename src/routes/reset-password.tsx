import { KeyReturnIcon } from '@phosphor-icons/react';
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useState } from 'react';

import { toast } from 'sonner';

import { useAuth } from '@/components/auth/auth-provider';
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

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/app' });
    }
  },
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const navigate = useNavigate();
  const { confirmPasswordReset } = useAuth();
  const { token } = Route.useSearch();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error('The passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset(token, password);
      toast.success('Your password has been reset.');
      await navigate({
        to: '/sign-in',
        search: { invitationToken: undefined },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to reset your password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      badge="Recovery"
      title="Choose a new password"
      description="This page completes the WorkOS password reset flow using the token in your reset link."
      footer={
        <div className="flex w-full justify-end text-sm text-muted-foreground">
          <Link
            to="/sign-in"
            search={{ invitationToken: undefined }}
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      }
    >
      {!token ? (
        <Alert variant="destructive">
          <AlertTitle>Missing reset token</AlertTitle>
          <AlertDescription>
            Open this page from the WorkOS password reset email, or include the
            `token` search parameter manually.
          </AlertDescription>
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <FieldContent>
                <Input
                  id="new-password"
                  autoComplete="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm password
              </FieldLabel>
              <FieldContent>
                <Input
                  id="confirm-password"
                  autoComplete="new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <FieldDescription>
                  WorkOS validates the reset token and stores the new password
                  when this form is submitted.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <Button disabled={isSubmitting} type="submit">
            <KeyReturnIcon data-icon="inline-start" />
            {isSubmitting ? 'Saving...' : 'Set new password'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
