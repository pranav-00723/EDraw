/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MasterLineCategory,
  MasterValidationStatus,
  NormalizedConstraintModel,
  NormalizedEndpoint,
  TraceIntersection,
  AuxiliaryPlaneGeometry,
  MasterConstructionStep,
  ConstructionMethodType,
} from '../types/masterLines';
import { ComputedLine, LineProblemInput, TargetQuadrantB } from '../types/lines';
import { HpRelation, VpRelation } from '../types/projection';
import { computeLineProjection } from './linesMath';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Normalizes text input into a clean string, repairing common OCR artifacts.
 */
export function normalizeMasterOcrText(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\blinc\b/gi, 'line');
  s = s.replace(/(\d+(?:\.\d+)?)\s*mm\s*lone\b/gi, '$1mm long');
  s = s.replace(/(\d+(?:\.\d+)?)\s*1\s*m\b/gi, '$1mm');
  s = s.replace(/\bpars?\s+to\s+the\b/gi, 'parallel to the');
  s = s.replace(/\bpar(?:al{1,2}el)?\b/gi, 'parallel');
  s = s.replace(/\boerpen\s*dic\s*ula[a-z]*\b/gi, 'perpendicular');
  s = s.replace(/\bperpen\s*dicular\b/gi, 'perpendicular');
  s = s.replace(/\bto\s+the\s+[Pp]\b/gi, 'to the VP');
  s = s.replace(/\b[vV][\.\s]*[pP]\b/g, 'VP');
  s = s.replace(/\b[hH][\.\s]*[pP]\b/g, 'HP');
  return s;
}

/**
 * Builds an empty normalized constraint model.
 */
export function createEmptyNormalizedModel(
  inputMode: 'MANUAL' | 'OCR' | 'CLIPBOARD' | 'SAMPLE' | 'TEST_SUITE' = 'CLIPBOARD'
): NormalizedConstraintModel {
  return {
    input_mode: inputMode,
    category: 'SL_06_INCLINED_BOTH',
    categoryTitle: 'Line Inclined to Both Planes',
    categoryDescription: 'General 3D oblique line',
    task_type: 'PROJECTION',
    true_length_mm: null,
    endpoint_A: {
      name: 'A',
      x: 0,
      y: null,
      z: null,
      hpRelation: null,
      distHp: null,
      vpRelation: null,
      distVp: null,
      quadrant: null,
    },
    endpoint_B: {
      name: 'B',
      x: null,
      y: null,
      z: null,
      hpRelation: null,
      distHp: null,
      vpRelation: null,
      distVp: null,
      quadrant: null,
    },
    inclination_hp_deg: null,
    inclination_vp_deg: null,
    front_view_length_mm: null,
    top_view_length_mm: null,
    front_view_angle_deg: null,
    top_view_angle_deg: null,
    dep_projector_distance_mm: null,
    parallel_to: null,
    perpendicular_to: null,
    quadrant_A: null,
    quadrant_B: null,
    known_traces: { ht: null, vt: null },
    construction_method: 'ROTATING_LINE',
    ocr_candidates: {},
    source_of_each_constraint: {},
    validation_status: 'UNDERDETERMINED',
    validation_messages: [],
    degrees_of_freedom: 6,
    solution_count: 0,
    candidate_solutions: [],
    construction_steps: [],
  };
}

/**
 * Parses free text or clipboard into a NormalizedConstraintModel.
 */
