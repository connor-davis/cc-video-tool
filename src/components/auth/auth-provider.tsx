import * as React from 'react';

import { decodeJwt } from 'jose';
import { toast } from 'sonner';

import type {
  AuthFlowResult,
  AuthSession,
  AuthUser,
  PendingAuthState,
  RouterAuthContext,
  TotpEnrollment,
} from '@/lib/auth-types';
import { getPathForAuthFlow } from '@/lib/auth-types';
import {
  challengeMfaFactor,
  confirmPasswordReset,
  enrollPendingTotp,
  enrollTotp,
  getCurrentSession,
  refreshSession,
  requestPasswordReset,
  selectOrganization,
  signIn,
  signOut,
  signUp,
  verifyEmail,
  verifyTotp,
  verifyTotpEnrollment,
} from '@/lib/workos-auth-client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SignInInput = {
  email: string;
  password: string;
  invitationToken?: string;
};

type SignUpInput = {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  invitationToken?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  pendingAuth: PendingAuthState | null;
  totpEnrollment: TotpEnrollment | null;
  routerContext: RouterAuthContext;
  signIn: (input: SignInInput) => Promise<AuthFlowResult>;
  signUp: (input: SignUpInput) => Promise<AuthFlowResult>;
  verifyEmailCode: (code: string) => Promise<AuthFlowResult>;
  chooseOrganization: (organizationId: string) => Promise<AuthFlowResult>;
  startTotpChallenge: (factorId: string) => Promise<void>;
  startPendingTotpEnrollment: (issuer?: string) => Promise<void>;
  verifyTotpCode: (code: string) => Promise<AuthFlowResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  enrollTotp: (issuer?: string) => Promise<void>;
  verifyTotpEnrollment: (code: string) => Promise<void>;
  clearPendingAuth: () => void;
  fetchAccessToken: (options?: {
    forceRefreshToken?: boolean;
  }) => Promise<string | null>;
};

type StoredAuthState = {
  session: AuthSession | null;
  pendingAuth: PendingAuthState | null;
  totpEnrollment: TotpEnrollment | null;
};

const AUTH_STORAGE_KEY = 'auth-session';
const SESSION_SYNC_INTERVAL_MS = 60_000;

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

function readStoredAuthState(): StoredAuthState {
  const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedValue) {
    return {
      session: null,
      pendingAuth: null,
      totpEnrollment: null,
    };
  }

  try {
    const parsed = JSON.parse(storedValue) as StoredAuthState;
    return {
      session: parsed.session ?? null,
      pendingAuth: parsed.pendingAuth ?? null,
      totpEnrollment: parsed.totpEnrollment ?? null,
    };
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return {
      session: null,
      pendingAuth: null,
      totpEnrollment: null,
    };
  }
}

function persistAuthState(state: StoredAuthState) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function clearStoredAuthState() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function extractSessionClaims(accessToken: string) {
  const payload = decodeJwt(accessToken);

  if (typeof payload.exp !== 'number') {
    throw new Error('WorkOS access token is missing an expiration claim.');
  }

  return {
    expiresAt: payload.exp * 1000,
    sessionId: typeof payload.sid === 'string' ? payload.sid : null,
  };
}

function buildSessionFromAuthResult(
  result: Extract<AuthFlowResult, { status: 'authenticated' }>
): AuthSession {
  const claims = extractSessionClaims(result.accessToken);

  return {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: claims.expiresAt,
    sessionId: claims.sessionId,
  };
}

function buildPendingState(
  result: Exclude<AuthFlowResult, { status: 'authenticated' }>
): PendingAuthState {
  switch (result.status) {
    case 'email_verification_required':
      return {
        step: 'verify-email',
        pendingAuthenticationToken: result.pendingAuthenticationToken,
        email: result.email,
      };
    case 'mfa_required':
      return {
        step: 'mfa',
        pendingAuthenticationToken: result.pendingAuthenticationToken,
        factors: result.factors,
        authenticationChallengeId: null,
        selectedFactorId: result.factors[0]?.id ?? null,
      };
    case 'mfa_enrollment_required':
      return {
        step: 'mfa-enrollment',
        pendingAuthenticationToken: result.pendingAuthenticationToken,
        userId: result.userId,
        email: result.email,
        authenticationChallengeId: null,
        enrollment: null,
      };
    case 'organization_selection_required':
      return {
        step: 'organization',
        pendingAuthenticationToken: result.pendingAuthenticationToken,
        organizations: result.organizations,
      };
  }
}

