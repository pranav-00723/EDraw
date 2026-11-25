/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLineVideoSteps } from './lineVideoScript.ts';

test('buildLineVideoSteps generates all 8 steps with clean spoken narration without raw prime/subscript glyphs', () => {
  const steps = buildLineVideoSteps({
    nameA: 'A',
    nameB: 'B',
    tl: 75,
    theta: 30,
    phi: 45,
    plAux: 64.95,
    elAux: 53.03,
    zA: 15,
    yA: 20,
    zB: 52.5,
    yB: 73.03,
    depCalculated: 37.5,
    alphaApparent: 45,
    betaApparent: 54.7,
    hasHt: true,
    hasVt: true,
  });

  assert.equal(steps.length, 8);
  steps.forEach((step, idx) => {
    assert.equal(step.num, idx + 1);
    assert.ok(step.title.length > 0);
    assert.ok(step.description.length > 0);
    assert.ok(step.narration.length > 40, `Step ${step.num} narration should be descriptive`);
    assert.equal(step.narration.includes('′'), false, 'Narration should expand prime symbols for TTS');
    assert.equal(step.narration.includes('₁'), false, 'Narration should expand subscript 1 for TTS');
    assert.equal(step.narration.includes('₂'), false, 'Narration should expand subscript 2 for TTS');
  });

  assert.match(steps[0].narration, /Step 1/i);
  assert.match(steps[1].narration, /15 millimeters above X Y/i);
  assert.match(steps[2].narration, /75 millimeters/i);
  assert.match(steps[7].narration, /horizontal and vertical traces/i);
});

test('buildLineVideoSteps handles zero distances and parallel angles gracefully in narration', () => {
  const steps = buildLineVideoSteps({
    nameA: 'P',
    nameB: 'Q',
    tl: 60,
    theta: 0,
    phi: 0,
    plAux: 60,
    elAux: 60,
    zA: 0,
    yA: 0,
    zB: 0,
    yB: 0,
    depCalculated: 60,
    alphaApparent: 0,
    betaApparent: 0,
    hasHt: false,
    hasVt: false,
  });

  assert.equal(steps.length, 8);
  assert.match(steps[1].narration, /directly on the X Y line/i);
  assert.match(steps[2].narration, /parallel to X Y at zero degrees/i);
  assert.match(steps[3].narration, /parallel to X Y at zero degrees/i);
  assert.equal(steps[7].narration.includes('traces'), false);
});