export function parseTextToNormalizedModel(
  rawText: string,
  inputMode: 'MANUAL' | 'OCR' | 'CLIPBOARD' | 'SAMPLE' | 'TEST_SUITE' = 'CLIPBOARD'
): NormalizedConstraintModel {
  const model = createEmptyNormalizedModel(inputMode);
  const normalized = normalizeMasterOcrText(rawText);
  const lower = normalized.toLowerCase();

  // Strip out numbered solution steps if present
  const problemStatement = normalized
    .replace(/(?:^|\n)\s*\d+[\.\)]\s*[^.\n]*(?:draw|mark|join|project|extend|measure|with|taking|from|cut|locate)[^\n]*/gi, '')
    .trim();
  const probLower = problemStatement.toLowerCase();

  // Stop words to prevent matching English words as endpoint names
  const STOP_WORDS = new Set(['is', 'to', 'at', 'in', 'on', 'by', 'so', 'it', 'if', 'as', 'an', 'or', 'and', 'the', 'of', 'for']);

  // 1. Line endpoints & names
  let startName = 'A';
  let endName = 'B';
  const explicit2Letter = problemStatement.match(/(?:line|linc|lone|straight\s*line)\s+([A-Z])([A-Z])\b/);
  const explicitLineAnd = problemStatement.match(/(?:line|linc|lone)\s+([A-Z])\s*(?:and|to|-)\s*([A-Z])\b/i);

  if (explicit2Letter) {
    startName = explicit2Letter[1];
    endName = explicit2Letter[2];
    model.source_of_each_constraint['line_name'] = {
      value: `${startName}${endName}`,
      source: inputMode,
      explicit: true,
      confidence: 0.98,
    };
  } else if (
    explicitLineAnd &&
    !STOP_WORDS.has(explicitLineAnd[1].toLowerCase()) &&
    !STOP_WORDS.has(explicitLineAnd[2].toLowerCase())
  ) {
    startName = explicitLineAnd[1].toUpperCase();
    endName = explicitLineAnd[2].toUpperCase();
    model.source_of_each_constraint['line_name'] = {
      value: `${startName}${endName}`,
      source: inputMode,
      explicit: true,
      confidence: 0.98,
    };
  }
  model.endpoint_A.name = startName;
  model.endpoint_B.name = endName;

  // 2. True Length (TL)
  const tlMatch =
    probLower.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:line|linc|lone|straight\s*line)/i) ||
    probLower.match(/(?:true\s*length|tl)\s*(?:is|=|of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/(?:line|linc|lone)\s+[a-z]{1,2}\s+(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:long|lone|in\s*length)/i) ||
    probLower.match(/(?:length\s*(?:of)?\s*(?:the\s*line\s*)?|line\s*length\s*(?:is)?\s*)(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/tl\s*=?\s*(\d+(?:\.\d+)?)/i) ||
    probLower.match(/^a\s+(\d+(?:\.\d+)?)\s*mm\s+line/i) ||
    probLower.match(/(\d+(?:\.\d+)?)\s*mm/i);

  if (tlMatch) {
    model.true_length_mm = parseFloat(tlMatch[1]);
    model.source_of_each_constraint['true_length_mm'] = {
      value: model.true_length_mm,
      unit: 'mm',
      source: inputMode,
      explicit: true,
      confidence: 0.95,
    };
  }

  // 3. Parallel & Perpendicular Constraints
  const isPerpHP =
    probLower.includes('perpendicular to the hp') ||
    probLower.includes('perpendicular to hp') ||
    probLower.includes('perp to hp') ||
    probLower.includes('perp. to hp') ||
    probLower.includes('normal to hp');

  const isPerpVP =
    probLower.includes('perpendicular to the vp') ||
    probLower.includes('perpendicular to vp') ||
    probLower.includes('perp to vp') ||
    probLower.includes('perp. to vp') ||
    probLower.includes('normal to vp');

  const isParBoth =
    probLower.includes('parallel to both') ||
    probLower.includes('parallel to hp and vp') ||
    probLower.includes('parallel to vp and hp') ||
    probLower.includes('parallel to the hp and vp') ||
    probLower.includes('parallel to the vp and hp') ||
    probLower.includes('parallel to the hp and the vp') ||
    probLower.includes('parallel to the vp and the hp');

  const isParHP =
    isParBoth ||
    isPerpVP ||
    probLower.includes('parallel to the hp') ||
    probLower.includes('parallel to hp');

  const isParVP =
    isParBoth ||
    isPerpHP ||
    probLower.includes('parallel to the vp') ||
    probLower.includes('parallel to vp');

  if (isParHP && isParVP) {
    model.parallel_to = 'BOTH';
    model.perpendicular_to = 'NONE';
  } else if (isPerpHP) {
    model.perpendicular_to = 'HP';
    model.parallel_to = 'VP';
  } else if (isPerpVP) {
    model.perpendicular_to = 'VP';
    model.parallel_to = 'HP';
  } else if (isParHP) {
    model.parallel_to = 'HP';
  } else if (isParVP) {
    model.parallel_to = 'VP';
  }

  // 4. True Angles (theta with HP, phi with VP)
  const thetaMatch =
    probLower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?hp)/i) ||
    probLower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?hp)/i) ||
    probLower.match(/θ\s*=?\s*(\d+(?:\.\d+)?)/i);

  if (thetaMatch) {
    model.inclination_hp_deg = parseFloat(thetaMatch[1]);
    model.source_of_each_constraint['inclination_hp_deg'] = {
      value: model.inclination_hp_deg,
      unit: 'deg',
      source: inputMode,
      explicit: true,
      confidence: 0.95,
    };
  } else if (isPerpHP) {
    model.inclination_hp_deg = 90;
    model.source_of_each_constraint['inclination_hp_deg'] = {
      value: 90,
      unit: 'deg',
      source: 'DERIVED',
      explicit: false,
      confidence: 1.0,
      notes: 'Line perpendicular to HP has θ = 90°',
    };
  } else if (isParHP) {
    model.inclination_hp_deg = 0;
    model.source_of_each_constraint['inclination_hp_deg'] = {
      value: 0,
      unit: 'deg',
      source: 'DERIVED',
      explicit: false,
      confidence: 1.0,
      notes: 'Line parallel to HP has θ = 0°',
    };
  }

  const phiMatch =
    probLower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?vp)/i) ||
    probLower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?vp)/i) ||
    probLower.match(/φ\s*=?\s*(\d+(?:\.\d+)?)/i);

  if (phiMatch) {
    model.inclination_vp_deg = parseFloat(phiMatch[1]);
    model.source_of_each_constraint['inclination_vp_deg'] = {
      value: model.inclination_vp_deg,
      unit: 'deg',
      source: inputMode,
      explicit: true,
      confidence: 0.95,
    };
  } else if (isPerpVP) {
    model.inclination_vp_deg = 90;
    model.source_of_each_constraint['inclination_vp_deg'] = {
      value: 90,
      unit: 'deg',
      source: 'DERIVED',
      explicit: false,
      confidence: 1.0,
      notes: 'Line perpendicular to VP has φ = 90°',
    };
  } else if (isParVP) {
    model.inclination_vp_deg = 0;
    model.source_of_each_constraint['inclination_vp_deg'] = {
      value: 0,
      unit: 'deg',
      source: 'DERIVED',
      explicit: false,
      confidence: 1.0,
      notes: 'Line parallel to VP has φ = 0°',
    };
  }

  // 5. Projected Lengths (Elevation / Front View length, Plan / Top View length)
  const elMatch =
    probLower.match(/(?:front[\s-]*view|elevation)\s*(?:length\s*)?(?:is|=|of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/el\s*(?:is|=|of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/(?:front[\s-]*view\s*is)\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (elMatch) {
    model.front_view_length_mm = parseFloat(elMatch[1]);
    model.source_of_each_constraint['front_view_length_mm'] = {
      value: model.front_view_length_mm,
      unit: 'mm',
      source: inputMode,
      explicit: true,
      confidence: 0.92,
    };
  }

  const plMatch =
    probLower.match(/(?:top[\s-]*view|plan)\s*(?:length\s*)?(?:is|=|of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/pl\s*(?:is|=|of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
    probLower.match(/(?:top[\s-]*view\s*is)\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (plMatch) {
    model.top_view_length_mm = parseFloat(plMatch[1]);
    model.source_of_each_constraint['top_view_length_mm'] = {
      value: model.top_view_length_mm,
      unit: 'mm',
      source: inputMode,
      explicit: true,
      confidence: 0.92,
    };
  }

  // 6. Apparent Angles (alpha in FV with XY, beta in TV with XY)
  const alphaMatch =
    probLower.match(/(?:front[\s-]*view|elevation)\s*(?:makes\s*(?:an\s*angle\s*of)?|inclined\s*at)\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*with\s*(?:the\s*)?xy/i) ||
    probLower.match(/α\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (alphaMatch) {
    model.front_view_angle_deg = parseFloat(alphaMatch[1]);
    model.source_of_each_constraint['front_view_angle_deg'] = {
      value: model.front_view_angle_deg,
      unit: 'deg',
      source: inputMode,
      explicit: true,
      confidence: 0.95,
    };
  }

  const betaMatch =
    probLower.match(/(?:top[\s-]*view|plan)\s*(?:makes\s*(?:an\s*angle\s*of)?|inclined\s*at)\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*with\s*(?:the\s*)?xy/i) ||
    probLower.match(/β\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (betaMatch) {
    model.top_view_angle_deg = parseFloat(betaMatch[1]);
    model.source_of_each_constraint['top_view_angle_deg'] = {
      value: model.top_view_angle_deg,
      unit: 'deg',
      source: inputMode,
      explicit: true,
      confidence: 0.95,
    };
  }

  // 7. Distance Between End Projectors (DEP)
  const depMatch =
    probLower.match(/(?:distance\s*between\s*(?:end\s*)?projectors|dep)\s*(?:is|=|of)?\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (depMatch) {
    model.dep_projector_distance_mm = parseFloat(depMatch[1]);
    model.source_of_each_constraint['dep_projector_distance_mm'] = {
      value: model.dep_projector_distance_mm,
      unit: 'mm',
      source: inputMode,
      explicit: true,
      confidence: 0.94,
    };
  } else if (isPerpHP || isPerpVP) {
    model.dep_projector_distance_mm = 0;
  }

  // 8. Endpoint A Position
  const pName = startName.toLowerCase();
  const qName = endName.toLowerCase();

  const aHpAbove = probLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*above\\s*(?:the\\s*)?hp`, 'i')) ||
    probLower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\\s*)?hp/i);
  const aHpBelow = probLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*below\\s*(?:the\\s*)?hp`, 'i')) ||
    probLower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\\s*)?hp/i);
  const aHpOn = probLower.includes(`${pName} is in hp`) || probLower.includes(`${pName} is in the hp`) || probLower.includes(`${pName} is on hp`);

  if (aHpOn) {
    model.endpoint_A.z = 0;
    model.endpoint_A.hpRelation = 'ON';
    model.endpoint_A.distHp = 0;
  } else if (aHpAbove) {
    const val = parseFloat(aHpAbove[1]);
    model.endpoint_A.z = val;
    model.endpoint_A.hpRelation = 'ABOVE';
    model.endpoint_A.distHp = val;
  } else if (aHpBelow) {
    const val = parseFloat(aHpBelow[1]);
    model.endpoint_A.z = -val;
    model.endpoint_A.hpRelation = 'BELOW';
    model.endpoint_A.distHp = val;
  }

  const aVpFront = probLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*in\\s*front\\s*of\\s*(?:the\\s*)?vp`, 'i')) ||
    probLower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\\s*)?vp/i);
  const aVpBehind = probLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*behind\\s*(?:the\\s*)?vp`, 'i')) ||
    probLower.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\\s*)?vp/i);
  const aVpOn = probLower.includes(`${pName} is in vp`) || probLower.includes(`${pName} is in the vp`) || probLower.includes(`${pName} is on vp`);

  if (aVpOn) {
    model.endpoint_A.y = 0;
    model.endpoint_A.vpRelation = 'ON';
    model.endpoint_A.distVp = 0;
  } else if (aVpFront) {
    const val = parseFloat(aVpFront[1]);
    model.endpoint_A.y = val;
    model.endpoint_A.vpRelation = 'IN_FRONT';
    model.endpoint_A.distVp = val;
  } else if (aVpBehind) {
    const val = parseFloat(aVpBehind[1]);
    model.endpoint_A.y = -val;
    model.endpoint_A.vpRelation = 'BEHIND';
    model.endpoint_A.distVp = val;
  }

  // 9. Endpoint B Position
  const bHpAbove = probLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*above\\s*(?:the\\s*)?hp`, 'i'));
  const bHpBelow = probLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*below\\s*(?:the\\s*)?hp`, 'i'));
  if (bHpAbove) {
    const val = parseFloat(bHpAbove[1]);
    model.endpoint_B.z = val;
    model.endpoint_B.hpRelation = 'ABOVE';
    model.endpoint_B.distHp = val;
  } else if (bHpBelow) {
    const val = parseFloat(bHpBelow[1]);
    model.endpoint_B.z = -val;
    model.endpoint_B.hpRelation = 'BELOW';
    model.endpoint_B.distHp = val;
  }

  const bVpFront = probLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*in\\s*front\\s*of\\s*(?:the\\s*)?vp`, 'i'));
  const bVpBehind = probLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*behind\\s*(?:the\\s*)?vp`, 'i'));
  if (bVpFront) {
    const val = parseFloat(bVpFront[1]);
    model.endpoint_B.y = val;
    model.endpoint_B.vpRelation = 'IN_FRONT';
    model.endpoint_B.distVp = val;
  } else if (bVpBehind) {
    const val = parseFloat(bVpBehind[1]);
    model.endpoint_B.y = -val;
    model.endpoint_B.vpRelation = 'BEHIND';
    model.endpoint_B.distVp = val;
  }

  // 10. Construction method requested
  if (probLower.includes('auxiliary') || probLower.includes('auxiliary plane')) {
    model.construction_method = 'AUXILIARY_PLANE';
  } else if (probLower.includes('direct') || probLower.includes('direct projection')) {
    model.construction_method = 'DIRECT';
  } else {
    model.construction_method = 'ROTATING_LINE';
  }

  // 11. Classify Category SL-01 through SL-22
  classifyCategory(model, probLower);

  // 12. Run the deterministic solver and constraint validation
  return solveNormalizedModel(model);
}

