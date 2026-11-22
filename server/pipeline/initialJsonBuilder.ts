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
  type GeometricConstraint,
  type MeasurementField,
  type UncertainReading,
  type ValidationIssue,
} from '../../src/pipeline/schema.ts';
import { detectUncertainOcrReadings, type OcrExtractionSuccess } from './ocrService.ts';

const DEFAULT_PIPELINE_STORE_DIR = path.resolve(process.cwd(), '.edraw-data', 'pipeline');

function normalizeUnitToMm(value: number, unitRaw: string): { valueMm: number; originalUnit: string } {
  const unit = unitRaw.trim().toLowerCase();
  if (unit === 'cm') return { valueMm: Number((value * 10).toFixed(4)), originalUnit: 'cm' };
  if (unit === 'm') return { valueMm: Number((value * 1000).toFixed(4)), originalUnit: 'm' };
  if (unit === 'in' || unit === 'inch' || unit === 'inches') {
    return { valueMm: Number((value * 25.4).toFixed(4)), originalUnit: 'in' };
  }
  return { valueMm: value, originalUnit: 'mm' };
}

function normalizeAngleToDeg(value: number, unitRaw: string): { valueDeg: number; originalUnit: string } {
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
  s = s.replace(/\blinc\b/gi, 'line');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

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

function detectRequestedOutputs(lowerText: string): string[] {
  const outputs: string[] = [];
  if (lowerText.includes('front view') || lowerText.includes('elevation') || lowerText.includes('projections')) {
    outputs.push('front_view');
  }
  if (lowerText.includes('top view') || lowerText.includes('plan') || lowerText.includes('projections')) {
    outputs.push('top_view');
  }
  if (lowerText.includes('true length')) outputs.push('true_length');
  if (lowerText.includes('inclination') || lowerText.includes('angle') || lowerText.includes('find θ') || lowerText.includes('find φ')) {
    outputs.push('true_inclinations');
  }
  if (lowerText.includes('trace')) outputs.push('traces');
  if (outputs.length === 0) {
    outputs.push('front_view', 'top_view');
  }
  return Array.from(new Set(outputs));
}

function extractEndpoints(text: string): { start: string; end: string; lineLabel: string; explicit: boolean } {
  const reservedPairs = new Set(['HP', 'VP', 'XY', 'TV', 'FV', 'TL', 'MM', 'CM', 'IN', 'IS', 'OF', 'TO', 'AT', 'ON', 'BY', 'OR', 'AN', 'AS', 'IT']);

  const patterns: RegExp[] = [
    /(?:straight\s+)?line\s+([A-Z])([A-Z])\b/,
    /(?:straight\s+)?line\s+([A-Za-z])([A-Za-z])\b/i,
    /\b([A-Z])([A-Z])\b\s*,?\s*(?:measuring|of\s+length|is|\d+(?:\.\d+)?\s*(?:mm|cm|m|in))/,
    /(?:line|segment)\s+([A-Za-z])\s*(?:to|and|-)\s*([A-Za-z])\b/i,
    /(?:end\s*point|end|point)\s+([A-Z])\b[\s\S]{0,160}?(?:end\s*point|end|point)\s+([A-Z])\b/,
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

  // Split into sentence/clause windows mentioning this specific endpoint
  const sentences = text.split(/(?<=[.;])\s+|\n+/);
  const relevantClauses = sentences.filter((s) =>
    new RegExp(`(?:end\\s*point|end|point|extremity)\\s+${pEsc}\\b|\\b${pEsc}\\s+is\\b|\\b${pEsc}\\s+lies\\b`, 'i').test(s)
  );
  // If start point wasn't matched in a clause, allow clauses mentioning "its end" or "one end"
  if (isPrimaryStart && relevantClauses.length === 0) {
    const fallbackClauses = sentences.filter((s) =>
      /(?:its\s+end(?:\s*point)?|one\s+end(?:\s*point)?|it\s+is\s+\d)/i.test(s)
    );
    relevantClauses.push(...fallbackClauses);
  }

  const searchText = relevantClauses.join(' . ');

  // HP Position
  let zHp: {
    value: number;
    originalValue: number;
    originalUnit: string;
    relation: 'above' | 'below' | 'on';
    excerpt: string;
  } | null = null;

  const onHpRe = new RegExp(
    `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b|its\\s+end(?:\\s*point)?|one\\s+end(?:\\s*point)?)[^.;]{0,45}?(?:is\\s+|lies\\s+)?(?:in|on)\\s+(?:the\\s+)?HP\\b`,
    'i'
  );
  const onBothRe = new RegExp(
    `(?:(?:end\\s*point|end|point)\\s+${pEsc}|\\b${pEsc}\\b)[^.;]{0,45}?(?:in|on)\\s+both\\s+(?:the\\s+)?(?:HP\\s+and\\s+VP|VP\\s+and\\s+HP)`,
    'i'
  );
  const explicitAmbiguousHpRe =
    /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:either\s+)?(?:above\s+or\s+below|below\s+or\s+above)\s+(?:the\s+)?HP\b/i;
  const aboveHpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+above\s+(?:the\s+)?HP\b/i;
  const belowHpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+below\s+(?:the\s+)?HP\b/i;
  const fromHpRe = /(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+(?:away\s+)?from\s+(?:the\s+)?HP\b/i;

  // Match scoped to endpoint clause first
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
    // First-angle projection standard: "X from HP" defaults to above HP with explicit provenance notice
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
      message: `Interpreted "${m[0]}" for point ${p} as ${valueMm} mm ABOVE HP under First-Angle projection convention. Specify "below HP" or edit Stage 2 JSON if below HP was intended.`,
    });
  }

  // VP Position
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
      message: `Interpreted "${m[0]}" for point ${p} as ${valueMm} mm IN FRONT OF VP under First-Angle projection convention. Specify "behind VP" or edit Stage 2 JSON if behind VP was intended.`,
    });
  }

  return { zHp, yVp, ambiguousRelationIssues };
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

