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
  validateCanonicalProblem,
  getMeasurementValue,
} from '../../src/pipeline/schema.ts';
import { runStage1Ocr, detectUncertainOcrReadings } from './ocrService.ts';
import { buildInitialProblemJson } from './initialJsonBuilder.ts';
import { runStage3PythonSolver } from './pythonSolverBridge.ts';
import { updateAndValidateProblemJson } from './jsonUpdaterValidator.ts';
import { runStage5SvgRenderer } from './svgRenderer.ts';
import { runEngineeringDrawingPipeline } from './orchestrator.ts';

function makeTempStoreDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'edraw-pipeline-test-'));
}

test('1. Full pipeline solves question with all required values provided (Line AB)', async () => {
  const storeDir = makeTempStoreDir();
  try {
    const text =
      'A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections.';
    const res = await runEngineeringDrawingPipeline({ text, storeDir });

    assert.equal(res.ok, true);
    assert.equal(res.failed_stage, null);
    assert.equal(res.stages.length, 5);
    assert.ok(res.stages.every((s) => s.status === 'completed'));

    // Verify Stage 2 Initial JSON kept unknowns strictly null before Python solved them
    assert.ok(res.initial_json);
    assert.equal(res.initial_json.givens.true_length.value, 80);
    assert.equal(res.initial_json.unknowns.front_view_length.value, null);
    assert.equal(res.initial_json.unknowns.dep.value, null);
    assert.equal(res.initial_json.validation.ready_for_render, false);

    // Verify Stage 4 Validated JSON numerical accuracy against analytical ground truth
    assert.ok(res.validated_json);
    assert.equal(res.validated_json.validation.solver_status, 'solved');
    assert.equal(res.validated_json.validation.ready_for_render, true);
    assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'front_view_length') ?? 0) - 80 * Math.cos(Math.PI / 4)) < 0.01);
    assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'top_view_length') ?? 0) - 80 * Math.cos(Math.PI / 6)) < 0.01);
    assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'dep') ?? 0) - 40) < 0.01);
    assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'end_z_hp') ?? 0) - 60) < 0.01);

    // Verify both .initial.json and .solved.json were persisted atomically
    assert.ok(fs.existsSync(path.join(storeDir, `${res.initial_json.problem_id}.initial.json`)));
    assert.ok(fs.existsSync(path.join(storeDir, `${res.initial_json.problem_id}.solved.json`)));

    // Verify Stage 5 SVG output labels and structure
    assert.ok(res.svg);
    assert.ok(res.svg.startsWith('<svg'));
    assert.ok(res.svg.includes('a′'));
    assert.ok(res.svg.includes('b′'));
    assert.ok(res.svg.includes('LINE AB'));
  } finally {
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('2. Full pipeline derives unknown angles and DEP from TL, FV, and TV (Line NM)', async () => {
  const storeDir = makeTempStoreDir();
  try {
    const text =
      'A line NM 75 mm long has its front view 60 mm long and top view 55 mm long. End N is 15 mm above HP and 20 mm in front of VP. Draw its projections.';
    const res = await runEngineeringDrawingPipeline({ text, storeDir });

    assert.equal(res.ok, true);
    assert.ok(res.initial_json);
    assert.equal(res.initial_json.unknowns.theta_hp.value, null);
    assert.equal(res.initial_json.unknowns.phi_vp.value, null);
    assert.equal(res.initial_json.unknowns.dep.value, null);

    assert.ok(res.validated_json);
    assert.equal(res.validated_json.unknowns.theta_hp.status, 'derived');
    assert.equal(res.validated_json.unknowns.phi_vp.status, 'derived');
    assert.equal(res.validated_json.unknowns.dep.status, 'derived');

    const expectedPhi = (Math.acos(60 / 75) * 180) / Math.PI;
    const expectedTheta = (Math.acos(55 / 75) * 180) / Math.PI;
    assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'phi_vp') ?? 0) - expectedPhi) < 0.05);
    assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'theta_hp') ?? 0) - expectedTheta) < 0.05);
    assert.ok(res.svg?.includes('n′'));
    assert.ok(res.svg?.includes('m′'));
  } finally {
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('3. Arbitrary endpoint names AB, NM, LK, JP propagate end-to-end into JSON and SVG', async () => {
  const cases: Array<{ pair: string; s: string; e: string }> = [
    { pair: 'AB', s: 'A', e: 'B' },
    { pair: 'NM', s: 'N', e: 'M' },
    { pair: 'LK', s: 'L', e: 'K' },
    { pair: 'JP', s: 'J', e: 'P' },
  ];

  for (const c of cases) {
    const text = `A line ${c.pair} 80 mm long is inclined at 30° to the HP and 45° to the VP. End ${c.s} is 20 mm above HP and 30 mm in front of VP. Draw its projections.`;
    const res = await runEngineeringDrawingPipeline({ text, persist: false });
    assert.equal(res.ok, true, `Expected ${c.pair} to solve cleanly`);
    assert.ok(res.validated_json);
    assert.equal(res.validated_json.geometry.entity_type, 'straight_line');
    assert.equal(res.validated_json.geometry.line_label, c.pair);
    assert.equal(res.validated_json.geometry.endpoints.start, c.s);
    assert.equal(res.validated_json.geometry.endpoints.end, c.e);
    assert.ok(res.svg?.includes(`${c.s.toLowerCase()}′`), `SVG missing ${c.s.toLowerCase()}′`);
    assert.ok(res.svg?.includes(`${c.e.toLowerCase()}′`), `SVG missing ${c.e.toLowerCase()}′`);
    assert.ok(res.svg?.includes(`LINE ${c.pair}`), `SVG missing LINE ${c.pair}`);
  }
});

test('4. Missing dimensions keep unknowns null and strictly block Stage 5 rendering', async () => {
  const text =
    'A line AB has its end A 20 mm above HP and 30 mm in front of VP. The line is inclined at 30° to HP. Draw its projections.';
  const res = await runEngineeringDrawingPipeline({ text, persist: false });

  assert.equal(res.ok, false);
  assert.ok(res.initial_json);
  assert.equal(res.initial_json.unknowns.true_length.value, null);
  assert.equal(res.initial_json.unknowns.phi_vp.value, null);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.validation.solver_status, 'underdetermined');
  assert.equal(res.validated_json.validation.ready_for_render, false);
  assert.equal(res.svg, null);

  // Verify Python solver diagnostic missing_requirements array propagates end-to-end
  assert.deepEqual(
    res.missing_requirements.map((r) => r.parameter),
    ['true_length', 'phi_vp']
  );
  assert.deepEqual(
    res.validated_json.validation.missing_requirements.map((r) => r.category),
    ['length', 'inclination']
  );
});

