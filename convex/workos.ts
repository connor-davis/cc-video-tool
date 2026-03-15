'use node';

import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

const WORKOS_API_BASE_URL = 'https://api.workos.com';
const DEFAULT_TOTP_ISSUER = 'CC Video Tool';

type WorkosRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type WorkosAuthFactorType = 'totp' | 'sms';

type WorkosUser = {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
};

type WorkosOrganization = {
  id: string;
  name: string;
};

type WorkosFactor = {
  object: 'authentication_factor';
  id: string;
  type: WorkosAuthFactorType;
  created_at: string;
  updated_at: string;
  sms?: {
    phone_number: string;
  };
  totp?: {
    issuer: string;
    user: string;
    qr_code?: string;
    secret?: string;
    uri?: string;
  };
};

type WorkosChallenge = {
  object: 'authentication_challenge';
  id: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  authentication_factor_id: string;
};

type WorkosAuthenticationResponse = {
  user: WorkosUser;
  organization_id?: string | null;
  access_token: string;
  refresh_token: string;
};

type AuthenticatedUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  mfaEnrolled: boolean;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  organizationId: string | null;
};

type AuthenticatedResult = {
  ok: true;
  status: 'authenticated';
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
};

type EmailVerificationRequiredResult = {
  ok: true;
  status: 'email_verification_required';
  pendingAuthenticationToken: string;
  email: string | null;
};

type MfaEnrollmentRequiredResult = {
  ok: true;
  status: 'mfa_enrollment_required';
  pendingAuthenticationToken: string;
  userId: string;
  email: string | null;
};

type MfaRequiredResult = {
  ok: true;
  status: 'mfa_required';
  pendingAuthenticationToken: string;
  factors: Array<{
    id: string;
    type: WorkosAuthFactorType;
    displayName: string;
  }>;
};

type OrganizationSelectionRequiredResult = {
  ok: true;
  status: 'organization_selection_required';
  pendingAuthenticationToken: string;
  organizations: Array<{
    id: string;
    name: string;
  }>;
};

export type AuthFlowResult =
  | AuthenticatedResult
  | EmailVerificationRequiredResult
  | MfaEnrollmentRequiredResult
  | MfaRequiredResult
  | OrganizationSelectionRequiredResult;

type WorkosApiErrorPayload = {
  code?: string;
  error?: string;
  message?: string;
  error_description?: string;
  pending_authentication_token?: string;
  email?: string;
  user?: WorkosUser;
  factors?: WorkosFactor[];
  authentication_factors?: WorkosFactor[];
  organizations?: WorkosOrganization[];
};

type VerifiedAccessToken = {
  claims: JWTPayload;
  userId: string;
  sessionId: string | null;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class WorkosApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly payload: WorkosApiErrorPayload
  ) {
    super(message);
  }
}

export class ConfigurationError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getWorkosConfig() {
  const clientId = getRequiredEnv('WORKOS_CLIENT_ID');
  const apiKey = getRequiredEnv('WORKOS_API_KEY');
  const clientSecret =
    process.env.WORKOS_CLIENT_SECRET ?? process.env.WORKOS_API_SECRET;

  if (!clientSecret) {
    throw new ConfigurationError(
      'Missing required environment variable: WORKOS_CLIENT_SECRET (or WORKOS_API_SECRET).'
    );
  }

  return {
    apiKey,
    clientId,
    clientSecret,
    issuer: process.env.WORKOS_ISSUER ?? null,
    jwksUrl:
      process.env.WORKOS_JWKS_URL ??
      `https://api.workos.com/sso/jwks/${clientId}`,
  };
}

function getJwks(url: string) {
  const cached = jwksCache.get(url);

  if (cached) {
    return cached;
  }

  const next = createRemoteJWKSet(new URL(url));
  jwksCache.set(url, next);
  return next;
}

function claimMatchesClientId(payload: JWTPayload, clientId: string) {
  const audience = payload.aud;

  if (typeof audience === 'string') {
    return audience === clientId;
  }

  if (Array.isArray(audience)) {
    return audience.includes(clientId);
  }

  if (typeof payload.azp === 'string') {
    return payload.azp === clientId;
  }

  const clientIdClaim = payload.client_id;

  if (typeof clientIdClaim === 'string') {
    return clientIdClaim === clientId;
  }

  return null;
}

