/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RegistrationService,
  type TokenVerifier,
  type VerifiedFirebaseCaller,
} from './registrationService';

function makeTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edraw-reg-test-'));
  return {
    dir,
    storePath: path.join(dir, 'registrations.json'),
    legacyPath: path.join(dir, 'students.json'),
  };
}

function makeVerifier(map: Record<string, VerifiedFirebaseCaller>): TokenVerifier {
  return async (token: string) => {
    const caller = map[token];
    if (!caller) {
      throw new Error('Invalid token');
    }
    return caller;
  };
}

test('allocates EDID-XXXX immediately without email verification and enforces idempotency across retries', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  const tokens: Record<string, VerifiedFirebaseCaller> = {
    unverified_tok: { uid: 'uid-1', email: 'ananya@college.edu', emailVerified: false },
    verified_tok: { uid: 'uid-1', email: 'ananya@college.edu', emailVerified: true },
  };
  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier(tokens),
  });

  // 1. Completing immediately allocates EDID-1000 even when emailVerified is false
  const firstComplete = await service.completeVerifiedRegistration({
    authHeader: 'Bearer unverified_tok',
    name: 'Ananya Rao',
    college: 'IIT Madras',
    studentDetails: 'ME24B012 · Mechanical',
  });
  assert.equal(firstComplete.success, true);
  if (!firstComplete.success) return;
  assert.equal(firstComplete.alreadyAllocated, false);
  assert.equal(firstComplete.record.edrawId, 'EDID-1000');
  assert.equal(firstComplete.record.registrationStatus, 'verified');
  assert.equal(firstComplete.record.verified, true);

  // 2. Repeated callback / page refresh is idempotent and preserves EDID-1000
  const secondComplete = await service.completeVerifiedRegistration({
    authHeader: 'Bearer verified_tok',
    name: 'Changed Name Should Not Overwrite ID',
  });
  assert.equal(secondComplete.success, true);
  if (!secondComplete.success) return;
  assert.equal(secondComplete.alreadyAllocated, true);
  assert.equal(secondComplete.record.edrawId, 'EDID-1000');

  // 3. Duplicate email already stored in students.json is rejected with 409
  fs.writeFileSync(
    legacyPath,
    JSON.stringify({ students: [{ edrawId: 'EDID-1005', gmail: 'already.in.db@college.edu' }] }),
    'utf8'
  );
  const serviceWithLegacy = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      dup_legacy_tok: { uid: 'uid-legacy-dup', email: 'ALREADY.IN.DB@college.edu', emailVerified: true },
    }),
  });
  const legacyDup = await serviceWithLegacy.completeVerifiedRegistration({
    authHeader: 'Bearer dup_legacy_tok',
    name: 'Duplicate User',
    college: 'IIT Madras',
  });
  assert.equal(legacyDup.success, false);
  if (!legacyDup.success) {
    assert.equal(legacyDup.status, 409);
  }

  fs.rmSync(dir, { recursive: true, force: true });
});

test('prevents concurrent race collisions and skips legacy EDID-XXXX identifiers', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  fs.writeFileSync(
    legacyPath,
    JSON.stringify({ students: [{ edrawId: 'EDID-1000' }, { edrawId: 'EDID-1002' }] }),
    'utf8'
  );

  const tokens: Record<string, VerifiedFirebaseCaller> = {};
  for (let i = 0; i < 15; i++) {
    tokens[`tok-${i}`] = {
      uid: `uid-${i}`,
      email: `student${i}@college.edu`,
      emailVerified: true,
    };
  }

  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier(tokens),
  });

  // Fire 15 concurrent complete requests + 5 duplicate concurrent requests for uid-0
  const calls = [
    ...Array.from({ length: 15 }, (_, i) =>
      service.completeVerifiedRegistration({
        authHeader: `Bearer tok-${i}`,
        name: `Student ${i}`,
        college: 'MIT Chennai',
      })
    ),
    ...Array.from({ length: 5 }, () =>
      service.completeVerifiedRegistration({
        authHeader: 'Bearer tok-0',
        name: 'Student 0',
        college: 'MIT Chennai',
      })
    ),
  ];

  const results = await Promise.all(calls);
  const first15Ids = new Set<string>();

  for (let i = 0; i < 15; i++) {
    const res = results[i];
    assert.equal(res.success, true);
    if (res.success) {
      assert.ok(res.record.edrawId);
      assert.notEqual(res.record.edrawId, 'EDID-1000');
      assert.notEqual(res.record.edrawId, 'EDID-1002');
      first15Ids.add(res.record.edrawId!);
    }
  }
  assert.equal(first15Ids.size, 15);

  const uid0Id = results[0].success ? results[0].record.edrawId : null;
  for (let i = 15; i < 20; i++) {
    const dupRes = results[i];
    assert.equal(dupRes.success, true);
    if (dupRes.success) {
      assert.equal(dupRes.record.edrawId, uid0Id);
    }
  }

  fs.rmSync(dir, { recursive: true, force: true });
});