function shouldRefreshSession(session: AuthSession) {
  return session.expiresAt - Date.now() < 60_000;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [pendingAuth, setPendingAuth] = React.useState<PendingAuthState | null>(
    null
  );
  const [totpEnrollment, setTotpEnrollment] =
    React.useState<TotpEnrollment | null>(null);
  const refreshInFlightRef = React.useRef<Promise<string | null> | null>(null);
  const sessionSyncInFlightRef = React.useRef<Promise<void> | null>(null);
  const sessionRef = React.useRef<AuthSession | null>(null);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const saveState = React.useCallback((nextState: StoredAuthState) => {
    persistAuthState(nextState);
    setSession(nextState.session);
    setPendingAuth(nextState.pendingAuth);
    setTotpEnrollment(nextState.totpEnrollment);
    setStatus(nextState.session ? 'authenticated' : 'unauthenticated');
  }, []);

  const clearPendingAuth = React.useCallback(() => {
    saveState({
      session,
      pendingAuth: null,
      totpEnrollment,
    });
  }, [saveState, session, totpEnrollment]);

  const applyAuthResult = React.useCallback(
    (result: AuthFlowResult) => {
      if (result.status === 'authenticated') {
        const nextSession = buildSessionFromAuthResult(result);
        saveState({
          session: nextSession,
          pendingAuth: null,
          totpEnrollment: null,
        });
        return result;
      }

      saveState({
        session: null,
        pendingAuth: buildPendingState(result),
        totpEnrollment: null,
      });

      return result;
    },
    [saveState]
  );

  const refreshActiveSession = React.useCallback(
    async (currentSession: AuthSession, forceRefreshToken = false) => {
      if (!forceRefreshToken && !shouldRefreshSession(currentSession)) {
        return currentSession.accessToken;
      }

      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      const nextRefresh = (async () => {
        const result = await refreshSession(currentSession.refreshToken);

        if (result.status !== 'authenticated') {
          saveState({
            session: null,
            pendingAuth: buildPendingState(result),
            totpEnrollment: null,
          });
          return null;
        }

        const nextSession = buildSessionFromAuthResult(result);
        saveState({
          session: nextSession,
          pendingAuth: null,
          totpEnrollment: null,
        });

        return nextSession.accessToken;
      })();

      refreshInFlightRef.current = nextRefresh;

      try {
        return await nextRefresh;
      } finally {
        if (refreshInFlightRef.current === nextRefresh) {
          refreshInFlightRef.current = null;
        }
      }
    },
    [saveState]
  );

  const syncSessionUser = React.useCallback(
    async (currentSession: AuthSession) => {
      if (sessionSyncInFlightRef.current) {
        return sessionSyncInFlightRef.current;
      }

      const nextSync = (async () => {
        const accessToken = await refreshActiveSession(currentSession);

        if (!accessToken) {
          return;
        }

        const result = await getCurrentSession(accessToken);
        const latestSession = sessionRef.current ?? currentSession;
        const nextSession: AuthSession = {
          ...latestSession,
          accessToken,
          user: result.user,
        };

        saveState({
          session: nextSession,
          pendingAuth: null,
          totpEnrollment,
        });
      })();

      sessionSyncInFlightRef.current = nextSync;

      try {
        await nextSync;
      } finally {
        if (sessionSyncInFlightRef.current === nextSync) {
          sessionSyncInFlightRef.current = null;
        }
      }
    },
    [refreshActiveSession, saveState, totpEnrollment]
  );

  React.useEffect(() => {
    const storedState = readStoredAuthState();

    let cancelled = false;

    const restoreSession = async () => {
      if (!storedState.session) {
        if (!cancelled) {
          setPendingAuth(storedState.pendingAuth);
          setTotpEnrollment(storedState.totpEnrollment);
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        if (shouldRefreshSession(storedState.session)) {
          const result = await refreshSession(storedState.session.refreshToken);

          if (cancelled) {
            return;
          }

          if (result.status !== 'authenticated') {
            saveState({
              session: null,
              pendingAuth: buildPendingState(result),
              totpEnrollment: null,
            });
            return;
          }

          const nextSession = buildSessionFromAuthResult(result);
          saveState({
            session: nextSession,
            pendingAuth: null,
            totpEnrollment: null,
          });
          return;
        }

        if (!cancelled) {
          setSession(storedState.session);
          setPendingAuth(storedState.pendingAuth);
          setTotpEnrollment(storedState.totpEnrollment);
          setStatus('authenticated');
        }

        try {
          await syncSessionUser(storedState.session);
        } catch {
          if (!cancelled) {
            clearStoredAuthState();
            setSession(null);
            setPendingAuth(null);
            setTotpEnrollment(null);
            setStatus('unauthenticated');
          }
        }
      } catch {
        if (!cancelled) {
          clearStoredAuthState();
          setSession(null);
          setPendingAuth(null);
          setTotpEnrollment(null);
          setStatus('unauthenticated');
        }
      }
    };

    void restoreSession();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        event.key !== AUTH_STORAGE_KEY
      ) {
        return;
      }

      const nextState = readStoredAuthState();
      setSession(nextState.session);
      setPendingAuth(nextState.pendingAuth);
      setTotpEnrollment(nextState.totpEnrollment);
      setStatus(nextState.session ? 'authenticated' : 'unauthenticated');
    };

    window.addEventListener('storage', handleStorage);

    const syncOnVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !sessionRef.current) {
        return;
      }

      void syncSessionUser(sessionRef.current).catch(() => {
        clearStoredAuthState();
        setSession(null);
        setPendingAuth(null);
        setTotpEnrollment(null);
        setStatus('unauthenticated');
      });
    };

    const intervalId = window.setInterval(() => {
      const currentState = readStoredAuthState();

      if (!currentState.session) {
        return;
      }

      void syncSessionUser(currentState.session).catch(() => {
        clearStoredAuthState();
        setSession(null);
        setPendingAuth(null);
        setTotpEnrollment(null);
        setStatus('unauthenticated');
      });
    }, SESSION_SYNC_INTERVAL_MS);

    window.addEventListener('focus', syncOnVisibilityChange);
    document.addEventListener('visibilitychange', syncOnVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncOnVisibilityChange);
      document.removeEventListener('visibilitychange', syncOnVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [saveState, syncSessionUser]);

  const handleSignIn = React.useCallback(
    async (input: SignInInput) => {
      const result = await signIn(input);
      return applyAuthResult(result);
    },
    [applyAuthResult]
  );

  const handleSignUp = React.useCallback(
    async (input: SignUpInput) => {
      const result = await signUp(input);
      return applyAuthResult(result);
    },
    [applyAuthResult]
  );

  const handleVerifyEmailCode = React.useCallback(
    async (code: string) => {
      if (pendingAuth?.step !== 'verify-email') {
        throw new Error('There is no email verification flow in progress.');
      }

      const result = await verifyEmail({
        code,
        pendingAuthenticationToken: pendingAuth.pendingAuthenticationToken,
      });

      return applyAuthResult(result);
    },
    [applyAuthResult, pendingAuth]
  );

  const handleChooseOrganization = React.useCallback(
    async (organizationId: string) => {
      if (pendingAuth?.step !== 'organization') {
        throw new Error('There is no organization selection in progress.');
      }

      const result = await selectOrganization({
        organizationId,
        pendingAuthenticationToken: pendingAuth.pendingAuthenticationToken,
      });

      return applyAuthResult(result);
    },
    [applyAuthResult, pendingAuth]
  );

  const handleStartTotpChallenge = React.useCallback(
    async (factorId: string) => {
      if (pendingAuth?.step !== 'mfa') {
        throw new Error('There is no MFA challenge in progress.');
      }

      const response = await challengeMfaFactor(factorId);

      saveState({
        session: null,
        pendingAuth: {
          ...pendingAuth,
          selectedFactorId: factorId,
          authenticationChallengeId: response.authenticationChallengeId,
        },
        totpEnrollment,
      });
    },
    [pendingAuth, saveState, totpEnrollment]
  );

  const handleVerifyTotpCode = React.useCallback(
    async (code: string) => {
      if (
        (pendingAuth?.step !== 'mfa' &&
          pendingAuth?.step !== 'mfa-enrollment') ||
        !pendingAuth.authenticationChallengeId
      ) {
        throw new Error('Start an MFA challenge before verifying a code.');
      }

      const result = await verifyTotp({
        code,
        authenticationChallengeId: pendingAuth.authenticationChallengeId,
        pendingAuthenticationToken: pendingAuth.pendingAuthenticationToken,
      });

      return applyAuthResult(result);
    },
    [applyAuthResult, pendingAuth]
  );

  const handleStartPendingTotpEnrollment = React.useCallback(
    async (issuer?: string) => {
      if (pendingAuth?.step !== 'mfa-enrollment') {
        throw new Error('There is no MFA enrollment in progress.');
      }

      if (!pendingAuth.email) {
        throw new Error('WorkOS did not provide an email for MFA enrollment.');
      }

      const result = await enrollPendingTotp({
        pendingAuthenticationToken: pendingAuth.pendingAuthenticationToken,
        userId: pendingAuth.userId,
        email: pendingAuth.email,
        issuer,
      });

      saveState({
        session: null,
        pendingAuth: {
          ...pendingAuth,
          authenticationChallengeId: result.authenticationChallengeId,
          enrollment: {
            factor: result.authenticationFactor,
            authenticationChallengeId: result.authenticationChallengeId,
          },
        },
        totpEnrollment,
      });
    },
    [pendingAuth, saveState, totpEnrollment]
  );

  const handleRequestPasswordReset = React.useCallback(
    async (email: string) => {
      await requestPasswordReset(email);
    },
    []
  );

  const handleConfirmPasswordReset = React.useCallback(
    async (token: string, password: string) => {
      await confirmPasswordReset({
        token,
        password,
      });
    },
    []
  );

  const handleSignOut = React.useCallback(async () => {
    if (session) {
      try {
        await signOut(session.accessToken);
      } catch {
        toast.error('We cleared the local session, but remote logout failed.');
      }
    }

    clearStoredAuthState();
    setSession(null);
    setPendingAuth(null);
    setTotpEnrollment(null);
    setStatus('unauthenticated');
  }, [session]);

  const handleEnrollTotp = React.useCallback(
    async (issuer?: string) => {
      if (!session) {
        throw new Error('Sign in before enrolling MFA.');
      }

      const accessToken = await refreshActiveSession(session);

      if (!accessToken) {
        throw new Error(
          'Your session has expired. Sign in again to enroll MFA.'
        );
      }

      const result = await enrollTotp(accessToken, issuer);
      const nextEnrollment: TotpEnrollment = {
        factor: result.authenticationFactor,
        authenticationChallengeId: result.authenticationChallengeId,
      };

      saveState({
        session,
        pendingAuth,
        totpEnrollment: nextEnrollment,
      });
    },
    [pendingAuth, refreshActiveSession, saveState, session]
  );

  const handleVerifyTotpEnrollment = React.useCallback(
    async (code: string) => {
      if (!totpEnrollment) {
        throw new Error('Start TOTP enrollment before verifying it.');
      }

      const result = await verifyTotpEnrollment({
        authenticationChallengeId: totpEnrollment.authenticationChallengeId,
        code,
      });

      if (!result.valid) {
        throw new Error('That TOTP code was invalid.');
      }

      saveState({
        session: session
          ? {
              ...session,
              user: {
                ...session.user,
                mfaEnrolled: true,
              },
            }
          : session,
        pendingAuth,
        totpEnrollment: null,
      });

      toast.success('TOTP MFA is now enrolled for this account.');
    },
    [pendingAuth, saveState, session, totpEnrollment]
  );

  const fetchAccessToken = React.useCallback(
    async (options?: { forceRefreshToken?: boolean }) => {
      const currentSession = sessionRef.current;

      if (!currentSession) {
        return null;
      }

      return refreshActiveSession(currentSession, options?.forceRefreshToken);
    },
    [refreshActiveSession]
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === 'authenticated',
      user: session?.user ?? null,
      session,
      pendingAuth,
      totpEnrollment,
      routerContext: {
        isAuthenticated: status === 'authenticated',
        user: session?.user ?? null,
      },
      signIn: handleSignIn,
      signUp: handleSignUp,
      verifyEmailCode: handleVerifyEmailCode,
      chooseOrganization: handleChooseOrganization,
      startTotpChallenge: handleStartTotpChallenge,
      startPendingTotpEnrollment: handleStartPendingTotpEnrollment,
      verifyTotpCode: handleVerifyTotpCode,
      requestPasswordReset: handleRequestPasswordReset,
      confirmPasswordReset: handleConfirmPasswordReset,
      signOut: handleSignOut,
      enrollTotp: handleEnrollTotp,
      verifyTotpEnrollment: handleVerifyTotpEnrollment,
      clearPendingAuth,
      fetchAccessToken,
    }),
    [
      clearPendingAuth,
      fetchAccessToken,
      handleChooseOrganization,
      handleConfirmPasswordReset,
      handleEnrollTotp,
      handleRequestPasswordReset,
      handleSignIn,
      handleSignOut,
      handleSignUp,
      handleStartPendingTotpEnrollment,
      handleStartTotpChallenge,
      handleVerifyEmailCode,
      handleVerifyTotpCode,
      handleVerifyTotpEnrollment,
      pendingAuth,
      session,
      status,
      totpEnrollment,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export function useConvexAuthBridge() {
  const {
    fetchAccessToken: providerFetchAccessToken,
    isAuthenticated,
    status,
  } = useAuth();

  const fetchAccessToken = React.useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
      providerFetchAccessToken({ forceRefreshToken }),
    [providerFetchAccessToken]
  );

  return React.useMemo(
    () => ({
      isLoading: status === 'loading',
      isAuthenticated,
      fetchAccessToken,
    }),
    [fetchAccessToken, isAuthenticated, status]
  );
}

export function getAuthSuccessPath(result: AuthFlowResult) {
  return getPathForAuthFlow(result);
}