/**
 * Classifies problem into categories SL-01 to SL-22 based on constraints
 */
function classifyCategory(model: NormalizedConstraintModel, text: string) {
  if (text.includes('trace') || text.includes('horizontal trace') || text.includes('vertical trace') || text.includes('ht') || text.includes('vt')) {
    model.category = 'SL_12_TRACES_HT_VT';
    model.categoryTitle = 'Horizontal and Vertical Traces';
    model.categoryDescription = 'Finding piercing points where line meets reference planes';
    return;
  }

  if (model.construction_method === 'AUXILIARY_PLANE') {
    model.category = 'SL_15_AUXILIARY_PLANE';
    model.categoryTitle = 'Auxiliary-Plane Method';
    model.categoryDescription = 'AIP / AVP construction for true lengths and inclinations';
    return;
  }

  if (model.perpendicular_to === 'HP') {
    model.category = 'SL_02_PERPENDICULAR_HP';
    model.categoryTitle = 'Line Perpendicular to HP';
    model.categoryDescription = 'Top view collapses to a point; front view shows true length';
    return;
  }

  if (model.perpendicular_to === 'VP') {
    model.category = 'SL_03_PERPENDICULAR_VP';
    model.categoryTitle = 'Line Perpendicular to VP';
    model.categoryDescription = 'Front view collapses to a point; top view shows true length';
    return;
  }

  if (model.parallel_to === 'BOTH') {
    model.category = 'SL_01_PARALLEL_BOTH';
    model.categoryTitle = 'Line Parallel to Both HP and VP';
    model.categoryDescription = 'Both views are parallel to XY and show true length';
    return;
  }

  if (model.parallel_to === 'VP' && model.inclination_hp_deg !== null && model.inclination_hp_deg > 0) {
    model.category = 'SL_04_INCLINED_HP_PARALLEL_VP';
    model.categoryTitle = 'Line Inclined to HP and Parallel to VP';
    model.categoryDescription = 'Front view shows true length and θ; top view parallel to XY';
    return;
  }

  if (model.parallel_to === 'HP' && model.inclination_vp_deg !== null && model.inclination_vp_deg > 0) {
    model.category = 'SL_05_INCLINED_VP_PARALLEL_HP';
    model.categoryTitle = 'Line Inclined to VP and Parallel to HP';
    model.categoryDescription = 'Top view shows true length and φ; front view parallel to XY';
    return;
  }

  if (model.front_view_length_mm !== null && model.top_view_length_mm !== null) {
    model.category = 'SL_09_FIND_TRUE_LENGTH';
    model.categoryTitle = 'Find True Length';
    model.categoryDescription = 'Calculating TL and true inclinations from apparent projections';
    return;
  }

  if (model.endpoint_A.z !== null && model.endpoint_B.z !== null && Math.sign(model.endpoint_A.z) !== Math.sign(model.endpoint_B.z)) {
    model.category = 'SL_08_DIFFERENT_QUADRANTS';
    model.categoryTitle = 'Endpoints in Different Quadrants';
    model.categoryDescription = 'Line crosses ground reference plane XY between quadrants';
    return;
  }

  if (model.endpoint_A.distHp !== null && model.endpoint_A.distVp !== null && model.endpoint_B.distHp !== null && model.endpoint_B.distVp !== null && model.dep_projector_distance_mm !== null) {
    model.category = 'SL_07_ENDPOINT_COORDINATES';
    model.categoryTitle = 'Endpoint Coordinates Given';
    model.categoryDescription = 'Deriving all lengths and angles from known endpoint positions';
    return;
  }

  if (model.front_view_angle_deg !== null && model.inclination_hp_deg === null) {
    model.category = 'SL_11_FIND_APPARENT_ANGLES';
    model.categoryTitle = 'Find Apparent Angles';
    model.categoryDescription = 'Distinguishing apparent view angles α and β from true θ and φ';
    return;
  }

  model.category = 'SL_06_INCLINED_BOTH';
  model.categoryTitle = 'Line Inclined to Both HP and VP';
  model.categoryDescription = 'General oblique line with θ and φ';
}