test('rejects duplicate email across different UIDs and unauthorized/missing tokens', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  const tokens: Record<string, VerifiedFirebaseCaller> = {
    user_a: { uid: 'uid-a', email: 'same@college.edu', emailVerified: true },
    user_b: { uid: 'uid-b', email: 'same@college.edu', emailVerified: true },
  };

  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier(tokens),
  });

  const missingAuth = await service.completeVerifiedRegistration({ authHeader: undefined });
  assert.equal(missingAuth.success, false);
  if (!missingAuth.success) assert.equal(missingAuth.status, 401);

  const first = await service.completeVerifiedRegistration({
    authHeader: 'Bearer user_a',
    name: 'Student One',
    college: 'College A',
  });
  assert.equal(first.success, true);

  const duplicate = await service.completeVerifiedRegistration({
    authHeader: 'Bearer user_b',
    name: 'Student Two',
    college: 'College B',
  });
  assert.equal(duplicate.success, false);
  if (!duplicate.success) assert.equal(duplicate.status, 409);

  // Stale unallocated pending_verification stub under another UID must NOT block completion
  const currentDb = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  currentDb.records['uid-orphan-stub'] = {
    uid: 'uid-orphan-stub',
    name: 'Orphan',
    email: 'fresh.after.stub@college.edu',
    college: 'College C',
    studentDetails: '',
    edrawId: null,
    registrationStatus: 'pending_verification',
    verified: false,
    emailVerifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(storePath, JSON.stringify(currentDb, null, 2), 'utf8');

  const serviceFresh = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      user_c: { uid: 'uid-c', email: 'fresh.after.stub@college.edu', emailVerified: true },
    }),
  });
  const allowed = await serviceFresh.completeVerifiedRegistration({
    authHeader: 'Bearer user_c',
    name: 'Fresh Student',
    college: 'College C',
  });
  assert.equal(allowed.success, true);
  const afterDb = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.equal('uid-orphan-stub' in afterDb.records, false);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('verifies 6-digit email code to allocate EDID-XXXX and enforces idempotency', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  let sentCode = '';
  let sentTo = '';
  let nowMs = 1_700_000_000_000;

  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      tok1: { uid: 'uid-otp-1', email: 'vibin@college.edu', emailVerified: false },
    }),
    codeGenerator: () => '684215',
    nowProvider: () => nowMs,
    otpEmailSender: async ({ to, code }) => {
      sentTo = to;
      sentCode = code;
      return true;
    },
  });

  const pending = await service.upsertPendingRegistration({
    authHeader: 'Bearer tok1',
    name: 'Vibin A',
    college: 'MIT Chennai',
    studentDetails: 'ME26B007',
  });
  assert.equal(pending.success, true);
  if (!pending.success) return;
  assert.equal(pending.deliveryMode, 'smtp');
  assert.equal(sentTo, 'vibin@college.edu');
  assert.equal(sentCode, '684215');
  assert.equal(pending.record.edrawId, null);

  // Wrong code fails cleanly with 400
  const wrong = await service.verifyEmailCode({
    authHeader: 'Bearer tok1',
    code: '111111',
  });
  assert.equal(wrong.success, false);
  if (!wrong.success) assert.equal(wrong.status, 400);

  // Valid 6-digit code verifies and allocates EDID-1000
  const verified = await service.verifyEmailCode({
    authHeader: 'Bearer tok1',
    code: '684215',
  });
  assert.equal(verified.success, true);
  if (!verified.success) return;
  assert.equal(verified.alreadyAllocated, false);
  assert.equal(verified.student.edrawId, 'EDID-1000');
  assert.equal(verified.student.verified, true);

  // Repeated verifyEmailCode submission is strictly idempotent
  const repeat = await service.verifyEmailCode({
    authHeader: 'Bearer tok1',
    code: '684215',
  });
  assert.equal(repeat.success, true);
  if (!repeat.success) return;
  assert.equal(repeat.alreadyAllocated, true);
  assert.equal(repeat.student.edrawId, 'EDID-1000');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('enforces 5-attempt lockout, 1-hour code expiry, and resend invalidation', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  let issuedCounter = 0;
  const codes = ['123456', '654321'];
  let nowMs = 1_700_000_000_000;

  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      tok_lock: { uid: 'uid-lock', email: 'lock@college.edu', emailVerified: false },
      tok_exp: { uid: 'uid-exp', email: 'exp@college.edu', emailVerified: false },
    }),
    codeGenerator: () => codes[issuedCounter++] || '999999',
    nowProvider: () => nowMs,
    otpEmailSender: async () => false,
  });

  await service.upsertPendingRegistration({
    authHeader: 'Bearer tok_lock',
    name: 'Lock Student',
    college: 'NIT',
  });

  // 5 bad attempts trigger lockout (429 on 5th failed attempt)
  for (let i = 1; i <= 4; i++) {
    const res = await service.verifyEmailCode({ authHeader: 'Bearer tok_lock', code: '000000' });
    assert.equal(res.success, false);
    if (!res.success) assert.equal(res.status, 400);
  }
  const fifth = await service.verifyEmailCode({ authHeader: 'Bearer tok_lock', code: '000000' });
  assert.equal(fifth.success, false);
  if (!fifth.success) assert.equal(fifth.status, 429);

  // Resend issues new code '654321' and resets attempts
  const resent = await service.resendVerificationCode({ authHeader: 'Bearer tok_lock' });
  assert.equal(resent.success, true);

  // Old code '123456' is invalidated
  const oldAttempt = await service.verifyEmailCode({ authHeader: 'Bearer tok_lock', code: '123456' });
  assert.equal(oldAttempt.success, false);

  // New code '654321' succeeds
  const newAttempt = await service.verifyEmailCode({ authHeader: 'Bearer tok_lock', code: '654321' });
  assert.equal(newAttempt.success, true);

  // Expiry test (over 1 hour)
  await service.upsertPendingRegistration({
    authHeader: 'Bearer tok_exp',
    name: 'Expiry Student',
    college: 'Anna Univ',
  });
  nowMs += 60 * 60 * 1000 + 1000; // 1 hour + 1 second
  const expiredRes = await service.verifyEmailCode({
    authHeader: 'Bearer tok_exp',
    code: '999999',
  });
  assert.equal(expiredRes.success, false);
  if (!expiredRes.success) assert.equal(expiredRes.status, 410);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('dispatches 6-digit verification code via Gmail API with expected MIME content', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  let capturedRaw = '';

  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      tok_gmail: { uid: 'uid-gm', email: 'student.gm@gmail.com', emailVerified: false },
    }),
    codeGenerator: () => '684215',
    otpEmailSender: async () => false,
  });

  await service.upsertPendingRegistration({
    authHeader: 'Bearer tok_gmail',
    name: 'Arjun Menon',
    college: 'MIT',
  });

  const gmailResult = await service.sendCodeViaGmailApi({
    gmailAuthHeader: 'Bearer gmail_tok',
    targetEmail: 'student.gm@gmail.com',
    verifySender: async () => ({
      ok: true,
      email: 'edrawmit@gmail.com',
      accessToken: 'gmail_tok',
    }),
    fetchImpl: (async (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}')) as { raw?: string };
      capturedRaw = parsed.raw || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg-otp-123' }),
      } as Response;
    }) as typeof fetch,
  });

  assert.equal(gmailResult.success, true);
  assert.ok(capturedRaw);
  const decodedMime = Buffer.from(capturedRaw, 'base64url').toString('utf8');
  assert.match(decodedMime, /Subject: Verify your email address/);
  assert.match(decodedMime, /To: student\.gm@gmail\.com/);

  const plainMatch = decodedMime.match(
    /Content-Type: text\/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=]+)/
  );
  assert.ok(plainMatch?.[1]);
  const decodedText = Buffer.from(plainMatch[1], 'base64').toString('utf8');
  assert.match(decodedText, /Your verification code/);
  assert.match(decodedText, /684215/);
  assert.match(decodedText, /This code will expire one hour after this email was sent\./);

  const htmlMatch = decodedMime.match(
    /Content-Type: text\/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=]+)/
  );
  assert.ok(htmlMatch?.[1]);
  const decodedHtml = Buffer.from(htmlMatch[1], 'base64').toString('utf8');
  assert.match(decodedHtml, /684215/);

  // Confirm queue item tracks verificationEmailSentAt and pending status
  const queue = service.getDispatchQueueItems();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].gmail, 'student.gm@gmail.com');
  assert.equal(queue[0].verified, false);
  assert.ok(queue[0].verificationEmailSentAt);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('auto-sends verified EDID-XXXX email once on verification and resetDatabase clears all records back to EDID-1000', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  fs.writeFileSync(legacyPath, JSON.stringify({ students: [{ edrawId: 'EDID-1000' }] }), 'utf8');

  const verifiedEmailsSent: Array<{ to: string; edrawId: string }> = [];
  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      tok1: { uid: 'uid-1', email: 'fresh@college.edu', emailVerified: false },
      tok2: { uid: 'uid-2', email: 'afterreset@college.edu', emailVerified: false },
    }),
    codeGenerator: () => '246810',
    otpEmailSender: async () => true,
    verifiedIdEmailSender: async ({ to, edrawId }) => {
      verifiedEmailsSent.push({ to, edrawId });
      return true;
    },
  });

  await service.upsertPendingRegistration({
    authHeader: 'Bearer tok1',
    name: 'First Student',
    college: 'MIT Chennai',
  });

  const firstVerify = await service.verifyEmailCode({
    authHeader: 'Bearer tok1',
    code: '246810',
  });
  assert.equal(firstVerify.success, true);
  if (!firstVerify.success) return;
  assert.equal(firstVerify.student.edrawId, 'EDID-1001');
  assert.equal(verifiedEmailsSent.length, 1);
  assert.deepEqual(verifiedEmailsSent[0], { to: 'fresh@college.edu', edrawId: 'EDID-1001' });

  // Duplicate verify callback must NOT send a duplicate EDID email
  await service.verifyEmailCode({ authHeader: 'Bearer tok1', code: '246810' });
  assert.equal(verifiedEmailsSent.length, 1);

  // Reset database empties queue, deletes legacy file, and restarts at EDID-1000
  await service.resetDatabase();
  assert.equal(service.getDispatchQueueItems().length, 0);
  assert.equal(fs.existsSync(legacyPath), false);

  await service.upsertPendingRegistration({
    authHeader: 'Bearer tok2',
    name: 'Second Student',
    college: 'MIT Chennai',
  });
  const secondVerify = await service.verifyEmailCode({
    authHeader: 'Bearer tok2',
    code: '246810',
  });
  assert.equal(secondVerify.success, true);
  if (!secondVerify.success) return;
  assert.equal(secondVerify.student.edrawId, 'EDID-1000');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('postToAppsScriptWebhook accepts valid JSON/text OK and rejects 403, login redirects, HTML permission pages, and error payloads', async () => {
  const { postToAppsScriptWebhook } = await import('./registrationService');

  const okJson = await postToAppsScriptWebhook(
    { to: 'student@gmail.com', code: '123456' },
    {
      webhookUrl: 'https://script.google.com/macros/s/test/exec',
      fetchImpl: (async () =>
        ({
          ok: true,
          status: 200,
          url: 'https://script.googleusercontent.com/macros/echo',
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ ok: true }),
        }) as unknown as Response) as typeof fetch,
    }
  );
  assert.equal(okJson, true);

  const forbidden = await postToAppsScriptWebhook(
    { to: 'student@gmail.com' },
    {
      webhookUrl: 'https://script.google.com/macros/s/test/exec',
      fetchImpl: (async () =>
        ({
          ok: false,
          status: 403,
          url: 'https://script.google.com/macros/s/test/exec',
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => '<html>You need access</html>',
        }) as unknown as Response) as typeof fetch,
    }
  );
  assert.equal(forbidden, false);

  const loginRedirect = await postToAppsScriptWebhook(
    { to: 'student@gmail.com' },
    {
      webhookUrl: 'https://script.google.com/macros/s/test/exec',
      fetchImpl: (async () =>
        ({
          ok: true,
          status: 200,
          url: 'https://accounts.google.com/ServiceLogin',
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => '<html>Sign in</html>',
        }) as unknown as Response) as typeof fetch,
    }
  );
  assert.equal(loginRedirect, false);

  const permissionHtml = await postToAppsScriptWebhook(
    { to: 'student@gmail.com' },
    {
      webhookUrl: 'https://script.google.com/macros/s/test/exec',
      fetchImpl: (async () =>
        ({
          ok: true,
          status: 200,
          url: 'https://script.google.com/macros/s/test/exec',
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => '<html><body>You need access to view this script</body></html>',
        }) as unknown as Response) as typeof fetch,
    }
  );
  assert.equal(permissionHtml, false);

  const jsonError = await postToAppsScriptWebhook(
    { to: 'student@gmail.com' },
    {
      webhookUrl: 'https://script.google.com/macros/s/test/exec',
      fetchImpl: (async () =>
        ({
          ok: true,
          status: 200,
          url: 'https://script.googleusercontent.com/macros/echo',
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ success: false, error: 'Quota exceeded' }),
        }) as unknown as Response) as typeof fetch,
    }
  );
  assert.equal(jsonError, false);
});

