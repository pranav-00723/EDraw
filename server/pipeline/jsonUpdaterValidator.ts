/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createMeasurementField,
  getMeasurementValue,
  validateCanonicalProblem,
  type CanonicalEngineeringProblem,
  type MeasurementField,
  type ValidationCheck,
  type ValidationIssue,
} from '../../src/pipeline/schema.ts';
import { persistCanonicalJsonAtomically } from './initialJsonBuilder.ts';
import type { PythonSolverOutput } from './pythonSolverBridge.ts';

const TOL_MM = 1e-2;
const TOL_DEG = 5e-2;
const TOL_TRIG = 1e-3;

export interface Stage4ValidationSuccess {
  ok: true;
  stage: 'stage_4_validate_json';
  updated_problem: CanonicalEngineeringProblem;
  persisted_path: string | null;
  ready_for_render: boolean;
}

export interface Stage4ValidationFailure {
  ok: false;
  stage: 'stage_4_validate_json';
  error: string;
  schema_errors?: string[];
}

export type Stage4Result = Stage4ValidationSuccess | Stage4ValidationFailure;

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Independent Stage 4 mathematical & geometric constraint verification.
 * Never marks a derived value as validated merely because Stage 3 completed.
 */
function runIndependentGeometricValidation(
  problem: CanonicalEngineeringProblem
): {
  checks: ValidationCheck[];
  issues: ValidationIssue[];
  fieldValid: Record<string, boolean>;
} {
  const checks: ValidationCheck[] = [];
  const issues: ValidationIssue[] = [];
  const fieldValid: Record<string, boolean> = {};

  if (problem.geometry.entity_type !== 'straight_line') {
    issues.push({
      code: 'UNSUPPORTED_ENTITY',
      stage: 'stage_4_validator',
      severity: 'error',
      field: 'geometry.entity_type',
      message: `Validator currently supports straight_line, got ${problem.geometry.entity_type}.`,
    });
    return { checks, issues, fieldValid };
  }

  const tl = getMeasurementValue(problem, 'true_length');
  const fv = getMeasurementValue(problem, 'front_view_length');
  const tv = getMeasurementValue(problem, 'top_view_length');
  const dep = getMeasurementValue(problem, 'dep');
  const theta = getMeasurementValue(problem, 'theta_hp');
  const phi = getMeasurementValue(problem, 'phi_vp');
  const z1 = getMeasurementValue(problem, 'start_z_hp');
  const y1 = getMeasurementValue(problem, 'start_y_vp');
  const z2 = getMeasurementValue(problem, 'end_z_hp');
  const y2 = getMeasurementValue(problem, 'end_y_vp');
  const alpha = getMeasurementValue(problem, 'alpha_fv');
  const beta = getMeasurementValue(problem, 'beta_tv');

  const mark = (prop: string, passed: boolean) => {
    if (fieldValid[prop] === false) return;
    fieldValid[prop] = passed;
  };

  // 1. Check physical bounds on lengths & angles
  if (tl !== null) {
    const ok = tl > 0;
    mark('true_length', ok);
    if (!ok) {
      issues.push({
        code: 'INVALID_TRUE_LENGTH',
        stage: 'stage_4_validator',
        severity: 'error',
        field: 'true_length',
        message: `True length must be > 0 mm (got ${tl}).`,
      });
    }
  }
  for (const [prop, val] of [
    ['front_view_length', fv],
    ['top_view_length', tv],
    ['dep', dep],
  ] as const) {
    if (val !== null) {
      const ok = val >= -1e-4;
      mark(prop, ok);
      if (!ok) {
        issues.push({
          code: 'NEGATIVE_LENGTH',
          stage: 'stage_4_validator',
          severity: 'error',
          field: prop,
          message: `Property ${prop} cannot be negative (${val} mm).`,
        });
      }
    }
  }

  for (const [prop, val] of [
    ['theta_hp', theta],
    ['phi_vp', phi],
    ['alpha_fv', alpha],
    ['beta_tv', beta],
  ] as const) {
    if (val !== null) {
      const ok = val >= -TOL_DEG && val <= 90 + TOL_DEG;
      mark(prop, ok);
      if (!ok) {
        issues.push({
          code: 'ANGLE_OUT_OF_RANGE',
          stage: 'stage_4_validator',
          severity: 'error',
          field: prop,
          message: `Angle ${prop} = ${val}° is outside valid [0°, 90°] bounds.`,
        });
      }
    }
  }

  // 2. Direction cosine check: sin²θ + sin²φ <= 1
  if (theta !== null && phi !== null) {
    const sin2 = Math.sin(deg2rad(theta)) ** 2 + Math.sin(deg2rad(phi)) ** 2;
    const passed = sin2 <= 1 + TOL_TRIG;
    checks.push({
      id: 'stage4_direction_cosines',
      name: 'Stage 4 Independent Direction Cosines (sin²θ + sin²φ ≤ 1)',
      passed,
      expected: '≤ 1.000',
      actual: sin2.toFixed(4),
      tolerance: TOL_TRIG,
    });
    mark('theta_hp', passed);
    mark('phi_vp', passed);
    if (!passed) {
      issues.push({
        code: 'DIRECTION_COSINES_VIOLATED',
        stage: 'stage_4_validator',
        severity: 'error',
        field: 'theta_hp',
        message: `Direction cosine invariant failed: sin²(${theta}°) + sin²(${phi}°) = ${sin2.toFixed(4)} > 1.`,
      });
    }
  }

  // 3. Projection length identities: FV = TL cos(phi), TV = TL cos(theta)
  if (tl !== null && phi !== null && fv !== null) {
    const expectedFv = tl * Math.cos(deg2rad(phi));
    const passed = Math.abs(expectedFv - fv) <= TOL_MM && fv <= tl + TOL_MM;
    checks.push({
      id: 'stage4_fv_cosine',
      name: 'Stage 4 Front View Identity (FV = TL·cos φ)',
      passed,
      expected: `${expectedFv.toFixed(4)} mm`,
      actual: `${fv.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('front_view_length', passed);
    if (!passed) {
      issues.push({
        code: 'FV_IDENTITY_MISMATCH',
        stage: 'stage_4_validator',
        severity: 'error',
        field: 'front_view_length',
        message: `FV (${fv} mm) does not match TL·cos(φ) (${expectedFv.toFixed(4)} mm).`,
      });
    }
  }

  if (tl !== null && theta !== null && tv !== null) {
    const expectedTv = tl * Math.cos(deg2rad(theta));
    const passed = Math.abs(expectedTv - tv) <= TOL_MM && tv <= tl + TOL_MM;
    checks.push({
      id: 'stage4_tv_cosine',
      name: 'Stage 4 Top View Identity (TV = TL·cos θ)',
      passed,
      expected: `${expectedTv.toFixed(4)} mm`,
      actual: `${tv.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('top_view_length', passed);
    if (!passed) {
      issues.push({
        code: 'TV_IDENTITY_MISMATCH',
        stage: 'stage_4_validator',
        severity: 'error',
        field: 'top_view_length',
        message: `TV (${tv} mm) does not match TL·cos(θ) (${expectedTv.toFixed(4)} mm).`,
      });
    }
  }

  // 4. 3D coordinate & projector checks
  if (tl !== null && dep !== null && z1 !== null && y1 !== null && z2 !== null && y2 !== null) {
    const dz = z2 - z1;
    const dy = y2 - y1;
    const tl3d = Math.sqrt(dep * dep + dy * dy + dz * dz);
    const fv2d = Math.hypot(dep, dz);
    const tv2d = Math.hypot(dep, dy);

    const tlOk = Math.abs(tl3d - tl) <= TOL_MM;
    checks.push({
      id: 'stage4_3d_euclidean',
      name: 'Stage 4 3D Euclidean Length (√(DEP² + Δy² + Δz²) = TL)',
      passed: tlOk,
      expected: `${tl.toFixed(4)} mm`,
      actual: `${tl3d.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('dep', tlOk);
    mark('start_z_hp', tlOk);
    mark('start_y_vp', tlOk);
    mark('end_z_hp', tlOk);
    mark('end_y_vp', tlOk);

    if (fv !== null) {
      const fvOk = Math.abs(fv2d - fv) <= TOL_MM;
      checks.push({
        id: 'stage4_fv_coords',
        name: 'Stage 4 Front View Coordinate Length (√(DEP² + Δz²) = FV)',
        passed: fvOk,
        expected: `${fv.toFixed(4)} mm`,
        actual: `${fv2d.toFixed(4)} mm`,
        tolerance: TOL_MM,
      });
      mark('front_view_length', fvOk);
    }

    if (tv !== null) {
      const tvOk = Math.abs(tv2d - tv) <= TOL_MM;
      checks.push({
        id: 'stage4_tv_coords',
        name: 'Stage 4 Top View Coordinate Length (√(DEP² + Δy²) = TV)',
        passed: tvOk,
        expected: `${tv.toFixed(4)} mm`,
        actual: `${tv2d.toFixed(4)} mm`,
        tolerance: TOL_MM,
      });
      mark('top_view_length', tvOk);
    }

    if (alpha !== null && (dep > 1e-4 || Math.abs(dz) > 1e-4)) {
      const expectedAlpha = (Math.atan2(Math.abs(dz), dep) * 180) / Math.PI;
      const alphaOk = Math.abs(expectedAlpha - alpha) <= TOL_DEG;
      checks.push({
        id: 'stage4_alpha_apparent',
        name: 'Stage 4 Apparent FV Angle (α = atan2(|Δz|, DEP))',
        passed: alphaOk,
        expected: `${expectedAlpha.toFixed(2)}°`,
        actual: `${alpha.toFixed(2)}°`,
        tolerance: TOL_DEG,
      });
      mark('alpha_fv', alphaOk);
    }

    if (beta !== null && (dep > 1e-4 || Math.abs(dy) > 1e-4)) {
      const expectedBeta = (Math.atan2(Math.abs(dy), dep) * 180) / Math.PI;
      const betaOk = Math.abs(expectedBeta - beta) <= TOL_DEG;
      checks.push({
        id: 'stage4_beta_apparent',
        name: 'Stage 4 Apparent TV Angle (β = atan2(|Δy|, DEP))',
        passed: betaOk,
        expected: `${expectedBeta.toFixed(2)}°`,
        actual: `${beta.toFixed(2)}°`,
        tolerance: TOL_DEG,
      });
      mark('beta_tv', betaOk);
    }
  }

  // 5. Coordinate object alignment check
  const coords = problem.geometry.solved_coordinates;
  if (coords) {
    const startAligned = Math.abs(coords.front_view.start.x - coords.top_view.start.x) <= 1e-4;
    const endAligned = Math.abs(coords.front_view.end.x - coords.top_view.end.x) <= 1e-4;
    const aligned = startAligned && endAligned;
    checks.push({
      id: 'stage4_projector_alignment',
      name: 'Stage 4 Vertical Projector Alignment (Start & End)',
      passed: aligned,
      expected: 'x_start_FV = x_start_TV and x_end_FV = x_end_TV',
      actual: aligned ? 'Aligned' : 'Misaligned',
      tolerance: 1e-4,
    });
    if (!aligned) {
      issues.push({
        code: 'PROJECTOR_MISALIGNED',
        stage: 'stage_4_validator',
        severity: 'error',
        field: 'geometry.solved_coordinates',
        message: 'Solved front view and top view endpoints do not share identical vertical projectors.',
      });
    }
  }

  return { checks, issues, fieldValid };
}

/**
 * Stage 4 Entry Point: Update the existing canonical JSON with validated derived values
 * without overwriting explicit givens, and safely persist via atomic write.
 */
export function updateAndValidateProblemJson(
  initialProblem: CanonicalEngineeringProblem,
  solverOutput: PythonSolverOutput,
  options?: {
    persist?: boolean;
    storeDir?: string;
  }
): Stage4Result {
  // Verify input schema first so we never mutate/persist malformed objects
  const initialCheck = validateCanonicalProblem(initialProblem);
  if (!initialCheck.ok) {
    return {
      ok: false,
      stage: 'stage_4_validate_json',
      error: `Initial JSON failed schema validation before Stage 4 update: ${initialCheck.errors.join('; ')}`,
      schema_errors: initialCheck.errors,
    };
  }

  // Deep clone to preserve immutability and prevent partial overwrites on error
  const updated: CanonicalEngineeringProblem = structuredClone(initialCheck.data);

  // Merge derived values strictly into `unknowns` — NEVER overwrite `givens`
  const nextUnknowns: Record<string, MeasurementField> = {};
  for (const [prop, existingField] of Object.entries(updated.unknowns)) {
    const derived = solverOutput.derived_values[prop];
    if (
      solverOutput.solver_status !== 'inconsistent' &&
      derived &&
      typeof derived.value === 'number' &&
      Number.isFinite(derived.value)
    ) {
      nextUnknowns[prop] = createMeasurementField({
        property: prop,
        value: derived.value,
        unit: derived.unit,
        status: 'derived',
        source_stage: 'stage_3_python_solver',
        dependencies: derived.dependencies,
        formula: derived.formula,
        reason: null,
        validation_status: 'unvalidated',
      });
    } else {
      const unresolvedReason =
        solverOutput.unresolved_unknowns[prop] ||
        existingField.provenance.reason ||
        'Could not be uniquely determined from available constraints.';
      const isAmbiguousProp = solverOutput.ambiguities.some((a) => a.property === prop);
      nextUnknowns[prop] = {
        ...existingField,
        value: null,
        status:
          solverOutput.solver_status === 'inconsistent'
            ? 'inconsistent'
            : isAmbiguousProp
            ? 'ambiguous'
            : 'unknown',
        provenance: {
          ...existingField.provenance,
          reason: unresolvedReason,
        },
        validation_status: solverOutput.solver_status === 'inconsistent' ? 'failed' : 'unvalidated',
      };
    }
  }
  updated.unknowns = nextUnknowns;

  // Attach solved coordinates ONLY if solver status is 'solved'
  if (updated.geometry.entity_type === 'straight_line') {
    updated.geometry.solved_coordinates =
      solverOutput.solver_status === 'solved' ? solverOutput.solved_coordinates : null;
  }

  // Run independent Stage 4 mathematical & geometric checks
  const independent = runIndependentGeometricValidation(updated);

  // Merge parser issues + solver issues + validator issues (deduplicated by code+message)
  const seenIssueKeys = new Set<string>();
  const mergedIssues: ValidationIssue[] = [];
  for (const issue of [
    ...updated.validation.issues,
    ...solverOutput.issues,
    ...independent.issues,
  ]) {
    const key = `${issue.code}|${issue.field || ''}|${issue.message}`;
    if (!seenIssueKeys.has(key)) {
      seenIssueKeys.add(key);
      mergedIssues.push(issue);
    }
  }

  const allChecks = [...solverOutput.checks, ...independent.checks];
  const hasBlockingError =
    mergedIssues.some((i) => i.severity === 'error') ||
    allChecks.some((c) => !c.passed) ||
    updated.source.uncertain_readings.some((u) => u.severity === 'blocking');

  // Update per-field validation_status ONLY after independent Stage 4 checks pass
  for (const [prop, field] of Object.entries(updated.givens)) {
    const passed = independent.fieldValid[prop];
    field.validation_status =
      passed === false || solverOutput.solver_status === 'inconsistent'
        ? 'failed'
        : passed === true
        ? 'validated'
        : hasBlockingError
        ? 'failed'
        : 'validated';
  }
  for (const [prop, field] of Object.entries(updated.unknowns)) {
    if (field.status !== 'derived' || field.value === null) {
      field.validation_status =
        field.status === 'inconsistent' ? 'failed' : 'unvalidated';
      continue;
    }
    const passed = independent.fieldValid[prop];
    if (passed === false || hasBlockingError) {
      field.validation_status = 'failed';
    } else if (passed === true) {
      field.validation_status = 'validated';
    } else {
      field.validation_status = 'unvalidated';
    }
  }

  const finalSolverStatus =
    solverOutput.solver_status === 'solved' && hasBlockingError
      ? 'inconsistent'
      : solverOutput.solver_status;

  const hasSolvedCoords =
    updated.geometry.entity_type === 'straight_line' && updated.geometry.solved_coordinates !== null;

  const geometryValid =
    finalSolverStatus === 'solved' && !hasBlockingError && allChecks.length > 0 && hasSolvedCoords;

  // If independent Stage 4 checks failed, revoke coordinates and block rendering
  if (!geometryValid && updated.geometry.entity_type === 'straight_line') {
    updated.geometry.solved_coordinates = null;
  }

  let blockedReason: string | null = null;
  if (!geometryValid) {
    if (finalSolverStatus === 'inconsistent') {
      blockedReason =
        mergedIssues.find((i) => i.severity === 'error')?.message ||
        'Contradictory geometric constraints detected; sketch generation blocked.';
    } else if (finalSolverStatus === 'ambiguous') {
      blockedReason =
        solverOutput.ambiguities[0]?.reason ||
        mergedIssues.find((i) => i.severity === 'error')?.message ||
        'Ambiguous geometry or uncertain OCR symbol; resolve before rendering.';
    } else if (finalSolverStatus === 'underdetermined') {
      blockedReason =
        mergedIssues.find((i) => i.code === 'UNDERDETERMINED_SYSTEM')?.message ||
        'Underdetermined geometry: additional independent measurements are required before rendering.';
    } else {
      blockedReason = 'Geometry validation did not pass; rendering blocked.';
    }
  }

  updated.validation = {
    schema_valid: false, // will be set true after final Zod validation below
    solver_status: finalSolverStatus,
    geometry_valid: geometryValid,
    ready_for_render: geometryValid,
    issues: mergedIssues,
    ambiguities: solverOutput.ambiguities,
    missing_requirements:
      finalSolverStatus === 'underdetermined' ? solverOutput.missing_requirements : [],
    checks: allChecks,
  };

  updated.drawing_instructions = {
    ...updated.drawing_instructions,
    ready_to_render: geometryValid,
    blocked_reason: blockedReason,
  };

  // Validate updated JSON against canonical Zod schema BEFORE persisting
  const finalSchemaCheck = validateCanonicalProblem({
    ...updated,
    validation: {
      ...updated.validation,
      schema_valid: true,
    },
  });

  if (!finalSchemaCheck.ok) {
    return {
      ok: false,
      stage: 'stage_4_validate_json',
      error: `Updated JSON failed canonical schema validation: ${finalSchemaCheck.errors.join('; ')}`,
      schema_errors: finalSchemaCheck.errors,
    };
  }

  let persistedPath: string | null = null;
  if (options?.persist !== false) {
    persistedPath = persistCanonicalJsonAtomically(
      finalSchemaCheck.data,
      'solved.json',
      options?.storeDir
    );
  }

  return {
    ok: true,
    stage: 'stage_4_validate_json',
    updated_problem: finalSchemaCheck.data,
    persisted_path: persistedPath,
    ready_for_render: finalSchemaCheck.data.validation.ready_for_render,
  };
}
