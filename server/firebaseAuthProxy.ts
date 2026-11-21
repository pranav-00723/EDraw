/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { isValidEmail, normalizeEmail } from '../src/utils/studentAuthValidation.ts';

export interface FirebaseProxySession {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  idToken: string;
  refreshToken: string;
}

export type FirebaseProxyResult =
  | ({ success: true } & FirebaseProxySession)
  | { success: false; status: number; code: string; error: string };

const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';
const SECURE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';

export function loadFirebaseWebConfig(): { apiKey: string; authDomain: string } {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { apiKey?: string; authDomain?: string };
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
      authDomain: typeof parsed.authDomain === 'string' ? parsed.authDomain.trim() : '',
    };
  } catch {
    return { apiKey: '', authDomain: '' };
  }
}

export function mapIdentityToolkitErrorCode(rawMessage: string): {
  code: string;
  status: number;
  error: string;
} {
  const clean = (rawMessage || '').split(':')[0].trim().toUpperCase();
  switch (clean) {
    case 'EMAIL_EXISTS':
      return {
        code: 'auth/email-already-in-use',
        status: 409,
        error: 'An account with this email address already exists. Sign in below to check verification or view your eDraw ID.',
      };
    case 'INVALID_EMAIL':
      return {
        code: 'auth/invalid-email',
        status: 400,
        error: 'Please enter a valid email address.',
      };
    case 'WEAK_PASSWORD':
      return {
        code: 'auth/weak-password',
        status: 400,
        error: 'Password is too weak. Use at least 8 characters including letters and numbers.',
      };
    case 'OPERATION_NOT_ALLOWED':
      return {
        code: 'auth/operation-not-allowed',
        status: 403,
        error: 'Email/Password sign-in is not enabled in Firebase Authentication yet.',
      };
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_PASSWORD':
    case 'EMAIL_NOT_FOUND':
      return {
        code: 'auth/invalid-credential',
        status: 401,
        error: 'Invalid email address or password.',
      };
    case 'USER_DISABLED':
      return {
        code: 'auth/user-disabled',
        status: 403,
        error: 'This account has been disabled. Contact your administrator.',
      };
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return {
        code: 'auth/too-many-requests',
        status: 429,
        error: 'Too many attempts in a short time. Please wait a minute and try again.',
      };
    case 'INVALID_REFRESH_TOKEN':
    case 'TOKEN_EXPIRED':
    case 'USER_NOT_FOUND':
      return {
        code: 'auth/invalid-user-token',
        status: 401,
        error: 'Your authentication session expired. Please sign in again.',
      };
    default:
      return {
        code: 'auth/internal-error',
        status: 502,
        error: 'Authentication service returned an unexpected error. Please try again.',
      };
  }
}

