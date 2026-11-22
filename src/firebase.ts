/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().some((a) => a.name === '[DEFAULT]')
  ? getApp('[DEFAULT]')
  : initializeApp(firebaseConfig);

const configWithOptionalDb = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
};
export const db = configWithOptionalDb.firestoreDatabaseId
  ? getFirestore(app, configWithOptionalDb.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export interface AuthSessionResult {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  idToken: string;
  refreshToken?: string;
  viaServerProxy?: boolean;
}

async function postFirebaseProxy(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<AuthSessionResult> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw {
      code: 'auth/network-request-failed',
      message: 'Network error communicating with authentication services. Please check your connection and retry.',
    };
  }

  let data: Partial<AuthSessionResult> & {
    success?: boolean;
    code?: string;
    error?: string;
  };
  try {
    data = await res.json();
  } catch {
    throw {
      code: 'auth/network-request-failed',
      message: 'Unexpected response from authentication proxy.',
    };
  }

  if (!res.ok || !data.success || !data.idToken || !data.uid) {
    throw {
      code: data.code || 'auth/network-request-failed',
      message: data.error || 'Authentication failed.',
    };
  }

  return {
    uid: data.uid,
    email: data.email || '',
    displayName: data.displayName || '',
    emailVerified: data.emailVerified === true,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    viaServerProxy: true,
  };
}

let gisScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject({
      code: 'auth/network-request-failed',
      message: 'Google Identity Services requires a browser environment.',
    });
  }
  const win = window as Window & { google?: { accounts?: { oauth2?: unknown } } };
  if (win.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          gisScriptPromise = null;
          reject({
            code: 'auth/google-script-blocked',
            message: 'Could not reach accounts.google.com to load Google Sign-In.',
          });
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    const timeout = window.setTimeout(() => {
      gisScriptPromise = null;
      reject({
        code: 'auth/google-script-blocked',
        message: 'Timed out loading Google Identity Services from accounts.google.com.',
      });
    }, 10000);
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      gisScriptPromise = null;
      reject({
        code: 'auth/google-script-blocked',
        message: 'Could not reach accounts.google.com to load Google Sign-In.',
      });
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

async function signInWithGoogleViaGis(
  scopes: string[],
  loginHint?: string,
  targetAuth: Auth = auth
): Promise<{ session: AuthSessionResult; accessToken: string }> {
  const clientId = (configWithOptionalDb.oAuthClientId || '').trim();
  if (!clientId) {
    throw { code: 'auth/network-request-failed', message: 'Missing OAuth client ID.' };
  }

  await loadGoogleIdentityServices();
  const win = window as Window & {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            hint?: string;
            prompt?: string;
            callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  };

  const oauth2 = win.google?.accounts?.oauth2;
  if (!oauth2) {
    throw { code: 'auth/google-script-blocked', message: 'Google OAuth2 client unavailable.' };
  }

  const accessToken = await new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      ...(loginHint ? { hint: loginHint } : {}),
      callback: (resp) => {
        if (resp?.error || !resp?.access_token) {
          if (resp?.error === 'access_denied') {
            reject({ code: 'auth/popup-closed-by-user' });
          } else {
            reject({
              code: 'auth/google-oauth-failed',
              message: resp?.error_description || resp?.error || 'OAuth token failure',
            });
          }
          return;
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        if (err?.type === 'popup_closed') {
          reject({ code: 'auth/popup-closed-by-user' });
        } else if (err?.type === 'popup_failed_to_open') {
          reject({ code: 'auth/popup-blocked' });
        } else {
          reject({
            code: 'auth/google-oauth-failed',
            message: err?.message || err?.type || 'Google OAuth popup failed.',
          });
        }
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });

  try {
    const cred = GoogleAuthProvider.credential(null, accessToken);
    const userCred = await signInWithCredential(targetAuth, cred);
    const idToken = await userCred.user.getIdToken(true);
    return {
      accessToken,
      session: {
        uid: userCred.user.uid,
        email: userCred.user.email || '',
        displayName: userCred.user.displayName || '',
        emailVerified: userCred.user.emailVerified,
        idToken,
        refreshToken: userCred.user.refreshToken,
        viaServerProxy: false,
      },
    };
  } catch (err: any) {
    if (err?.code !== 'auth/network-request-failed') {
      throw err;
    }
    const proxySession = await postFirebaseProxy('/api/auth/firebase/google-idp', {
      accessToken,
    });
    return { accessToken, session: proxySession };
  }
}

export async function registerStudentWithFirebase(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthSessionResult> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, params.email, params.password);
    if (params.displayName.trim()) {
      await updateProfile(credential.user, { displayName: params.displayName.trim() }).catch(
        () => undefined
      );
    }
    const idToken = await credential.user.getIdToken(true);
    return {
      uid: credential.user.uid,
      email: credential.user.email || params.email,
      displayName: credential.user.displayName || params.displayName.trim(),
      emailVerified: credential.user.emailVerified,
      idToken,
      refreshToken: credential.user.refreshToken,
      viaServerProxy: false,
    };
  } catch (err: any) {
    if (err?.code === 'auth/network-request-failed') {
      return postFirebaseProxy('/api/auth/firebase/signup', {
        email: params.email,
        password: params.password,
        displayName: params.displayName.trim(),
      });
    }
    throw err;
  }
}

