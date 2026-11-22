/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { runEngineeringDrawingPipeline } from './orchestrator.ts';
import { extractDiagramEvidence, detectUncertainOcrReadings } from './ocrService.ts';
import { validateGeneratedJsModule } from './jsGenerator.ts';
import { listRegisteredModules } from '../../src/pipeline/moduleRegistry.ts';
import { getMeasurementValue } from '../../src/pipeline/schema.ts';

test('Golden Test 1: Projection of Point direct/orthographic (25, 30, 20)', async () => {
  const res = await runEngineeringDrawingPipeline({
    text: 'A point A has coordinates (25, 30, 20) i.e. 20 mm above HP and 30 mm in front of VP. Draw its projections.',
    persist: false,
  });

  assert.equal(res.ok, true);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.module?.id, 'projection_of_points');
  assert.equal(res.validated_json.validation.solver_status, 'solved');
  assert.equal(res.validated_json.validation.ready_for_render, true);
  assert.equal(res.validated_json.geometry.entity_type, 'point_set');

  if (res.validated_json.geometry.entity_type === 'point_set') {
    const pt = res.validated_json.geometry.solved_points?.[0];
    assert.ok(pt);
    assert.equal(pt.label, 'A');
    assert.equal(pt.y_mm, 30);
    assert.equal(pt.z_mm, 20);
    assert.equal(pt.front_view_y, 20);
    assert.equal(pt.top_view_y, -30);
    assert.equal(pt.quadrant, 'FIRST');
  }

  assert.ok(res.svg);
  assert.ok(res.svg.includes('a′'));
  assert.ok(res.svg.includes('>a (TV)'));
  assert.ok(res.generated_js_module);
  assert.equal(res.js_validation?.valid, true);
});

test('Golden Test 2: Partial Straight Line (FV=65, alpha_fv=45 with XY) computes DEP & |dz| and enforces underdetermined gate', async () => {
  const res = await runEngineeringDrawingPipeline({
    text: 'A line AB has its end A 20 mm above HP and 30 mm in front of VP. Its front view measures 65 mm long and is inclined at 45° with XY.',
    persist: false,
  });

  assert.equal(res.ok, false);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.module?.id, 'projection_of_straight_lines');

  // Must NEVER confuse alpha_fv (with XY) with theta_hp (with HP)!
  assert.equal(getMeasurementValue(res.validated_json, 'alpha_fv'), 45);
  assert.equal(getMeasurementValue(res.validated_json, 'theta_hp'), null);
  assert.equal(getMeasurementValue(res.validated_json, 'front_view_length'), 65);

  const dep = getMeasurementValue(res.validated_json, 'dep');
  const absDz = getMeasurementValue(res.validated_json, 'abs_delta_z');
  assert.ok(dep !== null && Math.abs(dep - 65 * Math.cos(Math.PI / 4)) < 1e-3);
  assert.ok(absDz !== null && Math.abs(absDz - 65 * Math.sin(Math.PI / 4)) < 1e-3);

  assert.equal(res.validated_json.validation.solver_status, 'underdetermined');
  assert.equal(res.validated_json.validation.ready_for_render, false);
  assert.equal(res.svg, null);
  assert.ok(res.missing_requirements.length > 0);
});

test('Golden Test 3: Arbitrary endpoint labels LK rendered without hardcoded A/B defaults', async () => {
  const res = await runEngineeringDrawingPipeline({
    text: 'A line LK 8 cm long is inclined at 30° to the HP and 45° to the VP. End L is 0.02 m above HP and 3 cm in front of VP. Draw its projections.',
    persist: false,
  });

  assert.equal(res.ok, true);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.geometry.entity_type, 'straight_line');
  if (res.validated_json.geometry.entity_type === 'straight_line') {
    assert.equal(res.validated_json.geometry.line_label, 'LK');
    assert.equal(res.validated_json.geometry.endpoints.start, 'L');
    assert.equal(res.validated_json.geometry.endpoints.end, 'K');
  }

  assert.ok(res.svg);
  assert.ok(res.svg.includes('l′'));
  assert.ok(res.svg.includes('k′'));
  assert.ok(!res.svg.includes('>a′<'));
  assert.ok(!res.svg.includes('>b′<'));

  assert.ok(res.generated_js_module);
  assert.ok(res.generated_js_module.includes('LK'));
  assert.ok(!res.generated_js_module.includes('"line_label": "AB"'));
  assert.equal(res.js_validation?.valid, true);
});

