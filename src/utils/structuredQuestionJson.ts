/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LineProblemInput } from '../types/lines';

export type HpRelValue = 'ABOVE' | 'BELOW' | 'ON' | null;
export type VpRelValue = 'IN_FRONT' | 'BEHIND' | 'ON' | null;

export interface StructuredQuestionData {
  object_type: 'STRAIGHT_LINE' | 'POINT' | 'PLANE';
  line_name: string;
  endpoints: {
    start: string;
    end: string;
  };
  dimensions: {
    true_length_mm: number | null;
    front_view_length_mm: number | null;
    top_view_length_mm: number | null;
    dep_projector_distance_mm: number | null;
  };
  coordinates: {
    point_A: {
      dist_hp_mm: number | null;
      hp_relation: HpRelValue;
      dist_vp_mm: number | null;
      vp_relation: VpRelValue;
    };
    point_B: {
      dist_hp_mm: number | null;
      hp_relation: HpRelValue;
      dist_vp_mm: number | null;
      vp_relation: VpRelValue;
    };
  };
  inclinations: {
    theta_hp_deg: number | null;
    phi_vp_deg: number | null;
    alpha_apparent_fv_deg: number | null;
    beta_apparent_tv_deg: number | null;
  };
  reference_plane_conditions: {
    system: 'FIRST_ANGLE_PROJECTION' | 'THIRD_ANGLE_PROJECTION';
    is_parallel_to_hp: boolean;
    is_parallel_to_vp: boolean;
    is_perpendicular_to_hp: boolean;
    is_perpendicular_to_vp: boolean;
  };
  projection_requirements: string[];
  construction_method: 'ROTATING_LINE_METHOD' | 'TRAPEZOIDAL_METHOD' | 'AUXILIARY_PLANE_METHOD';
  missing_or_ambiguous_fields: string[];
  validation: {
    is_valid: boolean;
    geometric_condition: string;
    warnings: string[];
  };
}

export interface InterpretedQuestionResult {
  structured: StructuredQuestionData;
  lineInput: LineProblemInput;
  hasAmbiguity: boolean;
}

export type ParseStructuredJsonResult =
  | ({ ok: true } & InterpretedQuestionResult)
  | { ok: false; error: string };

const VALID_OBJECT_TYPES = new Set(['STRAIGHT_LINE', 'POINT', 'PLANE']);
const VALID_HP_RELS = new Set(['ABOVE', 'BELOW', 'ON']);
const VALID_VP_RELS = new Set(['IN_FRONT', 'BEHIND', 'ON']);
const VALID_SYSTEMS = new Set(['FIRST_ANGLE_PROJECTION', 'THIRD_ANGLE_PROJECTION']);
const VALID_METHODS = new Set([
  'ROTATING_LINE_METHOD',
  'TRAPEZOIDAL_METHOD',
  'AUXILIARY_PLANE_METHOD',
]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function readNullableNumber(
  value: unknown,
  fallback: number | null,
  fieldLabel: string,
  options?: { min?: number; max?: number; exclusiveMin?: boolean }
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, value: fallback };
  }
  if (value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: `"${fieldLabel}" must be a finite number or null.` };
  }
  if (options?.min !== undefined) {
    if (options.exclusiveMin ? value <= options.min : value < options.min) {
      return {
        ok: false,
        error: `"${fieldLabel}" must be ${options.exclusiveMin ? '>' : '≥'} ${options.min}.`,
      };
    }
  }
  if (options?.max !== undefined && value > options.max) {
    return { ok: false, error: `"${fieldLabel}" must be ≤ ${options.max}.` };
  }
  return { ok: true, value };
}

function readHpRelation(
  value: unknown,
  fallback: HpRelValue,
  fieldLabel: string
): { ok: true; value: HpRelValue } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: fallback };
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string' && VALID_HP_RELS.has(value)) {
    return { ok: true, value: value as HpRelValue };
  }
  return {
    ok: false,
    error: `"${fieldLabel}" must be "ABOVE", "BELOW", "ON", or null.`,
  };
}

function readVpRelation(
  value: unknown,
  fallback: VpRelValue,
  fieldLabel: string
): { ok: true; value: VpRelValue } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: fallback };
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string' && VALID_VP_RELS.has(value)) {
    return { ok: true, value: value as VpRelValue };
  }
  return {
    ok: false,
    error: `"${fieldLabel}" must be "IN_FRONT", "BEHIND", "ON", or null.`,
  };
}