/**
 * Validates constraints and solves the mathematical geometry per HEAD 3.
 */
export function solveNormalizedModel(model: NormalizedConstraintModel): NormalizedConstraintModel {
  model.validation_messages = [];
  let status: MasterValidationStatus = 'VALID';

  // 1. Check for CONTRADICTORY CONSTRAINTS (SL-19 / Regression TEST 6 & TEST 4)
  // Check 1A: Parallel to HP yet theta > 0
  if (model.parallel_to === 'HP' && model.inclination_hp_deg !== null && model.inclination_hp_deg > 0.1) {
    status = 'INCONSISTENT_CONSTRAINTS';
    model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
    model.contradiction_explanation = `Contradictory constraints: Line is declared parallel to HP (which requires θ = 0°), but is also specified with θ = ${model.inclination_hp_deg}°.`;
    model.validation_messages.push(model.contradiction_explanation);
  }

  // Check 1B: Parallel to VP yet phi > 0
  if (model.parallel_to === 'VP' && model.inclination_vp_deg !== null && model.inclination_vp_deg > 0.1) {
    status = 'INCONSISTENT_CONSTRAINTS';
    model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
    model.contradiction_explanation = `Contradictory constraints: Line is declared parallel to VP (which requires φ = 0°), but is also specified with φ = ${model.inclination_vp_deg}°.`;
    model.validation_messages.push(model.contradiction_explanation);
  }

  // Check 1C: Projected length exceeds True Length (TEST 4)
  if (model.true_length_mm !== null) {
    if (model.top_view_length_mm !== null && model.top_view_length_mm > model.true_length_mm + 0.05) {
      status = 'INCONSISTENT_CONSTRAINTS';
      model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
      model.contradiction_explanation = `Impossible geometry: Top-view length (${model.top_view_length_mm} mm) cannot exceed True Length (${model.true_length_mm} mm) in orthographic projection.`;
      model.validation_messages.push(model.contradiction_explanation);
    }
    if (model.front_view_length_mm !== null && model.front_view_length_mm > model.true_length_mm + 0.05) {
      status = 'INCONSISTENT_CONSTRAINTS';
      model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
      model.contradiction_explanation = `Impossible geometry: Front-view length (${model.front_view_length_mm} mm) cannot exceed True Length (${model.true_length_mm} mm) in orthographic projection.`;
      model.validation_messages.push(model.contradiction_explanation);
    }
  }

  // Check 1D: sin^2(theta) + sin^2(phi) > 1 in 3D Euclidean space
  if (model.inclination_hp_deg !== null && model.inclination_vp_deg !== null) {
    const sTheta = Math.sin(model.inclination_hp_deg * DEG_TO_RAD);
    const sPhi = Math.sin(model.inclination_vp_deg * DEG_TO_RAD);
    const angleSum = sTheta * sTheta + sPhi * sPhi;
    if (angleSum > 1.0005) {
      status = 'INCONSISTENT_CONSTRAINTS';
      model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
      model.contradiction_explanation = `Geometric violation: sin²(θ) + sin²(φ) = ${angleSum.toFixed(3)} > 1.0. A straight line in Euclidean space cannot be inclined at θ=${model.inclination_hp_deg}° and φ=${model.inclination_vp_deg}°.`;
      model.validation_messages.push(model.contradiction_explanation);
    }
  }

  // Check 1E: DEP exceeds projected lengths
  if (model.dep_projector_distance_mm !== null) {
    if (model.front_view_length_mm !== null && model.dep_projector_distance_mm > model.front_view_length_mm + 0.05) {
      status = 'INCONSISTENT_CONSTRAINTS';
      model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
      model.contradiction_explanation = `Geometric violation: Distance between end projectors (${model.dep_projector_distance_mm} mm) cannot exceed Front View length (${model.front_view_length_mm} mm).`;
      model.validation_messages.push(model.contradiction_explanation);
    }
    if (model.top_view_length_mm !== null && model.dep_projector_distance_mm > model.top_view_length_mm + 0.05) {
      status = 'INCONSISTENT_CONSTRAINTS';
      model.category = 'SL_19_INCONSISTENT_CONSTRAINTS';
      model.contradiction_explanation = `Geometric violation: Distance between end projectors (${model.dep_projector_distance_mm} mm) cannot exceed Top View length (${model.top_view_length_mm} mm).`;
      model.validation_messages.push(model.contradiction_explanation);
    }
  }

  if (status === 'INCONSISTENT_CONSTRAINTS') {
    model.validation_status = status;
    model.solution_count = 0;
    model.candidate_solutions = [];
    return model;
  }

  // 2. Check for UNDERDETERMINED QUESTIONS (SL-20 / Regression TEST 5, 7, 10)
  // TEST 10: Apparent angle given without line orientation
  if (model.front_view_angle_deg !== null && model.inclination_hp_deg === null && model.parallel_to !== 'VP') {
    status = 'UNDERDETERMINED';
    model.category = 'SL_20_UNDERDETERMINED';
    model.missing_constraints_explanation = `Front-view angle with XY (α = ${model.front_view_angle_deg}°) is an apparent angle, which cannot be equated to true inclination θ without knowing the line's orientation to VP, true length, or top-view projection.`;
    model.validation_messages.push(model.missing_constraints_explanation);
    model.degrees_of_freedom = 3;
  }

  // Missing dimensions or unreadable labels (TEST 7)
  if (model.true_length_mm === null && model.front_view_length_mm === null && model.top_view_length_mm === null) {
    status = 'UNDERDETERMINED';
    model.category = 'SL_20_UNDERDETERMINED';
    model.missing_constraints_explanation = 'Insufficient dimension constraints: Neither True Length nor projected view lengths are defined. Specify at least one length constraint.';
    model.validation_messages.push(model.missing_constraints_explanation);
    model.degrees_of_freedom = 5;
  }

  // TEST 5: TL and both angles given, but endpoints / quadrant / direction along X unspecified
  const isEndpointSpecified = model.endpoint_A.distHp !== null && model.endpoint_A.distVp !== null;
  const isInclinedBoth = (model.inclination_hp_deg ?? 0) > 0 && (model.inclination_vp_deg ?? 0) > 0;
  if (!isEndpointSpecified && isInclinedBoth && model.true_length_mm !== null) {
    if (status !== 'UNDERDETERMINED') {
      status = 'MULTIPLE_SOLUTIONS';
      model.category = 'SL_18_MULTIPLE_SOLUTIONS';
      model.missing_constraints_explanation = `Orientation is feasible (TL = ${model.true_length_mm} mm, θ = ${model.inclination_hp_deg ?? 0}°, φ = ${model.inclination_vp_deg ?? 0}°), but endpoint placement and quadrant are unspecified (multiple valid positions exist in space).`;
      model.validation_messages.push(model.missing_constraints_explanation);
      model.degrees_of_freedom = 4;
    }
  }

  // 3. Mathematical Geometry Solving (HEAD 3)
  const solvedLine = solveGeometryCoordinates(model);

  model.validation_status = status;
  if (solvedLine) {
    model.candidate_solutions = [solvedLine];
    model.solution_count = status === 'MULTIPLE_SOLUTIONS' ? 4 : 1;

    // Traces calculation with finite segment vs extension distinction (SL-12 / TEST 8)
    computeTracesAnalysis(model, solvedLine);

    // Auxiliary plane calculations (SL-15)
    computeAuxiliaryPlaneGeometry(model, solvedLine);

    // Step-by-step engineering drafting procedure
    generateConstructionSteps(model, solvedLine);
  }

  return model;
}

