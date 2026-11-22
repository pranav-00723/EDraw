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
  StudentAuthService,
  generateUniqueEdrawId,
  hashPassword,
  verifyPassword,
} from './studentAuth';

function makeTempStorePaths(): { dir: string; storePath: string; registrationsPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edraw-auth-test-'));
  return {
    dir,
    storePath: path.join(dir, 'students.json'),
    registrationsPath: path.join(dir, 'registrations.json'),
  };
}

test('hashes and verifies passwords with per-user salts using scrypt', () => {
  const hash1 = hashPassword('Edraw2026');
  const hash2 = hashPassword('Edraw2026');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('Edraw2026', hash1), true);
  assert.equal(verifyPassword('WrongPass1', hash1), false);
});

test('generates unique EDID-XXXX identifiers avoiding collisions', () => {
  const used = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const id = generateUniqueEdrawId(used);
    assert.match(id, /^EDID-[0-9]{4}$/);
    assert.equal(used.has(id), false);
    used.add(id);
  }
});

test('instant zero-verification lifecycle: register -> immediate EDID-1000 & token -> login by email or EDID -> bearer auth -> logout', async () => {
  const { dir, storePath, registrationsPath } = makeTempStorePaths();
  const service = new StudentAuthService(storePath, registrationsPath);

  const reg = await service.registerStudent({
    name: 'Priya Nair',
    email: 'Priya.Nair@college.edu',
    college: 'Anna University',
    studentDetails: 'ME24B018',
    password: 'Password123',
    confirmPassword: 'Password123',
  });

  assert.equal(reg.success, true);
  if (!reg.success) return;

  // Immediate database insertion, normalized email, active status, and session token
  assert.equal(reg.gmail, 'priya.nair@college.edu');
  assert.equal(reg.student.edrawId, 'EDID-1000');
  assert.equal(reg.student.verified, true);
  assert.equal(reg.student.studentDetails, 'ME24B018');
  assert.ok(reg.token);

  // Token returned on registration immediately authenticates /api/auth/me
  const regMe = service.getAuthenticatedStudent(`Bearer ${reg.token}`);
  assert.equal(regMe?.edrawId, 'EDID-1000');
  assert.equal(regMe?.gmail, 'priya.nair@college.edu');

  // Wrong password fails
  const wrongPw = service.loginStudent({ identifier: 'EDID-1000', password: 'WrongPassword1' });
  assert.equal(wrongPw.success, false);

  // Login by EDID-XXXX succeeds immediately
  const loginById = service.loginStudent({ edrawId: 'edid-1000', password: 'Password123' });
  assert.equal(loginById.success, true);
  if (!loginById.success) return;
  assert.equal(loginById.student.edrawId, 'EDID-1000');

  // Login by email address (case-insensitive) succeeds immediately
  const loginByEmail = service.loginStudent({
    identifier: '  PRIYA.NAIR@COLLEGE.EDU ',
    password: 'Password123',
  });
  assert.equal(loginByEmail.success, true);
  if (!loginByEmail.success) return;
  assert.equal(loginByEmail.student.edrawId, 'EDID-1000');

  // Bearer token authenticates /api/auth/me and logout revokes it
  const me = service.getAuthenticatedStudent(`Bearer ${loginByEmail.token}`);
  assert.equal(me?.edrawId, 'EDID-1000');
  assert.equal(me?.college, 'Anna University');

  service.logoutToken(`Bearer ${loginByEmail.token}`);
  assert.equal(service.getAuthenticatedStudent(`Bearer ${loginByEmail.token}`), null);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('enforces strict non-duplicable emails (case-insensitive, concurrent, and across sibling registrations store)', async () => {
  const { dir, storePath, registrationsPath } = makeTempStorePaths();
  // Seed sibling registrations.json with an existing active student AND a stale unallocated pending stub
  fs.writeFileSync(
    registrationsPath,
    JSON.stringify({
      nextCounter: 1001,
      records: {
        'uid-google-1': {
          uid: 'uid-google-1',
          email: 'existing.google@gmail.com',
          edrawId: 'EDID-1000',
        },
        'uid-stale-pending': {
          uid: 'uid-stale-pending',
          email: 'stale.pending@gmail.com',
          edrawId: null,
          registrationStatus: 'pending_verification',
          verified: false,
        },
      },
    }),
    'utf8'
  );

  const service = new StudentAuthService(storePath, registrationsPath);

  // Stale unallocated pending_verification stub must NOT block registration
  const staleAllowed = await service.registerStudent({
    name: 'Fresh Student',
    email: 'stale.pending@gmail.com',
    college: 'MIT Chennai',
    password: 'Password123',
    confirmPassword: 'Password123',
  });
  assert.equal(staleAllowed.success, true);
  if (staleAllowed.success) {
    assert.equal(staleAllowed.student.edrawId, 'EDID-1001');
  }

  // Email with an active EDID-XXXX in sibling registrations.json must be rejected with 409
  const crossStoreDup = await service.registerStudent({
    name: 'Duplicate Google',
    email: 'EXISTING.GOOGLE@GMAIL.COM',
    college: 'MIT Chennai',
    password: 'Password123',
    confirmPassword: 'Password123',
  });
  assert.equal(crossStoreDup.success, false);
  if (!crossStoreDup.success) {
    assert.equal(crossStoreDup.status, 409);
  }

  // Concurrent duplicate submissions for the same email: exactly ONE succeeds, others get 409
  const raceResults = await Promise.all([
    service.registerStudent({
      name: 'Karthik One',
      email: 'karthik.unique@gmail.com',
      college: 'PSG Tech',
      password: 'Password123',
      confirmPassword: 'Password123',
    }),
    service.registerStudent({
      name: 'Karthik Two',
      email: 'KARTHIK.UNIQUE@GMAIL.COM',
      college: 'PSG Tech',
      password: 'Password123',
      confirmPassword: 'Password123',
    }),
    service.registerStudent({
      name: 'Karthik Three',
      email: '  Karthik.Unique@gmail.com ',
      college: 'PSG Tech',
      password: 'Password123',
      confirmPassword: 'Password123',
    }),
  ]);

  const successes = raceResults.filter((r) => r.success);
  const conflicts = raceResults.filter((r) => !r.success && r.status === 409);
  assert.equal(successes.length, 1);
  assert.equal(conflicts.length, 2);

  // Skipped EDID-1000 (sibling) and EDID-1001 (stale.pending) -> allocated EDID-1002
  if (successes[0].success) {
    assert.equal(successes[0].student.edrawId, 'EDID-1002');
  }

  // Persisted database has strictly 1 record for karthik.unique@gmail.com
  const stored = JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
    students: Array<{ gmail: string }>;
  };
  assert.equal(
    stored.students.filter((s) => s.gmail === 'karthik.unique@gmail.com').length,
    1
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test('builds sanitized RFC 2822 MIME payload and exposes sanitized student records without hashes', async () => {
  const {
    buildMimeRawEmail,
    buildVerificationEmailContent,
    getAdminSenderEmail,
  } = await import('./studentAuth');

  assert.equal(getAdminSenderEmail(), 'edrawmit@gmail.com');

  const content = buildVerificationEmailContent({
    studentName: 'Meera <script>alert(1)</script>',
    college: 'MIT Anna University',
    verificationUrl: 'https://example.com/?verifyToken=abc123',
  });
  assert.equal(content.html.includes('<script>'), false);
  assert.equal(content.html.includes('&lt;script&gt;'), true);

  const raw = buildMimeRawEmail({
    from: 'edrawmit@gmail.com\r\nBcc: evil@example.com',
    to: 'student@gmail.com',
    subject: 'Verify Account\r\nX-Injected: bad',
    text: content.text,
    html: content.html,
  });
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  assert.equal(decoded.includes('\r\nBcc:'), false);
  assert.equal(decoded.includes('\r\nX-Injected:'), false);
  assert.equal(decoded.includes('To: student@gmail.com'), true);

  const { dir, storePath, registrationsPath } = makeTempStorePaths();
  const service = new StudentAuthService(storePath, registrationsPath);
  await service.registerStudent({
    name: 'Rohan Das',
    email: 'rohan.das@gmail.com',
    college: 'NIT Trichy',
    password: 'Password123',
    confirmPassword: 'Password123',
  });

  const queue = service.getDispatchQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].gmail, 'rohan.das@gmail.com');
  assert.equal(queue[0].verified, true);
  assert.equal('passwordHash' in queue[0], false);
  assert.equal('verificationTokenHash' in queue[0], false);

  fs.rmSync(dir, { recursive: true, force: true });
});
