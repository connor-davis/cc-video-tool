import {
  CheckCircleIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserCircleIcon,
} from '@phosphor-icons/react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { type ReactNode, useState } from 'react';

import { toast } from 'sonner';

import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

export const Route = createFileRoute('/app')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/sign-in',
        search: { invitationToken: undefined },
      });
    }
  },
  component: AppRoute,
});

function AppRoute() {
  const convexAuth = useConvexAuth();
  const navigate = useNavigate();
  const {
    session,
    user,
    signOut,
    enrollTotp,
    totpEnrollment,
    verifyTotpEnrollment,
  } = useAuth();
  const [totpCode, setTotpCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleEnrollTotp() {
    setIsEnrolling(true);

    try {
      await enrollTotp();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to start TOTP enrollment.'
      );
    } finally {
      setIsEnrolling(false);
    }
  }

  async function handleVerifyTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifying(true);

    try {
      await verifyTotpEnrollment(totpCode);
      setTotpCode('');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to verify the TOTP code.'
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out.');
    await navigate({
      to: '/sign-in',
      search: { invitationToken: undefined },
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="border-primary/10 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Protected route</Badge>
            <Badge variant="secondary">Convex + WorkOS</Badge>
          </div>
          <CardTitle className="text-3xl">Authenticated workspace</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            This route only renders after the custom WorkOS flow fully
            completes, including any required MFA challenge. Convex handles the
            server-side HTTP routes while your WorkOS session stays in the
            custom client auth provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoTile
              label="Signed-in email"
              value={user?.email ?? 'Unknown'}
              icon={<UserCircleIcon weight="fill" />}
            />
            <InfoTile
              label="Convex auth"
              value={convexAuth.isAuthenticated ? 'Connected' : 'Pending'}
              icon={<CheckCircleIcon weight="fill" />}
            />
            <InfoTile
              label="Email verified"
              value={user?.emailVerified ? 'Yes' : 'No'}
              icon={<ShieldCheckIcon weight="fill" />}
            />
            <InfoTile
              label="Session ID"
              value={session?.sessionId ?? 'Unavailable'}
              icon={<CheckCircleIcon weight="fill" />}
            />
          </div>

          <Button className="w-fit" onClick={handleSignOut} variant="outline">
            <SignOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Security settings</CardTitle>
          <CardDescription>
            Enroll a WorkOS TOTP factor from your own UI. WorkOS stores the
            factor; Convex only brokers the secure REST calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user?.mfaEnrolled && !totpEnrollment ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="font-medium">TOTP MFA is enrolled</p>
              <p className="mt-1 text-sm text-muted-foreground">
                WorkOS can now challenge your authenticator app during future
                sign-ins.
              </p>
            </div>
          ) : !totpEnrollment ? (
            <Button disabled={isEnrolling} onClick={handleEnrollTotp}>
              <ShieldCheckIcon data-icon="inline-start" />
              {isEnrolling ? 'Starting TOTP setup...' : 'Enroll TOTP MFA'}
            </Button>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border p-4">
                <p className="font-medium">Step 1: add this factor</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scan the QR code in an authenticator app, or enter the secret
                  manually.
                </p>

                {totpEnrollment.factor.qrCode ? (
                  <img
                    alt="WorkOS TOTP QR code"
                    className="mt-4 size-48 rounded-xl border bg-white p-2"
                    src={totpEnrollment.factor.qrCode}
                  />
                ) : null}

                {totpEnrollment.factor.secret ? (
                  <p className="mt-4 break-all rounded-lg bg-muted p-3 font-mono text-xs">
                    {totpEnrollment.factor.secret}
                  </p>
                ) : null}
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleVerifyTotp}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Step 2: verify the current code</FieldLabel>
                    <FieldContent>
                      <InputOTP
                        maxLength={6}
                        value={totpCode}
                        onChange={(value) => setTotpCode(value)}
                        containerClassName="justify-center"
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot index={index} key={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <FieldDescription>
                        Once verified, WorkOS can challenge this factor during
                        future sign-ins.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>

                <Button
                  disabled={isVerifying || totpCode.length < 6}
                  type="submit"
                >
                  <ShieldCheckIcon data-icon="inline-start" />
                  {isVerifying ? 'Verifying...' : 'Verify TOTP enrollment'}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background/80 p-4">
      <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}
