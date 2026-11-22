/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  validateCanonicalProblem,
  type CanonicalEngineeringProblem,
  type MissingRequirement,
  type PipelineStageTrace,
} from '../../src/pipeline/schema.ts';
import type { LineProblemInput } from '../../src/types/lines.ts';
import {
  getOcrCapabilities,
  runStage1Ocr,
  type OcrCapabilities,
  type OcrEnginePreference,
} from './ocrService.ts';
import { buildInitialProblemJson, persistCanonicalJsonAtomically } from './initialJsonBuilder.ts';
import {
  checkPythonSolverCapability,
  runStage3PythonSolver,
} from './pythonSolverBridge.ts';
import { updateAndValidateProblemJson } from './jsonUpdaterValidator.ts';
import {
  runStage5SvgRenderer,
  type DeterministicDrawingGeometry,
} from './svgRenderer.ts';

export interface FullPipelineResponse {
  ok: boolean;
  failed_stage: string | null;
  error: string | null;
  configuration_hint?: string;
  stages: PipelineStageTrace[];
  raw_ocr_text: string | null;
  ocr_engine_used: string | null;
  initial_json: CanonicalEngineeringProblem | null;
  validated_json: CanonicalEngineeringProblem | null;
  missing_requirements: MissingRequirement[];
  svg: string | null;
  drawing_geometry: DeterministicDrawingGeometry | null;
  line_input: LineProblemInput | null;
}

export interface PipelineCapabilities {
  python_solver: {
    available: boolean;
    python_bin: string;
    script_exists: boolean;
    version?: string;
    error?: string;
  };
  ocr: OcrCapabilities;
}

export async function getPipelineCapabilities(): Promise<PipelineCapabilities> {
  const python_solver = await checkPythonSolverCapability();
  const ocr = getOcrCapabilities();
  return { python_solver, ocr };
}

/**
 * Executes the strict 5-stage Engineering Drawing pipeline:
 * Stage 1 (OCR) -> Stage 2 (Initial JSON) -> Stage 3 (Python Solver) -> Stage 4 (Update & Validate) -> Stage 5 (SVG Render)
 *
 * Also supports resuming strictly at Stage 3 from a user-edited canonical initial JSON
 * (never skipping Stage 3 Python solving or Stage 4 validation).
 */