export class FirebaseAuthProxyService {
  private readonly apiKey: string;
  private readonly authDomain: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: {
    apiKey?: string;
    authDomain?: string;
    fetchImpl?: typeof fetch;
  }) {
    const config = loadFirebaseWebConfig();
    this.apiKey = options?.apiKey ?? config.apiKey;
    this.authDomain = options?.authDomain ?? config.authDomain;
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  private async callIdentityToolkit<T>(
    endpoint: string,
    payload: Record<string, unknown>
  ): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; error: string }> {
    if (!this.apiKey) {
      return {
        ok: false,
        status: 500,
        code: 'auth/internal-error',
        error: 'Firebase API key is not configured on the server.',
      };
    }

    try {
      const res = await this.fetchImpl(
        `${IDENTITY_TOOLKIT_BASE}/${endpoint}?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as T & { error?: { message?: string } };
      if (!res.ok) {
        const mapped = mapIdentityToolkitErrorCode(data?.error?.message || '');
        return { ok: false, ...mapped };
      }
      return { ok: true, data };
    } catch {
      return {
        ok: false,
        status: 502,
        code: 'auth/network-request-failed',
        error: 'Could not reach Firebase Authentication services from the server. Please retry.',
      };
    }
  }

  private async lookupAccount(idToken: string): Promise<{
    uid?: string;
    email?: string;
    displayName?: string;
    emailVerified?: boolean;
  }> {
    const res = await this.callIdentityToolkit<{
      users?: Array<{
        localId?: string;
        email?: string;
        displayName?: string;
        emailVerified?: boolean;
      }>;
    }>('accounts:lookup', { idToken });

    if (!res.ok || !Array.isArray(res.data.users) || res.data.users.length === 0) {
      return {};
    }
    const u = res.data.users[0];
    return {
      uid: u.localId,
      email: u.email,
      displayName: u.displayName,
      emailVerified: u.emailVerified === true,
    };
  }

  async signUpWithEmailPassword(params: {
    email: unknown;
    password: unknown;
    displayName?: unknown;
  }): Promise<FirebaseProxyResult> {
    const email = normalizeEmail(typeof params.email === 'string' ? params.email : '');
    const password = typeof params.password === 'string' ? params.password : '';
    const displayName =
      typeof params.displayName === 'string' ? params.displayName.trim().slice(0, 80) : '';

    if (!isValidEmail(email)) {
      return {
        success: false,
        status: 400,
        code: 'auth/invalid-email',
        error: 'Please enter a valid email address.',
      };
    }
    if (password.length < 6) {
      return {
        success: false,
        status: 400,
        code: 'auth/weak-password',
        error: 'Password must be at least 6 characters long.',
      };
    }

    const signUpRes = await this.callIdentityToolkit<{
      localId: string;
      email: string;
      idToken: string;
      refreshToken: string;
    }>('accounts:signUp', {
      email,
      password,
      returnSecureToken: true,
    });

    if (!signUpRes.ok) {
      return {
        success: false,
        status: signUpRes.status,
        code: signUpRes.code,
        error: signUpRes.error,
      };
    }

    let idToken = signUpRes.data.idToken;
    let refreshToken = signUpRes.data.refreshToken;
    let resolvedName = displayName;

    if (displayName) {
      const updateRes = await this.callIdentityToolkit<{
        displayName?: string;
        idToken?: string;
        refreshToken?: string;
      }>('accounts:update', {
        idToken,
        displayName,
        returnSecureToken: true,
      });
      if (updateRes.ok) {
        if (updateRes.data.idToken) idToken = updateRes.data.idToken;
        if (updateRes.data.refreshToken) refreshToken = updateRes.data.refreshToken;
        if (updateRes.data.displayName) resolvedName = updateRes.data.displayName;
      }
    }

    return {
      success: true,
      uid: signUpRes.data.localId,
      email: normalizeEmail(signUpRes.data.email || email),
      displayName: resolvedName,
      emailVerified: false,
      idToken,
      refreshToken,
    };
  }

  async signInWithEmailPassword(params: {
    email: unknown;
    password: unknown;
  }): Promise<FirebaseProxyResult> {
    const email = normalizeEmail(typeof params.email === 'string' ? params.email : '');
    const password = typeof params.password === 'string' ? params.password : '';

    if (!isValidEmail(email) || !password) {
      return {
        success: false,
        status: 400,
        code: 'auth/invalid-credential',
        error: 'Invalid email address or password.',
      };
    }

    const signInRes = await this.callIdentityToolkit<{
      localId: string;
      email: string;
      displayName?: string;
      idToken: string;
      refreshToken: string;
    }>('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });

    if (!signInRes.ok) {
      return {
        success: false,
        status: signInRes.status,
        code: signInRes.code,
        error: signInRes.error,
      };
    }

    const profile = await this.lookupAccount(signInRes.data.idToken);

    return {
      success: true,
      uid: signInRes.data.localId,
      email: normalizeEmail(profile.email || signInRes.data.email || email),
      displayName: profile.displayName || signInRes.data.displayName || '',
      emailVerified: profile.emailVerified === true,
      idToken: signInRes.data.idToken,
      refreshToken: signInRes.data.refreshToken,
    };
  }

  async signInWithGoogleAccessToken(params: {
    accessToken: unknown;
    requestUri?: unknown;
  }): Promise<FirebaseProxyResult> {
    const accessToken = typeof params.accessToken === 'string' ? params.accessToken.trim() : '';
    if (!accessToken) {
      return {
        success: false,
        status: 400,
        code: 'auth/invalid-credential',
        error: 'Google access token is missing.',
      };
    }

    const fallbackUri = this.authDomain
      ? `https://${this.authDomain}`
      : 'https://localhost';
    let requestUri = fallbackUri;
    if (typeof params.requestUri === 'string' && /^https?:\/\//i.test(params.requestUri.trim())) {
      requestUri = params.requestUri.trim();
    }

    const idpRes = await this.callIdentityToolkit<{
      localId: string;
      email?: string;
      displayName?: string;
      fullName?: string;
      emailVerified?: boolean;
      idToken: string;
      refreshToken: string;
    }>('accounts:signInWithIdp', {
      postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`,
      requestUri,
      returnIdpCredential: true,
      returnSecureToken: true,
    });

    if (!idpRes.ok) {
      return {
        success: false,
        status: idpRes.status,
        code: idpRes.code,
        error: idpRes.error,
      };
    }

    const profile = await this.lookupAccount(idpRes.data.idToken);

    return {
      success: true,
      uid: idpRes.data.localId,
      email: normalizeEmail(profile.email || idpRes.data.email || ''),
      displayName:
        profile.displayName || idpRes.data.displayName || idpRes.data.fullName || '',
      emailVerified:
        profile.emailVerified === true || idpRes.data.emailVerified === true,
      idToken: idpRes.data.idToken,
      refreshToken: idpRes.data.refreshToken,
    };
  }

  async refreshIdToken(params: { refreshToken: unknown }): Promise<FirebaseProxyResult> {
    const refreshToken =
      typeof params.refreshToken === 'string' ? params.refreshToken.trim() : '';
    if (!refreshToken || !this.apiKey) {
      return {
        success: false,
        status: 401,
        code: 'auth/invalid-user-token',
        error: 'Session refresh token is missing.',
      };
    }

    try {
      const res = await this.fetchImpl(
        `${SECURE_TOKEN_URL}?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }).toString(),
        }
      );
      const data = (await res.json()) as {
        id_token?: string;
        refresh_token?: string;
        user_id?: string;
        error?: { message?: string };
      };
      if (!res.ok || !data.id_token || !data.user_id) {
        const mapped = mapIdentityToolkitErrorCode(data?.error?.message || 'TOKEN_EXPIRED');
        return { success: false, ...mapped };
      }

      const profile = await this.lookupAccount(data.id_token);
      return {
        success: true,
        uid: data.user_id,
        email: normalizeEmail(profile.email || ''),
        displayName: profile.displayName || '',
        emailVerified: profile.emailVerified === true,
        idToken: data.id_token,
        refreshToken: data.refresh_token || refreshToken,
      };
    } catch {
      return {
        success: false,
        status: 502,
        code: 'auth/network-request-failed',
        error: 'Unable to refresh authentication session right now.',
      };
    }
  }
}
