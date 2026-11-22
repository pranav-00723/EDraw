/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  CANONICAL_SCHEMA_VERSION,
  STRAIGHT_LINE_PROPERTIES,
  createMeasurementField,
  validateCanonicalProblem,
  type CanonicalEngineeringProblem,
  type GeometryEntity,
  type MeasurementField,
  type UncertainReading,
} from '../../src/pipeline/schema.ts';
import { detectUncertainOcrReadings, type OcrExtractionSuccess } from './ocrService.ts';
import {
  interpretQuestionDeterministically,
  lightNormalizeProblemText,
  type SemanticInterpretationResult,
} from './semanticInterpreter.ts';

export { lightNormalizeProblemText };

const DEFAULT_PIPELINE_STORE_DIR = path.resolve(process.cwd(), '.edraw-data', 'pipeline');

export function generateSafeProblemId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `edraw_${ts}_${rand}`;
}

export function resolvePipelineFilePath(
  problemId: string,
  suffix: 'initial.json' | 'solved.json',
  storeDir: string = DEFAULT_PIPELINE_STORE_DIR
): string {
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(problemId)) {
    throw new Error('Invalid problem_id format.');
  }
  const baseDir = path.resolve(storeDir);
  const target = path.resolve(baseDir, `${problemId}.${suffix}`);
  if (!target.startsWith(baseDir + path.sep)) {
    throw new Error('Resolved path escapes pipeline storage directory.');
  }
  return target;
}

export function persistCanonicalJsonAtomically(
  problem: CanonicalEngineeringProblem,
  suffix: 'initial.json' | 'solved.json',
  storeDir: string = DEFAULT_PIPELINE_STORE_DIR
): string {
  const schemaCheck = validateCanonicalProblem(problem);
  if (!schemaCheck.ok) {
    throw new Error(`Refusing to persist schema-invalid JSON: ${schemaCheck.errors.join('; ')}`);
  }
  const targetPath = resolvePipelineFilePath(problem.problem_id, suffix, storeDir);
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(problem, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, targetPath);
  return targetPath;
}

export interface BuildInitialJsonResult {
  ok: true;
  stage: 'stage_2_initial_json';
  problem: CanonicalEngineeringProblem;
  persisted_path: string | null;
}

export interface BuildInitialJsonFailure {
  ok: false;
  stage: 'stage_2_initial_json';
  error: string;
  schema_errors?: string[];
}

export type Stage2Result = BuildInitialJsonResult | BuildInitialJsonFailure;

