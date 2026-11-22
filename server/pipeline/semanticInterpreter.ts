/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type, GoogleGenAI } from '@google/genai';
import {
  ENGINEERING_MODULE_REGISTRY,
  getModuleDescriptor,
  mapModuleToTaskDomain,
  type EngineeringModuleDescriptor,
  type EngineeringModuleId,
} from '../../src/pipeline/moduleRegistry.ts';
import {
  createMeasurementField,
  type GeometricConstraint,
  type InterpretedEntity,
  type MeasurementField,
  type PointEntitySpec,
  type PointRelativeRelation,
  type UncertainReading,
  type ValidationIssue,
} from '../../src/pipeline/schema.ts';
import { detectUncertainOcrReadings, isGeminiConfigured } from './ocrService.ts';

const GEMINI_SEMANTIC_MODEL = 'gemini-4-hydrogen';

export interface SemanticLinePayload {
  lineLabel: string;
  startChar: string;
  endChar: string;
  explicitLabel: boolean;
  startHp: 'above' | 'below' | 'on' | null;
  startVp: 'in_front' | 'behind' | 'on' | null;
  endHp: 'above' | 'below' | 'on' | null;
  endVp: 'in_front' | 'behind' | 'on' | null;
  branchPreference: 'first_quadrant_positive' | 'explicit_endpoints' | 'unspecified';
}

export interface SemanticPointsPayload {
  points: PointEntitySpec[];
  relativeRelations: PointRelativeRelation[];
}

export interface SemanticInterpretationResult {
  normalized_text: string;
  module: EngineeringModuleDescriptor;
  module_confidence: number | null;
  selection_reason: string;
  task_domain: ReturnType<typeof mapModuleToTaskDomain>;
  projection_system: 'first_angle' | 'third_angle';
  requested_outputs: string[];
  interpretation_method: 'gemini_semantic' | 'deterministic_semantic' | 'hybrid';
  entities: InterpretedEntity[];
  givens: Record<string, MeasurementField>;
  constraints: GeometricConstraint[];
  assumptions: string[];
  unresolved_questions: string[];
  ambiguities_notes: string[];
  repair_notes: string[];
  issues: ValidationIssue[];
  uncertain_readings: UncertainReading[];
  line_payload: SemanticLinePayload | null;
  points_payload: SemanticPointsPayload | null;
  unsupported_topic_label?: string;
}

export function normalizeUnitToMm(value: number, unitRaw: string): { valueMm: number; originalUnit: string } {
  const unit = unitRaw.trim().toLowerCase();
  if (unit === 'cm') return { valueMm: Number((value * 10).toFixed(4)), originalUnit: 'cm' };
  if (unit === 'm' || unit === 'meter' || unit === 'meters') {
    return { valueMm: Number((value * 1000).toFixed(4)), originalUnit: 'm' };
  }
  if (unit === 'in' || unit === 'inch' || unit === 'inches') {
    return { valueMm: Number((value * 25.4).toFixed(4)), originalUnit: 'in' };
  }
  return { valueMm: value, originalUnit: 'mm' };
}

export function normalizeAngleToDeg(value: number, unitRaw: string): { valueDeg: number; originalUnit: string } {
  const unit = unitRaw.trim().toLowerCase();
  if (unit === 'rad' || unit === 'radian' || unit === 'radians') {
    return { valueDeg: Number(((value * 180) / Math.PI).toFixed(4)), originalUnit: 'rad' };
  }
  return { valueDeg: value, originalUnit: 'deg' };
}

/**
 * Light structural cleanup that preserves raw numbers and uncertain tokens
 * (never silently rewrites numbers or degree errors like "300" -> "30").
 */
export function lightNormalizeProblemText(rawText: string): string {
  let s = rawText.replace(/\r\n/g, '\n').trim();
  // Strip explicit [DIAGRAM EVIDENCE]: lines from prose normalization (preserved in source.diagram_evidence)
  s = s.replace(/(?:^|\n)\s*\[DIAGRAM\s+EVIDENCE\]\s*:[^\n]*/gi, '');
  // Strip textbook numbered drawing procedure steps that follow the question statement
  s = s.replace(
    /(?:^|\n)\s*\d+[\.\)]\s*[^\n]*(?:draw\s+(?:line|xy)|mark\s+[a-z]['′]|join\s+[a-z]|with\s+[a-z]['′]\s+as\s+centre)[^\n]*/gi,
    ''
  );
  s = s.replace(/\bhorizontal\s+plane\b/gi, 'HP');
  s = s.replace(/\bvertical\s+plane\b/gi, 'VP');
  s = s.replace(/\bprofile\s+plane\b/gi, 'PP');
  s = s.replace(/\bH\s*\.\s*P\.?/gi, 'HP');
  s = s.replace(/\bV\s*\.\s*P\.?/gi, 'VP');
  s = s.replace(/\breference\s+line\s+(?:x\s*-?\s*y|xy)\b/gi, 'XY');
  s = s.replace(/\bground\s+line\s+(?:x\s*-?\s*y|xy)\b/gi, 'XY');
  s = s.replace(/\bx\s*-\s*y\b/gi, 'XY');
  s = s.replace(/\blinc\b/gi, 'line');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Split problem text into semantic clauses without breaking decimal numbers or "St." / "N.D." abbreviations.
 */