/**
 * Stage 2 Entry Point: Build canonical initial JSON with explicit givens and null unknowns.
 * Never invents missing values or solves unknowns.
 */
export function buildInitialProblemJson(
  ocr: OcrExtractionSuccess,
  options?: {
    problemId?: string;
    persist?: boolean;
    storeDir?: string;
  }
): Stage2Result {
  const rawText = ocr.raw_text;
  const normalizedText = lightNormalizeProblemText(rawText);
  const lower = normalizedText.toLowerCase();
  const problemId = options?.problemId || generateSafeProblemId();

  const uncertainReadings: UncertainReading[] =
    ocr.uncertain_readings.length > 0
      ? ocr.uncertain_readings
      : detectUncertainOcrReadings(rawText);

  const issues: ValidationIssue[] = [];
  const constraints: GeometricConstraint[] = [];
  const givens: Record<string, MeasurementField> = {};

  const endpoints = extractEndpoints(normalizedText);
  const startChar = endpoints.start;
  const endChar = endpoints.end;
  const lineLabel = endpoints.lineLabel;

  // Helper to record an explicit given measurement
  const recordGiven = (params: {
    property: string;
    value: number;
    unit: 'mm' | 'deg';
    excerpt: string;
    originalValue?: number;
    originalUnit?: string;
  }) => {
    givens[params.property] = createMeasurementField({
      property: params.property,
      value: params.value,
      unit: params.unit,
      original_value: params.originalValue ?? params.value,
      original_unit: params.originalUnit ?? params.unit,
      status: 'given',
      source_stage: 'stage_2_parser',
      excerpt: params.excerpt,
      validation_status: 'unvalidated',
    });
  };

  // Detect ambiguous angle wording (e.g., "inclined at 30° to one of the planes")
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
  }

  // 1. True Length (only when explicitly given as line length / true length; never guess)
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
      if (/(?:front\s+view|top\s+view|elevation|plan|projector)\s*(?:is|of|measures|=)?\s*$/i.test(prefix)) {
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
    });
  }

  // 4. Distance Between End Projectors (DEP)
  const depMatch =
    normalizedText.match(
      /(?:distance\s+between\s+(?:the\s+)?(?:end\s+)?projectors|end\s+projectors\s+(?:are|is)\s+(?:apart\s+by)?|dep)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\b/i
    ) ||
    normalizedText.match(
      /(?:end\s+)?projectors\s+are\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches)\s+apart/i
    );
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

  // 6. True Inclination Angles (theta_hp, phi_vp) — skip if flagged as blocking OCR uncertainty
  const hasBlockingThetaOcr = uncertainReadings.some(
    (u) => u.severity === 'blocking' && u.suspected_property === 'theta_hp'
  );
  const hasBlockingPhiOcr = uncertainReadings.some(
    (u) => u.severity === 'blocking' && u.suspected_property === 'phi_vp'
  );

  if (!hasBlockingThetaOcr) {
    const thetaMatch =
      normalizedText.match(
        /(?:inclined\s*(?:at)?|makes?\s+(?:an\s+)?angle\s+(?:of)?|angle\s+(?:of)?)\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?HP\b/i
      ) ||
      normalizedText.match(
        /(?:and\s+)?(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)\s*(?:to|with)\s*(?:the\s+)?HP\b/i
      ) ||
      normalizedText.match(/(?:θ|theta)\s*=\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);
    if (thetaMatch) {
      const rawVal = parseFloat(thetaMatch[1]);
      const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, thetaMatch[2] || 'deg');
      recordGiven({
        property: 'theta_hp',
        value: valueDeg,
        unit: 'deg',
        excerpt: thetaMatch[0],
        originalValue: rawVal,
        originalUnit,
      });
    }
  }

  if (!hasBlockingPhiOcr) {
    const phiMatch =
      normalizedText.match(
        /(?:inclined\s*(?:at)?|makes?\s+(?:an\s+)?angle\s+(?:of)?|angle\s+(?:of)?)\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?VP\b/i
      ) ||
      normalizedText.match(
        /(?:and\s+)?(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)\s*(?:to|with)\s*(?:the\s+)?VP\b/i
      ) ||
      normalizedText.match(/(?:φ|phi)\s*=\s*(-?\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);
    if (phiMatch) {
      const rawVal = parseFloat(phiMatch[1]);
      const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, phiMatch[2] || 'deg');
      recordGiven({
        property: 'phi_vp',
        value: valueDeg,
        unit: 'deg',
        excerpt: phiMatch[0],
        originalValue: rawVal,
        originalUnit,
      });
    }
  }

  // 7. Apparent Angles (alpha_fv, beta_tv)
  const alphaMatch =
    normalizedText.match(
      /(?:front\s+view|elevation)[^.;]{0,45}?(?:inclined\s*(?:at)?|makes?)\s*(\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?(?:XY|HP|reference\s+line)\b/i
    ) || normalizedText.match(/(?:α|alpha)\s*=\s*(\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);
  if (alphaMatch) {
    const rawVal = parseFloat(alphaMatch[1]);
    const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, alphaMatch[2] || 'deg');
    recordGiven({
      property: 'alpha_fv',
      value: valueDeg,
      unit: 'deg',
      excerpt: alphaMatch[0],
      originalValue: rawVal,
      originalUnit,
    });
  }

  const betaMatch =
    normalizedText.match(
      /(?:top\s+view|plan)[^.;]{0,45}?(?:inclined\s*(?:at)?|makes?)\s*(\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?\s*(?:to|with)\s*(?:the\s+)?(?:XY|VP|reference\s+line)\b/i
    ) || normalizedText.match(/(?:β|beta)\s*=\s*(\d+(?:\.\d+)?)\s*(°|deg|degree|degrees|rad|radian|radians)?/i);
  if (betaMatch) {
    const rawVal = parseFloat(betaMatch[1]);
    const { valueDeg, originalUnit } = normalizeAngleToDeg(rawVal, betaMatch[2] || 'deg');
    recordGiven({
      property: 'beta_tv',
      value: valueDeg,
      unit: 'deg',
      excerpt: betaMatch[0],
      originalValue: rawVal,
      originalUnit,
    });
  }

  // 8. Endpoint Positions (Start & End)
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

  // First-quadrant constraint detection
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

  const branchPreference: 'first_quadrant_positive' | 'explicit_endpoints' | 'unspecified' =
    endPos.zHp && endPos.yVp
      ? 'explicit_endpoints'
      : explicitFirstQuad ||
        lower.includes('away from hp') ||
        lower.includes('away from vp') ||
        lower.includes('higher than')
      ? 'first_quadrant_positive'
      : 'unspecified';

  // Populate unknowns with strictly null numerical values for every property not explicitly given
  const unknowns: Record<string, MeasurementField> = {};
  for (const spec of STRAIGHT_LINE_PROPERTIES) {
    if (spec.property in givens) continue;
    unknowns[spec.property] = createMeasurementField({
      property: spec.property,
      value: null,
      unit: spec.unit,
      status: 'unknown',
      source_stage: 'stage_2_parser',
      reason: 'Not explicitly given in the source problem; pending deterministic Python solver.',
      validation_status: 'unvalidated',
    });
  }

  const projectionSystem = lower.includes('third angle') || lower.includes('third-angle')
    ? 'third_angle'
    : 'first_angle';

  const initialProblem: CanonicalEngineeringProblem = {
    schema_version: CANONICAL_SCHEMA_VERSION,
    problem_id: problemId,
    source: {
      input_type: ocr.input_type,
      ocr_engine: ocr.engine_used,
      raw_text: rawText,
      normalized_text: normalizedText,
      confidence: ocr.confidence,
      warnings: ocr.warnings,
      uncertain_readings: uncertainReadings,
    },
    task: {
      domain: 'straight_line_projection',
      projection_system: projectionSystem,
      requested_outputs: detectRequestedOutputs(lower),
      description: normalizedText,
    },
    geometry: {
      entity_type: 'straight_line',
      line_label: lineLabel,
      endpoints: { start: startChar, end: endChar },
      planes: ['HP', 'VP'],
      quadrant_hints: {
        start_hp: startPos.zHp?.relation ?? null,
        start_vp: startPos.yVp?.relation ?? null,
        end_hp: endPos.zHp?.relation ?? null,
        end_vp: endPos.yVp?.relation ?? null,
        branch_preference: branchPreference,
      },
      solved_coordinates: null,
    },
    givens,
    unknowns,
    constraints,
    drawing_instructions: {
      ready_to_render: false,
      coordinate_system: projectionSystem === 'third_angle' ? 'third_angle_iso' : 'first_angle_bis_sp46',
      scale: null,
      views: ['front_view', 'top_view'],
      annotations: [
        'XY reference line',
        `Front view ${startChar.toLowerCase()}′${endChar.toLowerCase()}′`,
        `Top view ${startChar.toLowerCase()}${endChar.toLowerCase()}`,
        'End projectors',
        'True length & inclinations',
      ],
      blocked_reason: 'Initial JSON generated; awaiting Stage 3 Python geometry solver and Stage 4 validation.',
    },
    validation: {
      schema_valid: true,
      solver_status: 'unsolved',
      geometry_valid: false,
      ready_for_render: false,
      issues,
      ambiguities: [],
      missing_requirements: [],
      checks: [],
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
