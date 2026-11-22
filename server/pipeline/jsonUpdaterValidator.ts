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

function expectedPointQuadrantCode(y: number, z: number): string {
  const onHp = Math.abs(z) <= 1e-3;
  const onVp = Math.abs(y) <= 1e-3;
  if (onHp && onVp) return 'ON_BOTH_XY';
  if (onHp) return y > 0 ? 'ON_HP_IN_FRONT' : 'ON_HP_BEHIND';
  if (onVp) return z > 0 ? 'ON_VP_ABOVE' : 'ON_VP_BELOW';
  if (z > 0 && y > 0) return 'FIRST';
  if (z > 0 && y < 0) return 'SECOND';
  if (z < 0 && y < 0) return 'THIRD';
  return 'FOURTH';
}

function runIndependentPointSetValidation(
  problem: CanonicalEngineeringProblem
): {
  checks: ValidationCheck[];
  issues: ValidationIssue[];
  fieldValid: Record<string, boolean>;
} {
  const checks: ValidationCheck[] = [];
  const issues: ValidationIssue[] = [];
  const fieldValid: Record<string, boolean> = {};

  if (problem.geometry.entity_type !== 'point_set') {
    return { checks, issues, fieldValid };
  }

  const solvedPoints = problem.geometry.solved_points || [];
  const isSingle = problem.geometry.points.length === 1;
  const solvedMap = new Map(solvedPoints.map((p) => [p.label, p]));

  const mark = (prop: string, passed: boolean) => {
    if (fieldValid[prop] === false) return;
    fieldValid[prop] = passed;
  };

  for (const sp of solvedPoints) {
    if (sp.status !== 'solved') continue;
    if (sp.y_mm === null || sp.z_mm === null || sp.front_view_y === null || sp.top_view_y === null) {
      issues.push({
        code: 'INCOMPLETE_SOLVED_POINT',
        stage: 'stage_4_validator',
        severity: 'error',
        field: sp.label,
        message: `Solved point ${sp.label} is missing numeric coordinates.`,
      });
      continue;
    }

    const prefix = isSingle ? '' : `${sp.label}.`;
    const fvOk = Math.abs(sp.front_view_y - sp.z_mm) <= 1e-3;
    const tvOk = Math.abs(sp.top_view_y + sp.y_mm) <= 1e-3;
    const expectedQuad = expectedPointQuadrantCode(sp.y_mm, sp.z_mm);
    const quadOk = sp.quadrant === expectedQuad;

    checks.push(
      {
        id: `stage4_point_fv_${sp.label}`,
        name: `Stage 4 Point ${sp.label} Front View (fv_y = z)`,
        passed: fvOk,
        expected: `${sp.z_mm.toFixed(4)} mm`,
        actual: `${sp.front_view_y.toFixed(4)} mm`,
        tolerance: 1e-3,
      },
      {
        id: `stage4_point_tv_${sp.label}`,
        name: `Stage 4 Point ${sp.label} Top View (tv_y = -y)`,
        passed: tvOk,
        expected: `${(-sp.y_mm).toFixed(4)} mm`,
        actual: `${sp.top_view_y.toFixed(4)} mm`,
        tolerance: 1e-3,
      },
      {
        id: `stage4_point_quadrant_${sp.label}`,
        name: `Stage 4 Point ${sp.label} Quadrant Classification`,
        passed: quadOk,
        expected: expectedQuad,
        actual: sp.quadrant || 'null',
        tolerance: null,
      }
    );

    mark(`${prefix}z_mm`, fvOk && quadOk);
    mark(`${prefix}front_view_y`, fvOk);
    mark(`${prefix}y_mm`, tvOk && quadOk);
    mark(`${prefix}top_view_y`, tvOk);
    if (sp.x_mm !== null) mark(`${prefix}x_mm`, true);

    if (!fvOk || !tvOk || !quadOk) {
      issues.push({
        code: 'POINT_PROJECTION_CHECK_FAILED',
        stage: 'stage_4_validator',
        severity: 'error',
        field: sp.label,
        message: `Point ${sp.label} failed independent projection or quadrant verification.`,
      });
    }
  }

  for (const rel of problem.geometry.relative_relations) {
    const subj = solvedMap.get(rel.subject);
    const ref = solvedMap.get(rel.reference);
    if (!subj || !ref || subj.status !== 'solved' || ref.status !== 'solved') continue;
    const key = rel.axis === 'x' ? 'x_mm' : rel.axis === 'y' ? 'y_mm' : 'z_mm';
    const sv = subj[key];
    const rv = ref[key];
    if (sv === null || rv === null) continue;
    const actualDelta = sv - rv;
    const ok = Math.abs(actualDelta - rel.delta_mm) <= TOL_MM;
    checks.push({
      id: `stage4_point_rel_${rel.id}`,
      name: `Stage 4 Relative Offset (${rel.subject}.${rel.axis} - ${rel.reference}.${rel.axis})`,
      passed: ok,
      expected: `${rel.delta_mm.toFixed(4)} mm`,
      actual: `${actualDelta.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    if (!ok) {
      issues.push({
        code: 'RELATIVE_OFFSET_VIOLATION',
        stage: 'stage_4_validator',
        severity: 'error',
        field: `${rel.subject}.${key}`,
        message: `Relative offset ${rel.subject}.${rel.axis} - ${rel.reference}.${rel.axis} = ${actualDelta.toFixed(2)} mm != ${rel.delta_mm} mm.`,
      });
    }
  }

  return { checks, issues, fieldValid };
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
  if (problem.geometry.entity_type === 'point_set') {
    return runIndependentPointSetValidation(problem);
  }

  const checks: ValidationCheck[] = [];
  const issues: ValidationIssue[] = [];
  const fieldValid: Record<string, boolean> = {};

  if (problem.geometry.entity_type !== 'straight_line') {
    return { checks, issues, fieldValid };
  }

  const tl = getMeasurementValue(problem, 'true_length');
  const fv = getMeasurementValue(problem, 'front_view_length');
  const tv = getMeasurementValue(problem, 'top_view_length');
  const dep = getMeasurementValue(problem, 'dep');
  const absDz = getMeasurementValue(problem, 'abs_delta_z');
  const absDy = getMeasurementValue(problem, 'abs_delta_y');
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
    ['abs_delta_z', absDz],
    ['abs_delta_y', absDy],
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

  // Partial right-triangle validation checks (critical for partial FV + alpha or TV + beta problems)
  if (fv !== null && alpha !== null && dep !== null) {
    const expectedDep = fv * Math.cos(deg2rad(alpha));
    const ok = Math.abs(expectedDep - dep) <= TOL_MM;
    checks.push({
      id: 'stage4_fv_alpha_dep',
      name: 'Stage 4 Front View Cos Identity (DEP = FV·cos α)',
      passed: ok,
      expected: `${expectedDep.toFixed(4)} mm`,
      actual: `${dep.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('dep', ok);
    mark('front_view_length', ok);
    mark('alpha_fv', ok);
  }
  if (fv !== null && alpha !== null && absDz !== null) {
    const expectedDz = fv * Math.sin(deg2rad(alpha));
    const ok = Math.abs(expectedDz - absDz) <= TOL_MM;
    checks.push({
      id: 'stage4_fv_alpha_dz',
      name: 'Stage 4 Front View Sin Identity (|Δz| = FV·sin α)',
      passed: ok,
      expected: `${expectedDz.toFixed(4)} mm`,
      actual: `${absDz.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('abs_delta_z', ok);
    mark('front_view_length', ok);
    mark('alpha_fv', ok);
  }
  if (tv !== null && beta !== null && dep !== null) {
    const expectedDep = tv * Math.cos(deg2rad(beta));
    const ok = Math.abs(expectedDep - dep) <= TOL_MM;
    checks.push({
      id: 'stage4_tv_beta_dep',
      name: 'Stage 4 Top View Cos Identity (DEP = TV·cos β)',
      passed: ok,
      expected: `${expectedDep.toFixed(4)} mm`,
      actual: `${dep.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('dep', ok);
    mark('top_view_length', ok);
    mark('beta_tv', ok);
  }
  if (tv !== null && beta !== null && absDy !== null) {
    const expectedDy = tv * Math.sin(deg2rad(beta));
    const ok = Math.abs(expectedDy - absDy) <= TOL_MM;
    checks.push({
      id: 'stage4_tv_beta_dy',
      name: 'Stage 4 Top View Sin Identity (|Δy| = TV·sin β)',
      passed: ok,
      expected: `${expectedDy.toFixed(4)} mm`,
      actual: `${absDy.toFixed(4)} mm`,
      tolerance: TOL_MM,
    });
    mark('abs_delta_y', ok);
    mark('top_view_length', ok);
    mark('beta_tv', ok);
  }

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

    if (absDz !== null) {
      mark('abs_delta_z', Math.abs(Math.abs(dz) - absDz) <= TOL_MM);
    }
    if (absDy !== null) {
      mark('abs_delta_y', Math.abs(Math.abs(dy) - absDy) <= TOL_MM);
    }

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
 * Stage 4 Entry Point (Layer F): Update canonical JSON with validated derived values
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
  const initialCheck = validateCanonicalProblem(initialProblem);
  if (!initialCheck.ok) {
    return {
      ok: false,
      stage: 'stage_4_validate_json',
      error: `Initial JSON failed schema validation before Stage 4 update: ${initialCheck.errors.join('; ')}`,
      schema_errors: initialCheck.errors,
    };
  }

  const updated: CanonicalEngineeringProblem = structuredClone(initialCheck.data);

  // Merge derived values strictly into `unknowns` — NEVER overwrite `givens`
  const nextUnknowns: Record<string, MeasurementField> = {};
  for (const [prop, existingField] of Object.entries(updated.unknowns)) {
    const derived = solverOutput.derived_values[prop];
    if (
      solverOutput.solver_status !== 'inconsistent' &&
      solverOutput.solver_status !== 'unsupported' &&
      solverOutput.solver_status !== 'needs_clarification' &&
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
        epistemic_status: 'calculated',
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
          epistemic_status: 'unresolved',
          reason: unresolvedReason,
        },
        validation_status: solverOutput.solver_status === 'inconsistent' ? 'failed' : 'unvalidated',
      };
    }
  }
  updated.unknowns = nextUnknowns;

  if (updated.geometry.entity_type === 'straight_line') {
    updated.geometry.solved_coordinates =
      solverOutput.solver_status === 'solved' ? solverOutput.solved_coordinates : null;
  } else if (updated.geometry.entity_type === 'point_set') {
    updated.geometry.solved_points =
      solverOutput.solver_status !== 'inconsistent' ? solverOutput.solved_points : null;
  }

  updated.derivation = solverOutput.derivation ?? [];

  const independent = runIndependentGeometricValidation(updated);

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
  const hasFailedCheck = allChecks.some((c) => !c.passed);
  const hasBlockingError =
    mergedIssues.some((i) => i.severity === 'error') ||
    hasFailedCheck ||
    updated.source.uncertain_readings.some((u) => u.severity === 'blocking');

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
      field.validation_status = field.status === 'inconsistent' ? 'failed' : 'unvalidated';
      continue;
    }
    const passed = independent.fieldValid[prop];
    if (passed === false || hasFailedCheck || solverOutput.solver_status === 'inconsistent') {
      field.validation_status = 'failed';
    } else if (passed === true) {
      field.validation_status = 'validated';
    } else {
      field.validation_status = hasBlockingError ? 'failed' : 'unvalidated';
    }
  }

  const finalSolverStatus =
    solverOutput.solver_status === 'solved' && hasBlockingError
      ? 'inconsistent'
      : solverOutput.solver_status;

  const hasSolvedGeometry =
    (updated.geometry.entity_type === 'straight_line' &&
      updated.geometry.solved_coordinates !== null) ||
    (updated.geometry.entity_type === 'point_set' &&
      Array.isArray(updated.geometry.solved_points) &&
      updated.geometry.solved_points.length > 0 &&
      updated.geometry.solved_points.every((p) => p.status === 'solved'));

  const geometryValid =
    finalSolverStatus === 'solved' &&
    !hasBlockingError &&
    allChecks.length > 0 &&
    hasSolvedGeometry;

  if (!geometryValid) {
    if (updated.geometry.entity_type === 'straight_line') {
      updated.geometry.solved_coordinates = null;
    } else if (updated.geometry.entity_type === 'point_set' && finalSolverStatus === 'inconsistent') {
      updated.geometry.solved_points = null;
    }
  }

  let blockedReason: string | null = null;
  if (!geometryValid) {
    if (finalSolverStatus === 'unsupported') {
      blockedReason =
        mergedIssues.find((i) => i.code === 'UNSUPPORTED_MODULE')?.message ||
        'Module accurately identified, but automated solver/renderer is not implemented for this module yet.';
    } else if (finalSolverStatus === 'needs_clarification') {
      blockedReason =
        mergedIssues.find((i) => i.code === 'MODULE_NEEDS_CLARIFICATION')?.message ||
        'Question could not be classified into an Engineering Graphics module without clarification.';
    } else if (finalSolverStatus === 'inconsistent') {
      blockedReason =
        mergedIssues.find((i) => i.severity === 'error')?.message ||
        'Contradictory geometric constraints detected; sketch generation blocked.';
    } else if (finalSolverStatus === 'ambiguous') {
      blockedReason =
        solverOutput.ambiguities[0]?.reason ||
        mergedIssues.find((i) => i.severity === 'error')?.message ||
        'Ambiguous geometry or uncertain OCR symbol; resolve before rendering.';
    } else if (finalSolverStatus === 'underdetermined' || finalSolverStatus === 'partially_solved') {
      blockedReason =
        mergedIssues.find((i) => i.code === 'UNDERDETERMINED_SYSTEM')?.message ||
        'Underdetermined geometry: additional independent measurements are required before full sketch rendering.';
    } else {
      blockedReason = 'Geometry validation did not pass; rendering blocked.';
    }
  }

  updated.validation = {
    schema_valid: false,
    solver_status: finalSolverStatus,
    geometry_valid: geometryValid,
    ready_for_render: geometryValid,
    issues: mergedIssues,
    ambiguities: solverOutput.ambiguities,
    missing_requirements:
      finalSolverStatus === 'underdetermined' ||
      finalSolverStatus === 'partially_solved' ||
      finalSolverStatus === 'needs_clarification'
        ? solverOutput.missing_requirements
        : [],
    checks: allChecks,
  };

  updated.drawing_instructions = {
    ...updated.drawing_instructions,
    ready_to_render: geometryValid,
    blocked_reason: blockedReason,
  };

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
