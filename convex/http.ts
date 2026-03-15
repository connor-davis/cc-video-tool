import { httpActionGeneric, httpRouter } from 'convex/server';

import {
  AuthFlowResult,
  ConfigurationError,
  WorkosApiError,
  authenticateWithEmailVerification,
  authenticateWithOrganizationSelection,
  authenticateWithPassword,
  authenticateWithRefreshToken,
  authenticateWithTotp,
  challengeAuthenticationFactor,
  enrollTotpFactor,
  enrollTotpFactorForUser,
  extractAccessToken,
  extractRequestContext,
  getCurrentAuthenticatedUser,
  resetPassword,
  revokeCurrentSession,
  sendPasswordReset,
  signUpUser,
  verifyEnrollmentChallenge,
} from './workos';

const http = httpRouter();

type RouteHandler = (request: Request) => Promise<Response>;

type JsonRecord = Record<string, unknown>;

class HttpJsonError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function getCorsHeaders(request: Request) {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = process.env.APP_ORIGIN ?? requestOrigin ?? '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    Vary: 'Origin',
  };
}

function json(
  request: Request,
  body: JsonRecord | AuthFlowResult,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}

function empty(request: Request, status = 204) {
  return new Response(null, {
    status,
    headers: getCorsHeaders(request),
  });
}

async function parseJsonBody<T extends JsonRecord>(
  request: Request
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpJsonError(400, 'invalid_json', 'Request body must be JSON.');
  }
}

function registerPostRoute(path: string, handler: RouteHandler) {
  http.route({
    path,
    method: 'POST',
    handler: httpActionGeneric(async (_, request) => handler(request)),
  });

  http.route({
    path,
    method: 'OPTIONS',
    handler: httpActionGeneric(async (_, request) => empty(request)),
  });
}

function errorResponse(request: Request, error: unknown) {
  if (error instanceof HttpJsonError) {
    return json(
      request,
      {
        ok: false,
        code: error.code,
        message: error.message,
      },
      error.status
    );
  }

  if (error instanceof WorkosApiError) {
    return json(
      request,
      {
        ok: false,
        code: error.code,
        message: error.message,
      },
      error.status
    );
  }

  if (error instanceof ConfigurationError) {
    return json(
      request,
      {
        ok: false,
        code: 'configuration_error',
        message: error.message,
      },
      500
    );
  }

  const message =
    error instanceof Error ? error.message : 'Unexpected authentication error.';

  return json(
    request,
    {
      ok: false,
      code: 'internal_error',
      message,
    },
    500
  );
}

