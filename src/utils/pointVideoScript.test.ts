import test from 'node:test';
import assert from 'node:assert/strict';
import { computePointCoordinates, SAMPLE_PROBLEMS } from './projectionMath.ts';
import { buildPointVideoSteps, splitNarrationIntoSubtitleCues } from './pointVideoScript.ts';

test('buildPointVideoSteps generates 7 complete What/How/Why/When steps across all quadrants and boundary presets', () => {
  for (const preset of SAMPLE_PROBLEMS) {
    for (const rawPt of preset.points) {
      const computed = computePointCoordinates({ ...rawPt, id: `test-${rawPt.name}` });
      const steps = buildPointVideoSteps(computed);

      assert.equal(steps.length, 7, `Expected 7 steps for ${preset.title} (${rawPt.name})`);

      for (const step of steps) {
        assert.ok(step.what.trim().length > 15);
        assert.ok(step.how.trim().length > 15);
        assert.ok(step.why.trim().length > 15);
        assert.ok(step.when.trim().length > 15);
        assert.ok(step.narration.trim().length > 20);
      }
    }
  }
});

test('buildPointVideoSteps detects same-side staggered dimensions in 2nd Quadrant and coincidence when distHp === distVp', () => {
  const q2NonCoincident = computePointCoordinates({
    id: 'q2-stagger',
    name: 'B',
    color: '#dc2626',
    hpRelation: 'ABOVE',
    distanceHp: 25,
    vpRelation: 'BEHIND',
    distanceVp: 35,
    x: 0,
    showOptionalX: false,
  });
  const staggerSteps = buildPointVideoSteps(q2NonCoincident);
  assert.match(staggerSteps[5].how, /SAME side of X–Y/i);
  assert.match(staggerSteps[5].how, /25 mm/);
  assert.match(staggerSteps[5].how, /35 mm/);

  const q2Coincident = computePointCoordinates({
    id: 'q2-coincide',
    name: 'K',
    color: '#2563eb',
    hpRelation: 'ABOVE',
    distanceHp: 30,
    vpRelation: 'BEHIND',
    distanceVp: 30,
    x: 0,
    showOptionalX: false,
  });
  const coincideSteps = buildPointVideoSteps(q2Coincident);
  assert.match(coincideSteps[4].what, /exact same spot/i);
  assert.match(coincideSteps[3].narration, /\bk prime\b/i);
  assert.ok(!coincideSteps[1].narration.includes('–'), 'Narration should speak X Y cleanly without en-dash');
});

test('splitNarrationIntoSubtitleCues splits narration into short ordered cues covering 0..1 ratio', () => {
  const pt = computePointCoordinates({ ...SAMPLE_PROBLEMS[0].points[0], id: 'sub-test' });
  const steps = buildPointVideoSteps(pt);

  for (const step of steps) {
    const cues = splitNarrationIntoSubtitleCues(step.narration);
    assert.ok(cues.length >= 3, `Expected >= 3 subtitle cues for step ${step.id}`);
    assert.equal(cues[0].startRatio, 0);
    assert.equal(cues[cues.length - 1].endRatio, 1);

    for (let i = 0; i < cues.length; i++) {
      assert.ok(cues[i].text.length > 0 && cues[i].text.length <= 72, `Cue too long: "${cues[i].text}"`);
      assert.ok(cues[i].endRatio > cues[i].startRatio);
      if (i > 0) {
        assert.ok(cues[i].startChar >= cues[i - 1].startChar);
        assert.equal(cues[i].startRatio, cues[i - 1].endRatio);
      }
    }
  }
});
