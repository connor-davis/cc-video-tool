import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';

import { toast } from 'sonner';

import { useAuth } from '@/components/auth/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/app' });
    }
  },
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setIsSent(true);
      toast.success('Password reset instructions were requested.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to request a password reset.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      badge="Recovery"
      title="Reset your password"
      description="WorkOS handles the password reset lifecycle. This page starts the recovery flow with your own branded UI."
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
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {isSent ? (
          <Alert>
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>
              If the account exists, WorkOS has started the reset flow for that
              email address.
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reset-email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="reset-email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </FieldContent>
          </Field>
        </FieldGroup>

        <Button disabled={isSubmitting} type="submit">
          <EnvelopeSimpleIcon data-icon="inline-start" />
          {isSubmitting ? 'Requesting...' : 'Send reset instructions'}
        </Button>
      </form>
    </AuthShell>
  );
}
