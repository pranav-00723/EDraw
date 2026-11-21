/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FirebaseAuthProxyService,
  mapIdentityToolkitErrorCode,
} from './firebaseAuthProxy';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('mapIdentityToolkitErrorCode maps standard Identity Toolkit error strings', () => {
  assert.equal(mapIdentityToolkitErrorCode('EMAIL_EXISTS').code, 'auth/email-already-in-use');
  assert.equal(mapIdentityToolkitErrorCode('EMAIL_EXISTS').status, 409);
  assert.equal(mapIdentityToolkitErrorCode('INVALID_EMAIL : bad').code, 'auth/invalid-email');
  assert.equal(mapIdentityToolkitErrorCode('WEAK_PASSWORD : Password should be at least 6 characters').code, 'auth/weak-password');
  assert.equal(mapIdentityToolkitErrorCode('OPERATION_NOT_ALLOWED').code, 'auth/operation-not-allowed');
  assert.equal(mapIdentityToolkitErrorCode('INVALID_LOGIN_CREDENTIALS').code, 'auth/invalid-credential');
  assert.equal(mapIdentityToolkitErrorCode('INVALID_LOGIN_CREDENTIALS').status, 401);
  assert.equal(mapIdentityToolkitErrorCode('USER_DISABLED').code, 'auth/user-disabled');
  assert.equal(mapIdentityToolkitErrorCode('TOO_MANY_ATTEMPTS_TRY_LATER').code, 'auth/too-many-requests');
  assert.equal(mapIdentityToolkitErrorCode('TOKEN_EXPIRED').code, 'auth/invalid-user-token');
  assert.equal(mapIdentityToolkitErrorCode('UNKNOWN_ERR').code, 'auth/internal-error');
});

test('signUpWithEmailPassword validates input locally before network calls', async () => {
  let called = false;
  const service = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    fetchImpl: async () => {
      called = true;
      return jsonResponse(200, {});
    },
  });

  const badEmail = await service.signUpWithEmailPassword({
    email: 'not-an-email',
    password: 'Password123',
    displayName: 'Arjun Menon',
  });
  assert.equal(badEmail.success, false);
  if (!badEmail.success) {
    assert.equal(badEmail.code, 'auth/invalid-email');
    assert.equal(badEmail.status, 400);
  }

  const weakPass = await service.signUpWithEmailPassword({
    email: 'arjun@mit.edu',
    password: '123',
    displayName: 'Arjun Menon',
  });
  assert.equal(weakPass.success, false);
  if (!weakPass.success) {
    assert.equal(weakPass.code, 'auth/weak-password');
    assert.equal(weakPass.status, 400);
  }
  assert.equal(called, false);
});

test('signUpWithEmailPassword calls accounts:signUp and updates displayName via accounts:update', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const service = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    fetchImpl: async (url, init) => {
      const parsedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      calls.push({ url: String(url), body: parsedBody });
      if (String(url).includes('accounts:signUp')) {
        return jsonResponse(200, {
          localId: 'uid-signup-1',
          email: 'Student@MIT.Edu',
          idToken: 'initial-id-token',
          refreshToken: 'initial-refresh-token',
        });
      }
      return jsonResponse(200, {
        displayName: 'Arjun Menon',
        idToken: 'updated-id-token',
        refreshToken: 'updated-refresh-token',
      });
    },
  });

  const result = await service.signUpWithEmailPassword({
    email: '  Student@MIT.Edu ',
    password: 'Password123!',
    displayName: '  Arjun Menon  ',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.uid, 'uid-signup-1');
    assert.equal(result.email, 'student@mit.edu');
    assert.equal(result.displayName, 'Arjun Menon');
    assert.equal(result.emailVerified, false);
    assert.equal(result.idToken, 'updated-id-token');
    assert.equal(result.refreshToken, 'updated-refresh-token');
  }
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes('accounts:signUp?key=test-api-key'));
  assert.ok(calls[1].url.includes('accounts:update?key=test-api-key'));
  assert.equal(calls[1].body.displayName, 'Arjun Menon');
});

test('signUpWithEmailPassword maps duplicate email and network failures cleanly', async () => {
  const dupService = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    fetchImpl: async () =>
      jsonResponse(400, { error: { message: 'EMAIL_EXISTS' } }),
  });

  const dup = await dupService.signUpWithEmailPassword({
    email: 'arjun@mit.edu',
    password: 'Password123!',
    displayName: 'Arjun',
  });
  assert.equal(dup.success, false);
  if (!dup.success) {
    assert.equal(dup.status, 409);
    assert.equal(dup.code, 'auth/email-already-in-use');
  }

  const netService = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    fetchImpl: async () => {
      throw new Error('ECONNRESET');
    },
  });
  const net = await netService.signUpWithEmailPassword({
    email: 'arjun@mit.edu',
    password: 'Password123!',
  });
  assert.equal(net.success, false);
  if (!net.success) {
    assert.equal(net.status, 502);
    assert.equal(net.code, 'auth/network-request-failed');
  }
});

