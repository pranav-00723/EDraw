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
