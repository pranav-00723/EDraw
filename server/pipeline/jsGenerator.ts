/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import vm from 'node:vm';
import type { CanonicalEngineeringProblem } from '../../src/pipeline/schema.ts';

export interface JsGenerationValidation {
  valid: boolean;
  errors: string[];
}

export interface GeneratedJsExecutionPackage {
  solver_id: string;
  renderer_id: string;
  visualization_config: Record<string, unknown>;
  generated_js_module: string;
  js_validation: JsGenerationValidation;
}

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\beval\s*\(/, reason: 'Forbidden dynamic eval() call' },
  { re: /\bnew\s+Function\b/, reason: 'Forbidden dynamic Function() constructor' },
  { re: /\bfetch\s*\(/, reason: 'Forbidden network fetch() call in generated geometry module' },
  { re: /\bXMLHttpRequest\b/, reason: 'Forbidden XMLHttpRequest usage' },
  { re: /\bprocess\b/, reason: 'Forbidden Node process reference' },
  { re: /\bchild_process\b/, reason: 'Forbidden child_process reference' },
  { re: /\brequire\s*\(/, reason: 'Forbidden require() call' },
  { re: /\bwindow\.open\b/, reason: 'Forbidden window.open() call' },
  { re: /__proto__/, reason: 'Forbidden prototype pollution token' },
  { re: /\bimport\s*\(/, reason: 'Forbidden dynamic import() call' },
];

/**
 * Validates generated JavaScript code statically for syntax & safety (parses via vm.Script without executing).
 */
export function validateGeneratedJsModule(code: string): JsGenerationValidation {
  const errors: string[] = [];
  if (!code || code.trim().length < 20) {
    errors.push('Generated JS module is empty or too short.');
  }

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.re.test(code)) {
      errors.push(rule.reason);
    }
  }

  try {
    new vm.Script(code, { filename: 'edraw_question_module.js' });
  } catch (err) {
    errors.push(`JS syntax error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildVisualizationConfig(problem: CanonicalEngineeringProblem): Record<string, unknown> {
  const moduleId = problem.module?.id || problem.task.domain;
  const givensSummary: Record<string, { value: number | null; unit: string }> = {};
  for (const [k, f] of Object.entries(problem.givens)) {
    givensSummary[k] = { value: f.value, unit: f.unit };
  }

  const derivedSummary: Record<string, { value: number; unit: string; formula: string | null }> = {};
  const unresolvedList: string[] = [];
  for (const [k, f] of Object.entries(problem.unknowns)) {
    if (f.status === 'derived' && f.value !== null) {
      derivedSummary[k] = {
        value: f.value,
        unit: f.unit,
        formula: f.provenance.formula,
      };
    } else if (f.value === null) {
      unresolvedList.push(k);
    }
  }

  return {
    problem_id: problem.problem_id,
    module_id: moduleId,
    module_name: problem.module?.name || problem.task.domain,
    renderer_id: problem.execution?.renderer_id || `renderer:${moduleId}`,
    entity_type: problem.geometry.entity_type,
    projection_system: problem.task.projection_system,
    coordinate_system: problem.drawing_instructions.coordinate_system,
    views: problem.drawing_instructions.views,
    solver_status: problem.validation.solver_status,
    ready_to_render: problem.validation.ready_for_render,
    blocked_reason: problem.drawing_instructions.blocked_reason,
    givens: givensSummary,
    derived: derivedSummary,
    unresolved: unresolvedList,
    geometry: problem.geometry,
    missing_requirements: problem.validation.missing_requirements,
    derivation: problem.derivation ?? [],
    annotations: problem.drawing_instructions.annotations,
  };
}

/**
 * Generates a self-contained, question-specific JavaScript module and visualization config
 * directly from the validated CanonicalEngineeringProblem (never using generic templates with hardcoded defaults).
 */
export function generateQuestionJsExecution(
  problem: CanonicalEngineeringProblem
): GeneratedJsExecutionPackage {
  const moduleId = problem.module?.id || problem.task.domain;
  const solverId = problem.execution?.solver_id || `solver:${moduleId}`;
  const rendererId = problem.execution?.renderer_id || `renderer:${moduleId}`;
  const config = buildVisualizationConfig(problem);
  const serializedConfig = JSON.stringify(config, null, 2);

  const entityDesc =
    problem.geometry.entity_type === 'straight_line'
      ? `Line ${problem.geometry.line_label} (${problem.geometry.endpoints.start} -> ${problem.geometry.endpoints.end})`
      : problem.geometry.entity_type === 'point_set'
      ? `Points [${problem.geometry.points.map((p) => p.label).join(', ')}]`
      : `${problem.module?.name || problem.geometry.entity_type}`;

  const jsLines: string[] = [
    `/**`,
    ` * EDraw Question-Specific Validated Geometry Execution Module`,
    ` * Problem ID: ${problem.problem_id}`,
    ` * Module: ${problem.module?.name || moduleId} (${moduleId})`,
    ` * Entities: ${entityDesc}`,
    ` * Solver Status: ${problem.validation.solver_status}`,
    ` */`,
    ``,
    `(function (root) {`,
    `  'use strict';`,
    ``,
    `  var PROBLEM_CONFIG = ${serializedConfig.split('\n').join('\n  ')};`,
    ``,
    `  function buildRenderPlan() {`,
    `    if (!PROBLEM_CONFIG.ready_to_render) {`,
    `      return {`,
    `        ok: false,`,
    `        problemId: PROBLEM_CONFIG.problem_id,`,
    `        moduleId: PROBLEM_CONFIG.module_id,`,
    `        status: PROBLEM_CONFIG.solver_status,`,
    `        blockedReason: PROBLEM_CONFIG.blocked_reason,`,
    `        missingRequirements: PROBLEM_CONFIG.missing_requirements,`,
    `        partialDerived: PROBLEM_CONFIG.derived`,
    `      };`,
    `    }`,
  ];

  if (problem.geometry.entity_type === 'point_set') {
    jsLines.push(
      `    var solvedPoints = Array.isArray(PROBLEM_CONFIG.geometry.solved_points) ? PROBLEM_CONFIG.geometry.solved_points : [];`,
      `    var primitives = [];`,
      `    for (var i = 0; i < solvedPoints.length; i++) {`,
      `      var pt = solvedPoints[i];`,
      `      if (pt.status !== 'solved') continue;`,
      `      var x = Number(pt.x_mm || 0);`,
      `      primitives.push({ kind: 'projector', x1: x, y1: pt.front_view_y, x2: x, y2: pt.top_view_y, label: pt.label });`,
      `      primitives.push({ kind: 'point_fv', x: x, y: pt.front_view_y, label: pt.front_view_label, desc: pt.front_view_desc });`,
      `      primitives.push({ kind: 'point_tv', x: x, y: pt.top_view_y, label: pt.top_view_label, desc: pt.top_view_desc });`,
      `    }`,
      `    return {`,
      `      ok: true,`,
      `      problemId: PROBLEM_CONFIG.problem_id,`,
      `      moduleId: PROBLEM_CONFIG.module_id,`,
      `      coordinateSystem: PROBLEM_CONFIG.coordinate_system,`,
      `      points: solvedPoints,`,
      `      primitives: primitives`,
      `    };`
    );
  } else if (problem.geometry.entity_type === 'straight_line') {
    jsLines.push(
      `    var coords = PROBLEM_CONFIG.geometry.solved_coordinates;`,
      `    if (!coords) {`,
      `      return { ok: false, blockedReason: 'Solved coordinates missing.' };`,
      `    }`,
      `    var primitives = [`,
      `      { kind: 'line_fv', start: coords.front_view.start, end: coords.front_view.end },`,
      `      { kind: 'line_tv', start: coords.top_view.start, end: coords.top_view.end },`,
      `      { kind: 'projector', x: coords.front_view.start.x, yTop: coords.front_view.start.y, yBot: coords.top_view.start.y },`,
      `      { kind: 'projector', x: coords.front_view.end.x, yTop: coords.front_view.end.y, yBot: coords.top_view.end.y },`,
      `      { kind: 'auxiliary_tl_hp', start: coords.front_view.start, end: coords.auxiliary.b1_prime },`,
      `      { kind: 'auxiliary_tl_vp', start: coords.top_view.start, end: coords.auxiliary.b2 }`,
      `    ];`,
      `    return {`,
      `      ok: true,`,
      `      problemId: PROBLEM_CONFIG.problem_id,`,
      `      moduleId: PROBLEM_CONFIG.module_id,`,
      `      lineLabel: PROBLEM_CONFIG.geometry.line_label,`,
      `      endpoints: PROBLEM_CONFIG.geometry.endpoints,`,
      `      givens: PROBLEM_CONFIG.givens,`,
      `      derived: PROBLEM_CONFIG.derived,`,
      `      coordinates: coords,`,
      `      primitives: primitives`,
      `    };`
    );
  } else {
    jsLines.push(
      `    return {`,
      `      ok: false,`,
      `      problemId: PROBLEM_CONFIG.problem_id,`,
      `      moduleId: PROBLEM_CONFIG.module_id,`,
      `      status: PROBLEM_CONFIG.solver_status,`,
      `      blockedReason: PROBLEM_CONFIG.blocked_reason`,
      `    };`
    );
  }

  jsLines.push(
    `  }`,
    ``,
    `  var api = {`,
    `    config: PROBLEM_CONFIG,`,
    `    buildRenderPlan: buildRenderPlan`,
    `  };`,
    ``,
    `  if (typeof module !== 'undefined' && module.exports) {`,
    `    module.exports = api;`,
    `  }`,
    `  if (root && typeof root === 'object') {`,
    `    root.__EDRAW_LAST_PLAN__ = api;`,
    `  }`,
    `})(typeof globalThis !== 'undefined' ? globalThis : null);`
  );

  const generatedJsModule = jsLines.join('\n');
  const jsValidation = validateGeneratedJsModule(generatedJsModule);

  return {
    solver_id: solverId,
    renderer_id: rendererId,
    visualization_config: config,
    generated_js_module: generatedJsModule,
    js_validation: jsValidation,
  };
}
