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

test('allocates EDID-XXXX only after email verification and enforces idempotency across retries', async () => {
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

  // 1. Pending registration creates record with NO edrawId
  const pending = await service.upsertPendingRegistration({
    authHeader: 'Bearer unverified_tok',
    name: 'Ananya Rao',
    college: 'IIT Madras',
    studentDetails: 'ME24B012 · Mechanical',
  });
  assert.equal(pending.success, true);
  if (pending.success) {
    assert.equal(pending.record.edrawId, null);
    assert.equal(pending.record.registrationStatus, 'pending_verification');
    assert.equal(pending.record.verified, false);
  }

  // 2. Completing before email verification is blocked (403) and allocates NO ID
  const blocked = await service.completeVerifiedRegistration({
    authHeader: 'Bearer unverified_tok',
  });
  assert.equal(blocked.success, false);
  if (!blocked.success) {
    assert.equal(blocked.status, 403);
  }

  // 3. Completing after email verification allocates EDID-1000
  const firstComplete = await service.completeVerifiedRegistration({
    authHeader: 'Bearer verified_tok',
  });
  assert.equal(firstComplete.success, true);
  if (!firstComplete.success) return;
  assert.equal(firstComplete.alreadyAllocated, false);
  assert.equal(firstComplete.record.edrawId, 'EDID-1000');
  assert.equal(firstComplete.record.registrationStatus, 'verified');
  assert.equal(firstComplete.record.verified, true);

  // 4. Repeated callback / page refresh is idempotent and preserves EDID-1000
  const secondComplete = await service.completeVerifiedRegistration({
    authHeader: 'Bearer verified_tok',
    name: 'Changed Name Should Not Overwrite ID',
  });
  assert.equal(secondComplete.success, true);
  if (!secondComplete.success) return;
  assert.equal(secondComplete.alreadyAllocated, true);
  assert.equal(secondComplete.record.edrawId, 'EDID-1000');

  // 5. Attempting upsertPendingRegistration after allocation never overwrites EDID-1000
  const afterPending = await service.upsertPendingRegistration({
    authHeader: 'Bearer verified_tok',
    name: 'Ananya Rao',
    college: 'IIT Madras',
    studentDetails: 'ME24B012',
  });
  assert.equal(afterPending.success, true);
  if (afterPending.success) {
    assert.equal(afterPending.record.edrawId, 'EDID-1000');
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
