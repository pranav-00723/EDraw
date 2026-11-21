/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEdrawId,
  isValidEmail,
  isValidGmail,
  isValidVerificationCode,
  normalizeEdrawId,
  normalizeEmail,
  normalizeVerificationCode,
  validateFirebaseRegistrationInput,
  validateLoginInput,
  validateRegistrationInput,
} from './studentAuthValidation';

test('normalizes and validates 6-digit verification codes strictly', () => {
  assert.equal(normalizeVerificationCode('68-42 15abc'), '684215');
  assert.equal(isValidVerificationCode('684215'), true);
  assert.equal(isValidVerificationCode('68421'), false);
  assert.equal(isValidVerificationCode('68421a'), false);
});

test('normalizes and validates EDID-XXXX format strictly', () => {
  assert.equal(normalizeEdrawId(' edid-1042 '), 'EDID-1042');
  assert.equal(isValidEdrawId('EDID-0001'), true);
  assert.equal(isValidEdrawId('edid-9876'), true);
  assert.equal(isValidEdrawId('EDID-123'), false);
  assert.equal(isValidEdrawId('EDID-12345'), false);
  assert.equal(isValidEdrawId('EDID-ABCD'), false);
  assert.equal(isValidEdrawId('USER-1234'), false);
});

test('validates Google Mail IDs strictly', () => {
  assert.equal(isValidGmail('student.name+1@gmail.com'), true);
  assert.equal(isValidGmail('STUDENT@GOOGLEMAIL.COM'), true);
  assert.equal(isValidGmail('student@yahoo.com'), false);
  assert.equal(isValidGmail('not-an-email'), false);
});

test('normalizes and validates general email addresses for Firebase registration', () => {
  assert.equal(normalizeEmail('  Student.One+Lab@MIT.EDU  '), 'student.one+lab@mit.edu');
  assert.equal(isValidEmail('student@mit.edu'), true);
  assert.equal(isValidEmail('arjun.menon@gmail.com'), true);
  assert.equal(isValidEmail('bad@email'), false);
  assert.equal(isValidEmail('missing-at.edu'), false);
});

test('validates Firebase student registration inputs accurately', () => {
  const okErrors = validateFirebaseRegistrationInput({
    name: 'Arjun Menon',
    email: 'arjun.menon@mit.edu',
    college: 'MIT',
    studentDetails: 'B.Tech Mechanical • Sem 2 • Roll ME26B014',
    password: 'Edraw2026',
    confirmPassword: 'Edraw2026',
  });
  assert.deepEqual(okErrors, {});

  const badErrors = validateFirebaseRegistrationInput({
    name: 'A',
    email: 'invalid-email',
    college: '',
    studentDetails: 'x'.repeat(125),
    password: 'short',
    confirmPassword: 'different',
  });
  assert.ok(badErrors.name);
  assert.ok(badErrors.email);
  assert.ok(badErrors.college);
  assert.ok(badErrors.studentDetails);
  assert.ok(badErrors.password);
  assert.ok(badErrors.confirmPassword);
});

test('validates student registration inputs accurately', () => {
  const okErrors = validateRegistrationInput({
    name: 'Arjun Menon',
    gmail: 'arjun.menon@gmail.com',
    college: 'NIT Trichy',
    password: 'Edraw2026',
    confirmPassword: 'Edraw2026',
  });
  assert.deepEqual(okErrors, {});

  const badErrors = validateRegistrationInput({
    name: 'A',
    gmail: 'arjun@outlook.com',
    college: '',
    password: 'short',
    confirmPassword: 'different',
  });
  assert.ok(badErrors.name);
  assert.ok(badErrors.gmail);
  assert.ok(badErrors.college);
  assert.ok(badErrors.password);
  assert.ok(badErrors.confirmPassword);
});

test('validates student login inputs accurately', () => {
  assert.deepEqual(validateLoginInput({ edrawId: 'EDID-2048', password: 'Edraw2026' }), {});

  const errs = validateLoginInput({ edrawId: 'BAD-ID', password: '' });
  assert.ok(errs.edrawId);
  assert.ok(errs.password);
});