function getAllowedIssuers(clientId: string, configuredIssuer: string | null) {
  return [
    configuredIssuer,
    `https://api.workos.com/user_management/${clientId}`,
  ].filter((issuer): issuer is string => Boolean(issuer));
}

function mapUser(
  user: WorkosUser,
  options: {
    organizationId?: string | null;
    mfaEnrolled?: boolean;
  } = {}
): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified,
    mfaEnrolled: options.mfaEnrolled ?? false,
    firstName: user.first_name,
    lastName: user.last_name,
    profilePictureUrl: user.profile_picture_url,
    organizationId: options.organizationId ?? null,
  };
}

function mapAuthFactor(factor: WorkosFactor) {
  return {
    id: factor.id,
    type: factor.type,
    displayName:
      factor.type === 'totp'
        ? factor.totp?.issuer
          ? `${factor.totp.issuer} TOTP`
          : 'Authenticator app'
        : factor.sms?.phone_number
          ? `SMS to ${factor.sms.phone_number}`
          : 'SMS code',
  };
}

function extractFactors(payload: unknown): WorkosFactor[] {
  if (Array.isArray(payload)) {
    return payload as WorkosFactor[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.authentication_factors)) {
    return record.authentication_factors as WorkosFactor[];
  }

  if (Array.isArray(record.data)) {
    return record.data as WorkosFactor[];
  }

  return [];
}

async function listAuthenticationFactors(userId: string) {
  const response = await workosRequest<unknown>(
    `/user_management/users/${userId}/auth_factors`,
    {
      method: 'GET',
    }
  );

  return extractFactors(response);
}

async function normalizeAuthResponse(
  response: WorkosAuthenticationResponse
): Promise<AuthenticatedResult> {
  const factors = await listAuthenticationFactors(response.user.id);

  return {
    ok: true,
    status: 'authenticated',
    user: mapUser(response.user, {
      organizationId: response.organization_id,
      mfaEnrolled: factors.some((factor) => factor.type === 'totp'),
    }),
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  };
}

function normalizeAuthError(error: WorkosApiError): AuthFlowResult | null {
  const pendingAuthenticationToken =
    typeof error.payload.pending_authentication_token === 'string'
      ? error.payload.pending_authentication_token
      : null;

  if (!pendingAuthenticationToken) {
    return null;
  }

  if (error.code === 'email_verification_required') {
    return {
      ok: true,
      status: 'email_verification_required',
      pendingAuthenticationToken,
      email:
        typeof error.payload.email === 'string' ? error.payload.email : null,
    };
  }

  if (
    error.code === 'mfa_enrollment' ||
    error.code === 'mfa_enrollment_required'
  ) {
    const userId =
      typeof error.payload.user?.id === 'string' ? error.payload.user.id : null;

    if (!userId) {
      return null;
    }

    return {
      ok: true,
      status: 'mfa_enrollment_required',
      pendingAuthenticationToken,
      userId,
      email:
        typeof error.payload.user?.email === 'string'
          ? error.payload.user.email
          : typeof error.payload.email === 'string'
            ? error.payload.email
            : null,
    };
  }

  if (
    error.code === 'mfa_challenge_required' ||
    error.code === 'mfa_challenge'
  ) {
    const rawFactors =
      error.payload.factors ?? error.payload.authentication_factors ?? [];

    return {
      ok: true,
      status: 'mfa_required',
      pendingAuthenticationToken,
      factors: rawFactors.map(mapAuthFactor),
    };
  }

  if (
    error.code === 'organization_selection_required' ||
    error.code === 'organization_selection'
  ) {
    return {
      ok: true,
      status: 'organization_selection_required',
      pendingAuthenticationToken,
      organizations: (error.payload.organizations ?? []).map(
        (organization) => ({
          id: organization.id,
          name: organization.name,
        })
      ),
    };
  }

  return null;
}