test('5. Ambiguous wording ("above or below HP" or "one of the planes") blocks rendering cleanly', async () => {
  const text1 =
    'A line AB 80 mm long is inclined at 30° to HP and 45° to VP. End A is 20 mm above or below HP and 30 mm in front of VP.';
  const res1 = await runEngineeringDrawingPipeline({ text: text1, persist: false });
  assert.equal(res1.ok, false);
  assert.equal(res1.svg, null);
  assert.ok(res1.validated_json?.validation.issues.some((i) => i.code === 'AMBIGUOUS_HP_SIDE'));

  const text2 =
    'A line AB 80 mm long is inclined at 30° to one of the planes. End A is 20 mm above HP and 30 mm in front of VP.';
  const res2 = await runEngineeringDrawingPipeline({ text: text2, persist: false });
  assert.equal(res2.ok, false);
  assert.equal(res2.svg, null);
  assert.ok(res2.validated_json?.validation.issues.some((i) => i.code === 'AMBIGUOUS_PLANE_REFERENCE'));
});

test('6. OCR misrecognition of mathematical symbols ("300 to HP", "75 1m") is flagged and never silently overwritten', async () => {
  const text =
    'A line AB 75 1m long is inclined at 300 to the HP and 45° to the VP. End A is 20 mm above HP and 30 mm in front of VP.';
  const readings = detectUncertainOcrReadings(text);
  assert.ok(readings.some((r) => r.raw_token.includes('300')));
  assert.ok(readings.some((r) => r.raw_token.includes('75 1m')));

  const res = await runEngineeringDrawingPipeline({ text, persist: false });
  assert.equal(res.ok, false);
  assert.equal(res.svg, null);
  assert.ok(res.validated_json);
  assert.equal(res.validated_json.validation.ready_for_render, false);
  assert.ok(res.validated_json.source.uncertain_readings.length >= 2);
});