function segmentClauses(text: string): string[] {
  const parts = text.split(/(?<!\d)[.;\n]+(?!\d)\s*/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function detectRequestedOutputs(lowerText: string, moduleId: EngineeringModuleId): string[] {
  const outputs: string[] = [];
  if (lowerText.includes('front view') || lowerText.includes('elevation') || lowerText.includes('projections')) {
    outputs.push('front_view');
  }
  if (lowerText.includes('top view') || lowerText.includes('plan') || lowerText.includes('projections')) {
    outputs.push('top_view');
  }
  if (moduleId === 'projection_of_points') {
    if (lowerText.includes('quadrant') || lowerText.includes('position') || lowerText.includes('locate')) {
      outputs.push('quadrant');
    }
    if (lowerText.includes('coordinate')) outputs.push('coordinates_3d');
    if (outputs.length === 0) outputs.push('front_view', 'top_view', 'quadrant');
    return Array.from(new Set(outputs));
  }

  if (lowerText.includes('true length') || lowerText.includes('find tl') || /\bfind\b.*\blength\b/i.test(lowerText)) {
    outputs.push('true_length');
  }
  if (
    lowerText.includes('inclination') ||
    lowerText.includes('angle') ||
    lowerText.includes('find θ') ||
    lowerText.includes('find φ') ||
    lowerText.includes('theta') ||
    lowerText.includes('phi')
  ) {
    outputs.push('true_inclinations');
  }
  if (lowerText.includes('trace')) outputs.push('traces');
  if (outputs.length === 0) {
    outputs.push('front_view', 'top_view');
  }
  return Array.from(new Set(outputs));
}

interface ModuleClassificationOutcome {
  moduleId: EngineeringModuleId;
  confidence: number | null;
  reason: string;
  unsupportedLabel?: string;
}

/**
 * Context-aware semantic module classifier.
 * Classifies by geometric entity, plane/view context, and relationship structure rather than single keywords.
 */
export function classifyModuleContext(normalizedText: string): ModuleClassificationOutcome {
  const lower = normalizedText.toLowerCase();

  // Check future / unsupported Engineering Graphics topics FIRST when primary entity clearly matches
  if (
    /\b(?:section\s+plane|cutting\s+plane|sectional\s+(?:front|top|side)\s+view|true\s+shape\s+of\s+(?:the\s+)?section)\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'sections_of_solids',
      confidence: 0.92,
      reason: 'Question specifies cutting/section plane or sectional view construction.',
      unsupportedLabel: 'Sections of Solids',
    };
  }

  if (
    /\b(?:development\s+of\s+(?:the\s+)?(?:lateral\s+)?surface|stretch[-\s]?out|radial\s+line\s+development|parallel\s+line\s+development)\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'development_of_surfaces',
      confidence: 0.92,
      reason: 'Question asks for surface development construction.',
      unsupportedLabel: 'Development of Surfaces',
    };
  }

  if (
    /\b(?:curve\s+of\s+intersection|interpenetrat(?:e|ing|ion)|intersection\s+of\s+(?:surfaces|cylinders|prisms|cones))\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'intersection_of_surfaces',
      confidence: 0.9,
      reason: 'Question concerns surface interpenetration curves.',
      unsupportedLabel: 'Intersection of Surfaces',
    };
  }

  if (
    /\b(?:pentagonal|hexagonal|square|triangular|rectangular|octagonal|circular)?\s*(?:prism|pyramid|tetrahedron|cube|hexahedron|octahedron|cylinder|cone|frustum)\b/i.test(
      normalizedText
    ) &&
    !/\bstraight\s+line\b/i.test(normalizedText)
  ) {
    return {
      moduleId: 'projection_of_solids',
      confidence: 0.94,
      reason: 'Primary geometric entity is a 3D solid (prism, pyramid, cylinder, cone, or polyhedron).',
      unsupportedLabel: 'Projection of Solids',
    };
  }

  if (
    /\b(?:lamina|plane\s+figure|thin\s+(?:plate|sheet)|(?:triangular|square|rectangular|pentagonal|hexagonal|circular)\s+(?:plate|lamina|plane|disc))\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'projection_of_planes',
      confidence: 0.93,
      reason: 'Primary geometric entity is a 2D planar lamina/plate rather than a point or line segment.',
      unsupportedLabel: 'Projection of Planes / Laminas',
    };
  }

  if (/\b(?:isometric\s+(?:view|projection|scale|box|axes))\b/i.test(normalizedText)) {
    return {
      moduleId: 'isometric_projections',
      confidence: 0.92,
      reason: 'Question requests isometric projection or isometric view construction.',
      unsupportedLabel: 'Isometric Projections',
    };
  }

  if (
    /\b(?:pictorial\s+view|orthographic\s+views?\s+of\s+(?:the\s+)?(?:object|block|bracket|machine|casting)|sectional\s+view\s+looking\s+from)\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'orthographic_projections',
      confidence: 0.88,
      reason: 'Question asks for multi-view orthographic projections of a 3D machine/pictorial object.',
      unsupportedLabel: 'Orthographic Projections of Machine Blocks',
    };
  }

  if (
    /\b(?:perspective\s+(?:view|projection)|picture\s+plane|station\s+point|vanishing\s+point|horizon\s+line)\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'perspective_drawing',
      confidence: 0.92,
      reason: 'Question uses perspective projection elements (station point, picture plane, vanishing point).',
      unsupportedLabel: 'Perspective Projection',
    };
  }

  if (
    /\b(?:ellipse|parabola|hyperbola|cycloid|epicycloid|hypocycloid|involute|archimedean\s+spiral|helix|eccentricity|directrix)\b/i.test(
      normalizedText
    )
  ) {
    return {
      moduleId: 'engineering_curves',
      confidence: 0.93,
      reason: 'Question involves conic sections or engineering curves.',
      unsupportedLabel: 'Engineering Curves',
    };
  }

  // Distinguish Straight Line vs Point vs Auxiliary View vs Unknown
  const hasLineEntity =
    /\b(?:straight\s+line|line\s+segment|segment\s+[a-z]{1,2})\b/i.test(normalizedText) ||
    /\bline\s+[A-Z]{2}\b/.test(normalizedText) ||
    /\bline\b(?:\s+[A-Za-z])?/i.test(lower) && !/\b(?:xy\s+line|reference\s+line|ground\s+line|projector\s+line)\b/i.test(
      lower.replace(/\b(?:xy|reference|ground|projector)\s+line\b/gi, '')
    ) === false;

  // Clean out "XY line", "reference line", "ground line", "projector line" before checking for bare "line"
  const textWithoutRefLines = normalizedText
    .replace(/\b(?:xy|x-y|xv|reference|ground|vertical|horizontal|projector|locus)\s+line\b/gi, '')
    .replace(/\bline\s+xy\b/gi, '');

  const explicitLineIndicator =
    /\b(?:straight\s+line|line\s+segment|line\s+[A-Z]{2}|true\s+length|front[\s-]*view\s+length|top[\s-]*view\s+length|end\s+projectors|distance\s+between\s+(?:the\s+)?(?:end\s+)?projectors|\bdep\b|\btl\b|\bfv\s*=|\btv\s*=|inclined\s+(?:at\s+)?[-+]?\d|making\s+an\s+angle)\b/i.test(
      textWithoutRefLines
    ) ||
    /\b(?:ends?|extremit(?:y|ies))\s+[A-Z]\b/i.test(textWithoutRefLines) ||
    /\bparallel\s+to\s+(?:HP|VP|both)\b/i.test(textWithoutRefLines) ||
    /\bperpendicular\s+to\s+(?:HP|VP)\b/i.test(textWithoutRefLines) ||
    /\bline\b/i.test(textWithoutRefLines);

  const explicitPointIndicator =
    /\bpoints?\s+[A-Z0-9]{1,3}\b/i.test(textWithoutRefLines) ||
    /\bcoordinates?\b/i.test(textWithoutRefLines) ||
    /\bquadrants?\b/i.test(textWithoutRefLines) ||
    /\b(?:x\s*=|y\s*=|z\s*=|signed\s+depth|signed\s+height)\b/i.test(textWithoutRefLines) ||
    /\b[A-Z]\s*\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/.test(textWithoutRefLines);

  if (
    /\b(?:auxiliary\s+inclined\s+plane|auxiliary\s+vertical\s+plane|auxiliary\s+view)\b/i.test(normalizedText) &&
    !explicitLineIndicator
  ) {
    return {
      moduleId: 'auxiliary_views',
      confidence: 0.85,
      reason: 'Question requests an auxiliary view without identifying a straight-line projection problem.',
      unsupportedLabel: 'Auxiliary Views',
    };
  }

  // If straight-line indicators exist (e.g. "line AB", "true length", "front view length", "inclined at 30 to HP", "end A"),
  // route to Straight Lines unless the question clearly only defines point(s) with no line segment.
  const hasLineExclusiveMetric =
    /\b(?:straight\s+line|line\s+segment|line\s+[A-Z]{2}|true\s+length|front[\s-]*view\s+length|top[\s-]*view\s+length|distance\s+between\s+(?:the\s+)?(?:end\s+)?projectors|\bdep\b|\btl\b|front\s+view\s*=?\s*\d+\s*(?:mm|cm|m)\s+long|top\s+view\s*=?\s*\d+\s*(?:mm|cm|m)\s+long|fv\s*=|tv\s*=|alpha\s*=|beta\s*=|α\s*=|β\s*=|front\s+view\s+(?:makes|inclined)|top\s+view\s+(?:makes|inclined)|inclined\s+(?:at\s+)?[-+]?\d|parallel\s+to\s+(?:HP|VP|both)|perpendicular\s+to\s+(?:HP|VP)|end\s+[A-Z]\b|other\s+end\b|its\s+end\b)\b/i.test(
      textWithoutRefLines
    ) || /\bline\b/i.test(textWithoutRefLines);

  if (hasLineExclusiveMetric) {
    return {
      moduleId: 'projection_of_straight_lines',
      confidence: 0.94,
      reason: 'Recognized straight-line entities, lengths, inclinations, or end-point segment constraints.',
    };
  }

  // Point indicators (single point, multiple points, coordinates, quadrants, or above/below HP + in front/behind VP on a point)
  const hasHpVpPlaneContext =
    /\b(?:above|below|in|on|from)\s+(?:the\s+)?HP\b/i.test(normalizedText) ||
    /\b(?:in\s+front\s+of|behind|in|on|from)\s+(?:the\s+)?VP\b/i.test(normalizedText) ||
    /\b(?:front\s+view|top\s+view|elevation|plan)\s+(?:is\s+|lies\s+)?(?:\d+(?:\.\d+)?\s*(?:mm|cm|m)\s+)?(?:above|below|on)\s+(?:the\s+)?XY\b/i.test(
      normalizedText
    );

  if (explicitPointIndicator || (hasHpVpPlaneContext && !hasLineEntity)) {
    return {
      moduleId: 'projection_of_points',
      confidence: 0.93,
      reason: 'Recognized point entity/coordinates/quadrant relations with HP/VP or XY without line-segment attributes.',
    };
  }

  return {
    moduleId: 'unknown_module',
    confidence: 0.2,
    reason: 'Insufficient geometric entity or Engineering Graphics context to assign a module safely.',
  };
}

function extractEndpoints(text: string): { start: string; end: string; lineLabel: string; explicit: boolean } {
  const reservedPairs = new Set([
    'HP', 'VP', 'XY', 'XV', 'PP', 'TV', 'FV', 'TL', 'MM', 'CM', 'IN', 'IS', 'OF',
    'TO', 'AT', 'ON', 'BY', 'OR', 'AN', 'AS', 'IT', 'IF', 'SO', 'NO', 'DO',
  ]);

  const patterns: RegExp[] = [
    /(?:straight\s+)?line\s+([A-Z])([A-Z])\b/,
    /(?:straight\s+)?line\s+([A-Za-z])([A-Za-z])\b/i,
    /\b([A-Z])([A-Z])\b\s*,?\s*(?:measuring|of\s+(?:true\s+)?length|is\s+\d|has\s+(?:its|a)|\d+(?:\.\d+)?\s*(?:mm|cm|m|in))/,
    /(?:line|segment)\s+(?:joining\s+)?([A-Za-z])\s*(?:to|and|-)\s*([A-Za-z])\b/i,
    /(?:end\s*point|end|point|extremity)\s+([A-Z])\b[\s\S]{0,180}?(?:end\s*point|end|point|extremity)\s+([A-Z])\b/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const a = m[1].toUpperCase();
      const b = m[2].toUpperCase();
      const pair = `${a}${b}`;
      if (a !== b && !reservedPairs.has(pair)) {
        return { start: a, end: b, lineLabel: pair, explicit: true };
      }
    }
  }

  // Single endpoint mentioned ("Its end P is..." or "One end K is...")
  const singleEnd = text.match(/(?:one\s+end|its\s+end|end\s*point|end)\s+([A-Z])\b/);
  if (singleEnd && !['H', 'V', 'X'].includes(singleEnd[1])) {
    const s = singleEnd[1].toUpperCase();
    const e = s === 'A' ? 'B' : s === 'P' ? 'Q' : s === 'L' ? 'K' : 'B';
    return { start: s, end: e, lineLabel: `${s}${e}`, explicit: false };
  }

  return { start: 'A', end: 'B', lineLabel: 'AB', explicit: false };
}