export async function runEngineeringDrawingPipeline(params: {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  ocrEngine?: OcrEnginePreference;
  editedInitialJson?: unknown;
  isDark?: boolean;
  persist?: boolean;
  storeDir?: string;
  fetchImpl?: typeof fetch;
}): Promise<FullPipelineResponse> {
  const stages: PipelineStageTrace[] = [];
  let initialJson: CanonicalEngineeringProblem | null = null;
  let rawOcrText: string | null = null;
  let ocrEngineUsed: string | null = null;

  // Path A: Resuming from user-edited canonical initial JSON (validates schema first, then runs Stages 3 -> 4 -> 5)
  if (params.editedInitialJson !== undefined) {
    const t2Start = Date.now();
    const checked = validateCanonicalProblem(params.editedInitialJson);
    if (!checked.ok) {
      stages.push({
        stage: 'stage_2_initial_json',
        label: 'Stage 2 · Initial Structured JSON',
        status: 'failed',
        duration_ms: Date.now() - t2Start,
        summary: 'Edited JSON failed canonical schema validation.',
        error: checked.errors.join('; '),
      });
      return {
        ok: false,
        failed_stage: 'stage_2_initial_json',
        error: `Edited JSON failed schema validation: ${checked.errors.join('; ')}`,
        stages,
        raw_ocr_text: null,
        ocr_engine_used: null,
        initial_json: null,
        validated_json: null,
        missing_requirements: [],
        svg: null,
        drawing_geometry: null,
        line_input: null,
      };
    }

    initialJson = checked.data;
    rawOcrText = initialJson.source.raw_text;
    ocrEngineUsed = initialJson.source.ocr_engine;

    // Reset unknowns & validation status cleanly before re-solving in Python
    initialJson = {
      ...initialJson,
      geometry:
        initialJson.geometry.entity_type === 'straight_line'
          ? { ...initialJson.geometry, solved_coordinates: null }
          : initialJson.geometry,
      validation: {
        ...initialJson.validation,
        solver_status: 'unsolved',
        geometry_valid: false,
        ready_for_render: false,
        issues: initialJson.validation.issues.filter((i) => i.stage === 'stage_1_ocr' || i.stage === 'stage_2_parser'),
        ambiguities: [],
        missing_requirements: [],
        checks: [],
      },
      drawing_instructions: {
        ...initialJson.drawing_instructions,
        ready_to_render: false,
        blocked_reason: 'Pending Stage 3 Python solver.',
      },
    };

    if (params.persist !== false) {
      persistCanonicalJsonAtomically(initialJson, 'initial.json', params.storeDir);
    }

    stages.push(
      {
        stage: 'stage_1_ocr',
        label: 'Stage 1 · OCR Text Extraction',
        status: 'completed',
        duration_ms: 0,
        summary: `Reused source text (${ocrEngineUsed}).`,
      },
      {
        stage: 'stage_2_initial_json',
        label: 'Stage 2 · Initial Structured JSON',
        status: 'completed',
        duration_ms: Date.now() - t2Start,
        summary: `Validated user-edited canonical JSON (${Object.keys(initialJson.givens).length} givens, ${Object.keys(initialJson.unknowns).length} unknowns).`,
      }
    );
  } else {
    // Path B: Full run starting at Stage 1 (OCR) -> Stage 2 (Initial JSON)
    const t1Start = Date.now();
    const ocrResult = await runStage1Ocr({
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      text: params.text,
      engine: params.ocrEngine,
      fetchImpl: params.fetchImpl,
    });

    if (!ocrResult.ok) {
      stages.push({
        stage: 'stage_1_ocr',
        label: 'Stage 1 · OCR Text Extraction',
        status: 'failed',
        duration_ms: Date.now() - t1Start,
        summary: 'OCR extraction failed.',
        error: ocrResult.error,
      });
      return {
        ok: false,
        failed_stage: 'stage_1_ocr',
        error: ocrResult.error,
        configuration_hint: ocrResult.configuration_hint,
        stages,
        raw_ocr_text: null,
        ocr_engine_used: null,
        initial_json: null,
        validated_json: null,
        missing_requirements: [],
        svg: null,
        drawing_geometry: null,
        line_input: null,
      };
    }

    rawOcrText = ocrResult.raw_text;
    ocrEngineUsed = ocrResult.engine_used;
    stages.push({
      stage: 'stage_1_ocr',
      label: 'Stage 1 · OCR Text Extraction',
      status: 'completed',
      duration_ms: Date.now() - t1Start,
      summary: `Extracted ${ocrResult.raw_text.length} chars via ${ocrResult.engine_used}${
        ocrResult.uncertain_readings.length > 0
          ? ` (${ocrResult.uncertain_readings.length} uncertain reading flagged)`
          : ''
      }.`,
    });

    const t2Start = Date.now();
    const stage2 = buildInitialProblemJson(ocrResult, {
      persist: params.persist,
      storeDir: params.storeDir,
    });

    if (!stage2.ok) {
      stages.push({
        stage: 'stage_2_initial_json',
        label: 'Stage 2 · Initial Structured JSON',
        status: 'failed',
        duration_ms: Date.now() - t2Start,
        summary: 'Initial JSON generation failed.',
        error: stage2.error,
      });
      return {
        ok: false,
        failed_stage: 'stage_2_initial_json',
        error: stage2.error,
        stages,
        raw_ocr_text: rawOcrText,
        ocr_engine_used: ocrEngineUsed,
        initial_json: null,
        validated_json: null,
        missing_requirements: [],
        svg: null,
        drawing_geometry: null,
        line_input: null,
      };
    }

    initialJson = stage2.problem;
    stages.push({
      stage: 'stage_2_initial_json',
      label: 'Stage 2 · Initial Structured JSON',
      status: 'completed',
      duration_ms: Date.now() - t2Start,
      summary: `Built schema v${initialJson.schema_version} (${Object.keys(initialJson.givens).length} givens, ${Object.keys(initialJson.unknowns).length} unknowns = null).`,
    });
  }

  // STAGE 3: Deterministic Python Geometry Solver
  const t3Start = Date.now();
  const stage3 = await runStage3PythonSolver(initialJson);

  if (!stage3.ok) {
    stages.push({
      stage: 'stage_3_python_solver',
      label: 'Stage 3 · Python Geometry Solver',
      status: 'failed',
      duration_ms: Date.now() - t3Start,
      summary: 'Python geometry solver runtime error.',
      error: stage3.error,
    });
    return {
      ok: false,
      failed_stage: 'stage_3_python_solver',
      error: stage3.error,
      stages,
      raw_ocr_text: rawOcrText,
      ocr_engine_used: ocrEngineUsed,
      initial_json: initialJson,
      validated_json: null,
      missing_requirements: [],
      svg: null,
      drawing_geometry: null,
      line_input: null,
    };
  }

  const derivedCount = Object.keys(stage3.derived_values).length;
  stages.push({
    stage: 'stage_3_python_solver',
    label: 'Stage 3 · Python Geometry Solver',
    status: stage3.solver_status === 'solved' ? 'completed' : 'blocked',
    duration_ms: Date.now() - t3Start,
    summary: `Python solver status: ${stage3.solver_status} (${derivedCount} quantities derived).`,
    ...(stage3.solver_status !== 'solved'
      ? { error: stage3.issues[0]?.message || stage3.ambiguities[0]?.reason || null }
      : {}),
  });

  // STAGE 4: Update & Independently Validate Existing JSON
  const t4Start = Date.now();
  const stage4 = updateAndValidateProblemJson(initialJson, stage3, {
    persist: params.persist,
    storeDir: params.storeDir,
  });

  if (!stage4.ok) {
    stages.push({
      stage: 'stage_4_validate_json',
      label: 'Stage 4 · Update & Validate JSON',
      status: 'failed',
      duration_ms: Date.now() - t4Start,
      summary: 'Updated JSON failed schema validation.',
      error: stage4.error,
    });
    return {
      ok: false,
      failed_stage: 'stage_4_validate_json',
      error: stage4.error,
      stages,
      raw_ocr_text: rawOcrText,
      ocr_engine_used: ocrEngineUsed,
      initial_json: initialJson,
      validated_json: null,
      missing_requirements: [],
      svg: null,
      drawing_geometry: null,
      line_input: null,
    };
  }

  const validatedJson = stage4.updated_problem;
  const passedChecks = validatedJson.validation.checks.filter((c) => c.passed).length;
  const totalChecks = validatedJson.validation.checks.length;

  stages.push({
    stage: 'stage_4_validate_json',
    label: 'Stage 4 · Update & Validate JSON',
    status: stage4.ready_for_render ? 'completed' : 'blocked',
    duration_ms: Date.now() - t4Start,
    summary: stage4.ready_for_render
      ? `Validated (${passedChecks}/${totalChecks} geometric checks passed).`
      : `Blocked (${validatedJson.validation.solver_status}): ${validatedJson.drawing_instructions.blocked_reason || 'Validation failed.'}`,
    ...(stage4.ready_for_render ? {} : { error: validatedJson.drawing_instructions.blocked_reason }),
  });

  // STAGE 5: Deterministic Geometry Engine & SVG Renderer (strictly gated on Stage 4)
  const t5Start = Date.now();
  const stage5 = runStage5SvgRenderer(validatedJson, { isDark: params.isDark });

  if (!stage5.ok) {
    stages.push({
      stage: 'stage_5_render_svg',
      label: 'Stage 5 · Geometry Engine & SVG',
      status: 'blocked',
      duration_ms: Date.now() - t5Start,
      summary: 'Drawing generation blocked until problem is valid and uniquely determined.',
      error: stage5.error,
    });
    return {
      ok: false,
      failed_stage: 'stage_5_render_svg',
      error: stage5.error,
      stages,
      raw_ocr_text: rawOcrText,
      ocr_engine_used: ocrEngineUsed,
      initial_json: initialJson,
      validated_json: validatedJson,
      missing_requirements: validatedJson.validation.missing_requirements,
      svg: null,
      drawing_geometry: null,
      line_input: null,
    };
  }

  stages.push({
    stage: 'stage_5_render_svg',
    label: 'Stage 5 · Geometry Engine & SVG',
    status: 'completed',
    duration_ms: Date.now() - t5Start,
    summary: `Generated deterministic BIS SP 46 SVG for Line ${stage5.geometry.lineLabel} (${Number(
      stage5.geometry.scale.toFixed(2)
    )} px/mm).`,
  });

  return {
    ok: true,
    failed_stage: null,
    error: null,
    stages,
    raw_ocr_text: rawOcrText,
    ocr_engine_used: ocrEngineUsed,
    initial_json: initialJson,
    validated_json: validatedJson,
    missing_requirements: validatedJson.validation.missing_requirements,
    svg: stage5.svg,
    drawing_geometry: stage5.geometry,
    line_input: stage5.lineInput,
  };
}