function buildGeometryAndUnknowns(semantic: SemanticInterpretationResult): {
  geometry: GeometryEntity;
  unknowns: Record<string, MeasurementField>;
  annotations: string[];
  solverId: string;
  rendererId: string;
} {
  const unknowns: Record<string, MeasurementField> = {};

  if (semantic.module.id === 'projection_of_straight_lines' && semantic.line_payload) {
    const lp = semantic.line_payload;
    for (const spec of STRAIGHT_LINE_PROPERTIES) {
      if (spec.property in semantic.givens) continue;
      unknowns[spec.property] = createMeasurementField({
        property: spec.property,
        value: null,
        unit: spec.unit,
        status: 'unknown',
        source_stage: 'stage_2_parser',
        epistemic_status: 'unresolved',
        reason: 'Not explicitly given in the source problem; pending deterministic Python solver.',
        validation_status: 'unvalidated',
      });
    }

    const sLow = lp.startChar.toLowerCase();
    const eLow = lp.endChar.toLowerCase();
    return {
      geometry: {
        entity_type: 'straight_line',
        line_label: lp.lineLabel,
        endpoints: { start: lp.startChar, end: lp.endChar },
        planes: ['HP', 'VP'],
        quadrant_hints: {
          start_hp: lp.startHp,
          start_vp: lp.startVp,
          end_hp: lp.endHp,
          end_vp: lp.endVp,
          branch_preference: lp.branchPreference,
        },
        solved_coordinates: null,
      },
      unknowns,
      annotations: [
        'XY reference line',
        `Front view ${sLow}′${eLow}′`,
        `Top view ${sLow}${eLow}`,
        'End projectors',
        'True length & inclinations',
      ],
      solverId: `solver:${semantic.module.id}`,
      rendererId: `renderer:${semantic.module.id}`,
    };
  }

  if (semantic.module.id === 'projection_of_points' && semantic.points_payload) {
    const pts = semantic.points_payload.points;
    const isSingle = pts.length === 1;

    for (const pt of pts) {
      const prefix = isSingle ? '' : `${pt.label}.`;
      const pointProps: Array<{ key: string; label: string }> = [
        { key: `${prefix}x_mm`, label: `X Position along XY (${pt.label})` },
        { key: `${prefix}y_mm`, label: `Signed Depth from VP (${pt.label})` },
        { key: `${prefix}z_mm`, label: `Signed Height from HP (${pt.label})` },
        { key: `${prefix}front_view_y`, label: `Front View Offset y_2d (${pt.label}′)` },
        { key: `${prefix}top_view_y`, label: `Top View Offset y_2d (${pt.label})` },
      ];
      for (const p of pointProps) {
        if (p.key in semantic.givens) continue;
        unknowns[p.key] = createMeasurementField({
          property: p.key,
          value: null,
          unit: 'mm',
          status: 'unknown',
          source_stage: 'stage_2_semantic_interpreter',
          epistemic_status: 'unresolved',
          reason: `Pending deterministic point solver for ${p.label}.`,
          validation_status: 'unvalidated',
        });
      }
    }

    return {
      geometry: {
        entity_type: 'point_set',
        points: pts,
        relative_relations: semantic.points_payload.relativeRelations,
        planes: ['HP', 'VP'],
        solved_points: null,
      },
      unknowns,
      annotations: [
        'XY reference line',
        ...pts.map((p) => `Point ${p.label}: ${p.label.toLowerCase()}′ (FV), ${p.label.toLowerCase()} (TV)`),
        'Vertical projector(s)',
      ],
      solverId: `solver:${semantic.module.id}`,
      rendererId: `renderer:${semantic.module.id}`,
    };
  }

  // Unsupported / Needs clarification modules — NEVER force into straight_line or point_set
  if (semantic.module.id === 'projection_of_planes') {
    return {
      geometry: {
        entity_type: 'plane',
        label: semantic.entities[0]?.label || 'Lamina',
        shape: semantic.entities[0]?.label || 'plane_lamina',
        planes: ['HP', 'VP'],
      },
      unknowns,
      annotations: ['Module registered (Projection of Planes) — solver not yet active'],
      solverId: `solver:${semantic.module.id}`,
      rendererId: `renderer:${semantic.module.id}`,
    };
  }

  if (
    semantic.module.id === 'projection_of_solids' ||
    semantic.module.id === 'sections_of_solids'
  ) {
    return {
      geometry: {
        entity_type: 'solid',
        label: semantic.entities[0]?.label || 'Solid',
        solid_type: semantic.unsupported_topic_label || semantic.module.name,
        planes: ['HP', 'VP'],
      },
      unknowns,
      annotations: [`Module registered (${semantic.module.name}) — solver not yet active`],
      solverId: `solver:${semantic.module.id}`,
      rendererId: `renderer:${semantic.module.id}`,
    };
  }

  return {
    geometry: {
      entity_type: 'general',
      topic: semantic.module.name,
      label: semantic.unsupported_topic_label || semantic.module.name,
      planes: ['HP', 'VP'],
    },
    unknowns,
    annotations: [`Topic: ${semantic.module.name}`],
    solverId: `solver:${semantic.module.id}`,
    rendererId: `renderer:${semantic.module.id}`,
  };
}

/**
 * Stage 2 Entry Point (Layer D): Build canonical initial JSON dynamically from semantic
 * interpretation with explicit givens and strictly null unknowns.
 * Never invents missing values or forces unsupported modules into straight-line defaults.
 */