function extractEndpointPosition(
  text: string,
  pointChar: string,
  isPrimaryStart: boolean
): {
  zHp: { value: number; originalValue: number; originalUnit: string; relation: 'above' | 'below' | 'on'; excerpt: string } | null;
  yVp: { value: number; originalValue: number; originalUnit: string; relation: 'in_front' | 'behind' | 'on'; excerpt: string } | null;
  ambiguousRelationIssues: ValidationIssue[];
} {
  const p = pointChar;
  const pEsc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ambiguousRelationIssues: ValidationIssue[] = [];

  const sentences = segmentClauses(text);
  const relevantClauses = sentences.filter((s) =>
    new RegExp(`(?:end\\s*point|end|point|extremity)\\s+${pEsc}\\b|\\b${pEsc}\\s+is\\b|\\b${pEsc}\\s+lies\\b`, 'i').test(s)
  );
  if (isPrimaryStart && relevantClauses.length === 0) {
    const fallbackClauses = sentences.filter((s) =>
      /(?:its\s+end(?:\s*point)?|one\s+end(?:\s*point)?|it\s+is\s+\d)/i.test(s)
    );
    relevantClauses.push(...fallbackClauses);
  }

  const searchText = relevantClauses.join(' ; ');

  let zHp: {
    value: number;
    originalValue: number;
    originalUnit: string;
    relation: 'above' | 'below' | 'on';
    excerpt: string;
  } | null = null;

  const onHpRe = new RegExp(
    `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b|its\\s+end(?:\\s*point)?|one\\s+end(?:\\s*point)?)[^.;]{0,55}?(?:is\\s+|lies\\s+)?(?:in|on)\\s+(?:the\\s+)?HP\\b`,
    'i'
  );
  const onBothRe = new RegExp(
    `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b)[^.;]{0,55}?(?:in|on)\\s+both\\s+(?:the\\s+)?(?:HP\\s+and\\s+VP|VP\\s+and\\s+HP)`,
    'i'
  );
  const explicitAmbiguousHpRe =
    /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:either\s+)?(?:above\s+or\s+below|below\s+or\s+above)\s+(?:the\s+)?HP\b/i;
  const aboveHpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+above\s+(?:the\s+)?HP\b/i;
  const belowHpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+below\s+(?:the\s+)?HP\b/i;
  const fromHpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:away\s+)?from\s+(?:the\s+)?HP\b/i;

  const scopedHpMatch =
    searchText.match(
      new RegExp(
        `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b|its\\s+end(?:\\s*point)?|one\\s+end(?:\\s*point)?)[^.;]*?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|in|inch|inches)\\s+(above|below)\\s+(?:the\\s+)?HP\\b`,
        'i'
      )
    ) ||
    (relevantClauses.length > 0 ? searchText.match(aboveHpRe) || searchText.match(belowHpRe) : null);

  if (explicitAmbiguousHpRe.test(searchText)) {
    const m = searchText.match(explicitAmbiguousHpRe)!;
    ambiguousRelationIssues.push({
      code: 'AMBIGUOUS_HP_SIDE',
      stage: 'stage_2_parser',
      severity: 'error',
      field: isPrimaryStart ? 'start_z_hp' : 'end_z_hp',
      message: `Ambiguous wording "${m[0]}" for point ${p}: specify explicitly whether ${p} is ABOVE or BELOW HP.`,
    });
  } else if (onHpRe.test(searchText) || onBothRe.test(searchText)) {
    const m = searchText.match(onHpRe) || searchText.match(onBothRe);
    zHp = { value: 0, originalValue: 0, originalUnit: 'mm', relation: 'on', excerpt: m ? m[0] : `${p} in HP` };
  } else if (scopedHpMatch) {
    const num = parseFloat(scopedHpMatch[1]);
    const unit = scopedHpMatch[2];
    const relRaw = (scopedHpMatch[3] || (scopedHpMatch[0].toLowerCase().includes('below') ? 'below' : 'above')).toLowerCase();
    const { valueMm, originalUnit } = normalizeUnitToMm(num, unit);
    const relation = valueMm === 0 ? 'on' : relRaw === 'below' ? 'below' : 'above';
    zHp = {
      value: relation === 'below' ? -valueMm : valueMm,
      originalValue: num,
      originalUnit,
      relation,
      excerpt: scopedHpMatch[0],
    };
  } else if (fromHpRe.test(searchText)) {
    const m = searchText.match(fromHpRe)!;
    const num = parseFloat(m[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(num, m[2]);
    const relation = valueMm === 0 ? 'on' : 'above';
    zHp = {
      value: valueMm,
      originalValue: num,
      originalUnit,
      relation,
      excerpt: `${m[0]} (First-Angle default: above HP)`,
    };
    ambiguousRelationIssues.push({
      code: 'FIRST_ANGLE_DEFAULT_HP_SIDE',
      stage: 'stage_2_parser',
      severity: 'info',
      field: isPrimaryStart ? 'start_z_hp' : 'end_z_hp',
      message: `Interpreted "${m[0]}" for point ${p} as ${valueMm} mm ABOVE HP under First-Angle projection convention.`,
    });
  }

  let yVp: {
    value: number;
    originalValue: number;
    originalUnit: string;
    relation: 'in_front' | 'behind' | 'on';
    excerpt: string;
  } | null = null;

  const onVpRe = new RegExp(
    `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b|its\\s+end(?:\\s*point)?|one\\s+end(?:\\s*point)?)[^.;]{0,75}?(?:is\\s+|lies\\s+|and\\s+)?(?:in|on)\\s+(?:the\\s+)?VP\\b`,
    'i'
  );
  const explicitAmbiguousVpRe =
    /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:either\s+)?(?:in\s+front\s+(?:of\s+)?or\s+behind|behind\s+or\s+in\s+front(?:\s+of)?)\s+(?:the\s+)?VP\b/i;
  const inFrontVpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+in\s+front\s+of\s+(?:the\s+)?VP\b/i;
  const behindVpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+behind\s+(?:the\s+)?VP\b/i;
  const fromVpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:away\s+)?from\s+(?:the\s+)?VP\b/i;

  const scopedVpMatch =
    searchText.match(
      new RegExp(
        `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b|its\\s+end(?:\\s*point)?|one\\s+end(?:\\s*point)?)[^.;]*?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|in|inch|inches)\\s+(in\\s+front\\s+of|behind)\\s+(?:the\\s+)?VP\\b`,
        'i'
      )
    ) ||
    (relevantClauses.length > 0 ? searchText.match(inFrontVpRe) || searchText.match(behindVpRe) : null);

  if (explicitAmbiguousVpRe.test(searchText)) {
    const m = searchText.match(explicitAmbiguousVpRe)!;
    ambiguousRelationIssues.push({
      code: 'AMBIGUOUS_VP_SIDE',
      stage: 'stage_2_parser',
      severity: 'error',
      field: isPrimaryStart ? 'start_y_vp' : 'end_y_vp',
      message: `Ambiguous wording "${m[0]}" for point ${p}: specify explicitly whether ${p} is IN FRONT OF or BEHIND VP.`,
    });
  } else if (onVpRe.test(searchText) || onBothRe.test(searchText)) {
    const m = searchText.match(onVpRe) || searchText.match(onBothRe);
    yVp = { value: 0, originalValue: 0, originalUnit: 'mm', relation: 'on', excerpt: m ? m[0] : `${p} in VP` };
  } else if (scopedVpMatch) {
    const num = parseFloat(scopedVpMatch[1]);
    const unit = scopedVpMatch[2];
    const relRaw = (scopedVpMatch[3] || (scopedVpMatch[0].toLowerCase().includes('behind') ? 'behind' : 'in front of')).toLowerCase();
    const { valueMm, originalUnit } = normalizeUnitToMm(num, unit);
    const relation = valueMm === 0 ? 'on' : relRaw.includes('behind') ? 'behind' : 'in_front';
    yVp = {
      value: relation === 'behind' ? -valueMm : valueMm,
      originalValue: num,
      originalUnit,
      relation,
      excerpt: scopedVpMatch[0],
    };
  } else if (fromVpRe.test(searchText)) {
    const m = searchText.match(fromVpRe)!;
    const num = parseFloat(m[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(num, m[2]);
    const relation = valueMm === 0 ? 'on' : 'in_front';
    yVp = {
      value: valueMm,
      originalValue: num,
      originalUnit,
      relation,
      excerpt: `${m[0]} (First-Angle default: in front of VP)`,
    };
    ambiguousRelationIssues.push({
      code: 'FIRST_ANGLE_DEFAULT_VP_SIDE',
      stage: 'stage_2_parser',
      severity: 'info',
      field: isPrimaryStart ? 'start_y_vp' : 'end_y_vp',
      message: `Interpreted "${m[0]}" for point ${p} as ${valueMm} mm IN FRONT OF VP under First-Angle projection convention.`,
    });
  }

  return { zHp, yVp, ambiguousRelationIssues };
}

function interpretStraightLineSemantics(
  normalizedText: string,
  lower: string,
  uncertainReadings: UncertainReading[]
): {
  entities: InterpretedEntity[];
  givens: Record<string, MeasurementField>;
  constraints: GeometricConstraint[];
  issues: ValidationIssue[];
  assumptions: string[];
  unresolvedQuestions: string[];
  linePayload: SemanticLinePayload;
} {
  const issues: ValidationIssue[] = [];
  const constraints: GeometricConstraint[] = [];
  const givens: Record<string, MeasurementField> = {};
  const assumptions: string[] = [];
  const unresolvedQuestions: string[] = [];

  const endpoints = extractEndpoints(normalizedText);
  const startChar = endpoints.start;
  const endChar = endpoints.end;
  const lineLabel = endpoints.lineLabel;

  const entities: InterpretedEntity[] = [
    { id: `line_${lineLabel}`, kind: 'straight_line', label: lineLabel, role: 'primary_segment' },
    { id: `pt_${startChar}`, kind: 'point', label: startChar, role: 'start_endpoint' },
    { id: `pt_${endChar}`, kind: 'point', label: endChar, role: 'end_endpoint' },
  ];

  const recordGiven = (params: {
    property: string;
    value: number;
    unit: 'mm' | 'deg';
    excerpt: string;
    originalValue?: number;
    originalUnit?: string;
    reference?: { entity: string; relation: string; target: string };
    epistemic?: 'observed' | 'inferred' | 'assumed';
  }) => {
    givens[params.property] = createMeasurementField({
      property: params.property,
      value: params.value,
      unit: params.unit,
      original_value: params.originalValue ?? params.value,
      original_unit: params.originalUnit ?? params.unit,
      status: 'given',
      source_stage: 'stage_2_semantic_interpreter',
      epistemic_status: params.epistemic ?? 'observed',
      reference: params.reference,
      excerpt: params.excerpt,
      validation_status: 'unvalidated',
    });
  };

  // Detect ambiguous plane reference wording
  const ambiguousPlaneAngle = normalizedText.match(
    /inclined\s+at\s+\d+(?:\.\d+)?\s*(?:°|deg|degree|degrees)?\s+to\s+(?:one\s+of\s+the\s+planes|a\s+reference\s+plane|either\s+plane)/i
  );
  if (ambiguousPlaneAngle) {
    issues.push({
      code: 'AMBIGUOUS_PLANE_REFERENCE',
      stage: 'stage_2_parser',
      severity: 'error',
      field: 'theta_hp',
      message: `Ambiguous wording "${ambiguousPlaneAngle[0]}": specify explicitly whether the angle is to HP or VP.`,
    });
    unresolvedQuestions.push('Clarify whether the stated inclination angle applies to HP or VP.');
  }

  // 1. True Length
  const tlPatterns = [
    /(?:true\s+length(?:\s+of\s+(?:the\s+)?line)?(?:\s+[A-Za-z]{2})?\s*(?:is|=|of)?\s*)(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i,
    /(?:straight\s+)?line(?:\s+[A-Za-z]{2})?\s*,?\s*(?:is\s+|of\s+|measuring\s+|has\s+(?:a\s+)?)?(?:length\s*(?:of\s*)?)?(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s*(?:long|in\s+length|length)?\b/i,
    /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:long|in\s+length|length)\b/i,
    /\bTL\s*=\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)?\b/i,
  ];
  for (const re of tlPatterns) {
    const m = normalizedText.match(re);
    if (m) {
      const idx = m.index ?? 0;
      const prefix = normalizedText.slice(Math.max(0, idx - 35), idx);
      if (/(?:front\s+view|top\s+view|elevation|plan|side\s+view|projector(?:s)?)\s*(?:length\s*)?(?:is|of|measures|=)?\s*$/i.test(prefix)) {
        continue;
      }
      const rawVal = parseFloat(m[1]);
      const rawUnit = m[2] || 'mm';
      const { valueMm, originalUnit } = normalizeUnitToMm(rawVal, rawUnit);
      recordGiven({
        property: 'true_length',
        value: valueMm,
        unit: 'mm',
        excerpt: m[0],
        originalValue: rawVal,
        originalUnit,
        reference: { entity: `line_${lineLabel}`, relation: 'true_length_of', target: '3D_space' },
      });
      break;
    }
  }

  // 2. Front View Length (Elevation)
  const fvMatch =
    normalizedText.match(
      /(?:front\s+view|elevation)(?:\s+(?:length|measures|is|of))?\s*(?:=|is|of|measures)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i
    ) ||
    normalizedText.match(/\bFV\s*=\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)?\b/i);
  if (fvMatch) {
    const rawVal = parseFloat(fvMatch[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(rawVal, fvMatch[2] || 'mm');
    recordGiven({
      property: 'front_view_length',
      value: valueMm,
      unit: 'mm',
      excerpt: fvMatch[0],
      originalValue: rawVal,
      originalUnit,
      reference: { entity: 'front_view', relation: 'projected_length_on', target: 'VP' },
    });
  }

  // 3. Top View Length (Plan)
  const tvMatch =
    normalizedText.match(
      /(?:top\s+view|plan)(?:\s+(?:length|measures|is|of))?\s*(?:=|is|of|measures)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i
    ) ||
    normalizedText.match(/\bTV\s*=\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)?\b/i);
  if (tvMatch) {
    const rawVal = parseFloat(tvMatch[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(rawVal, tvMatch[2] || 'mm');
    recordGiven({
      property: 'top_view_length',
      value: valueMm,
      unit: 'mm',
      excerpt: tvMatch[0],
      originalValue: rawVal,
      originalUnit,
      reference: { entity: 'top_view', relation: 'projected_length_on', target: 'HP' },
    });
  }

  // 4. Distance Between End Projectors (DEP / |Δx|)
  const depMatch =
    normalizedText.match(
      /(?:distance\s+between\s+(?:the\s+)?(?:end\s+)?projectors|end\s+projectors\s+(?:are|is)\s+(?:apart\s+by)?|dep)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i
    ) ||
    normalizedText.match(
      /(?:end\s+)?projectors\s+are\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+apart/i
    ) ||
    normalizedText.match(/(?:delta\s*x|Δx|displacement\s+along\s+XY)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i);
  if (depMatch) {
    const rawVal = parseFloat(depMatch[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(rawVal, depMatch[2] || 'mm');
    recordGiven({
      property: 'dep',
      value: valueMm,
      unit: 'mm',
      excerpt: depMatch[0],
      originalValue: rawVal,
      originalUnit,
      reference: { entity: 'end_projectors', relation: 'horizontal_separation_along', target: 'XY' },
    });
  }

  // 4b. Direct height difference |Δz| and depth difference |Δy|
  const absDzMatch =
    normalizedText.match(
      /(?:vertical\s+(?:height\s+)?difference|height\s+difference|vertical\s+displacement|\|?Δz\|?|\|?dz\|?)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i
    ) ||
    normalizedText.match(
      new RegExp(
        `(?:end\\s*point|end|point)?\\s*${endChar}\\s+(?:is\\s+)?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|in|inch|inches)\\s+(?:higher|above)\\s+than\\s+(?:end\\s*point|end|point)?\\s*${startChar}\\b`,
        'i'
      )
    );
  if (absDzMatch) {
    const rawVal = parseFloat(absDzMatch[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(rawVal, absDzMatch[2] || 'mm');
    recordGiven({
      property: 'abs_delta_z',
      value: valueMm,
      unit: 'mm',
      excerpt: absDzMatch[0],
      originalValue: rawVal,
      originalUnit,
      reference: { entity: `line_${lineLabel}`, relation: 'height_difference_relative_to', target: 'HP' },
    });
  }

  const absDyMatch =
    normalizedText.match(
      /(?:depth\s+difference|depth\s+displacement|\|?Δy\|?|\|?dy\|?)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i
    ) ||
    normalizedText.match(
      new RegExp(
        `(?:end\\s*point|end|point)?\\s*${endChar}\\s+(?:is\\s+)?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|in|inch|inches)\\s+(?:further|farther)?\\s*in\\s+front\\s+of\\s+VP\\s+than\\s+(?:end\\s*point|end|point)?\\s*${startChar}\\b`,
        'i'
      )
    );
  if (absDyMatch) {
    const rawVal = parseFloat(absDyMatch[1]);
    const { valueMm, originalUnit } = normalizeUnitToMm(rawVal, absDyMatch[2] || 'mm');
    recordGiven({
      property: 'abs_delta_y',
      value: valueMm,
      unit: 'mm',
      excerpt: absDyMatch[0],
      originalValue: rawVal,
      originalUnit,
      reference: { entity: `line_${lineLabel}`, relation: 'depth_difference_relative_to', target: 'VP' },
    });
  }

  // 5. Parallel / Perpendicular Constraints
  const isPerpHp = /\b(?:perpendicular|perp\.?|normal)\s+to\s+(?:the\s+)?HP\b/i.test(normalizedText);
  const isPerpVp = /\b(?:perpendicular|perp\.?|normal)\s+to\s+(?:the\s+)?VP\b/i.test(normalizedText);
  const isParBoth = /\bparallel\s+to\s+both\s+(?:the\s+)?(?:HP\s+and\s+VP|VP\s+and\s+HP|planes)\b/i.test(normalizedText);
  const isParHp = isParBoth || /\bparallel\s+to\s+(?:the\s+)?HP\b/i.test(normalizedText);
  const isParVp = isParBoth || /\bparallel\s+to\s+(?:the\s+)?VP\b/i.test(normalizedText);

  if (isPerpHp) {
    constraints.push({
      id: 'c_perp_hp',
      kind: 'perpendicular_hp',
      target: lineLabel,
      relation: 'perpendicular_to_HP',
      value: true,
      unit: null,
      status: 'given',
      excerpt: 'perpendicular to HP',
    });
  }
  if (isPerpVp) {
    constraints.push({
      id: 'c_perp_vp',
      kind: 'perpendicular_vp',
      target: lineLabel,
      relation: 'perpendicular_to_VP',
      value: true,
      unit: null,
      status: 'given',
      excerpt: 'perpendicular to VP',
    });
  }
  if (isParHp) {
    constraints.push({
      id: 'c_par_hp',
      kind: 'parallel_hp',
      target: lineLabel,
      relation: 'parallel_to_HP',
      value: true,
      unit: null,
      status: 'given',
      excerpt: 'parallel to HP',
    });
  }
  if (isParVp) {
    constraints.push({
      id: 'c_par_vp',
      kind: 'parallel_vp',
      target: lineLabel,
      relation: 'parallel_to_VP',
      value: true,
      unit: null,
      status: 'given',
      excerpt: 'parallel to VP',
    });
  }

  // 6. Clause-aware Angle Disambiguation (CRITICAL: never confuse FV/TV angle with XY/XV with true HP/VP inclination!)
  const clauses = segmentClauses(normalizedText);
  const hasBlockingThetaOcr = uncertainReadings.some(
    (u) => u.severity === 'blocking' && u.suspected_property === 'theta_hp'
  );
  const hasBlockingPhiOcr = uncertainReadings.some(
    (u) => u.severity === 'blocking' && u.suspected_property === 'phi_vp'
  );

  for (const clause of clauses) {
    // Front view / elevation angle -> ALWAYS alpha_fv (never theta_hp)
    const isFvSubject = /\b(?:front[\s-]*view|elevation|a['′]b['′])\b/i.test(clause);
    const isTvSubject = /\b(?:top[\s-]*view|plan)\b/i.test(clause);

    const alphaClauseMatch =
      (isFvSubject
        ? clause.match(
            /(?:front[\s-]*view|elevation)[^.;]{0,55}?(?:inclined\s*(?:at)?|makes?\s*(?:an\s*angle\s*(?:of)?)?|angle\s*(?:of|=)?|at)\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?(?:XY|XV|HP|reference\s+line)\b/i
          )
        : null) ||
      clause.match(/(?:α|alpha|apparent\s+(?:front\s+view\s+)?angle\s*(?:alpha)?)\s*(?:=|is|of)?\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);

    if (alphaClauseMatch && !givens.alpha_fv) {
      const rawVal = parseFloat(alphaClauseMatch[1]);
      const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, alphaClauseMatch[2] || 'deg');
      recordGiven({
        property: 'alpha_fv',
        value: valueDeg,
        unit: 'deg',
        excerpt: alphaClauseMatch[0],
        originalValue: rawVal,
        originalUnit,
        reference: { entity: 'front_view', relation: 'angle_with', target: 'XY' },
      });
      constraints.push({
        id: 'c_alpha_fv',
        kind: 'view_angle',
        target: 'front_view',
        relation: 'angle_with_XY',
        value: valueDeg,
        unit: 'deg',
        status: 'given',
        excerpt: alphaClauseMatch[0],
      });
    }

    const betaClauseMatch =
      (isTvSubject
        ? clause.match(
            /(?:top[\s-]*view|plan)[^.;]{0,55}?(?:inclined\s*(?:at)?|makes?\s*(?:an\s*angle\s*(?:of)?)?|angle\s*(?:of|=)?|at)\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?(?:XY|XV|VP|reference\s+line)\b/i
          )
        : null) ||
      clause.match(/(?:β|beta|apparent\s+(?:top\s+view\s+)?angle\s*(?:beta)?)\s*(?:=|is|of)?\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);

    if (betaClauseMatch && !givens.beta_tv) {
      const rawVal = parseFloat(betaClauseMatch[1]);
      const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, betaClauseMatch[2] || 'deg');
      recordGiven({
        property: 'beta_tv',
        value: valueDeg,
        unit: 'deg',
        excerpt: betaClauseMatch[0],
        originalValue: rawVal,
        originalUnit,
        reference: { entity: 'top_view', relation: 'angle_with', target: 'XY' },
      });
      constraints.push({
        id: 'c_beta_tv',
        kind: 'view_angle',
        target: 'top_view',
        relation: 'angle_with_XY',
        value: valueDeg,
        unit: 'deg',
        status: 'given',
        excerpt: betaClauseMatch[0],
      });
    }

    // True inclination to HP (theta_hp): ONLY if the angle phrase is NOT governed by front_view/elevation with XY/XV
    if (!hasBlockingThetaOcr && !givens.theta_hp) {
      const thetaMatch =
        clause.match(
          /(?:inclined\s*(?:at)?|makes?\s+(?:an\s+)?angle\s+(?:of)?|angle\s+(?:of)?)\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?HP\b/i
        ) ||
        clause.match(/(?:and\s+)?(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)\s*(?:to|with)\s*(?:the\s+)?HP\b/i) ||
        clause.match(/(?:θ|theta)\s*=\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);

      if (thetaMatch) {
        const matchIdx = thetaMatch.index ?? 0;
        const prefix = clause.slice(0, matchIdx);
        const governedByView = /\b(?:front[\s-]*view|elevation|top[\s-]*view|plan)\b[^.;]*$/i.test(prefix);
        if (!governedByView) {
          const rawVal = parseFloat(thetaMatch[1]);
          const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, thetaMatch[2] || 'deg');
          recordGiven({
            property: 'theta_hp',
            value: valueDeg,
            unit: 'deg',
            excerpt: thetaMatch[0],
            originalValue: rawVal,
            originalUnit,
            reference: { entity: `line_${lineLabel}`, relation: 'inclined_to', target: 'HP' },
          });
        }
      }
    }

    // True inclination to VP (phi_vp)
    if (!hasBlockingPhiOcr && !givens.phi_vp) {
      const phiMatch =
        clause.match(
          /(?:inclined\s*(?:at)?|makes?\s+(?:an\s+)?angle\s+(?:of)?|angle\s+(?:of)?)\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?VP\b/i
        ) ||
        clause.match(/(?:and\s+)?(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)\s*(?:to|with)\s*(?:the\s+)?VP\b/i) ||
        clause.match(/(?:φ|phi)\s*=\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);

      if (phiMatch) {
        const matchIdx = phiMatch.index ?? 0;
        const prefix = clause.slice(0, matchIdx);
        const governedByView = /\b(?:front[\s-]*view|elevation|top[\s-]*view|plan)\b[^.;]*$/i.test(prefix);
        if (!governedByView) {
          const rawVal = parseFloat(phiMatch[1]);
          const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, phiMatch[2] || 'deg');
          recordGiven({
            property: 'phi_vp',
            value: valueDeg,
            unit: 'deg',
            excerpt: phiMatch[0],
            originalValue: rawVal,
            originalUnit,
            reference: { entity: `line_${lineLabel}`, relation: 'inclined_to', target: 'VP' },
          });
        }
      }
    }
  }

  // 7. Endpoint Positions
  const startPos = extractEndpointPosition(normalizedText, startChar, true);
  const endPos = extractEndpointPosition(normalizedText, endChar, false);
  issues.push(...startPos.ambiguousRelationIssues, ...endPos.ambiguousRelationIssues);

  if (startPos.zHp) {
    recordGiven({
      property: 'start_z_hp',
      value: startPos.zHp.value,
      unit: 'mm',
      excerpt: startPos.zHp.excerpt,
      originalValue: startPos.zHp.originalValue,
      originalUnit: startPos.zHp.originalUnit,
      reference: { entity: `point_${startChar}`, relation: `${startPos.zHp.relation}_HP`, target: 'HP' },
    });
    constraints.push({
      id: 'c_start_hp',
      kind: startPos.zHp.relation === 'on' ? 'in_hp' : startPos.zHp.relation === 'below' ? 'below_hp' : 'above_hp',
      target: startChar,
      relation: startPos.zHp.relation,
      value: Math.abs(startPos.zHp.value),
      unit: 'mm',
      status: 'given',
      excerpt: startPos.zHp.excerpt,
    });
  }

  if (startPos.yVp) {
    recordGiven({
      property: 'start_y_vp',
      value: startPos.yVp.value,
      unit: 'mm',
      excerpt: startPos.yVp.excerpt,
      originalValue: startPos.yVp.originalValue,
      originalUnit: startPos.yVp.originalUnit,
      reference: { entity: `point_${startChar}`, relation: `${startPos.yVp.relation}_VP`, target: 'VP' },
    });
    constraints.push({
      id: 'c_start_vp',
      kind: startPos.yVp.relation === 'on' ? 'in_vp' : startPos.yVp.relation === 'behind' ? 'behind_vp' : 'in_front_vp',
      target: startChar,
      relation: startPos.yVp.relation,
      value: Math.abs(startPos.yVp.value),
      unit: 'mm',
      status: 'given',
      excerpt: startPos.yVp.excerpt,
    });
  }

  if (endPos.zHp) {
    recordGiven({
      property: 'end_z_hp',
      value: endPos.zHp.value,
      unit: 'mm',
      excerpt: endPos.zHp.excerpt,
      originalValue: endPos.zHp.originalValue,
      originalUnit: endPos.zHp.originalUnit,
      reference: { entity: `point_${endChar}`, relation: `${endPos.zHp.relation}_HP`, target: 'HP' },
    });
    constraints.push({
      id: 'c_end_hp',
      kind: endPos.zHp.relation === 'on' ? 'in_hp' : endPos.zHp.relation === 'below' ? 'below_hp' : 'above_hp',
      target: endChar,
      relation: endPos.zHp.relation,
      value: Math.abs(endPos.zHp.value),
      unit: 'mm',
      status: 'given',
      excerpt: endPos.zHp.excerpt,
    });
  }

  if (endPos.yVp) {
    recordGiven({
      property: 'end_y_vp',
      value: endPos.yVp.value,
      unit: 'mm',
      excerpt: endPos.yVp.excerpt,
      originalValue: endPos.yVp.originalValue,
      originalUnit: endPos.yVp.originalUnit,
      reference: { entity: `point_${endChar}`, relation: `${endPos.yVp.relation}_VP`, target: 'VP' },
    });
    constraints.push({
      id: 'c_end_vp',
      kind: endPos.yVp.relation === 'on' ? 'in_vp' : endPos.yVp.relation === 'behind' ? 'behind_vp' : 'in_front_vp',
      target: endChar,
      relation: endPos.yVp.relation,
      value: Math.abs(endPos.yVp.value),
      unit: 'mm',
      status: 'given',
      excerpt: endPos.yVp.excerpt,
    });
  }

  const explicitFirstQuad =
    lower.includes('first quadrant') ||
    lower.includes('1st quadrant') ||
    lower.includes('first-angle') ||
    lower.includes('first angle');
  if (explicitFirstQuad) {
    constraints.push({
      id: 'c_first_quad',
      kind: 'quadrant',
      target: lineLabel,
      relation: 'lies_in',
      value: 'first_quadrant',
      unit: null,
      status: 'given',
      excerpt: 'first quadrant',
    });
  }

  const branchPreference: SemanticLinePayload['branchPreference'] =
    endPos.zHp && endPos.yVp
      ? 'explicit_endpoints'
      : explicitFirstQuad ||
        lower.includes('away from hp') ||
        lower.includes('away from vp') ||
        lower.includes('higher than')
      ? 'first_quadrant_positive'
      : 'unspecified';

  if (!endpoints.explicit) {
    assumptions.push(`Line endpoints not named in prose; assigned nominal placeholder labels "${startChar}" and "${endChar}".`);
  }

  return {
    entities,
    givens,
    constraints,
    issues,
    assumptions,
    unresolvedQuestions,
    linePayload: {
      lineLabel,
      startChar,
      endChar,
      explicitLabel: endpoints.explicit,
      startHp: startPos.zHp?.relation ?? null,
      startVp: startPos.yVp?.relation ?? null,
      endHp: endPos.zHp?.relation ?? null,
      endVp: endPos.yVp?.relation ?? null,
      branchPreference,
    },
  };
}

function parseQuadrantNumber(text: string): 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | null {
  if (/\b(?:first|1st|i)\s+quadrant\b|\bquadrant\s*(?:1|i)\b/i.test(text)) return 'FIRST';
  if (/\b(?:second|2nd|ii)\s+quadrant\b|\bquadrant\s*(?:2|ii)\b/i.test(text)) return 'SECOND';
  if (/\b(?:third|3rd|iii)\s+quadrant\b|\bquadrant\s*(?:3|iii)\b/i.test(text)) return 'THIRD';
  if (/\b(?:fourth|4th|iv)\s+quadrant\b|\bquadrant\s*(?:4|iv)\b/i.test(text)) return 'FOURTH';
  return null;
}

function interpretPointsSemantics(
  normalizedText: string
): {
  entities: InterpretedEntity[];
  givens: Record<string, MeasurementField>;
  constraints: GeometricConstraint[];
  issues: ValidationIssue[];
  assumptions: string[];
  unresolvedQuestions: string[];
  pointsPayload: SemanticPointsPayload;
} {
  const issues: ValidationIssue[] = [];
  const constraints: GeometricConstraint[] = [];
  const givens: Record<string, MeasurementField> = {};
  const assumptions: string[] = [];
  const unresolvedQuestions: string[] = [];
  const relativeRelations: PointRelativeRelation[] = [];

  const reservedLabels = new Set(['H', 'V', 'X', 'Y', 'P', 'O']); // allow P only if preceded by "point P"
  const pointMap = new Map<string, PointEntitySpec>();
  const ensurePoint = (lbl: string): PointEntitySpec => {
    const clean = lbl.toUpperCase();
    let existing = pointMap.get(clean);
    if (!existing) {
      existing = {
        label: clean,
        x_mm: null,
        y_mm: null,
        z_mm: null,
        hp_relation: null,
        vp_relation: null,
        declared_quadrant: null,
        evidence_excerpts: [],
      };
      pointMap.set(clean, existing);
    }
    return existing;
  };

  // Discover explicitly named points in prose
  const explicitPointNameRegex = /\b[Pp](?:oint|t\.?)\s+([A-Z][0-9]?)\b|\b([A-Z][0-9]?)\s*\(\s*-?\d+(?:\.\d+)?\s*,|\b([A-Z][0-9]?)\s+(?:is|lies|has)\b/g;
  let mName: RegExpExecArray | null;
  let firstDiscoveredLabel: string | null = null;
  while ((mName = explicitPointNameRegex.exec(normalizedText)) !== null) {
    const candidate = (mName[1] || mName[2] || mName[3] || '').toUpperCase();
    if (candidate && candidate !== 'HP' && candidate !== 'VP' && candidate !== 'XY' && candidate !== 'IT') {
      ensurePoint(candidate);
      if (!firstDiscoveredLabel) firstDiscoveredLabel = candidate;
    }
  }

  // Fallback for unnamed point description (e.g., "Given a point with x = 25 mm, signed depth y = 30 mm, signed height z = 20 mm")
  if (pointMap.size === 0) {
    // Try plural list "points P, Q, and R"
    const multiListMatch = normalizedText.match(/\bpoints\s+([A-Z](?:\s*,\s*[A-Z])*(?:\s*(?:,|and)\s*[A-Z])?)\b/i);
    if (multiListMatch) {
      const tokens: string[] = multiListMatch[1].match(/\b[A-Z]\b/g) ?? [];
      for (const tok of tokens) {
        if (!reservedLabels.has(tok) || tokens.includes(tok)) {
          ensurePoint(tok);
          if (!firstDiscoveredLabel) firstDiscoveredLabel = tok;
        }
      }
    }
  }
  if (pointMap.size === 0) {
    ensurePoint('P');
    firstDiscoveredLabel = 'P';
    assumptions.push('Point label not explicitly stated; assigned label "P".');
  }

  const clauses = segmentClauses(normalizedText);
  let lastMentionedPoint = firstDiscoveredLabel || 'P';

  for (const clause of clauses) {
    // Identify points mentioned in this clause
    const pointRefs: Array<{ label: string; index: number }> = [];
    const pRe = /\b[Pp](?:oint|t\.?)\s+([A-Z][0-9]?)\b|\b([A-Z][0-9]?)\s+(?:is|lies|has)\b|\b([A-Z][0-9]?)\s*\(/g;
    let mp: RegExpExecArray | null;
    while ((mp = pRe.exec(clause)) !== null) {
      const lbl = (mp[1] || mp[2] || mp[3] || '').toUpperCase();
      if (lbl && lbl !== 'HP' && lbl !== 'VP' && lbl !== 'XY' && lbl !== 'IT') {
        ensurePoint(lbl);
        pointRefs.push({ label: lbl, index: mp.index });
      }
    }
    const activeLabel = pointRefs.length > 0 ? pointRefs[0].label : lastMentionedPoint;
    if (pointRefs.length > 0) {
      lastMentionedPoint = activeLabel;
    }
    const pt = ensurePoint(activeLabel);

    // 1. Check relative relations between two points:
    // e.g. "Point Q is 15 mm above P", "Point Q is 15 mm above P and 10 mm closer to VP",
    //      "Q is 10 mm closer to VP than P", "Q is 25 mm to the right of P"
    const relOffsetPatterns: Array<{
      re: RegExp;
      axis: 'x' | 'y' | 'z';
      signMode: 'fixed_pos' | 'fixed_neg' | 'closer_vp' | 'further_vp' | 'closer_hp' | 'further_hp';
    }> = [
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:higher\s+than|above)\s+(?:point\s+)?([A-Z][0-9]?)\b(?!\s*(?:HP|VP|XY))/gi,
        axis: 'z',
        signMode: 'fixed_pos',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:lower\s+than|below)\s+(?:point\s+)?([A-Z][0-9]?)\b(?!\s*(?:HP|VP|XY))/gi,
        axis: 'z',
        signMode: 'fixed_neg',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:further\s+|farther\s+)?in\s+front\s+of\s+(?:VP\s+than\s+|point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'y',
        signMode: 'fixed_pos',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:further\s+|farther\s+)?behind\s+(?:VP\s+than\s+|point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'y',
        signMode: 'fixed_neg',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:closer|nearer)\s+to\s+(?:the\s+)?VP\s+than\s+(?:point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'y',
        signMode: 'closer_vp',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:further|farther)\s+(?:away\s+)?from\s+(?:the\s+)?VP\s+than\s+(?:point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'y',
        signMode: 'further_vp',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:closer|nearer)\s+to\s+(?:the\s+)?HP\s+than\s+(?:point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'z',
        signMode: 'closer_hp',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:further|farther)\s+(?:away\s+)?from\s+(?:the\s+)?HP\s+than\s+(?:point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'z',
        signMode: 'further_hp',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:to\s+the\s+)?right\s+of\s+(?:point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'x',
        signMode: 'fixed_pos',
      },
      {
        re: /\b(?:point\s+)?([A-Z][0-9]?)\s+is\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:to\s+the\s+)?left\s+of\s+(?:point\s+)?([A-Z][0-9]?)\b/gi,
        axis: 'x',
        signMode: 'fixed_neg',
      },
    ];

    const resolveSign = (
      refLbl: string,
      mode: 'fixed_pos' | 'fixed_neg' | 'closer_vp' | 'further_vp' | 'closer_hp' | 'further_hp'
    ): 1 | -1 => {
      const refPt = pointMap.get(refLbl);
      if (mode === 'fixed_pos') return 1;
      if (mode === 'fixed_neg') return -1;
      if (mode === 'closer_vp') return refPt?.vp_relation === 'behind' ? 1 : -1;
      if (mode === 'further_vp') return refPt?.vp_relation === 'behind' ? -1 : 1;
      if (mode === 'closer_hp') return refPt?.hp_relation === 'below' ? 1 : -1;
      return refPt?.hp_relation === 'below' ? -1 : 1;
    };

    const matchedAxes = new Set<'x' | 'y' | 'z'>();
    let clauseRefLabel: string | null = null;
    const recordRelative = (
      subj: string,
      ref: string,
      axis: 'x' | 'y' | 'z',
      deltaMm: number,
      excerpt: string
    ) => {
      ensurePoint(subj);
      ensurePoint(ref);
      clauseRefLabel = ref;
      matchedAxes.add(axis);
      relativeRelations.push({
        id: `rel_${subj}_${ref}_${axis}_${relativeRelations.length + 1}`,
        subject: subj,
        reference: ref,
        axis,
        delta_mm: deltaMm,
        excerpt,
      });
      constraints.push({
        id: `c_rel_${subj}_${ref}_${axis}`,
        kind: 'relative_offset',
        target: subj,
        relation: `${axis}_offset_from_${ref}`,
        value: deltaMm,
        unit: 'mm',
        status: 'given',
        excerpt,
      });
    };

    for (const pat of relOffsetPatterns) {
      for (const rm of clause.matchAll(pat.re)) {
        const subj = rm[1].toUpperCase();
        const ref = rm[4].toUpperCase();
        if (subj !== ref && !['HP', 'VP', 'XY'].includes(ref) && !['HP', 'VP', 'XY'].includes(subj)) {
          const { valueMm } = normalizeUnitToMm(parseFloat(rm[2]), rm[3]);
          const sign = resolveSign(ref, pat.signMode);
          recordRelative(subj, ref, pat.axis, sign * valueMm, rm[0]);
        }
      }
    }

    // Elliptical relative phrases sharing subject & reference in the same clause,
    // e.g. "Point Q is 15 mm above P and 10 mm closer to VP"
    const fallbackRef =
      clauseRefLabel ||
      Array.from(pointMap.keys()).find((lbl) => lbl !== activeLabel) ||
      null;
    if (fallbackRef && fallbackRef !== activeLabel) {
      const ellipticalPatterns: Array<{
        re: RegExp;
        axis: 'y' | 'z';
        signMode: 'closer_vp' | 'further_vp' | 'closer_hp' | 'further_hp';
      }> = [
        {
          re: /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:closer|nearer)\s+to\s+(?:the\s+)?VP\b(?!\s+than)/gi,
          axis: 'y',
          signMode: 'closer_vp',
        },
        {
          re: /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:further|farther)\s+(?:away\s+)?from\s+(?:the\s+)?VP\b(?!\s+than)/gi,
          axis: 'y',
          signMode: 'further_vp',
        },
        {
          re: /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:closer|nearer)\s+to\s+(?:the\s+)?HP\b(?!\s+than)/gi,
          axis: 'z',
          signMode: 'closer_hp',
        },
        {
          re: /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:further|farther)\s+(?:away\s+)?from\s+(?:the\s+)?HP\b(?!\s+than)/gi,
          axis: 'z',
          signMode: 'further_hp',
        },
      ];
      for (const ep of ellipticalPatterns) {
        for (const em of clause.matchAll(ep.re)) {
          if (matchedAxes.has(ep.axis)) continue;
          const { valueMm } = normalizeUnitToMm(parseFloat(em[1]), em[2]);
          const sign = resolveSign(fallbackRef, ep.signMode);
          recordRelative(activeLabel, fallbackRef, ep.axis, sign * valueMm, em[0]);
        }
      }
    }

    // 2. Direct tuple "(x, y, z)" or "P(25, 30, 20)"
    const tupleMatch = clause.match(/(?:[A-Z][0-9]?\s*)?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
    if (tupleMatch) {
      pt.x_mm = parseFloat(tupleMatch[1]);
      pt.y_mm = parseFloat(tupleMatch[2]);
      pt.z_mm = parseFloat(tupleMatch[3]);
      pt.hp_relation = pt.z_mm === 0 ? 'on' : pt.z_mm > 0 ? 'above' : 'below';
      pt.vp_relation = pt.y_mm === 0 ? 'on' : pt.y_mm > 0 ? 'in_front' : 'behind';
      pt.evidence_excerpts.push(tupleMatch[0]);
    }

    // 3. Explicit x = ..., y = ..., z = ... / signed depth / signed height
    const xAssign = clause.match(/\bx\s*(?:=|is)\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\b/i);
    if (xAssign) {
      const { valueMm } = normalizeUnitToMm(parseFloat(xAssign[1]), xAssign[2] || 'mm');
      pt.x_mm = valueMm;
      pt.evidence_excerpts.push(xAssign[0]);
    }
    const yAssign = clause.match(/(?:signed\s+depth\s*)?\by\s*(?:=|is)\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\b/i);
    if (yAssign) {
      const { valueMm } = normalizeUnitToMm(parseFloat(yAssign[1]), yAssign[2] || 'mm');
      pt.y_mm = valueMm;
      pt.vp_relation = valueMm === 0 ? 'on' : valueMm > 0 ? 'in_front' : 'behind';
      pt.evidence_excerpts.push(yAssign[0]);
    }
    const zAssign = clause.match(/(?:signed\s+height\s*)?\bz\s*(?:=|is)\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\b/i);
    if (zAssign) {
      const { valueMm } = normalizeUnitToMm(parseFloat(zAssign[1]), zAssign[2] || 'mm');
      pt.z_mm = valueMm;
      pt.hp_relation = valueMm === 0 ? 'on' : valueMm > 0 ? 'above' : 'below';
      pt.evidence_excerpts.push(zAssign[0]);
    }

    // 4. Declared Quadrant
    const quad = parseQuadrantNumber(clause);
    if (quad) {
      pt.declared_quadrant = quad;
      constraints.push({
        id: `c_quad_${pt.label}`,
        kind: 'quadrant',
        target: pt.label,
        relation: 'lies_in_quadrant',
        value: quad,
        unit: null,
        status: 'given',
        excerpt: clause,
      });
    }

    // 5. HP & VP plane relations (check contradiction if already set differently!)
    const setZChecked = (nextZ: number, nextRel: 'above' | 'below' | 'on', excerpt: string) => {
      if (pt.z_mm !== null && Math.abs(pt.z_mm - nextZ) > 1e-3) {
        issues.push({
          code: 'CONFLICTING_POINT_Z',
          stage: 'stage_2_parser',
          severity: 'error',
          field: `${pt.label}.z_mm`,
          message: `Point ${pt.label} has conflicting HP height specifications (${pt.z_mm} mm vs ${nextZ} mm).`,
        });
      }
      pt.z_mm = nextZ;
      pt.hp_relation = nextRel;
      pt.evidence_excerpts.push(excerpt);
    };

    const setYChecked = (nextY: number, nextRel: 'in_front' | 'behind' | 'on', excerpt: string) => {
      if (pt.y_mm !== null && Math.abs(pt.y_mm - nextY) > 1e-3) {
        issues.push({
          code: 'CONFLICTING_POINT_Y',
          stage: 'stage_2_parser',
          severity: 'error',
          field: `${pt.label}.y_mm`,
          message: `Point ${pt.label} has conflicting VP depth specifications (${pt.y_mm} mm vs ${nextY} mm).`,
        });
      }
      pt.y_mm = nextY;
      pt.vp_relation = nextRel;
      pt.evidence_excerpts.push(excerpt);
    };

    if (/\b(?:in|on)\s+both\s+(?:the\s+)?(?:HP\s+and\s+VP|VP\s+and\s+HP)\b|\bon\s+(?:the\s+)?XY(?:\s+line)?\b/i.test(clause) &&
        !/\b(?:front\s+view|top\s+view)\b/i.test(clause)) {
      setZChecked(0, 'on', clause);
      setYChecked(0, 'on', clause);
    } else {
      if (!matchedAxes.has('z')) {
        const hpAboveM = clause.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+above\s+(?:the\s+)?HP\b/i);
        const hpBelowM = clause.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+below\s+(?:the\s+)?HP\b/i);
        const hpOnM = clause.match(/(?:is\s+|lies\s+)?(?:in|on)\s+(?:the\s+)?HP\b/i);
        if (hpAboveM) {
          const { valueMm } = normalizeUnitToMm(parseFloat(hpAboveM[1]), hpAboveM[2]);
          setZChecked(valueMm, valueMm === 0 ? 'on' : 'above', hpAboveM[0]);
        } else if (hpBelowM) {
          const { valueMm } = normalizeUnitToMm(parseFloat(hpBelowM[1]), hpBelowM[2]);
          setZChecked(-valueMm, valueMm === 0 ? 'on' : 'below', hpBelowM[0]);
        } else if (hpOnM) {
          setZChecked(0, 'on', hpOnM[0]);
        }
      }

      if (!matchedAxes.has('y')) {
        const vpFrontM = clause.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+in\s+front\s+of\s+(?:the\s+)?VP\b/i);
        const vpBehindM = clause.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+behind\s+(?:the\s+)?VP\b/i);
        const vpOnM = clause.match(/(?:is\s+|lies\s+|and\s+)?(?:in|on)\s+(?:the\s+)?VP\b/i);
        if (vpFrontM) {
          const { valueMm } = normalizeUnitToMm(parseFloat(vpFrontM[1]), vpFrontM[2]);
          setYChecked(valueMm, valueMm === 0 ? 'on' : 'in_front', vpFrontM[0]);
        } else if (vpBehindM) {
          const { valueMm } = normalizeUnitToMm(parseFloat(vpBehindM[1]), vpBehindM[2]);
          setYChecked(-valueMm, valueMm === 0 ? 'on' : 'behind', vpBehindM[0]);
        } else if (vpOnM) {
          setYChecked(0, 'on', vpOnM[0]);
        }
      }
    }

    // 6. View-coordinate descriptions (front view above/below/on XY -> z; top view above/below/on XY -> -y)
    const fvAboveM = clause.match(/(?:front\s+view|elevation)[^.;]{0,40}?(\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\s+(above|below)\s+(?:the\s+)?XY\b/i);
    const fvOnM = clause.match(/(?:front\s+view|elevation)[^.;]{0,30}?(?:is\s+|lies\s+)?on\s+(?:the\s+)?XY\b/i);
    if (fvAboveM) {
      const { valueMm } = normalizeUnitToMm(parseFloat(fvAboveM[1]), fvAboveM[2] || 'mm');
      const isBelow = fvAboveM[3].toLowerCase() === 'below';
      setZChecked(isBelow ? -valueMm : valueMm, valueMm === 0 ? 'on' : isBelow ? 'below' : 'above', fvAboveM[0]);
    } else if (fvOnM) {
      setZChecked(0, 'on', fvOnM[0]);
    }

    const tvXyM = clause.match(/(?:top\s+view|plan)[^.;]{0,40}?(\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\s+(above|below)\s+(?:the\s+)?XY\b/i);
    const tvOnM = clause.match(/(?:top\s+view|plan)[^.;]{0,30}?(?:is\s+|lies\s+)?on\s+(?:the\s+)?XY\b/i);
    if (tvXyM) {
      const { valueMm } = normalizeUnitToMm(parseFloat(tvXyM[1]), tvXyM[2] || 'mm');
      // In First-Angle unfolding: top view BELOW XY => +y (in front of VP); top view ABOVE XY => -y (behind VP)
      const isBelowXy = tvXyM[3].toLowerCase() === 'below';
      const ySigned = isBelowXy ? valueMm : -valueMm;
      setYChecked(ySigned, valueMm === 0 ? 'on' : isBelowXy ? 'in_front' : 'behind', tvXyM[0]);
    } else if (tvOnM) {
      setYChecked(0, 'on', tvOnM[0]);
    }

    // 7. Ambiguous distance wording without quadrant (e.g. "20 mm from HP" with no quadrant)
    const fromHpPoint = clause.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\s+(?:away\s+)?from\s+(?:the\s+)?HP\b/i);
    if (fromHpPoint && pt.z_mm === null) {
      const { valueMm } = normalizeUnitToMm(parseFloat(fromHpPoint[1]), fromHpPoint[2] || 'mm');
      if (pt.declared_quadrant === 'FIRST' || pt.declared_quadrant === 'SECOND') {
        setZChecked(valueMm, 'above', `${fromHpPoint[0]} + ${pt.declared_quadrant} quadrant`);
      } else if (pt.declared_quadrant === 'THIRD' || pt.declared_quadrant === 'FOURTH') {
        setZChecked(-valueMm, 'below', `${fromHpPoint[0]} + ${pt.declared_quadrant} quadrant`);
      } else {
        issues.push({
          code: 'AMBIGUOUS_HP_SIDE',
          stage: 'stage_2_parser',
          severity: 'error',
          field: `${pt.label}.z_mm`,
          message: `Distance "${fromHpPoint[0]}" for point ${pt.label} does not specify whether ${pt.label} is ABOVE or BELOW HP (or its quadrant).`,
        });
        unresolvedQuestions.push(`Specify whether point ${pt.label} is above or below HP.`);
      }
    }

    const fromVpPoint = clause.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in)?\s+(?:away\s+)?from\s+(?:the\s+)?VP\b/i);
    if (fromVpPoint && pt.y_mm === null) {
      const { valueMm } = normalizeUnitToMm(parseFloat(fromVpPoint[1]), fromVpPoint[2] || 'mm');
      if (pt.declared_quadrant === 'FIRST' || pt.declared_quadrant === 'FOURTH') {
        setYChecked(valueMm, 'in_front', `${fromVpPoint[0]} + ${pt.declared_quadrant} quadrant`);
      } else if (pt.declared_quadrant === 'SECOND' || pt.declared_quadrant === 'THIRD') {
        setYChecked(-valueMm, 'behind', `${fromVpPoint[0]} + ${pt.declared_quadrant} quadrant`);
      } else {
        issues.push({
          code: 'AMBIGUOUS_VP_SIDE',
          stage: 'stage_2_parser',
          severity: 'error',
          field: `${pt.label}.y_mm`,
          message: `Distance "${fromVpPoint[0]}" for point ${pt.label} does not specify whether ${pt.label} is IN FRONT OF or BEHIND VP (or its quadrant).`,
        });
        unresolvedQuestions.push(`Specify whether point ${pt.label} is in front of or behind VP.`);
      }
    }
  }

  const points = Array.from(pointMap.values());
  const entities: InterpretedEntity[] = points.map((pt, idx) => ({
    id: `pt_${pt.label}`,
    kind: 'point',
    label: pt.label,
    role: idx === 0 ? 'primary_point' : 'point',
  }));

  for (const pt of points) {
    const prefix = points.length === 1 ? '' : `${pt.label}.`;
    if (pt.x_mm !== null) {
      givens[`${prefix}x_mm`] = createMeasurementField({
        property: `${prefix}x_mm`,
        value: pt.x_mm,
        unit: 'mm',
        status: 'given',
        source_stage: 'stage_2_semantic_interpreter',
        reference: { entity: `point_${pt.label}`, relation: 'position_along', target: 'XY' },
        excerpt: pt.evidence_excerpts[0] || `${pt.label}.x = ${pt.x_mm} mm`,
      });
    }
    if (pt.y_mm !== null) {
      givens[`${prefix}y_mm`] = createMeasurementField({
        property: `${prefix}y_mm`,
        value: pt.y_mm,
        unit: 'mm',
        status: 'given',
        source_stage: 'stage_2_semantic_interpreter',
        reference: { entity: `point_${pt.label}`, relation: `${pt.vp_relation || 'signed_depth'}_VP`, target: 'VP' },
        excerpt: pt.evidence_excerpts.find((e) => /VP|depth|y|top view|\(/i.test(e)) || `${pt.label}.y = ${pt.y_mm} mm`,
      });
    }
    if (pt.z_mm !== null) {
      givens[`${prefix}z_mm`] = createMeasurementField({
        property: `${prefix}z_mm`,
        value: pt.z_mm,
        unit: 'mm',
        status: 'given',
        source_stage: 'stage_2_semantic_interpreter',
        reference: { entity: `point_${pt.label}`, relation: `${pt.hp_relation || 'signed_height'}_HP`, target: 'HP' },
        excerpt: pt.evidence_excerpts.find((e) => /HP|height|z|front view|\(/i.test(e)) || `${pt.label}.z = ${pt.z_mm} mm`,
      });
    }
  }

  return {
    entities,
    givens,
    constraints,
    issues,
    assumptions,
    unresolvedQuestions,
    pointsPayload: {
      points,
      relativeRelations,
    },
  };
}

/**
 * Deterministic semantic interpretation engine (always executes, zero external dependencies).
 */
export function interpretQuestionDeterministically(params: {
  raw_text: string;
  uncertain_readings?: UncertainReading[];
}): SemanticInterpretationResult {
  const normalizedText = lightNormalizeProblemText(params.raw_text);
  const lower = normalizedText.toLowerCase();
  const uncertainReadings =
    params.uncertain_readings && params.uncertain_readings.length > 0
      ? params.uncertain_readings
      : detectUncertainOcrReadings(params.raw_text);

  const classification = classifyModuleContext(normalizedText);
  const descriptor = getModuleDescriptor(classification.moduleId);
  const taskDomain = mapModuleToTaskDomain(descriptor.id);
  const projectionSystem =
    lower.includes('third angle') || lower.includes('third-angle') ? 'third_angle' : 'first_angle';
  const requestedOutputs = detectRequestedOutputs(lower, descriptor.id);

  if (descriptor.id === 'projection_of_straight_lines') {
    const sl = interpretStraightLineSemantics(normalizedText, lower, uncertainReadings);
    return {
      normalized_text: normalizedText,
      module: descriptor,
      module_confidence: classification.confidence,
      selection_reason: classification.reason,
      task_domain: taskDomain,
      projection_system: projectionSystem,
      requested_outputs: requestedOutputs,
      interpretation_method: 'deterministic_semantic',
      entities: sl.entities,
      givens: sl.givens,
      constraints: sl.constraints,
      assumptions: sl.assumptions,
      unresolved_questions: sl.unresolvedQuestions,
      ambiguities_notes: [],
      repair_notes: [],
      issues: sl.issues,
      uncertain_readings: uncertainReadings,
      line_payload: sl.linePayload,
      points_payload: null,
    };
  }

  if (descriptor.id === 'projection_of_points') {
    const pts = interpretPointsSemantics(normalizedText);
    return {
      normalized_text: normalizedText,
      module: descriptor,
      module_confidence: classification.confidence,
      selection_reason: classification.reason,
      task_domain: taskDomain,
      projection_system: projectionSystem,
      requested_outputs: requestedOutputs,
      interpretation_method: 'deterministic_semantic',
      entities: pts.entities,
      givens: pts.givens,
      constraints: pts.constraints,
      assumptions: pts.assumptions,
      unresolved_questions: pts.unresolvedQuestions,
      ambiguities_notes: [],
      repair_notes: [],
      issues: pts.issues,
      uncertain_readings: uncertainReadings,
      line_payload: null,
      points_payload: pts.pointsPayload,
    };
  }

  // Unsupported registered topic OR unclassified question
  const unsupportedMsg =
    descriptor.id === 'unknown_module'
      ? 'Could not identify the Engineering Graphics module from the input statement; provide geometric entity details (e.g., point or straight line).'
      : `Recognized module "${descriptor.name}", which is registered in the EDraw Module Registry but marked as unsupported in the current solver release.`;

  return {
    normalized_text: normalizedText,
    module: descriptor,
    module_confidence: classification.confidence,
    selection_reason: classification.reason,
    task_domain: taskDomain,
    projection_system: projectionSystem,
    requested_outputs: requestedOutputs,
    interpretation_method: 'deterministic_semantic',
    entities: [
      {
        id: `entity_${descriptor.id}`,
        kind:
          descriptor.id === 'projection_of_planes'
            ? 'plane'
            : descriptor.id === 'projection_of_solids' || descriptor.id === 'sections_of_solids'
            ? 'solid'
            : descriptor.id === 'engineering_curves'
            ? 'curve'
            : 'unknown',
        label: classification.unsupportedLabel || descriptor.name,
        role: 'primary',
      },
    ],
    givens: {},
    constraints: [],
    assumptions: [],
    unresolved_questions:
      descriptor.id === 'unknown_module'
        ? ['Please specify the geometric object (e.g., Point A, Line PQ, Hexagonal Pyramid) and known planes/measurements.']
        : [],
    ambiguities_notes: [],
    repair_notes: [],
    issues: [
      {
        code: descriptor.id === 'unknown_module' ? 'MODULE_NEEDS_CLARIFICATION' : 'UNSUPPORTED_MODULE',
        stage: 'stage_2_parser',
        severity: 'error',
        field: 'module.id',
        message: unsupportedMsg,
      },
    ],
    uncertain_readings: uncertainReadings,
    line_payload: null,
    points_payload: null,
    unsupported_topic_label: classification.unsupportedLabel || descriptor.name,
  };
}

/**
 * Optional LLM-assisted structured semantic classification & refinement (Gemini 4 Hydrogen).
 * Strictly enforces:
 * - No solving or arithmetic by the LLM
 * - No invented defaults or unknown-as-zero substitution
 * - Reference-aware angle separation (alpha_fv != theta_hp)
 * - Bounded 1-shot schema repair if JSON response has minor structural mismatch
 * Falls back cleanly to deterministic_semantic when GEMINI_API_KEY is unset or unavailable.
 */
export async function interpretQuestionSemantically(params: {
  raw_text: string;
  uncertain_readings?: UncertainReading[];
}): Promise<SemanticInterpretationResult> {
  const baseline = interpretQuestionDeterministically(params);

  if (!isGeminiConfigured()) {
    return baseline;
  }

  const repairNotes: string[] = [];
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const validModuleIds = Object.keys(ENGINEERING_MODULE_REGISTRY);
    const semanticPrompt = `Analyze this Engineering Graphics problem semantically and classify its module and entities.
RULES:
1. Do NOT solve the math or compute unstated values.
2. Distinguish view angles ("front view makes X deg with XY" -> alpha_fv; "top view makes X deg with XY" -> beta_tv) from true line inclinations ("inclined at X deg to HP" -> theta_hp; "to VP" -> phi_vp).
3. If the problem describes a solid, lamina/plane, section plane, isometric, perspective, or curve, select that exact module_id from: ${validModuleIds.join(', ')}.
4. Do NOT force a Point question into straight lines, and do NOT force a Straight Line question into points.
5. Never invent default lengths or assume missing values are zero.

Question text:
${baseline.normalized_text}`;

    const runModelCall = async (promptText: string) => {
      const p = ai.models.generateContent({
        model: GEMINI_SEMANTIC_MODEL,
        contents: promptText,
        config: {
          systemInstruction:
            'You are a strict Engineering Graphics semantic classifier. Return structured JSON only. Never solve arithmetic.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              module_id: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              selection_reason: { type: Type.STRING },
              requested_outputs: { type: Type.ARRAY, items: { type: Type.STRING } },
              unresolved_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['module_id', 'confidence', 'selection_reason'],
          },
        },
      });
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Gemini semantic interpretation timed out')), 10000)
      );
      return Promise.race([p, timeout]);
    };

    let parsedResp: {
      module_id?: string;
      confidence?: number;
      selection_reason?: string;
      requested_outputs?: string[];
      unresolved_questions?: string[];
    } | null = null;

    const firstResp = await runModelCall(semanticPrompt);
    try {
      parsedResp = JSON.parse((firstResp.text || '').trim());
    } catch {
      // Bounded 1-shot schema repair
      repairNotes.push('Repaired malformed JSON from initial semantic classification response.');
      const repairResp = await runModelCall(
        `Return ONLY valid JSON with keys "module_id", "confidence", "selection_reason" for:\n${baseline.normalized_text}`
      );
      parsedResp = JSON.parse((repairResp.text || '').trim());
    }

    if (
      parsedResp &&
      typeof parsedResp.module_id === 'string' &&
      parsedResp.module_id in ENGINEERING_MODULE_REGISTRY
    ) {
      const llmModId = parsedResp.module_id as EngineeringModuleId;
      // Only override unknown_module or confirm compatible module without breaking verified deterministic entity separation
      if (baseline.module.id === 'unknown_module' && llmModId !== 'unknown_module') {
        const desc = getModuleDescriptor(llmModId);
        return {
          ...baseline,
          module: desc,
          module_confidence:
            typeof parsedResp.confidence === 'number'
              ? Math.max(0, Math.min(1, parsedResp.confidence))
              : baseline.module_confidence,
          selection_reason: parsedResp.selection_reason || baseline.selection_reason,
          task_domain: mapModuleToTaskDomain(llmModId),
          interpretation_method: 'hybrid',
          repair_notes: repairNotes,
        };
      }
      return {
        ...baseline,
        module_confidence:
          typeof parsedResp.confidence === 'number'
            ? Math.max(0, Math.min(1, parsedResp.confidence))
            : baseline.module_confidence,
        interpretation_method: 'hybrid',
        repair_notes: repairNotes,
      };
    }
  } catch (err) {
    repairNotes.push(
      `Gemini semantic pass unavailable (${err instanceof Error ? err.message : 'fallback'}); used deterministic interpreter.`
    );
  }

  return {
    ...baseline,
    repair_notes: repairNotes,
  };
}
