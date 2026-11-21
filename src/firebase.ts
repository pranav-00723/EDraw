/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type ActionCodeSettings,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().some((a) => a.name === '[DEFAULT]')
  ? getApp('[DEFAULT]')
  : initializeApp(firebaseConfig);
const gmailSenderApp = getApps().some((a) => a.name === 'gmail-sender')
  ? getApp('gmail-sender')
  : initializeApp(firebaseConfig, 'gmail-sender');

const configWithOptionalDb = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
};
export const db = configWithOptionalDb.firestoreDatabaseId
  ? getFirestore(app, configWithOptionalDb.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const gmailAuth = getAuth(gmailSenderApp);

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
export const OFFICIAL_SENDER_GMAIL = 'edrawmit@gmail.com';

const gmailProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  gmailProvider.addScope(scope);
}
gmailProvider.setCustomParameters({
  login_hint: OFFICIAL_SENDER_GMAIL,
  prompt: 'consent select_account',
});

let isSigningInGmail = false;
let cachedGmailAccessToken: string | null = null;

export const initGmailAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthCleared?: () => void
) => {
  return onAuthStateChanged(gmailAuth, (user: User | null) => {
    if (user) {
      if (cachedGmailAccessToken) {
        onAuthSuccess?.(user, cachedGmailAccessToken);
      } else if (!isSigningInGmail) {
        cachedGmailAccessToken = null;
        onAuthCleared?.();
      }
    } else {
      cachedGmailAccessToken = null;
      onAuthCleared?.();
    }
  });
};

let gisScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser environment.'));
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
          reject(new Error('Could not load Google Identity Services.'));
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
      reject(new Error('Timed out loading Google Identity Services.'));
    }, 10000);
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      gisScriptPromise = null;
      reject(new Error('Could not load Google Identity Services.'));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

async function signInWithGoogleViaGis(
  scopes: string[],
  loginHint?: string,
  targetAuth: Auth = auth
): Promise<{ user: User; accessToken: string }> {
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
    throw { code: 'auth/network-request-failed', message: 'Google OAuth2 client unavailable.' };
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
              code: 'auth/network-request-failed',
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
            code: 'auth/network-request-failed',
            message: err?.message || err?.type || 'Popup OAuth failed',
          });
        }
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });

  const cred = GoogleAuthProvider.credential(null, accessToken);
  const userCred = await signInWithCredential(targetAuth, cred);
  return { user: userCred.user, accessToken };
}

export const signInGmailSender = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningInGmail = true;
    try {
      const result = await signInWithPopup(gmailAuth, gmailProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Could not obtain a Gmail sending access token from Google sign-in.');
      }
      cachedGmailAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedGmailAccessToken };
    } catch (err: any) {
      if (err?.code === 'auth/network-request-failed' && configWithOptionalDb.oAuthClientId) {
        const fallback = await signInWithGoogleViaGis(
          ['openid', 'email', 'profile', ...SCOPES],
          OFFICIAL_SENDER_GMAIL,
          gmailAuth
        );
        cachedGmailAccessToken = fallback.accessToken;
        return fallback;
      }
      throw err;
    }
  } finally {
    isSigningInGmail = false;
  }
};

export const getGmailAccessToken = (): string | null => cachedGmailAccessToken;

export const signOutGmailSender = async (): Promise<void> => {
  cachedGmailAccessToken = null;
  await gmailAuth.signOut();
};

export async function registerStudentWithFirebase(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, params.email, params.password);
  if (params.displayName.trim()) {
    await updateProfile(credential.user, { displayName: params.displayName.trim() });
  }
  return credential.user;
}

export async function sendFirebaseVerificationEmail(
  user: User,
  returnOrigin?: string
): Promise<{ usedContinueUrl: boolean }> {
  const origin =
    returnOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  if (origin && /^https?:\/\//i.test(origin)) {
    const actionCodeSettings: ActionCodeSettings = {
      url: `${origin.replace(/\/+$/, '')}/?verifyFlow=firebase`,
      handleCodeInApp: false,
    };
    try {
      await sendEmailVerification(user, actionCodeSettings);
      return { usedContinueUrl: true };
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      if (
        code === 'auth/unauthorized-continue-uri' ||
        code === 'auth/invalid-continue-uri' ||
        code === 'auth/missing-continue-uri'
      ) {
        await sendEmailVerification(user);
        return { usedContinueUrl: false };
      }
      throw err;
    }
  }

  await sendEmailVerification(user);
  return { usedContinueUrl: false };
}

export async function applyFirebaseVerificationCode(oobCode: string): Promise<void> {
  await applyActionCode(auth, oobCode);
  if (auth.currentUser) {
    await auth.currentUser.reload();
  }
}

export async function signInStudentWithFirebase(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await credential.user.reload().catch(() => undefined);
  return credential.user;
}

const studentGoogleProvider = new GoogleAuthProvider();
studentGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

export async function signInStudentWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, studentGoogleProvider);
    return result.user;
  } catch (err: any) {
    if (err?.code === 'auth/network-request-failed' && configWithOptionalDb.oAuthClientId) {
      const fallback = await signInWithGoogleViaGis(['openid', 'email', 'profile']);
      return fallback.user;
    }
    throw err;
  }
}

export async function reloadFirebaseUserAndGetToken(
  forceRefresh = true
): Promise<{ user: User; idToken: string } | null> {
  const current = auth.currentUser;
  if (!current) return null;
  await current.reload();
  const idToken = await current.getIdToken(forceRefresh);
  return { user: current, idToken };
}

export async function signOutStudentFirebase(): Promise<void> {
  await auth.signOut();
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
