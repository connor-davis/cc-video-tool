import { EnvelopeSimpleOpenIcon } from '@phosphor-icons/react';
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

export const Route = createFileRoute('/verify-email')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/app' });
    }
  },
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const navigate = useNavigate();
  const { pendingAuth, verifyEmailCode, clearPendingAuth } = useAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await verifyEmailCode(code);
      await navigate({ to: getAuthSuccessPath(result) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to verify your email.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingAuth?.step !== 'verify-email') {
    return (
      <AuthShell
        badge="Verification"
        title="No verification is in progress"
        description="Start with sign in or sign up so WorkOS can issue a pending authentication token."
      >
        <Alert>
          <AlertTitle>Nothing to verify yet</AlertTitle>
          <AlertDescription>
            This screen is only used after WorkOS requires email verification.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge="Email verification"
      title="Confirm your email"
      description={`Enter the one-time code WorkOS sent to ${pendingAuth.email ?? 'your inbox'}.`}
      footer={
        <div className="flex w-full justify-between text-sm text-muted-foreground">
          <button
            className="font-medium text-primary hover:underline"
            onClick={clearPendingAuth}
            type="button"
          >
            Start over
          </button>
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
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => setCode(value)}
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, index) => (
              <InputOTPSlot index={index} key={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <Button disabled={isSubmitting || code.length < 6} type="submit">
          <EnvelopeSimpleOpenIcon data-icon="inline-start" />
          {isSubmitting ? 'Verifying...' : 'Verify email'}
        </Button>
      </form>
    </AuthShell>
  );
}