test('signInWithEmailPassword returns verified profile from accounts:lookup', async () => {
  const service = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    fetchImpl: async (url) => {
      if (String(url).includes('accounts:signInWithPassword')) {
        return jsonResponse(200, {
          localId: 'uid-signin-1',
          email: 'kavya@gmail.com',
          displayName: 'Kavya Nair',
          idToken: 'signin-id-token',
          refreshToken: 'signin-refresh-token',
        });
      }
      return jsonResponse(200, {
        users: [
          {
            localId: 'uid-signin-1',
            email: 'kavya@gmail.com',
            displayName: 'Kavya Nair',
            emailVerified: true,
          },
        ],
      });
    },
  });

  const result = await service.signInWithEmailPassword({
    email: 'KAVYA@gmail.com',
    password: 'Password123!',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.uid, 'uid-signin-1');
    assert.equal(result.email, 'kavya@gmail.com');
    assert.equal(result.emailVerified, true);
    assert.equal(result.idToken, 'signin-id-token');
  }
});

test('signInWithGoogleAccessToken exchanges Google OAuth token via accounts:signInWithIdp', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const service = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    authDomain: 'example.firebaseapp.com',
    fetchImpl: async (url, init) => {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      calls.push({ url: String(url), body });
      if (String(url).includes('accounts:signInWithIdp')) {
        return jsonResponse(200, {
          localId: 'uid-google-1',
          email: 'vibin@gmail.com',
          fullName: 'Vibin Appachi',
          emailVerified: true,
          idToken: 'google-firebase-token',
          refreshToken: 'google-refresh-token',
        });
      }
      return jsonResponse(200, {
        users: [
          {
            localId: 'uid-google-1',
            email: 'vibin@gmail.com',
            displayName: 'Vibin Appachi',
            emailVerified: true,
          },
        ],
      });
    },
  });

  const missing = await service.signInWithGoogleAccessToken({ accessToken: '' });
  assert.equal(missing.success, false);
  if (!missing.success) {
    assert.equal(missing.status, 400);
    assert.equal(missing.code, 'auth/invalid-credential');
  }

  const ok = await service.signInWithGoogleAccessToken({
    accessToken: 'ya29.test-token',
    requestUri: 'https://preview.run.app',
  });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.uid, 'uid-google-1');
    assert.equal(ok.email, 'vibin@gmail.com');
    assert.equal(ok.displayName, 'Vibin Appachi');
    assert.equal(ok.emailVerified, true);
    assert.equal(ok.idToken, 'google-firebase-token');
  }
  assert.ok(calls[0].url.includes('accounts:signInWithIdp?key=test-api-key'));
  assert.equal(calls[0].body.requestUri, 'https://preview.run.app');
  assert.equal(
    calls[0].body.postBody,
    'access_token=ya29.test-token&providerId=google.com'
  );
});

test('refreshIdToken exchanges refreshToken via securetoken and refreshes profile', async () => {
  const service = new FirebaseAuthProxyService({
    apiKey: 'test-api-key',
    fetchImpl: async (url, init) => {
      if (String(url).includes('securetoken.googleapis.com')) {
        assert.ok(String(init?.body || '').includes('grant_type=refresh_token'));
        assert.ok(String(init?.body || '').includes('refresh_token=old-refresh'));
        return jsonResponse(200, {
          id_token: 'fresh-id-token',
          refresh_token: 'fresh-refresh-token',
          user_id: 'uid-refresh-1',
        });
      }
      return jsonResponse(200, {
        users: [
          {
            localId: 'uid-refresh-1',
            email: 'refreshed@mit.edu',
            displayName: 'Refreshed Student',
            emailVerified: true,
          },
        ],
      });
    },
  });

  const missing = await service.refreshIdToken({ refreshToken: '' });
  assert.equal(missing.success, false);
  if (!missing.success) {
    assert.equal(missing.status, 401);
    assert.equal(missing.code, 'auth/invalid-user-token');
  }

  const refreshed = await service.refreshIdToken({ refreshToken: 'old-refresh' });
  assert.equal(refreshed.success, true);
  if (refreshed.success) {
    assert.equal(refreshed.uid, 'uid-refresh-1');
    assert.equal(refreshed.email, 'refreshed@mit.edu');
    assert.equal(refreshed.emailVerified, true);
    assert.equal(refreshed.idToken, 'fresh-id-token');
    assert.equal(refreshed.refreshToken, 'fresh-refresh-token');
  }
});