async function workosRequest<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const config = getWorkosConfig();

  const response = await fetch(new URL(path, WORKOS_API_BASE_URL), {
    method: init.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const rawText = await response.text();
  let rawBody: Record<string, unknown> = {};

  if (rawText) {
    try {
      rawBody = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      rawBody = {};
    }
  }

  if (!response.ok) {
    throw new WorkosApiError(
      response.status,
      typeof rawBody.code === 'string'
        ? rawBody.code
        : typeof rawBody.error === 'string'
          ? rawBody.error
          : 'workos_error',
      typeof rawBody.message === 'string'
        ? rawBody.message
        : typeof rawBody.error_description === 'string'
          ? rawBody.error_description
          : rawText || `WorkOS request failed with status ${response.status}.`,
      rawBody as WorkosApiErrorPayload
    );
  }

  return rawBody as T;
}

async function runAuthentication(
  body: Record<string, unknown>
): Promise<AuthFlowResult> {
  try {
    const response = await workosRequest<WorkosAuthenticationResponse>(
      '/user_management/authenticate',
      {
        body,
      }
    );

    return await normalizeAuthResponse(response);
  } catch (error) {
    if (error instanceof WorkosApiError) {
      const authFlowResult = normalizeAuthError(error);

      if (authFlowResult) {
        return authFlowResult;
      }
    }

    throw error;
  }
}

function authBasePayload(context: WorkosRequestContext) {
  const { clientId, clientSecret } = getWorkosConfig();

  return {
    client_id: clientId,
    client_secret: clientSecret,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
  };
}

export function extractRequestContext(request: Request): WorkosRequestContext {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: request.headers.get('user-agent') ?? undefined,
  };
}

export function extractAccessToken(request: Request) {
  const authorizationHeader = request.headers.get('authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new WorkosApiError(
      401,
      'missing_authorization',
      'A bearer access token is required.',
      {}
    );
  }

  return authorizationHeader.slice('Bearer '.length);
}

async function verifyAccessToken(
  accessToken: string
): Promise<VerifiedAccessToken> {
  const config = getWorkosConfig();
  const jwks = getJwks(config.jwksUrl);
  let payload: JWTPayload;

  try {
    ({ payload } = await jwtVerify(accessToken, jwks));
  } catch (error) {
    throw new WorkosApiError(
      401,
      'invalid_access_token',
      error instanceof Error
        ? error.message
        : 'WorkOS access token is invalid.',
      {}
    );
  }

  const allowedIssuers = getAllowedIssuers(config.clientId, config.issuer);

  if (
    typeof payload.iss !== 'string' ||
    !allowedIssuers.includes(payload.iss)
  ) {
    throw new WorkosApiError(
      401,
      'invalid_access_token',
      `WorkOS access token has an unexpected issuer: ${
        payload.iss ?? 'missing iss claim'
      }.`,
      {}
    );
  }

  const matchesClientId = claimMatchesClientId(payload, config.clientId);

  if (matchesClientId === false) {
    throw new WorkosApiError(
      401,
      'invalid_access_token',
      'WorkOS access token does not match the configured client ID.',
      {}
    );
  }

  if (typeof payload.sub !== 'string') {
    throw new WorkosApiError(
      401,
      'invalid_access_token',
      'WorkOS access token is missing a subject claim.',
      {}
    );
  }

  return {
    claims: payload,
    userId: payload.sub,
    sessionId: typeof payload.sid === 'string' ? payload.sid : null,
  };
}

export async function authenticateWithPassword(
  input: {
    email: string;
    password: string;
    invitationToken?: string;
  },
  context: WorkosRequestContext
) {
  return runAuthentication({
    ...authBasePayload(context),
    grant_type: 'password',
    email: input.email,
    password: input.password,
    invitation_token: input.invitationToken,
  });
}

export async function signUpUser(
  input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    invitationToken?: string;
  },
  context: WorkosRequestContext
) {
  await workosRequest<WorkosUser>('/user_management/users', {
    body: {
      email: input.email,
      password: input.password,
      first_name: input.firstName,
      last_name: input.lastName,
    },
  });

  return authenticateWithPassword(
    {
      email: input.email,
      password: input.password,
      invitationToken: input.invitationToken,
    },
    context
  );
}

export async function authenticateWithEmailVerification(
  input: {
    pendingAuthenticationToken: string;
    code: string;
  },
  context: WorkosRequestContext
) {
  return runAuthentication({
    ...authBasePayload(context),
    grant_type: 'urn:workos:oauth:grant-type:email-verification:code',
    pending_authentication_token: input.pendingAuthenticationToken,
    code: input.code,
  });
}