test('7. Contradictory measurements (theta+phi > 90° and FV > TL) fail validation and block rendering', async () => {
  const resAngles = await runEngineeringDrawingPipeline({
    text: 'A line AB 80 mm long is inclined at 60° to the HP and 50° to the VP. End A is 20 mm above HP and 30 mm in front of VP.',
    persist: false,
  });
  assert.equal(resAngles.ok, false);
  assert.equal(resAngles.svg, null);
  assert.equal(resAngles.validated_json?.validation.solver_status, 'inconsistent');
  assert.ok(resAngles.validated_json?.validation.issues.some((i) => i.code === 'ANGLE_SUM_EXCEEDS_90'));

  const resFvGtTl = await runEngineeringDrawingPipeline({
    text: 'A line AB 80 mm long has front view 95 mm long and top view 60 mm long. End A is 20 mm above HP and 30 mm in front of VP.',
    persist: false,
  });
  assert.equal(resFvGtTl.ok, false);
  assert.equal(resFvGtTl.svg, null);
  assert.equal(resFvGtTl.validated_json?.validation.solver_status, 'inconsistent');
  assert.ok(resFvGtTl.validated_json?.validation.issues.some((i) => i.code === 'FV_EXCEEDS_TL'));
});

test('8. Underdetermined geometry (only true length given) is rejected cleanly', async () => {
  const res = await runEngineeringDrawingPipeline({
    text: 'A line AB 80 mm long. Draw its projections.',
    persist: false,
  });
  assert.equal(res.ok, false);
  assert.equal(res.svg, null);
  assert.equal(res.validated_json?.validation.solver_status, 'underdetermined');
  assert.equal(res.validated_json?.validation.ready_for_render, false);
  assert.deepEqual(
    res.missing_requirements.map((r) => r.parameter),
    ['theta_hp', 'phi_vp', 'start_z_hp', 'start_y_vp']
  );
  assert.deepEqual(
    res.validated_json?.validation.missing_requirements.map((r) => r.category),
    ['inclination', 'inclination', 'position', 'position']
  );
});

test('9. Unit conversion (cm, m -> mm) normalizes values while preserving original_value and original_unit', async () => {
  const text =
    'A line LK 8 cm long is inclined at 30° to the HP and 45° to the VP. End L is 0.02 m above HP and 3 cm in front of VP. Draw its projections.';
  const res = await runEngineeringDrawingPipeline({ text, persist: false });

  assert.equal(res.ok, true);
  assert.ok(res.initial_json);
  assert.equal(res.initial_json.givens.true_length.value, 80);
  assert.equal(res.initial_json.givens.true_length.original_value, 8);
  assert.equal(res.initial_json.givens.true_length.original_unit, 'cm');

  assert.equal(res.initial_json.givens.start_z_hp.value, 20);
  assert.equal(res.initial_json.givens.start_z_hp.original_value, 0.02);
  assert.equal(res.initial_json.givens.start_z_hp.original_unit, 'm');

  assert.equal(res.initial_json.givens.start_y_vp.value, 30);
  assert.equal(res.initial_json.givens.start_y_vp.original_value, 3);
  assert.equal(res.initial_json.givens.start_y_vp.original_unit, 'cm');

  assert.ok(res.validated_json);
  assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'dep') ?? 0) - 40) < 0.01);
  assert.ok(res.svg?.includes('l′'));
  assert.ok(res.svg?.includes('k′'));
});

test('10. Incorrect or malformed JSON is rejected cleanly without crashing or skipping validation', async () => {
  const badSchema = {
    schema_version: '9.9.9',
    problem_id: '../evil',
    givens: { true_length: 'eighty' },
  };
  const checked = validateCanonicalProblem(badSchema);
  assert.equal(checked.ok, false);

  const pipelineRes = await runEngineeringDrawingPipeline({
    editedInitialJson: badSchema,
    persist: false,
  });
  assert.equal(pipelineRes.ok, false);
  assert.equal(pipelineRes.failed_stage, 'stage_2_initial_json');
  assert.equal(pipelineRes.svg, null);
});