export function buildInitialProblemJson(
  ocr: OcrExtractionSuccess,
  options?: {
    problemId?: string;
    persist?: boolean;
    storeDir?: string;
    semanticResult?: SemanticInterpretationResult;
  }
): Stage2Result {
  const rawText = ocr.raw_text;
  const problemId = options?.problemId || generateSafeProblemId();

  const uncertainReadings: UncertainReading[] =
    ocr.uncertain_readings.length > 0
      ? ocr.uncertain_readings
      : detectUncertainOcrReadings(rawText);

  const semantic =
    options?.semanticResult ||
    interpretQuestionDeterministically({
      raw_text: rawText,
      uncertain_readings: uncertainReadings,
    });

  const { geometry, unknowns, annotations, solverId, rendererId } = buildGeometryAndUnknowns(semantic);
  const blockedReason =
    semantic.module.id === 'unknown_module'
      ? 'Could not identify the Engineering Graphics module; user clarification required.'
      : semantic.module.implementation_status === 'unsupported'
      ? `Module "${semantic.module.name}" is classified as ${semantic.module.implementation_status}; automated geometric solving and SVG rendering are not enabled for this module yet.`
      : 'Initial JSON generated; awaiting Stage 3 Python geometry solver and Stage 4 validation.';

  const initialProblem: CanonicalEngineeringProblem = {
    schema_version: CANONICAL_SCHEMA_VERSION,
    problem_id: problemId,
    module: {
      id: semantic.module.id,
      name: semantic.module.name,
      implementation_status: semantic.module.implementation_status,
      confidence: semantic.module_confidence,
      selection_reason: semantic.selection_reason,
      unsupported_capabilities:
        semantic.module.implementation_status === 'unsupported'
          ? semantic.module.unsupported_problem_classes
          : [],
    },
    source: {
      input_type: ocr.input_type,
      ocr_engine: ocr.engine_used,
      raw_text: rawText,
      normalized_text: semantic.normalized_text,
      confidence: ocr.confidence,
      diagram_evidence: ocr.diagram_evidence ?? [],
      warnings: ocr.warnings,
      uncertain_readings: uncertainReadings,
      ambiguities: semantic.ambiguities_notes,
    },
    task: {
      domain: semantic.task_domain,
      projection_system: semantic.projection_system,
      requested_outputs: semantic.requested_outputs,
      description: semantic.normalized_text,
    },
    interpretation: {
      interpretation_method: semantic.interpretation_method,
      entities: semantic.entities,
      assumptions: semantic.assumptions,
      unresolved_questions: semantic.unresolved_questions,
      repair_notes: semantic.repair_notes,
    },
    geometry,
    givens: semantic.givens,
    unknowns,
    constraints: semantic.constraints,
    drawing_instructions: {
      ready_to_render: false,
      coordinate_system:
        semantic.projection_system === 'third_angle'
          ? 'third_angle_iso'
          : 'first_angle_bis_sp46',
      scale: null,
      views: ['front_view', 'top_view'],
      annotations,
      blocked_reason: blockedReason,
    },
    validation: {
      schema_valid: true,
      solver_status: 'unsolved',
      geometry_valid: false,
      ready_for_render: false,
      issues: semantic.issues,
      ambiguities: [],
      missing_requirements: [],
      checks: [],
    },
    derivation: [],
    execution: {
      solver_id: solverId,
      renderer_id: rendererId,
      visualization_config: {},
      generated_js_module: null,
      js_validation: { valid: false, errors: [] },
    },
  };

  const schemaCheck = validateCanonicalProblem(initialProblem);
  if (!schemaCheck.ok) {
    return {
      ok: false,
      stage: 'stage_2_initial_json',
      error: `Generated initial JSON failed schema validation: ${schemaCheck.errors.join('; ')}`,
      schema_errors: schemaCheck.errors,
    };
  }

  let persistedPath: string | null = null;
  if (options?.persist !== false) {
    persistedPath = persistCanonicalJsonAtomically(
      schemaCheck.data,
      'initial.json',
      options?.storeDir
    );
  }

  return {
    ok: true,
    stage: 'stage_2_initial_json',
    problem: schemaCheck.data,
    persisted_path: persistedPath,
  };
}
