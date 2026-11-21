/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const configWithOptionalDb = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string;
};
export const db = configWithOptionalDb.firestoreDatabaseId
  ? getFirestore(app, configWithOptionalDb.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

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
  return onAuthStateChanged(auth, (user: User | null) => {
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

export const signInGmailSender = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningInGmail = true;
    const result = await signInWithPopup(auth, gmailProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain a Gmail sending access token from Google sign-in.');
    }
    cachedGmailAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedGmailAccessToken };
  } finally {
    isSigningInGmail = false;
  }
};

export const getGmailAccessToken = (): string | null => cachedGmailAccessToken;

export const signOutGmailSender = async (): Promise<void> => {
  cachedGmailAccessToken = null;
  await auth.signOut();
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
  await credential.user.reload();
  return credential.user;
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
  cachedGmailAccessToken = null;
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
