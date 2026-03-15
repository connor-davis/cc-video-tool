import { KeyIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { getAuthSuccessPath, useAuth } from '@/components/auth/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Route = createFileRoute('/mfa')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/app' });
    }
  },
  component: MfaRoute,
});

function MfaRoute() {
  const navigate = useNavigate();
  const {
    pendingAuth,
    startPendingTotpEnrollment,
    startTotpChallenge,
    verifyTotpCode,
    clearPendingAuth,
  } = useAuth();
  const [selectedFactorId, setSelectedFactorId] = useState<string>('');
  const [code, setCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedFactorId = useMemo(
    () =>
      selectedFactorId ||
      (pendingAuth?.step === 'mfa' ? pendingAuth.selectedFactorId || '' : ''),
    [pendingAuth, selectedFactorId]
  );

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await verifyTotpCode(code);
      await navigate({ to: getAuthSuccessPath(result) });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to verify the TOTP code.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStartEnrollment() {
    setIsEnrolling(true);

    try {
      await startPendingTotpEnrollment();
      toast.success(
        'Scan the QR code, then enter the current authenticator code.'
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to start MFA enrollment.'
      );
    } finally {
      setIsEnrolling(false);
    }
  }

  if (pendingAuth?.step !== 'mfa' && pendingAuth?.step !== 'mfa-enrollment') {
    return (
      <AuthShell
        badge="MFA"
        title="No MFA challenge is active"
        description="This page is only used after WorkOS requires a TOTP challenge."
      >
        <Alert>
          <AlertTitle>Start with sign in</AlertTitle>
          <AlertDescription>
            WorkOS only sends users here when the password step succeeds but
            authentication is still incomplete because MFA is required.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  useEffect(() => {
    if (pendingAuth.step !== 'mfa' || !resolvedFactorId) {
      return;
    }

    const shouldStartChallenge =
      !pendingAuth.authenticationChallengeId ||
      pendingAuth.selectedFactorId !== resolvedFactorId;

    if (!shouldStartChallenge) {
      return;
    }

    let cancelled = false;
    setIsChallenging(true);

    void startTotpChallenge(resolvedFactorId)
      .then(() => {
        if (!cancelled) {
          toast.success(
            'Use the code from your authenticator app to continue.'
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Unable to create the MFA challenge.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsChallenging(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingAuth, resolvedFactorId, startTotpChallenge]);

  return (
    <AuthShell
      badge="TOTP MFA"
      title="Finish your sign in"
      description={
        pendingAuth.step === 'mfa-enrollment'
          ? 'MFA is required before sign-in can finish. Set up your authenticator app, then enter the current six-digit code to complete authentication.'
          : 'Choose a factor, start the challenge, then enter the six-digit code from your authenticator app. Authentication is not complete until this MFA challenge succeeds.'
      }
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
      <div className="flex flex-col gap-4">
        {pendingAuth.step === 'mfa-enrollment' ? (
          pendingAuth.enrollment ? (
            <div className="rounded-2xl border p-4">
              <p className="font-medium">Step 1: add this factor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan the QR code in an authenticator app, or enter the secret
                manually. Then verify the current code below to finish signing
                in.
              </p>

              {pendingAuth.enrollment.factor.qrCode ? (
                <img
                  alt="WorkOS TOTP QR code"
                  className="mt-4 size-48 rounded-xl border bg-white p-2"
                  src={pendingAuth.enrollment.factor.qrCode}
                />
              ) : null}

              {pendingAuth.enrollment.factor.secret ? (
                <p className="mt-4 break-all rounded-lg bg-muted p-3 font-mono text-xs">
                  {pendingAuth.enrollment.factor.secret}
                </p>
              ) : null}
            </div>
          ) : (
            <Button
              disabled={isEnrolling}
              onClick={handleStartEnrollment}
              type="button"
            >
              <ShieldCheckIcon data-icon="inline-start" />
              {isEnrolling ? 'Starting MFA setup...' : 'Set up TOTP MFA'}
            </Button>
          )
        ) : (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel>Select a factor</FieldLabel>
                <FieldContent>
                  <Select
                    onValueChange={(value) => setSelectedFactorId(value ?? '')}
                    value={resolvedFactorId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a factor" />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingAuth.factors.map((factor) => (
                        <SelectItem key={factor.id} value={factor.id}>
                          {factor.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            </FieldGroup>

            <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
              {isChallenging
                ? 'Starting your TOTP challenge...'
                : pendingAuth.authenticationChallengeId
                  ? 'Your TOTP challenge is ready. Enter the current code from your authenticator app below.'
                  : 'Preparing your TOTP challenge...'}
            </div>
          </>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleVerify}>
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

          <Button
            disabled={
              isSubmitting ||
              code.length < 6 ||
              !pendingAuth.authenticationChallengeId
            }
            type="submit"
          >
            <KeyIcon data-icon="inline-start" />
            {isSubmitting ? 'Verifying...' : 'Verify TOTP'}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
