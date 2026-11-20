/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInterpretationFromStructured,
  parseStructuredQuestionJson,
  type StructuredQuestionData,
} from './structuredQuestionJson';

function createBaseStructured(): StructuredQuestionData {
  return buildInterpretationFromStructured({
    object_type: 'STRAIGHT_LINE',
    line_name: 'AB',
    endpoints: { start: 'A', end: 'B' },
    dimensions: {
      true_length_mm: 80,
      front_view_length_mm: null,
      top_view_length_mm: null,
      dep_projector_distance_mm: null,
    },
    coordinates: {
      point_A: {
        dist_hp_mm: 20,
        hp_relation: 'ABOVE',
        dist_vp_mm: 30,
        vp_relation: 'IN_FRONT',
      },
      point_B: {
        dist_hp_mm: null,
        hp_relation: 'ABOVE',
        dist_vp_mm: null,
        vp_relation: 'IN_FRONT',
      },
    },
    inclinations: {
      theta_hp_deg: 30,
      phi_vp_deg: 45,
      alpha_apparent_fv_deg: null,
      beta_apparent_tv_deg: null,
    },
    reference_plane_conditions: {
      system: 'FIRST_ANGLE_PROJECTION',
      is_parallel_to_hp: false,
      is_parallel_to_vp: false,
      is_perpendicular_to_hp: false,
      is_perpendicular_to_vp: false,
    },
    projection_requirements: ['FRONT_VIEW_ELEVATION', 'TOP_VIEW_PLAN'],
    construction_method: 'ROTATING_LINE_METHOD',
    missing_or_ambiguous_fields: [],
    validation: {
      is_valid: true,
      geometric_condition: '',
      warnings: [],
    },
  }).structured;
}

test('parses valid edited JSON and propagates changes to LineProblemInput and derived dimensions', () => {
  const base = createBaseStructured();
  const edited = {
    ...base,
    endpoints: { start: 'P', end: 'Q' },
    dimensions: { ...base.dimensions, true_length_mm: 100 },
    inclinations: { ...base.inclinations, theta_hp_deg: 40, phi_vp_deg: 30 },
    coordinates: {
      ...base.coordinates,
      point_A: {
        dist_hp_mm: 35,
        hp_relation: 'BELOW',
        dist_vp_mm: 15,
        vp_relation: 'IN_FRONT',
      },
    },
  };

  const result = parseStructuredQuestionJson(JSON.stringify(edited, null, 2), base);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.structured.line_name, 'PQ');
  assert.equal(result.structured.endpoints.start, 'P');
  assert.equal(result.structured.endpoints.end, 'Q');
  assert.equal(result.lineInput.nameA, 'P');
  assert.equal(result.lineInput.nameB, 'Q');
  assert.equal(result.lineInput.trueLength, 100);
  assert.equal(result.lineInput.thetaDeg, 40);
  assert.equal(result.lineInput.phiDeg, 30);
  assert.equal(result.lineInput.endA.hpRelation, 'BELOW');
  assert.equal(result.lineInput.endA.distanceHp, 35);
  assert.equal(result.hasAmbiguity, false);
  assert.equal(result.structured.validation.is_valid, true);
});

test('syncs endpoints automatically when user edits 2-letter line_name directly', () => {
  const base = createBaseStructured();
  const edited = { ...base, line_name: 'MN' };

  const result = parseStructuredQuestionJson(JSON.stringify(edited), base);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.structured.line_name, 'MN');
  assert.equal(result.structured.endpoints.start, 'M');
  assert.equal(result.structured.endpoints.end, 'N');
});

test('returns descriptive error on malformed JSON syntax or non-object root', () => {
  const base = createBaseStructured();

  const syntaxErr = parseStructuredQuestionJson('{ "line_name": "AB", }', base);
  assert.equal(syntaxErr.ok, false);
  if (!syntaxErr.ok) {
    assert.match(syntaxErr.error, /JSON syntax error/i);
  }

  const arrayErr = parseStructuredQuestionJson('[1, 2, 3]', base);
  assert.equal(arrayErr.ok, false);
  if (!arrayErr.ok) {
    assert.match(arrayErr.error, /JSON object/i);
  }
});

test('validates numeric bounds and enum relations', () => {
  const base = createBaseStructured();

  const badTl = parseStructuredQuestionJson(
    JSON.stringify({ ...base, dimensions: { ...base.dimensions, true_length_mm: -10 } }),
    base
  );
  assert.equal(badTl.ok, false);

  const badAngle = parseStructuredQuestionJson(
    JSON.stringify({ ...base, inclinations: { ...base.inclinations, theta_hp_deg: 120 } }),
    base
  );
  assert.equal(badAngle.ok, false);

  const badRel = parseStructuredQuestionJson(
    JSON.stringify({
      ...base,
      coordinates: {
        ...base.coordinates,
        point_A: { ...base.coordinates.point_A, hp_relation: 'SIDEWAYS' },
      },
    }),
    base
  );
  assert.equal(badRel.ok, false);
});

test('detects missing null parameters as ambiguity and angle sum violations as invalid', () => {
  const base = createBaseStructured();

  const missingTl = parseStructuredQuestionJson(
    JSON.stringify({ ...base, dimensions: { ...base.dimensions, true_length_mm: null } }),
    base
  );
  assert.equal(missingTl.ok, true);
  if (missingTl.ok) {
    assert.equal(missingTl.hasAmbiguity, true);
    assert.ok(missingTl.structured.missing_or_ambiguous_fields.includes('True Length (TL)'));
    assert.equal(missingTl.structured.validation.is_valid, false);
  }

  const invalidSum = parseStructuredQuestionJson(
    JSON.stringify({
      ...base,
      inclinations: { ...base.inclinations, theta_hp_deg: 60, phi_vp_deg: 60 },
    }),
    base
  );
  assert.equal(invalidSum.ok, true);
  if (invalidSum.ok) {
    assert.equal(invalidSum.structured.validation.is_valid, false);
    assert.match(invalidSum.structured.validation.geometric_condition, /FAILED/);
  }
});