test('upsertPendingRegistration and resendVerificationCode expose autoEmailSent, senderEmail, and deliveryError when automated sender is unconfigured', async () => {
  const { dir, storePath, legacyPath } = makeTempPaths();
  const service = new RegistrationService({
    storePath,
    legacyStudentsPath: legacyPath,
    verifyToken: makeVerifier({
      tok_unconf: { uid: 'uid-unconf', email: 'auto.test@college.edu', emailVerified: false },
    }),
    codeGenerator: () => '135791',
    otpEmailSender: async () => false,
  });

  const pending = await service.upsertPendingRegistration({
    authHeader: 'Bearer tok_unconf',
    name: 'Auto Student',
    college: 'MIT Chennai',
  });
  assert.equal(pending.success, true);
  if (pending.success) {
    assert.equal(pending.autoEmailSent, false);
    assert.equal(pending.senderEmail, 'edrawmit@gmail.com');
    assert.equal(pending.deliveryMode, 'gmail_pending');
    assert.ok(pending.deliveryError && pending.deliveryError.includes('edrawmit@gmail.com'));
  }

  const resent = await service.resendVerificationCode({
    authHeader: 'Bearer tok_unconf',
  });
  assert.equal(resent.success, true);
  if (resent.success) {
    assert.equal(resent.autoEmailSent, false);
    assert.equal(resent.senderEmail, 'edrawmit@gmail.com');
    assert.equal(resent.deliveryMode, 'gmail_pending');
    assert.ok(resent.deliveryError && resent.deliveryError.includes('edrawmit@gmail.com'));
  }

  fs.rmSync(dir, { recursive: true, force: true });
});