/**
 * Solves 3D coordinates and creates standard ComputedLine for renderer
 */
function solveGeometryCoordinates(model: NormalizedConstraintModel): ComputedLine | null {
  const tl = model.true_length_mm ?? 50;
  const isPerpHP = model.perpendicular_to === 'HP';
  const isPerpVP = model.perpendicular_to === 'VP';
  const isParHP = model.parallel_to === 'HP' || model.parallel_to === 'BOTH' || isPerpVP;
  const isParVP = model.parallel_to === 'VP' || model.parallel_to === 'BOTH' || isPerpHP;

  let theta = model.inclination_hp_deg ?? (isPerpHP ? 90 : isParHP ? 0 : 30);
  let phi = model.inclination_vp_deg ?? (isPerpVP ? 90 : isParVP ? 0 : 45);

  // If apparent lengths are given and TL is unknown (SL-09 / TEST 9)
  if (model.true_length_mm === null && model.front_view_length_mm !== null && model.top_view_length_mm !== null) {
    const el = model.front_view_length_mm;
    const pl = model.top_view_length_mm;
    let dep = model.dep_projector_distance_mm ?? 0;

    // If EL and PL are given with TL known e.g. TEST 9 (TL=100, PL=60, EL=80)
    // TL^2 = dep^2 + deltaZ^2 + deltaY^2
    const maxDep = Math.min(el, pl);
    dep = Math.min(dep, maxDep);

    const deltaZ = Math.sqrt(Math.max(0, el * el - dep * dep));
    const deltaY = Math.sqrt(Math.max(0, pl * pl - dep * dep));
    const calculatedTL = Math.sqrt(dep * dep + deltaY * deltaY + deltaZ * deltaZ);

    theta = calculatedTL > 0 ? (Math.asin(Math.min(1, deltaZ / calculatedTL)) * 180) / Math.PI : 0;
    phi = calculatedTL > 0 ? (Math.asin(Math.min(1, deltaY / calculatedTL)) * 180) / Math.PI : 0;

    const inputForm: LineProblemInput = {
      mode: 'APPARENT_VALUES',
      nameA: model.endpoint_A.name,
      nameB: model.endpoint_B.name,
      color: '#2563eb',
      endA: {
        name: model.endpoint_A.name,
        hpRelation: model.endpoint_A.hpRelation ?? 'ABOVE',
        distanceHp: model.endpoint_A.distHp ?? 20,
        vpRelation: model.endpoint_A.vpRelation ?? 'IN_FRONT',
        distanceVp: model.endpoint_A.distVp ?? 25,
      },
      endB: {
        name: model.endpoint_B.name,
        hpRelation: 'ABOVE',
        distanceHp: (model.endpoint_A.distHp ?? 20) + deltaZ,
        vpRelation: 'IN_FRONT',
        distanceVp: (model.endpoint_A.distVp ?? 25) + deltaY,
      },
      dep,
      trueLength: calculatedTL,
      thetaDeg: theta,
      phiDeg: phi,
      frontViewLength: el,
      topViewLength: pl,
      endBQuadrant: 'ABOVE_FRONT',
      targetQuadrantB: 'FIRST',
    };
    return computeLineProjection(inputForm);
  }

  // Canonical resolution using true length and angles or endpoints
  const pAbove = model.endpoint_A.distHp ?? 25;
  const pFront = model.endpoint_A.distVp ?? 20;

  let qAbove = model.endpoint_B.distHp;
  if (qAbove === null || qAbove === undefined) {
    if (isParHP) qAbove = pAbove;
    else if (isPerpHP) qAbove = pAbove + tl;
    else qAbove = pAbove + tl * Math.sin((theta * Math.PI) / 180);
  }

  let qFront = model.endpoint_B.distVp;
  if (qFront === null || qFront === undefined) {
    if (isParVP) qFront = pFront;
    else if (isPerpVP) qFront = pFront + tl;
    else qFront = pFront + tl * Math.sin((phi * Math.PI) / 180);
  }

  let dep = model.dep_projector_distance_mm;
  if (dep === null || dep === undefined) {
    if (isPerpHP || isPerpVP) {
      dep = 0;
    } else {
      const thetaRad = theta * DEG_TO_RAD;
      const phiRad = phi * DEG_TO_RAD;
      const dy = tl * Math.sin(phiRad);
      const dz = tl * Math.sin(thetaRad);
      const dxSq = Math.max(0, tl * tl - dy * dy - dz * dz);
      dep = Math.round(Math.sqrt(dxSq) * 100) / 100;
    }
  }

  const inputForm: LineProblemInput = {
    mode: 'END_POINTS',
    nameA: model.endpoint_A.name,
    nameB: model.endpoint_B.name,
    color: '#2563eb',
    endA: {
      name: model.endpoint_A.name,
      hpRelation: model.endpoint_A.hpRelation ?? 'ABOVE',
      distanceHp: pAbove,
      vpRelation: model.endpoint_A.vpRelation ?? 'IN_FRONT',
      distanceVp: pFront,
    },
    endB: {
      name: model.endpoint_B.name,
      hpRelation: model.endpoint_B.hpRelation ?? 'ABOVE',
      distanceHp: qAbove,
      vpRelation: model.endpoint_B.vpRelation ?? 'IN_FRONT',
      distanceVp: qFront,
    },
    dep,
    trueLength: tl,
    thetaDeg: theta,
    phiDeg: phi,
    frontViewLength: model.front_view_length_mm ?? (isPerpVP ? 0 : tl * Math.cos((phi * Math.PI) / 180)),
    topViewLength: model.top_view_length_mm ?? (isPerpHP ? 0 : tl * Math.cos((theta * Math.PI) / 180)),
    endBQuadrant: 'ABOVE_FRONT',
    targetQuadrantB: 'FIRST',
  };

  return computeLineProjection(inputForm);
}