test('Golden Test 4: Contradictory overdetermined straight line (theta + phi > 90) rejected strictly', async () => {
  const res = await runEngineeringDrawingPipeline({
    text: 'A line PQ 80 mm long is inclined at 60° to the HP and 50° to the VP. Its end P is 20 mm above HP and 30 mm in front of VP.',
    persist: false,
  });

  assert.equal(res.ok, false);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.validation.solver_status, 'inconsistent');
  assert.equal(res.validated_json.validation.ready_for_render, false);
  assert.equal(res.svg, null);
});

test('Golden Test 5: Multi-point relative offset solver propagates P -> Q cleanly', async () => {
  const res = await runEngineeringDrawingPipeline({
    text: 'Point P is 20 mm above HP and 30 mm in front of VP. Point Q is 15 mm above P and 10 mm closer to VP. Draw projections of P and Q.',
    persist: false,
  });

  assert.equal(res.ok, true);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.module?.id, 'projection_of_points');
  assert.equal(res.validated_json.geometry.entity_type, 'point_set');

  if (res.validated_json.geometry.entity_type === 'point_set') {
    const solved = res.validated_json.geometry.solved_points ?? [];
    assert.equal(solved.length, 2);
    const ptP = solved.find((p) => p.label === 'P');
    const ptQ = solved.find((p) => p.label === 'Q');
    assert.ok(ptP && ptQ);
    assert.equal(ptP.z_mm, 20);
    assert.equal(ptP.y_mm, 30);
    assert.equal(ptQ.z_mm, 35);
    assert.equal(ptQ.y_mm, 20);
    assert.equal(ptQ.quadrant, 'FIRST');
  }

  assert.ok(res.svg);
  assert.ok(res.svg.includes('p′'));
  assert.ok(res.svg.includes('q′'));
  assert.equal(res.point_inputs?.length, 2);
});

test('Golden Test 6: Unsupported topic (Hexagonal Pyramid) & Vague Prompt (needs_clarification)', async () => {
  const solidRes = await runEngineeringDrawingPipeline({
    text: 'A regular hexagonal pyramid of 30 mm base side and 60 mm axis rests on HP on one of its base edges. Draw its projections.',
    persist: false,
  });

  assert.equal(solidRes.ok, false);
  assert.ok(solidRes.validated_json);
  assert.equal(solidRes.validated_json.module?.id, 'projection_of_solids');
  assert.equal(solidRes.validated_json.validation.solver_status, 'unsupported');
  assert.equal(solidRes.svg, null);

  const vagueRes = await runEngineeringDrawingPipeline({
    text: 'Plot the given orthographic view cleanly.',
    persist: false,
  });

  assert.equal(vagueRes.ok, false);
  assert.ok(vagueRes.validated_json);
  assert.equal(vagueRes.validated_json.module?.id, 'unknown_module');
  assert.equal(vagueRes.validated_json.validation.solver_status, 'needs_clarification');
  assert.equal(vagueRes.svg, null);
});

test('Suite A: Diagram evidence preservation & OCR uncertainty flagging without silent overwrite', async () => {
  const sampleWithEvidence = `A line AB 75 1m long is inclined at 300 to HP.
[DIAGRAM EVIDENCE]: a' = 20 mm above XY`;

  const evidence = extractDiagramEvidence(sampleWithEvidence);
  assert.equal(evidence.length, 1);
  assert.ok(evidence[0].includes("a' = 20 mm above XY"));

  const uncertain = detectUncertainOcrReadings(sampleWithEvidence);
  assert.ok(uncertain.some((u) => u.raw_token.includes('300')));
  assert.ok(uncertain.some((u) => u.raw_token.includes('75 1m')));

  const pipeRes = await runEngineeringDrawingPipeline({
    text: sampleWithEvidence,
    persist: false,
  });
  assert.equal(pipeRes.ok, false);
  assert.ok((pipeRes.validated_json?.source.uncertain_readings.length ?? 0) >= 2);
  assert.equal(pipeRes.svg, null);
});