test('11. Stage 5 renderer gate blocks unvalidated JSON & Stage 1 reports unavailable GLM-OCR honestly', async () => {
  // 11a: Unvalidated Stage 2 initial JSON sent directly to Stage 5 MUST be refused
  const stage1 = await runStage1Ocr({
    text: 'A line AB 80 mm long is inclined at 30° to HP and 45° to VP. End A is 20 mm above HP and 30 mm in front of VP.',
  });
  assert.equal(stage1.ok, true);
  const stage2 = buildInitialProblemJson(stage1, { persist: false });
  assert.equal(stage2.ok, true);

  const blockedRender = runStage5SvgRenderer(stage2.problem);
  assert.equal(blockedRender.ok, false);
  assert.equal(blockedRender.stage, 'stage_5_render_svg');

  // 11b: Passing through Stage 3 Python + Stage 4 Validator unlocks Stage 5 cleanly
  const stage3 = await runStage3PythonSolver(stage2.problem);
  assert.equal(stage3.ok, true);
  const stage4 = updateAndValidateProblemJson(stage2.problem, stage3, { persist: false });
  assert.equal(stage4.ok, true);
  assert.equal(stage4.ready_for_render, true);
  const allowedRender = runStage5SvgRenderer(stage4.updated_problem);
  assert.equal(allowedRender.ok, true);
  assert.ok(allowedRender.svg.includes('<svg'));

  // 11c: Explicitly requesting GLM-OCR when OLLAMA_BASE_URL is unset reports clear failure without fabricating text
  const prevOllama = process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_BASE_URL;
  try {
    const failedOcr = await runStage1Ocr({
      imageBase64: 'data:image/png;base64,iVBORw0KGgo=',
      engine: 'glm-ocr',
    });
    assert.equal(failedOcr.ok, false);
    assert.ok(failedOcr.error.toLowerCase().includes('glm-ocr'));
    assert.ok(failedOcr.configuration_hint?.includes('OLLAMA_BASE_URL'));
  } finally {
    if (prevOllama !== undefined) process.env.OLLAMA_BASE_URL = prevOllama;
  }
});

test('12. Resuming from user-edited Stage 2 Initial JSON re-runs Python solver & updates SVG', async () => {
  const initialRun = await runEngineeringDrawingPipeline({
    text: 'A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. End A is 20 mm above HP and 30 mm in front of VP.',
    persist: false,
  });
  assert.equal(initialRun.ok, true);
  assert.ok(initialRun.initial_json);

  // User edits true_length from 80 -> 100 and renames endpoints AB -> NM
  const edited = JSON.parse(JSON.stringify(initialRun.initial_json));
  edited.givens.true_length.value = 100;
  edited.geometry.line_label = 'NM';
  edited.geometry.endpoints = { start: 'N', end: 'M' };

  const reSolved = await runEngineeringDrawingPipeline({
    editedInitialJson: edited,
    persist: false,
  });
  assert.equal(reSolved.ok, true);
  assert.ok(reSolved.validated_json);
  assert.ok(Math.abs((getMeasurementValue(reSolved.validated_json, 'dep') ?? 0) - 50) < 0.01);
  assert.ok(reSolved.svg?.includes('n′'));
  assert.ok(reSolved.svg?.includes('m′'));
  assert.ok(reSolved.svg?.includes('LINE NM'));
});

test('13. Spelled-out horizontal/vertical planes, "40mm length", "30 degree", and "end point P ... from" solve through all 5 stages', async () => {
  const text =
    'A straight line 40mm length is parallel to the horizontal plane and is inclined at 30 degree to the vertical plane. Its end point P is 10mm from the horizontal plane and 15mm from the vertical plane. Draw the projection of the line PQ.';
  const res = await runEngineeringDrawingPipeline({ text, persist: false });

  assert.equal(res.ok, true, `Expected full solve, got error: ${res.error}`);
  assert.equal(res.stages.length, 5);
  assert.ok(res.stages.every((s) => s.status === 'completed'));

  assert.ok(res.validated_json);
  assert.equal(res.validated_json.geometry.entity_type, 'straight_line');
  assert.equal(res.validated_json.geometry.line_label, 'PQ');
  assert.equal(getMeasurementValue(res.validated_json, 'true_length'), 40);
  assert.equal(getMeasurementValue(res.validated_json, 'theta_hp'), 0);
  assert.equal(getMeasurementValue(res.validated_json, 'phi_vp'), 30);
  assert.equal(getMeasurementValue(res.validated_json, 'start_z_hp'), 10);
  assert.equal(getMeasurementValue(res.validated_json, 'start_y_vp'), 15);
  assert.equal(getMeasurementValue(res.validated_json, 'end_z_hp'), 10);
  assert.equal(getMeasurementValue(res.validated_json, 'end_y_vp'), 35);
  assert.ok(Math.abs((getMeasurementValue(res.validated_json, 'front_view_length') ?? 0) - 40 * Math.cos(Math.PI / 6)) < 0.01);
  assert.equal(getMeasurementValue(res.validated_json, 'top_view_length'), 40);
  assert.ok(res.svg?.includes('LINE PQ'));
  assert.ok(res.svg?.includes('p′'));
  assert.ok(res.svg?.includes('q′'));
  assert.deepEqual(res.missing_requirements, []);
  assert.deepEqual(res.validated_json.validation.missing_requirements, []);
});