/**
 * Traces analysis per HEAD 1 & HEAD 4 (SL-12 & TEST 8)
 * Explicitly distinguishes finite segment intersection from infinite extension intersection!
 */
function computeTracesAnalysis(model: NormalizedConstraintModel, line: ComputedLine) {
  const { zA, zB, yA, yB, xA, xB } = line;
  const dZ = zB - zA;
  const dY = yB - yA;
  const dX = xB - xA;

  // Horizontal Trace (HT) - intersection with HP (Z = 0)
  if (Math.abs(dZ) < 1e-4) {
    model.known_traces.ht = {
      exists: false,
      type: 'HT',
      x: 0,
      y: 0,
      z: 0,
      isFiniteSegment: false,
      description: 'Line is parallel to HP (ΔZ = 0), so it never meets HP. HT does not exist.',
    };
  } else {
    const tHT = -zA / dZ;
    const xHT = xA + tHT * dX;
    const yHT = yA + tHT * dY;
    const isFinite = tHT >= -1e-4 && tHT <= 1.0001;

    let desc = '';
    if (isFinite) {
      desc = `HT intersects HP directly within the finite line segment at (${xHT.toFixed(1)}, ${yHT.toFixed(1)}, 0).`;
    } else {
      desc = `The finite line segment does not cross HP (both endpoints are on the same side of HP). The infinite extension of the line crosses HP at HT (${xHT.toFixed(1)}, ${yHT.toFixed(1)}, 0).`;
    }

    model.known_traces.ht = {
      exists: true,
      type: 'HT',
      x: xHT,
      y: yHT,
      z: 0,
      isFiniteSegment: isFinite,
      description: desc,
    };
  }

  // Vertical Trace (VT) - intersection with VP (Y = 0)
  if (Math.abs(dY) < 1e-4) {
    model.known_traces.vt = {
      exists: false,
      type: 'VT',
      x: 0,
      y: 0,
      z: 0,
      isFiniteSegment: false,
      description: 'Line is parallel to VP (ΔY = 0), so it never meets VP. VT does not exist.',
    };
  } else {
    const tVT = -yA / dY;
    const xVT = xA + tVT * dX;
    const zVT = zA + tVT * dZ;
    const isFinite = tVT >= -1e-4 && tVT <= 1.0001;

    let desc = '';
    if (isFinite) {
      desc = `VT intersects VP directly within the finite line segment at (${xVT.toFixed(1)}, 0, ${zVT.toFixed(1)}).`;
    } else {
      desc = `The finite line segment does not cross VP. The infinite extension of the line crosses VP at VT (${xVT.toFixed(1)}, 0, ${zVT.toFixed(1)}).`;
    }

    model.known_traces.vt = {
      exists: true,
      type: 'VT',
      x: xVT,
      y: 0,
      z: zVT,
      isFiniteSegment: isFinite,
      description: desc,
    };
  }
}