export async function signInStudentWithFirebase(
  email: string,
  password: string
): Promise<AuthSessionResult> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await credential.user.reload().catch(() => undefined);
    const idToken = await credential.user.getIdToken(true);
    return {
      uid: credential.user.uid,
      email: credential.user.email || email,
      displayName: credential.user.displayName || '',
      emailVerified: credential.user.emailVerified,
      idToken,
      refreshToken: credential.user.refreshToken,
      viaServerProxy: false,
    };
  } catch (err: any) {
    if (err?.code === 'auth/network-request-failed') {
      return postFirebaseProxy('/api/auth/firebase/signin', { email, password });
    }
    throw err;
  }
}

const studentGoogleProvider = new GoogleAuthProvider();
studentGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

export async function signInStudentWithGoogle(): Promise<AuthSessionResult> {
  try {
    const result = await signInWithPopup(auth, studentGoogleProvider);
    const idToken = await result.user.getIdToken(true);
    return {
      uid: result.user.uid,
      email: result.user.email || '',
      displayName: result.user.displayName || '',
      emailVerified: result.user.emailVerified,
      idToken,
      refreshToken: result.user.refreshToken,
      viaServerProxy: false,
    };
  } catch (err: any) {
    if (err?.code === 'auth/network-request-failed' && configWithOptionalDb.oAuthClientId) {
      const fallback = await signInWithGoogleViaGis(['openid', 'email', 'profile'], undefined, auth);
      return fallback.session;
    }
    throw err;
  }
}

export async function reloadFirebaseUserAndGetToken(
  forceRefresh = true,
  fallbackRefreshToken?: string | null
): Promise<AuthSessionResult | null> {
  const current = auth.currentUser;
  if (current) {
    try {
      await current.reload();
      const idToken = await current.getIdToken(forceRefresh);
      return {
        uid: current.uid,
        email: current.email || '',
        displayName: current.displayName || '',
        emailVerified: current.emailVerified,
        idToken,
        refreshToken: current.refreshToken,
        viaServerProxy: false,
      };
    } catch (err: any) {
      if (err?.code === 'auth/network-request-failed') {
        const refreshTok = fallbackRefreshToken || current.refreshToken;
        if (refreshTok) {
          return postFirebaseProxy('/api/auth/firebase/refresh', {
            refreshToken: refreshTok,
          }).catch(() => null);
        }
      }
      return null;
    }
  }

  if (fallbackRefreshToken) {
    return postFirebaseProxy('/api/auth/firebase/refresh', {
      refreshToken: fallbackRefreshToken,
    }).catch(() => null);
  }

  return null;
}

export async function signOutStudentFirebase(): Promise<void> {
  await auth.signOut().catch(() => undefined);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