registerPostRoute('/auth/sign-in', async (request) => {
  try {
    const body = await parseJsonBody<{
      email?: string;
      password?: string;
      invitationToken?: string;
    }>(request);

    if (!body.email || !body.password) {
      throw new HttpJsonError(
        400,
        'missing_credentials',
        'Email and password are required.'
      );
    }

    const result = await authenticateWithPassword(
      {
        email: body.email,
        password: body.password,
        invitationToken: body.invitationToken,
      },
      extractRequestContext(request)
    );

    return json(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/sign-up', async (request) => {
  try {
    const body = await parseJsonBody<{
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      invitationToken?: string;
    }>(request);

    if (!body.email || !body.password) {
      throw new HttpJsonError(
        400,
        'missing_credentials',
        'Email and password are required.'
      );
    }

    const result = await signUpUser(
      {
        email: body.email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
        invitationToken: body.invitationToken,
      },
      extractRequestContext(request)
    );

    return json(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/verify-email', async (request) => {
  try {
    const body = await parseJsonBody<{
      code?: string;
      pendingAuthenticationToken?: string;
    }>(request);

    if (!body.code || !body.pendingAuthenticationToken) {
      throw new HttpJsonError(
        400,
        'missing_verification_payload',
        'Verification code and pending authentication token are required.'
      );
    }

    const result = await authenticateWithEmailVerification(
      {
        code: body.code,
        pendingAuthenticationToken: body.pendingAuthenticationToken,
      },
      extractRequestContext(request)
    );

    return json(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/organization', async (request) => {
  try {
    const body = await parseJsonBody<{
      organizationId?: string;
      pendingAuthenticationToken?: string;
    }>(request);

    if (!body.organizationId || !body.pendingAuthenticationToken) {
      throw new HttpJsonError(
        400,
        'missing_organization_selection',
        'Organization selection is required.'
      );
    }

    const result = await authenticateWithOrganizationSelection(
      {
        organizationId: body.organizationId,
        pendingAuthenticationToken: body.pendingAuthenticationToken,
      },
      extractRequestContext(request)
    );

    return json(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/mfa/challenge', async (request) => {
  try {
    const body = await parseJsonBody<{ authenticationFactorId?: string }>(
      request
    );

    if (!body.authenticationFactorId) {
      throw new HttpJsonError(
        400,
        'missing_factor',
        'An authentication factor is required.'
      );
    }

    const result = await challengeAuthenticationFactor(
      body.authenticationFactorId
    );

    return json(request, {
      ok: true,
      authenticationChallengeId: result.authenticationChallengeId,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/mfa/verify', async (request) => {
  try {
    const body = await parseJsonBody<{
      code?: string;
      authenticationChallengeId?: string;
      pendingAuthenticationToken?: string;
    }>(request);

    if (
      !body.code ||
      !body.authenticationChallengeId ||
      !body.pendingAuthenticationToken
    ) {
      throw new HttpJsonError(
        400,
        'missing_mfa_payload',
        'Code, challenge, and pending authentication token are required.'
      );
    }

    const result = await authenticateWithTotp(
      {
        code: body.code,
        authenticationChallengeId: body.authenticationChallengeId,
        pendingAuthenticationToken: body.pendingAuthenticationToken,
      },
      extractRequestContext(request)
    );

    return json(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/mfa/enroll', async (request) => {
  try {
    const accessToken = extractAccessToken(request);
    const body = await parseJsonBody<{ issuer?: string }>(request);
    const result = await enrollTotpFactor(accessToken, body.issuer);

    return json(request, {
      ok: true,
      authenticationFactor: result.authenticationFactor,
      authenticationChallengeId: result.authenticationChallengeId,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/mfa/enroll-pending', async (request) => {
  try {
    const body = await parseJsonBody<{
      pendingAuthenticationToken?: string;
      userId?: string;
      email?: string | null;
      issuer?: string;
    }>(request);

    if (!body.pendingAuthenticationToken || !body.userId || !body.email) {
      throw new HttpJsonError(
        400,
        'missing_mfa_enrollment_payload',
        'Pending authentication token, user ID, and email are required.'
      );
    }

    const result = await enrollTotpFactorForUser({
      userId: body.userId,
      email: body.email,
      issuer: body.issuer,
    });

    return json(request, {
      ok: true,
      authenticationFactor: result.authenticationFactor,
      authenticationChallengeId: result.authenticationChallengeId,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/mfa/enroll/verify', async (request) => {
  try {
    const body = await parseJsonBody<{
      authenticationChallengeId?: string;
      code?: string;
    }>(request);

    if (!body.authenticationChallengeId || !body.code) {
      throw new HttpJsonError(
        400,
        'missing_enrollment_verification',
        'Challenge ID and code are required.'
      );
    }

    const result = await verifyEnrollmentChallenge({
      authenticationChallengeId: body.authenticationChallengeId,
      code: body.code,
    });

    return json(request, {
      ok: true,
      valid: result.valid,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/session', async (request) => {
  try {
    const accessToken = extractAccessToken(request);
    const user = await getCurrentAuthenticatedUser(accessToken);

    return json(request, {
      ok: true,
      status: 'authenticated',
      user,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/password-reset/request', async (request) => {
  try {
    const body = await parseJsonBody<{ email?: string }>(request);

    if (!body.email) {
      throw new HttpJsonError(
        400,
        'missing_email',
        'An email address is required.'
      );
    }

    await sendPasswordReset(body.email);

    return json(request, {
      ok: true,
      status: 'password_reset_requested',
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/password-reset/confirm', async (request) => {
  try {
    const body = await parseJsonBody<{ token?: string; password?: string }>(
      request
    );

    if (!body.token || !body.password) {
      throw new HttpJsonError(
        400,
        'missing_password_reset_payload',
        'Password reset token and new password are required.'
      );
    }

    const user = await resetPassword({
      token: body.token,
      newPassword: body.password,
    });

    return json(request, {
      ok: true,
      user,
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/refresh', async (request) => {
  try {
    const body = await parseJsonBody<{ refreshToken?: string }>(request);

    if (!body.refreshToken) {
      throw new HttpJsonError(
        400,
        'missing_refresh_token',
        'A refresh token is required.'
      );
    }

    const result = await authenticateWithRefreshToken(
      { refreshToken: body.refreshToken },
      extractRequestContext(request)
    );

    return json(request, result);
  } catch (error) {
    return errorResponse(request, error);
  }
});

registerPostRoute('/auth/logout', async (request) => {
  try {
    const accessToken = extractAccessToken(request);
    await revokeCurrentSession(accessToken);

    return json(request, {
      ok: true,
      status: 'logged_out',
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

export default http;