export function formatHpRelationLabel(rel: HpRelValue): string {
  if (rel === 'BELOW') return 'Below HP';
  if (rel === 'ON') return 'On HP';
  return 'Above HP';
}

export function formatVpRelationLabel(rel: VpRelValue): string {
  if (rel === 'BEHIND') return 'Behind VP';
  if (rel === 'ON') return 'On VP';
  return 'In Front VP';
}

/**
 * Recomputes derived geometric fields, validation state, and LineProblemInput
 * from a normalized StructuredQuestionData object.
 */
export function buildInterpretationFromStructured(
  input: StructuredQuestionData
): InterpretedQuestionResult {
  const startName = (input.endpoints.start || 'A').trim() || 'A';
  const endName = (input.endpoints.end || 'B').trim() || 'B';
  const lineName = (input.line_name || `${startName}${endName}`).trim() || `${startName}${endName}`;

  const tl = input.dimensions.true_length_mm;
  const theta = input.inclinations.theta_hp_deg;
  const phi = input.inclinations.phi_vp_deg;

  const hpRelA: HpRelValue =
    input.coordinates.point_A.hp_relation ??
    (input.coordinates.point_A.dist_hp_mm === null
      ? null
      : input.coordinates.point_A.dist_hp_mm === 0
      ? 'ON'
      : 'ABOVE');
  const distHpA =
    hpRelA === 'ON' ? 0 : input.coordinates.point_A.dist_hp_mm;

  const vpRelA: VpRelValue =
    input.coordinates.point_A.vp_relation ??
    (input.coordinates.point_A.dist_vp_mm === null
      ? null
      : input.coordinates.point_A.dist_vp_mm === 0
      ? 'ON'
      : 'IN_FRONT');
  const distVpA =
    vpRelA === 'ON' ? 0 : input.coordinates.point_A.dist_vp_mm;

  const missing: string[] = [];
  if (tl === null) missing.push('True Length (TL)');
  if (theta === null) missing.push('Inclination with HP (θ)');
  if (phi === null) missing.push('Inclination with VP (φ)');
  if (distHpA === null) missing.push(`Position of ${startName} relative to HP`);
  if (distVpA === null) missing.push(`Position of ${startName} relative to VP`);

  const hasAmbiguity = missing.length > 0;

  const effectiveTl = tl ?? 75;
  const effectiveTheta = theta ?? 30;
  const effectivePhi = phi ?? 45;
  const effThetaRad = (effectiveTheta * Math.PI) / 180;
  const effPhiRad = (effectivePhi * Math.PI) / 180;

  const sin2Sum = Math.sin(effThetaRad) ** 2 + Math.sin(effPhiRad) ** 2;
  const isValidSpatial = sin2Sum <= 1.0001;

  const warnings: string[] = [];
  if (!isValidSpatial) {
    warnings.push(
      `Geometric condition violated: sin²(θ) + sin²(φ) = ${sin2Sum.toFixed(3)} > 1.0`
    );
  }
  if (hasAmbiguity) {
    warnings.push(`Ambiguous question: Missing parameters [${missing.join(', ')}]`);
  }

  const hpRelB: HpRelValue = input.coordinates.point_B.hp_relation || 'ABOVE';
  const vpRelB: VpRelValue = input.coordinates.point_B.vp_relation || 'IN_FRONT';

  const endBQuadrant: LineProblemInput['endBQuadrant'] =
    hpRelB === 'BELOW'
      ? vpRelB === 'BEHIND'
        ? 'BELOW_BEHIND'
        : 'BELOW_FRONT'
      : vpRelB === 'BEHIND'
      ? 'ABOVE_BEHIND'
      : 'ABOVE_FRONT';

  const targetQuadrantB: LineProblemInput['targetQuadrantB'] =
    endBQuadrant === 'ABOVE_FRONT'
      ? 'FIRST'
      : endBQuadrant === 'ABOVE_BEHIND'
      ? 'SECOND'
      : endBQuadrant === 'BELOW_BEHIND'
      ? 'THIRD'
      : 'FOURTH';

  const effHpRelA = hpRelA || 'ABOVE';
  const effVpRelA = vpRelA || 'IN_FRONT';
  const effDistHpA = distHpA ?? 20;
  const effDistVpA = distVpA ?? 25;

  const signedZA = effHpRelA === 'BELOW' ? -effDistHpA : effHpRelA === 'ON' ? 0 : effDistHpA;
  const signedYA = effVpRelA === 'BEHIND' ? -effDistVpA : effVpRelA === 'ON' ? 0 : effDistVpA;
  const signZ = endBQuadrant.startsWith('BELOW') ? -1 : 1;
  const signY = endBQuadrant.endsWith('BEHIND') ? -1 : 1;

  const computedZB = signedZA + signZ * effectiveTl * Math.sin(effThetaRad);
  const computedYB = signedYA + signY * effectiveTl * Math.sin(effPhiRad);

  const isPerpHP = effectiveTheta >= 89.5;
  const isPerpVP = effectivePhi >= 89.5;
  const isParHP = effectiveTheta <= 0.5 || isPerpVP;
  const isParVP = effectivePhi <= 0.5 || isPerpHP;

  const structured: StructuredQuestionData = {
    object_type: input.object_type,
    line_name: lineName,
    endpoints: { start: startName, end: endName },
    dimensions: {
      true_length_mm: tl,
      front_view_length_mm: tl !== null ? Number((tl * Math.cos(effPhiRad)).toFixed(4)) : null,
      top_view_length_mm: tl !== null ? Number((tl * Math.cos(effThetaRad)).toFixed(4)) : null,
      dep_projector_distance_mm: input.dimensions.dep_projector_distance_mm,
    },
    coordinates: {
      point_A: {
        dist_hp_mm: distHpA,
        hp_relation: hpRelA,
        dist_vp_mm: distVpA,
        vp_relation: vpRelA,
      },
      point_B: {
        dist_hp_mm:
          distHpA !== null && tl !== null ? Number(Math.abs(computedZB).toFixed(4)) : null,
        hp_relation:
          distHpA !== null && tl !== null
            ? computedZB === 0
              ? 'ON'
              : computedZB > 0
              ? 'ABOVE'
              : 'BELOW'
            : hpRelB,
        dist_vp_mm:
          distVpA !== null && tl !== null ? Number(Math.abs(computedYB).toFixed(4)) : null,
        vp_relation:
          distVpA !== null && tl !== null
            ? computedYB === 0
              ? 'ON'
              : computedYB > 0
              ? 'IN_FRONT'
              : 'BEHIND'
            : vpRelB,
      },
    },
    inclinations: {
      theta_hp_deg: theta,
      phi_vp_deg: phi,
      alpha_apparent_fv_deg: input.inclinations.alpha_apparent_fv_deg,
      beta_apparent_tv_deg: input.inclinations.beta_apparent_tv_deg,
    },
    reference_plane_conditions: {
      system: input.reference_plane_conditions.system,
      is_parallel_to_hp: isParHP,
      is_parallel_to_vp: isParVP,
      is_perpendicular_to_hp: isPerpHP,
      is_perpendicular_to_vp: isPerpVP,
    },
    projection_requirements: input.projection_requirements,
    construction_method: input.construction_method,
    missing_or_ambiguous_fields: missing,
    validation: {
      is_valid: isValidSpatial && !hasAmbiguity,
      geometric_condition: `sin²(θ) + sin²(φ) = ${sin2Sum.toFixed(3)} ${
        isValidSpatial ? '≤ 1.0 (PASSED)' : '> 1.0 (FAILED)'
      }`,
      warnings,
    },
  };

  const lineInput: LineProblemInput = {
    mode: 'TRUE_LENGTH_ANGLES',
    nameA: startName,
    nameB: endName,
    color: '#2563eb',
    endA: {
      name: startName,
      hpRelation: effHpRelA,
      distanceHp: effDistHpA,
      vpRelation: effVpRelA,
      distanceVp: effDistVpA,
    },
    endB: {
      name: endName,
      hpRelation: computedZB < 0 ? 'BELOW' : computedZB === 0 ? 'ON' : 'ABOVE',
      distanceHp: Math.abs(computedZB),
      vpRelation: computedYB < 0 ? 'BEHIND' : computedYB === 0 ? 'ON' : 'IN_FRONT',
      distanceVp: Math.abs(computedYB),
    },
    dep: 0,
    trueLength: effectiveTl,
    thetaDeg: effectiveTheta,
    phiDeg: effectivePhi,
    endBQuadrant,
    frontViewLength: effectiveTl * Math.cos(effPhiRad),
    topViewLength: effectiveTl * Math.cos(effThetaRad),
    targetQuadrantB,
  };

  return { structured, lineInput, hasAmbiguity };
}

