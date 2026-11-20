/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

test('firestore.rules includes default-deny global safety net and rules_version 2', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2'/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces email_verified owner isolation and forbids blanket /students list', () => {
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /match \/students\/\{studentUid\}[\s\S]*?allow list:\s*if false;/);
});

test('firestore.rules enforces EDID-XXXX and Gmail regexes synchronized with firebase-blueprint.json', () => {
  const edidPattern = blueprint.entities.StudentProfile.properties.edrawId.pattern;
  const gmailPattern = blueprint.entities.StudentProfile.properties.gmail.pattern;
  const rulesEscapedGmailPattern = gmailPattern.replace(/\\/g, '\\\\');
  assert.equal(edidPattern, '^EDID-[0-9]{4}$');
  assert.ok(rulesText.includes(edidPattern));
  assert.ok(rulesText.includes(rulesEscapedGmailPattern));
});

test('firestore.rules enforces Master Gate, immutability, request.time, and affectedKeys.hasOnly', () => {
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.edrawId == existing\(\)\.edrawId/);
  assert.match(rulesText, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly/);
  assert.match(rulesText, /exists\(\/databases\/\$\(database\)\/documents\/students\/\$\(studentUid\)\)/);
  assert.match(rulesText, /resource\.data\.ownerUid == request\.auth\.uid/);
});