test('Suite C: Point Quadrants (2nd, 3rd, 4th, boundary) & Contradictory Quadrant + Zero-Length rejection', async () => {
  // 2nd Quadrant
  const q2 = await runEngineeringDrawingPipeline({
    text: 'A point C is 25 mm above HP and 40 mm behind VP.',
    persist: false,
  });
  assert.equal(q2.ok, true);
  if (q2.validated_json?.geometry.entity_type === 'point_set') {
    const pt = q2.validated_json.geometry.solved_points?.[0];
    assert.ok(pt);
    assert.equal(pt.quadrant, 'SECOND');
    assert.equal(pt.front_view_y, 25);
    assert.equal(pt.top_view_y, 40);
  }

  // 3rd Quadrant
  const q3 = await runEngineeringDrawingPipeline({
    text: 'A point D is 30 mm below HP and 20 mm behind VP.',
    persist: false,
  });
  assert.equal(q3.ok, true);
  if (q3.validated_json?.geometry.entity_type === 'point_set') {
    const pt = q3.validated_json.geometry.solved_points?.[0];
    assert.ok(pt);
    assert.equal(pt.quadrant, 'THIRD');
    assert.equal(pt.front_view_y, -30);
    assert.equal(pt.top_view_y, 20);
  }

  // Boundary: On Both XY
  const onXy = await runEngineeringDrawingPipeline({
    text: 'A point P lies in both HP and VP.',
    persist: false,
  });
  assert.equal(onXy.ok, true);
  if (onXy.validated_json?.geometry.entity_type === 'point_set') {
    const pt = onXy.validated_json.geometry.solved_points?.[0];
    assert.ok(pt);
    assert.equal(pt.quadrant, 'ON_BOTH_XY');
    assert.equal(pt.front_view_y, 0);
    assert.equal(pt.top_view_y, 0);
  }

  // Contradictory Quadrant
  const contra = await runEngineeringDrawingPipeline({
    text: 'A point K in the 1st quadrant is 25 mm below HP and 30 mm in front of VP.',
    persist: false,
  });
  assert.equal(contra.ok, false);
  assert.equal(contra.validated_json?.validation.solver_status, 'inconsistent');

  // Degenerate zero-length straight line
  const zeroLine = await runEngineeringDrawingPipeline({
    text: 'A line AB 0 mm long has end A 20 mm above HP and 30 mm in front of VP, inclined at 30° to HP.',
    persist: false,
  });
  assert.equal(zeroLine.ok, false);
  assert.equal(zeroLine.validated_json?.validation.solver_status, 'inconsistent');
});

test('Suite D & E: Module registry coverage + generated JS AST & sandbox safety verification', async () => {
  const modules = listRegisteredModules();
  assert.ok(modules.some((m) => m.id === 'projection_of_points' && m.implementation_status === 'implemented'));
  assert.ok(modules.some((m) => m.id === 'projection_of_straight_lines' && m.implementation_status === 'implemented'));
  assert.ok(modules.some((m) => m.id === 'projection_of_solids' && m.implementation_status === 'unsupported'));
  assert.ok(modules.some((m) => m.id === 'isometric_projections'));

  const res = await runEngineeringDrawingPipeline({
    text: 'Point R is 15 mm below HP and 25 mm in front of VP.',
    persist: false,
  });
  assert.equal(res.ok, true);
  assert.ok(res.generated_js_module);

  const validation = validateGeneratedJsModule(res.generated_js_module);
  assert.equal(validation.valid, true);

  // Compile cleanly inside isolated vm.Script without executing unsafe globals
  assert.doesNotThrow(() => new vm.Script(res.generated_js_module!));
});

test('Suite F: User-edited Stage 2 PointSet JSON propagates cleanly through Stage 3/4/5', async () => {
  const firstRun = await runEngineeringDrawingPipeline({
    text: 'A point A is 20 mm above HP and 30 mm in front of VP.',
    persist: false,
  });
  assert.equal(firstRun.ok, true);
  assert.ok(firstRun.initial_json);

  const edited = structuredClone(firstRun.initial_json);
  if (edited.givens.z_mm) {
    edited.givens.z_mm.value = 45;
    edited.givens.z_mm.status = 'given';
  }
  if (edited.geometry.entity_type === 'point_set') {
    edited.geometry.points[0].z_mm = 45;
  }

  const reRun = await runEngineeringDrawingPipeline({
    editedInitialJson: edited,
    persist: false,
  });
  assert.equal(reRun.ok, true);
  if (reRun.validated_json?.geometry.entity_type === 'point_set') {
    assert.equal(reRun.validated_json.geometry.solved_points?.[0]?.front_view_y, 45);
  }
});