/**
 * Parses and validates user-edited Structured JSON text against the StructuredQuestionData schema.
 */
export function parseStructuredQuestionJson(
  jsonText: string,
  fallback: StructuredQuestionData
): ParseStructuredJsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON syntax.';
    return { ok: false, error: `JSON syntax error: ${message}` };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Root value must be a JSON object ({ ... }).' };
  }

  // object_type
  let objectType = fallback.object_type;
  if (parsed.object_type !== undefined) {
    if (typeof parsed.object_type !== 'string' || !VALID_OBJECT_TYPES.has(parsed.object_type)) {
      return {
        ok: false,
        error: '"object_type" must be "STRAIGHT_LINE", "POINT", or "PLANE".',
      };
    }
    objectType = parsed.object_type as StructuredQuestionData['object_type'];
  }

  // endpoints & line_name
  if (parsed.endpoints !== undefined && !isPlainObject(parsed.endpoints)) {
    return { ok: false, error: '"endpoints" must be an object with "start" and "end".' };
  }
  const endpointsObj = isPlainObject(parsed.endpoints) ? parsed.endpoints : {};

  let startName = fallback.endpoints.start;
  let endName = fallback.endpoints.end;

  if (endpointsObj.start !== undefined) {
    if (typeof endpointsObj.start !== 'string' || !endpointsObj.start.trim()) {
      return { ok: false, error: '"endpoints.start" must be a non-empty string.' };
    }
    startName = endpointsObj.start.trim();
  }
  if (endpointsObj.end !== undefined) {
    if (typeof endpointsObj.end !== 'string' || !endpointsObj.end.trim()) {
      return { ok: false, error: '"endpoints.end" must be a non-empty string.' };
    }
    endName = endpointsObj.end.trim();
  }

  let lineName = fallback.line_name;
  const endpointsChanged =
    startName !== fallback.endpoints.start || endName !== fallback.endpoints.end;

  if (parsed.line_name !== undefined) {
    if (typeof parsed.line_name !== 'string' || !parsed.line_name.trim()) {
      return { ok: false, error: '"line_name" must be a non-empty string.' };
    }
    const candidateName = parsed.line_name.trim();
    const lineNameChanged = candidateName !== fallback.line_name;

    if (endpointsChanged && !lineNameChanged) {
      lineName = `${startName}${endName}`;
    } else if (lineNameChanged && !endpointsChanged && /^[A-Za-z]{2}$/.test(candidateName)) {
      lineName = candidateName;
      startName = candidateName[0];
      endName = candidateName[1];
    } else {
      lineName = candidateName;
    }
  } else if (endpointsChanged) {
    lineName = `${startName}${endName}`;
  }

  // dimensions
  if (parsed.dimensions !== undefined && !isPlainObject(parsed.dimensions)) {
    return { ok: false, error: '"dimensions" must be an object.' };
  }
  const dimsObj = isPlainObject(parsed.dimensions) ? parsed.dimensions : {};
  const tlRes = readNullableNumber(
    dimsObj.true_length_mm,
    fallback.dimensions.true_length_mm,
    'dimensions.true_length_mm',
    { min: 0, exclusiveMin: true, max: 1000 }
  );
  if (!tlRes.ok) return tlRes;

  const fvRes = readNullableNumber(
    dimsObj.front_view_length_mm,
    fallback.dimensions.front_view_length_mm,
    'dimensions.front_view_length_mm',
    { min: 0 }
  );
  if (!fvRes.ok) return fvRes;

  const tvRes = readNullableNumber(
    dimsObj.top_view_length_mm,
    fallback.dimensions.top_view_length_mm,
    'dimensions.top_view_length_mm',
    { min: 0 }
  );
  if (!tvRes.ok) return tvRes;

  const depRes = readNullableNumber(
    dimsObj.dep_projector_distance_mm,
    fallback.dimensions.dep_projector_distance_mm,
    'dimensions.dep_projector_distance_mm',
    { min: 0 }
  );
  if (!depRes.ok) return depRes;

  // coordinates
  if (parsed.coordinates !== undefined && !isPlainObject(parsed.coordinates)) {
    return { ok: false, error: '"coordinates" must be an object.' };
  }
  const coordsObj = isPlainObject(parsed.coordinates) ? parsed.coordinates : {};

  if (coordsObj.point_A !== undefined && !isPlainObject(coordsObj.point_A)) {
    return { ok: false, error: '"coordinates.point_A" must be an object.' };
  }
  const pointAObj = isPlainObject(coordsObj.point_A) ? coordsObj.point_A : {};
  const distHpARes = readNullableNumber(
    pointAObj.dist_hp_mm,
    fallback.coordinates.point_A.dist_hp_mm,
    'coordinates.point_A.dist_hp_mm',
    { min: 0, max: 1000 }
  );
  if (!distHpARes.ok) return distHpARes;

  const hpRelARes = readHpRelation(
    pointAObj.hp_relation,
    fallback.coordinates.point_A.hp_relation,
    'coordinates.point_A.hp_relation'
  );
  if (!hpRelARes.ok) return hpRelARes;

  const distVpARes = readNullableNumber(
    pointAObj.dist_vp_mm,
    fallback.coordinates.point_A.dist_vp_mm,
    'coordinates.point_A.dist_vp_mm',
    { min: 0, max: 1000 }
  );
  if (!distVpARes.ok) return distVpARes;

  const vpRelARes = readVpRelation(
    pointAObj.vp_relation,
    fallback.coordinates.point_A.vp_relation,
    'coordinates.point_A.vp_relation'
  );
  if (!vpRelARes.ok) return vpRelARes;

  if (coordsObj.point_B !== undefined && !isPlainObject(coordsObj.point_B)) {
    return { ok: false, error: '"coordinates.point_B" must be an object.' };
  }
  const pointBObj = isPlainObject(coordsObj.point_B) ? coordsObj.point_B : {};
  const distHpBRes = readNullableNumber(
    pointBObj.dist_hp_mm,
    fallback.coordinates.point_B.dist_hp_mm,
    'coordinates.point_B.dist_hp_mm',
    { min: 0, max: 2000 }
  );
  if (!distHpBRes.ok) return distHpBRes;

  const hpRelBRes = readHpRelation(
    pointBObj.hp_relation,
    fallback.coordinates.point_B.hp_relation,
    'coordinates.point_B.hp_relation'
  );
  if (!hpRelBRes.ok) return hpRelBRes;

  const distVpBRes = readNullableNumber(
    pointBObj.dist_vp_mm,
    fallback.coordinates.point_B.dist_vp_mm,
    'coordinates.point_B.dist_vp_mm',
    { min: 0, max: 2000 }
  );
  if (!distVpBRes.ok) return distVpBRes;

  const vpRelBRes = readVpRelation(
    pointBObj.vp_relation,
    fallback.coordinates.point_B.vp_relation,
    'coordinates.point_B.vp_relation'
  );
  if (!vpRelBRes.ok) return vpRelBRes;

  // inclinations
  if (parsed.inclinations !== undefined && !isPlainObject(parsed.inclinations)) {
    return { ok: false, error: '"inclinations" must be an object.' };
  }
  const inclObj = isPlainObject(parsed.inclinations) ? parsed.inclinations : {};
  const thetaRes = readNullableNumber(
    inclObj.theta_hp_deg,
    fallback.inclinations.theta_hp_deg,
    'inclinations.theta_hp_deg',
    { min: 0, max: 90 }
  );
  if (!thetaRes.ok) return thetaRes;

  const phiRes = readNullableNumber(
    inclObj.phi_vp_deg,
    fallback.inclinations.phi_vp_deg,
    'inclinations.phi_vp_deg',
    { min: 0, max: 90 }
  );
  if (!phiRes.ok) return phiRes;

  const alphaRes = readNullableNumber(
    inclObj.alpha_apparent_fv_deg,
    fallback.inclinations.alpha_apparent_fv_deg,
    'inclinations.alpha_apparent_fv_deg',
    { min: 0, max: 90 }
  );
  if (!alphaRes.ok) return alphaRes;

  const betaRes = readNullableNumber(
    inclObj.beta_apparent_tv_deg,
    fallback.inclinations.beta_apparent_tv_deg,
    'inclinations.beta_apparent_tv_deg',
    { min: 0, max: 90 }
  );
  if (!betaRes.ok) return betaRes;

  // reference_plane_conditions
  if (
    parsed.reference_plane_conditions !== undefined &&
    !isPlainObject(parsed.reference_plane_conditions)
  ) {
    return { ok: false, error: '"reference_plane_conditions" must be an object.' };
  }
  const refObj = isPlainObject(parsed.reference_plane_conditions)
    ? parsed.reference_plane_conditions
    : {};

  let system = fallback.reference_plane_conditions.system;
  if (refObj.system !== undefined) {
    if (typeof refObj.system !== 'string' || !VALID_SYSTEMS.has(refObj.system)) {
      return {
        ok: false,
        error:
          '"reference_plane_conditions.system" must be "FIRST_ANGLE_PROJECTION" or "THIRD_ANGLE_PROJECTION".',
      };
    }
    system = refObj.system as StructuredQuestionData['reference_plane_conditions']['system'];
  }

  let theta = thetaRes.value;
  let phi = phiRes.value;

  const thetaUnchanged = theta === fallback.inclinations.theta_hp_deg;
  const phiUnchanged = phi === fallback.inclinations.phi_vp_deg;

  // If user toggled plane-condition booleans without changing angles directly, honor those toggles
  if (
    refObj.is_perpendicular_to_hp === true &&
    !fallback.reference_plane_conditions.is_perpendicular_to_hp &&
    thetaUnchanged
  ) {
    theta = 90;
    if (phiUnchanged) phi = 0;
  } else if (
    refObj.is_perpendicular_to_vp === true &&
    !fallback.reference_plane_conditions.is_perpendicular_to_vp &&
    phiUnchanged
  ) {
    phi = 90;
    if (thetaUnchanged) theta = 0;
  } else {
    if (
      refObj.is_parallel_to_hp === true &&
      !fallback.reference_plane_conditions.is_parallel_to_hp &&
      thetaUnchanged
    ) {
      theta = 0;
    }
    if (
      refObj.is_parallel_to_vp === true &&
      !fallback.reference_plane_conditions.is_parallel_to_vp &&
      phiUnchanged
    ) {
      phi = 0;
    }
  }

  // construction_method
  let constructionMethod = fallback.construction_method;
  if (parsed.construction_method !== undefined) {
    if (
      typeof parsed.construction_method !== 'string' ||
      !VALID_METHODS.has(parsed.construction_method)
    ) {
      return {
        ok: false,
        error:
          '"construction_method" must be "ROTATING_LINE_METHOD", "TRAPEZOIDAL_METHOD", or "AUXILIARY_PLANE_METHOD".',
      };
    }
    constructionMethod =
      parsed.construction_method as StructuredQuestionData['construction_method'];
  }

  // projection_requirements
  let projReqs = fallback.projection_requirements;
  if (parsed.projection_requirements !== undefined) {
    if (
      !Array.isArray(parsed.projection_requirements) ||
      !parsed.projection_requirements.every((item) => typeof item === 'string')
    ) {
      return {
        ok: false,
        error: '"projection_requirements" must be an array of strings.',
      };
    }
    projReqs = parsed.projection_requirements;
  }

  const normalized: StructuredQuestionData = {
    object_type: objectType,
    line_name: lineName,
    endpoints: { start: startName, end: endName },
    dimensions: {
      true_length_mm: tlRes.value,
      front_view_length_mm: fvRes.value,
      top_view_length_mm: tvRes.value,
      dep_projector_distance_mm: depRes.value,
    },
    coordinates: {
      point_A: {
        dist_hp_mm: distHpARes.value,
        hp_relation: hpRelARes.value,
        dist_vp_mm: distVpARes.value,
        vp_relation: vpRelARes.value,
      },
      point_B: {
        dist_hp_mm: distHpBRes.value,
        hp_relation: hpRelBRes.value,
        dist_vp_mm: distVpBRes.value,
        vp_relation: vpRelBRes.value,
      },
    },
    inclinations: {
      theta_hp_deg: theta,
      phi_vp_deg: phi,
      alpha_apparent_fv_deg: alphaRes.value,
      beta_apparent_tv_deg: betaRes.value,
    },
    reference_plane_conditions: {
      system,
      is_parallel_to_hp: Boolean(refObj.is_parallel_to_hp ?? fallback.reference_plane_conditions.is_parallel_to_hp),
      is_parallel_to_vp: Boolean(refObj.is_parallel_to_vp ?? fallback.reference_plane_conditions.is_parallel_to_vp),
      is_perpendicular_to_hp: Boolean(
        refObj.is_perpendicular_to_hp ?? fallback.reference_plane_conditions.is_perpendicular_to_hp
      ),
      is_perpendicular_to_vp: Boolean(
        refObj.is_perpendicular_to_vp ?? fallback.reference_plane_conditions.is_perpendicular_to_vp
      ),
    },
    projection_requirements: projReqs,
    construction_method: constructionMethod,
    missing_or_ambiguous_fields: fallback.missing_or_ambiguous_fields,
    validation: fallback.validation,
  };

  return {
    ok: true,
    ...buildInterpretationFromStructured(normalized),
  };
}