/**
 * Auxiliary plane geometry calculations per HEAD 1 & HEAD 3 (SL-15)
 */
function computeAuxiliaryPlaneGeometry(model: NormalizedConstraintModel, line: ComputedLine) {
  // Auxiliary Inclined Plane (AIP): inclined to HP at θ, perpendicular to VP.
  // Auxiliary reference ground line X1Y1 is set up parallel to the top view (ab).
  // Projection on AIP shows True Length and true inclination θ.
  const aipAngle = line.betaDeg; // parallel to top view
  const avpAngle = line.alphaDeg; // parallel to front view

  model.auxiliary_view_geometry = {
    aipX1Y1AngleDeg: Math.round(aipAngle * 10) / 10,
    avpX2Y2AngleDeg: Math.round(avpAngle * 10) / 10,
    aipElevationLength: Math.round(line.trueLength * 10) / 10,
    avpPlanLength: Math.round(line.trueLength * 10) / 10,
    auxiliaryTrueLength: Math.round(line.trueLength * 10) / 10,
    explanation: `Auxiliary ground line X₁Y₁ is drawn parallel to top view ab (inclination β=${aipAngle.toFixed(1)}°). Projectors drawn perpendicular to X₁Y₁ carry elevations zA=${line.zA}mm and zB=${line.zB}mm to reveal True Length (${line.trueLength.toFixed(1)} mm) and true angle θ=${line.thetaDeg.toFixed(1)}°.`,
  };
}

