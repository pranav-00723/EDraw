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

function makeTempStorePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edraw-auth-test-'));
  return path.join(dir, 'students.json');
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

test('full lifecycle: register -> verify Gmail link -> receive EDID-XXXX -> login -> bearer auth -> logout', async () => {
  const storePath = makeTempStorePath();
  const service = new StudentAuthService(storePath);

  const reg = await service.registerStudent(
    {
      name: 'Priya Nair',
      gmail: 'priya.nair@gmail.com',
      college: 'Anna University',
      password: 'Password123',
      confirmPassword: 'Password123',
    },
    'http://localhost:3000'
  );

  assert.equal(reg.success, true);
  if (!reg.success) return;
  assert.equal(reg.gmail, 'priya.nair@gmail.com');
  assert.ok(reg.previewEmail?.verificationToken);

  // Verify token
  const verifyRes = await service.verifyEmailToken(reg.previewEmail!.verificationToken!);
  assert.equal(verifyRes.success, true);
  if (!verifyRes.success) return;

  const assignedId = verifyRes.student.edrawId;
  assert.match(assignedId, /^EDID-[0-9]{4}$/);
  assert.equal(verifyRes.student.verified, true);
  assert.equal(verifyRes.confirmationEmail?.edrawId, assignedId);

  // Reusing the same verification token must fail
  const reuseRes = await service.verifyEmailToken(reg.previewEmail!.verificationToken!);
  assert.equal(reuseRes.success, false);

  // Wrong password fails
  const wrongPw = service.loginStudent({ edrawId: assignedId, password: 'WrongPassword1' });
  assert.equal(wrongPw.success, false);

  // Valid EDID-XXXX + password succeeds
  const loginRes = service.loginStudent({ edrawId: assignedId, password: 'Password123' });
  assert.equal(loginRes.success, true);
  if (!loginRes.success) return;

  // Bearer token authenticates /api/auth/me
  const me = service.getAuthenticatedStudent(`Bearer ${loginRes.token}`);
  assert.equal(me?.edrawId, assignedId);
  assert.equal(me?.college, 'Anna University');

  // Logout revokes token
  service.logoutToken(`Bearer ${loginRes.token}`);
  assert.equal(service.getAuthenticatedStudent(`Bearer ${loginRes.token}`), null);

  // Duplicate verified Gmail registration is rejected
  const dup = await service.registerStudent(
    {
      name: 'Priya Duplicate',
      gmail: 'priya.nair@gmail.com',
      college: 'Anna University',
      password: 'Password123',
      confirmPassword: 'Password123',
    },
    'http://localhost:3000'
  );
  assert.equal(dup.success, false);

  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

test('blocks login for unverified student until Gmail verification completes', async () => {
  const storePath = makeTempStorePath();
  const service = new StudentAuthService(storePath);

  const reg = await service.registerStudent(
    {
      name: 'Karthik Raj',
      gmail: 'karthik.raj@gmail.com',
      college: 'PSG Tech',
      password: 'Password123',
      confirmPassword: 'Password123',
    },
    'http://localhost:3000'
  );
  assert.equal(reg.success, true);

  // Peek stored EDID to verify unverified login is blocked
  const db = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const edrawId = db.students[0].edrawId;

  const blocked = service.loginStudent({ edrawId, password: 'Password123' });
  assert.equal(blocked.success, false);
  if (!blocked.success) {
    assert.equal(blocked.status, 403);
    assert.equal(blocked.unverifiedGmail, 'karthik.raj@gmail.com');
  }

  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

test('builds sanitized RFC 2822 MIME payload and exposes sanitized dispatch queue without hashes', async () => {
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

  const storePath = makeTempStorePath();
  const service = new StudentAuthService(storePath);
  await service.registerStudent(
    {
      name: 'Rohan Das',
      gmail: 'rohan.das@gmail.com',
      college: 'NIT Trichy',
      password: 'Password123',
      confirmPassword: 'Password123',
    },
    'http://localhost:3000'
  );

  const queue = service.getDispatchQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].gmail, 'rohan.das@gmail.com');
  assert.equal(queue[0].verified, false);
  assert.equal('passwordHash' in queue[0], false);
  assert.equal('verificationTokenHash' in queue[0], false);

  const authCheck = await service.verifyGoogleSenderBearer(undefined);
  assert.equal(authCheck.ok, false);
  if (!authCheck.ok) {
    assert.equal(authCheck.status, 401);
  }

  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});
