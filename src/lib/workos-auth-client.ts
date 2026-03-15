import type { AuthFlowResult, TotpEnrollment } from '@/lib/auth-types';
import { getClientEnv } from '@/lib/env';

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

type RequestOptions = {
  token?: string;
  body?: Record<string, unknown>;
};

export class WorkosAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getApiBaseUrl() {
  return getClientEnv('VITE_CONVEX_SITE_URL');
}

async function request<T extends Record<string, unknown>>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token
        ? {
            Authorization: `Bearer ${options.token}`,
          }
        : {}),
    },
    body: JSON.stringify(options.body ?? {}),
  });

  const payload = (await response.json()) as T | ApiErrorPayload;

  if (!response.ok) {
    throw new WorkosAuthError(
      'code' in payload && typeof payload.code === 'string'
        ? payload.code
        : 'request_failed',
      'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : 'Authentication request failed.',
      response.status
    );
  }

  return payload as T;
}

export function signIn(input: {
  email: string;
  password: string;
  invitationToken?: string;
}) {
  return request<AuthFlowResult>('/auth/sign-in', {
    body: input,
  });
}

export function signUp(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  invitationToken?: string;
}) {
  return request<AuthFlowResult>('/auth/sign-up', {
    body: input,
  });
}

export function verifyEmail(input: {
  pendingAuthenticationToken: string;
  code: string;
}) {
  return request<AuthFlowResult>('/auth/verify-email', {
    body: input,
  });
}

export function selectOrganization(input: {
  pendingAuthenticationToken: string;
  organizationId: string;
}) {
  return request<AuthFlowResult>('/auth/organization', {
    body: input,
  });
}

export function challengeMfaFactor(authenticationFactorId: string) {
  return request<{
    ok: true;
    authenticationChallengeId: string;
    expiresAt: string;
  }>('/auth/mfa/challenge', {
    body: {
      authenticationFactorId,
    },
  });
}

export function enrollPendingTotp(input: {
  pendingAuthenticationToken: string;
  userId: string;
  email: string | null;
  issuer?: string;
}) {
  return request<{
    ok: true;
    authenticationFactor: TotpEnrollment['factor'];
    authenticationChallengeId: string;
  }>('/auth/mfa/enroll-pending', {
    body: input,
  });
}

export function verifyTotp(input: {
  pendingAuthenticationToken: string;
  authenticationChallengeId: string;
  code: string;
}) {
  return request<AuthFlowResult>('/auth/mfa/verify', {
    body: input,
  });
}

export function requestPasswordReset(email: string) {
  return request<{
    ok: true;
    status: 'password_reset_requested';
  }>('/auth/password-reset/request', {
    body: {
      email,
    },
  });
}

export function confirmPasswordReset(input: {
  token: string;
  password: string;
}) {
  return request<{
    ok: true;
    user: {
      id: string;
      email: string;
    };
  }>('/auth/password-reset/confirm', {
    body: input,
  });
}

export function refreshSession(refreshToken: string) {
  return request<AuthFlowResult>('/auth/refresh', {
    body: {
      refreshToken,
    },
  });
}

export function signOut(accessToken: string) {
  return request<{
    ok: true;
    status: 'logged_out';
  }>('/auth/logout', {
    token: accessToken,
  });
}

export function getCurrentSession(accessToken: string) {
  return request<{
    ok: true;
    status: 'authenticated';
    user: AuthFlowResult extends infer T
      ? T extends { status: 'authenticated'; user: infer U }
        ? U
        : never
      : never;
  }>('/auth/session', {
    token: accessToken,
  });
}

export function enrollTotp(accessToken: string, issuer?: string) {
  return request<{
    ok: true;
    authenticationFactor: TotpEnrollment['factor'];
    authenticationChallengeId: string;
  }>('/auth/mfa/enroll', {
    token: accessToken,
    body: issuer
      ? {
          issuer,
        }
      : {},
  });
}

export function verifyTotpEnrollment(input: {
  authenticationChallengeId: string;
  code: string;
}) {
  return request<{
    ok: true;
    valid: boolean;
  }>('/auth/mfa/enroll/verify', {
    body: input,
  });
}
