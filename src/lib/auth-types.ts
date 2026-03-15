export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  mfaEnrolled: boolean;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  organizationId: string | null;
};

export type AuthFactor = {
  id: string;
  type: 'totp' | 'sms';
  displayName: string;
};

export type AuthOrganization = {
  id: string;
  name: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sessionId: string | null;
};

export type AuthFlowResult =
  | {
      ok: true;
      status: 'authenticated';
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    }
  | {
      ok: true;
      status: 'email_verification_required';
      pendingAuthenticationToken: string;
      email: string | null;
    }
  | {
      ok: true;
      status: 'mfa_required';
      pendingAuthenticationToken: string;
      factors: AuthFactor[];
    }
  | {
      ok: true;
      status: 'mfa_enrollment_required';
      pendingAuthenticationToken: string;
      userId: string;
      email: string | null;
    }
  | {
      ok: true;
      status: 'organization_selection_required';
      pendingAuthenticationToken: string;
      organizations: AuthOrganization[];
    };

export type PendingAuthState =
  | {
      step: 'verify-email';
      pendingAuthenticationToken: string;
      email: string | null;
    }
  | {
      step: 'mfa';
      pendingAuthenticationToken: string;
      factors: AuthFactor[];
      authenticationChallengeId: string | null;
      selectedFactorId: string | null;
    }
  | {
      step: 'mfa-enrollment';
      pendingAuthenticationToken: string;
      userId: string;
      email: string | null;
      authenticationChallengeId: string | null;
      enrollment: TotpEnrollment | null;
    }
  | {
      step: 'organization';
      pendingAuthenticationToken: string;
      organizations: AuthOrganization[];
    };

export type TotpEnrollment = {
  factor: {
    id: string;
    type: 'totp';
    displayName: string;
    qrCode: string | null;
    secret: string | null;
    uri: string | null;
  };
  authenticationChallengeId: string;
};

export type RouterAuthContext = {
  isAuthenticated: boolean;
  user: AuthUser | null;
};

export function getPathForAuthFlow(result: AuthFlowResult) {
  switch (result.status) {
    case 'authenticated':
      return '/app' as const;
    case 'email_verification_required':
      return '/verify-email' as const;
    case 'mfa_required':
      return '/mfa' as const;
    case 'mfa_enrollment_required':
      return '/mfa' as const;
    case 'organization_selection_required':
      return '/select-organization' as const;
  }
}
