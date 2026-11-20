/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEdrawId,
  isValidGmail,
  normalizeEdrawId,
  validateLoginInput,
  validateRegistrationInput,
} from './studentAuthValidation';

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