/**
 * Step-by-step construction steps per BIS SP 46:2003
 */
function generateConstructionSteps(model: NormalizedConstraintModel, line: ComputedLine) {
  const steps: MasterConstructionStep[] = [
    {
      step: 1,
      title: 'Draw Reference Ground Line XY',
      description: 'Draw a horizontal reference line XY of convenient length to represent the intersection of HP and VP.',
      tool: 'T-Square / Drafter',
      pencilGrade: '2H (Construction)',
    },
    {
      step: 2,
      title: `Plot Endpoint ${line.nameA} Projections (a′, a)`,
      description: `Draw the reference projector for ${line.nameA}. Mark front view a′ at ${Math.abs(line.zA)} mm ${line.zA >= 0 ? 'above' : 'below'} XY, and top view a at ${Math.abs(line.yA)} mm ${line.yA >= 0 ? 'below' : 'above'} XY.`,
      tool: 'Set-Square & Divider',
      pencilGrade: '2H (Construction)',
    },
  ];

  if (model.construction_method === 'ROTATING_LINE') {
    steps.push(
      {
        step: 3,
        title: `Draw Locus of ${line.nameB} (Elevation & Plan)`,
        description: `Draw horizontal parallel locus lines through b′ (y = ${line.zB} mm) and through b (y = ${-line.yB} mm).`,
        tool: 'Mini-Drafter / T-Square',
        pencilGrade: '2H (Construction)',
      },
      {
        step: 4,
        title: `Rotate True Length in Elevation (θ = ${line.thetaDeg.toFixed(1)}°)`,
        description: `From a′, draw a line of length TL = ${line.trueLength.toFixed(1)} mm at angle θ = ${line.thetaDeg.toFixed(1)}° meeting locus of b′ at b₁′. Project vertically to XY line to get plan length.`,
        tool: 'Protractor & Compass',
        pencilGrade: '2H (Construction)',
      },
      {
        step: 5,
        title: `Rotate Plan Length into Final Position`,
        description: `With center a and radius equal to plan length, draw an arc swinging to intersect the locus of b at final top view b. Connect a-b.`,
        tool: 'Bow Compass',
        pencilGrade: 'HB (Final Line)',
      },
      {
        step: 6,
        title: `Project to Elevation for Final Front View (a′b′)`,
        description: `Project point b vertically to meet the locus of b′ at b′. Join a′-b′ with a firm dark continuous line.`,
        tool: 'Set-Square & Pencil',
        pencilGrade: 'HB (Final Line)',
      }
    );
  } else if (model.construction_method === 'AUXILIARY_PLANE') {
    steps.push(
      {
        step: 3,
        title: 'Draw Auxiliary Ground Line X₁Y₁',
        description: `Draw auxiliary reference line X₁Y₁ parallel to plan view ab at a convenient distance.`,
        tool: 'Parallel Ruler / Drafter',
        pencilGrade: '2H (Construction)',
      },
      {
        step: 4,
        title: 'Project Perpendicularly from Top View to X₁Y₁',
        description: 'Draw projectors from points a and b perpendicular to X₁Y₁.',
        tool: 'Set-Square',
        pencilGrade: '2H (Construction)',
      },
      {
        step: 5,
        title: 'Transfer Elevations to Auxiliary View',
        description: `Measure height of a′ (${Math.abs(line.zA)} mm) and b′ (${Math.abs(line.zB)} mm) above XY, and transfer them along the auxiliary projectors from X₁Y₁. Join a₁′-b₁′ to obtain True Length (${line.trueLength.toFixed(1)} mm) and θ.`,
        tool: 'Divider & Ruler',
        pencilGrade: 'HB (Final Line)',
      }
    );
  } else {
    // Direct Projection
    steps.push(
      {
        step: 3,
        title: `Mark End Projector at DEP = ${line.dep.toFixed(1)} mm`,
        description: `Draw the second projector parallel to the first at distance DEP = ${line.dep.toFixed(1)} mm.`,
        tool: 'Divider & Set-Square',
        pencilGrade: '2H (Construction)',
      },
      {
        step: 4,
        title: `Mark Endpoint ${line.nameB} and Draw Views`,
        description: `Mark b′ on the second projector at ${Math.abs(line.zB)} mm and b at ${Math.abs(line.yB)} mm. Connect a′-b′ for Front View and a-b for Top View.`,
        tool: 'Drafter & HB Pencil',
        pencilGrade: 'HB (Final Line)',
      }
    );
  }

  model.construction_steps = steps;
}