export async function authenticateWithOrganizationSelection(
  input: {
    pendingAuthenticationToken: string;
    organizationId: string;
  },
  context: WorkosRequestContext
) {
  return runAuthentication({
    ...authBasePayload(context),
    grant_type: 'urn:workos:oauth:grant-type:organization-selection',
    pending_authentication_token: input.pendingAuthenticationToken,
    organization_id: input.organizationId,
  });
}

export async function authenticateWithTotp(
  input: {
    pendingAuthenticationToken: string;
    authenticationChallengeId: string;
    code: string;
  },
  context: WorkosRequestContext
) {
  return runAuthentication({
    ...authBasePayload(context),
    grant_type: 'urn:workos:oauth:grant-type:mfa-totp',
    pending_authentication_token: input.pendingAuthenticationToken,
    authentication_challenge_id: input.authenticationChallengeId,
    code: input.code,
  });
}

export async function authenticateWithRefreshToken(
  input: { refreshToken: string },
  context: WorkosRequestContext
) {
  return runAuthentication({
    ...authBasePayload(context),
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  });
}

export async function challengeAuthenticationFactor(
  authenticationFactorId: string
) {
  const challenge = await workosRequest<WorkosChallenge>(
    `/auth/factors/${authenticationFactorId}/challenge`,
    {
      body: {},
    }
  );

  return {
    authenticationChallengeId: challenge.id,
    expiresAt: challenge.expires_at,
  };
}

export async function sendPasswordReset(email: string) {
  await workosRequest('/user_management/password_reset', {
    body: {
      email,
    },
  });
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
}) {
  const response = await workosRequest<{ user: WorkosUser }>(
    '/user_management/password_reset/confirm',
    {
      body: {
        token: input.token,
        new_password: input.newPassword,
      },
    }
  );

  return mapUser(response.user);
}

export async function getCurrentAuthenticatedUser(accessToken: string) {
  const verified = await verifyAccessToken(accessToken);
  const [user, factors] = await Promise.all([
    workosRequest<WorkosUser>(`/user_management/users/${verified.userId}`, {
      method: 'GET',
    }),
    listAuthenticationFactors(verified.userId),
  ]);

  return mapUser(user, {
    mfaEnrolled: factors.some((factor) => factor.type === 'totp'),
  });
}

export async function enrollTotpFactor(accessToken: string, issuer?: string) {
  const verified = await verifyAccessToken(accessToken);
  const user = await workosRequest<WorkosUser>(
    `/user_management/users/${verified.userId}`,
    {
      method: 'GET',
    }
  );

  return enrollTotpFactorForUser({
    userId: verified.userId,
    email: user.email,
    issuer,
  });
}

export async function enrollTotpFactorForUser(input: {
  userId: string;
  email: string;
  issuer?: string;
}) {
  const response = await workosRequest<{
    authentication_factor: WorkosFactor;
    authentication_challenge: WorkosChallenge;
  }>(`/user_management/users/${input.userId}/auth_factors`, {
    body: {
      type: 'totp',
      totp_issuer: input.issuer ?? DEFAULT_TOTP_ISSUER,
      totp_user: input.email,
    },
  });

  return {
    authenticationFactor: {
      id: response.authentication_factor.id,
      type: response.authentication_factor.type,
      displayName: mapAuthFactor(response.authentication_factor).displayName,
      qrCode: response.authentication_factor.totp?.qr_code ?? null,
      secret: response.authentication_factor.totp?.secret ?? null,
      uri: response.authentication_factor.totp?.uri ?? null,
    },
    authenticationChallengeId: response.authentication_challenge.id,
  };
}

export async function verifyEnrollmentChallenge(input: {
  authenticationChallengeId: string;
  code: string;
}) {
  const response = await workosRequest<{
    valid: boolean;
  }>(`/auth/challenges/${input.authenticationChallengeId}/verify`, {
    body: {
      code: input.code,
    },
  });

  return {
    valid: response.valid,
  };
}

export async function revokeCurrentSession(accessToken: string) {
  const verified = await verifyAccessToken(accessToken);

  if (!verified.sessionId) {
    return;
  }

  await workosRequest('/user_management/sessions/revoke', {
    body: {
      session_id: verified.sessionId,
    },
  });
}
