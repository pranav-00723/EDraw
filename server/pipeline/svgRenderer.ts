/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getMeasurementValue,
  validateCanonicalProblem,
  type CanonicalEngineeringProblem,
} from '../../src/pipeline/schema.ts';
import type { LineProblemInput } from '../../src/types/lines.ts';

export interface SvgPoint {
  x: number;
  y: number;
  label: string;
}

export interface DeterministicDrawingGeometry {
  viewBoxWidth: number;
  viewBoxHeight: number;
  scale: number;
  xyLineY: number;
  xyStartX: number;
  xyEndX: number;
  lineLabel: string;
  startName: string;
  endName: string;
  // Final orthographic views (pixels)
  aPrime: SvgPoint;
  bPrime: SvgPoint;
  aTop: SvgPoint;
  bTop: SvgPoint;
  // Auxiliary true-length points for rotating-line method (pixels)
  b1Prime: SvgPoint;
  b2Top: SvgPoint;
  // Loci pixel Y positions
  locusBPrimeY: number;
  locusBTopY: number;
  // Physical measurements (mm / deg)
  metrics: {
    tl: number;
    fv: number;
    tv: number;
    dep: number;
    theta: number;
    phi: number;
    alpha: number;
    beta: number;
    z1: number;
    y1: number;
    z2: number;
    y2: number;
  };
  // Flags for special cases (point view in FV or TV)
  isPerpHp: boolean;
  isPerpVp: boolean;
  isParallelBoth: boolean;
  topViewPointLabel: string | null;
  frontViewPointLabel: string | null;
}

export interface Stage5RenderSuccess {
  ok: true;
  stage: 'stage_5_render_svg';
  svg: string;
  geometry: DeterministicDrawingGeometry;
  lineInput: LineProblemInput;
}

export interface Stage5RenderFailure {
  ok: false;
  stage: 'stage_5_render_svg';
  error: string;
  blocked_reason: string;
}

export type Stage5RenderResult = Stage5RenderSuccess | Stage5RenderFailure;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(n: number, digits = 1): string {
  const cleaned = Math.abs(n) < 1e-6 ? 0 : n;
  return Number(cleaned.toFixed(digits)).toString();
}

/**
 * Pure geometric layout calculation (completely separated from SVG visual styling).
 */
export function computeDrawingGeometry(
  problem: CanonicalEngineeringProblem,
  canvas?: { width?: number; height?: number }
): DeterministicDrawingGeometry {
  if (problem.geometry.entity_type !== 'straight_line' || !problem.geometry.solved_coordinates) {
    throw new Error('Cannot compute drawing geometry without solved straight-line coordinates.');
  }

  const width = canvas?.width ?? 860;
  const height = canvas?.height ?? 540;
  const padLeft = 110;
  const padRight = 135;
  const padTop = 78;
  const padBottom = 86;

  const coords = problem.geometry.solved_coordinates;
  const tl = getMeasurementValue(problem, 'true_length')!;
  const fv = getMeasurementValue(problem, 'front_view_length')!;
  const tv = getMeasurementValue(problem, 'top_view_length')!;
  const dep = getMeasurementValue(problem, 'dep')!;
  const theta = getMeasurementValue(problem, 'theta_hp')!;
  const phi = getMeasurementValue(problem, 'phi_vp')!;
  const alpha = getMeasurementValue(problem, 'alpha_fv') ?? 0;
  const beta = getMeasurementValue(problem, 'beta_tv') ?? 0;
  const z1 = getMeasurementValue(problem, 'start_z_hp')!;
  const y1 = getMeasurementValue(problem, 'start_y_vp')!;
  const z2 = getMeasurementValue(problem, 'end_z_hp')!;
  const y2 = getMeasurementValue(problem, 'end_y_vp')!;

  // Collect all model-space 2D coordinates (mm, with y_model = +above XY, -below XY)
  const modelPoints = [
    { x: 0, y: 0 },
    { x: coords.front_view.start.x, y: coords.front_view.start.y },
    { x: coords.front_view.end.x, y: coords.front_view.end.y },
    { x: coords.top_view.start.x, y: coords.top_view.start.y },
    { x: coords.top_view.end.x, y: coords.top_view.end.y },
    { x: coords.auxiliary.b1_prime.x, y: coords.auxiliary.b1_prime.y },
    { x: coords.auxiliary.b2.x, y: coords.auxiliary.b2.y },
  ];

  const minX = Math.min(...modelPoints.map((p) => p.x), 0);
  const maxX = Math.max(...modelPoints.map((p) => p.x), tl, 40);
  const minY = Math.min(...modelPoints.map((p) => p.y), -25);
  const maxY = Math.max(...modelPoints.map((p) => p.y), 25);

  const spanX = Math.max(maxX - minX, 40);
  const spanY = Math.max(maxY - minY, 40);

  const availW = Math.max(200, width - padLeft - padRight);
  const availH = Math.max(180, height - padTop - padBottom);
  const rawScale = Math.min(availW / spanX, availH / spanY);
  const scale = Number(Math.max(0.4, Math.min(4.5, rawScale)).toFixed(4));

  // Center horizontally within drawable area; position XY based on model vertical bounds
  const contentW = spanX * scale;
  const originX = padLeft + (availW - contentW) / 2 - minX * scale;

  const contentH = spanY * scale;
  const topOffset = padTop + (availH - contentH) / 2;
  const xyLineY = topOffset + maxY * scale;

  const toSvg = (pt: { x: number; y: number; label: string }): SvgPoint => ({
    x: Number((originX + pt.x * scale).toFixed(2)),
    y: Number((xyLineY - pt.y * scale).toFixed(2)),
    label: pt.label,
  });

  const aPrime = toSvg(coords.front_view.start);
  const bPrime = toSvg(coords.front_view.end);
  const aTop = toSvg(coords.top_view.start);
  const bTop = toSvg(coords.top_view.end);
  const b1Prime = toSvg(coords.auxiliary.b1_prime);
  const b2Top = toSvg(coords.auxiliary.b2);

  const startName = problem.geometry.endpoints.start;
  const endName = problem.geometry.endpoints.end;
  const sLow = startName.toLowerCase();
  const eLow = endName.toLowerCase();

  const isPerpHp = Math.abs(theta - 90) <= 0.5 && tv <= 0.05;
  const isPerpVp = Math.abs(phi - 90) <= 0.5 && fv <= 0.05;
  const isParallelBoth = theta <= 0.5 && phi <= 0.5;

  const topViewPointLabel = isPerpHp
    ? z1 >= z2
      ? `${sLow}(${eLow})`
      : `${eLow}(${sLow})`
    : null;
  const frontViewPointLabel = isPerpVp
    ? y1 >= y2
      ? `${sLow}′(${eLow}′)`
      : `${eLow}′(${sLow}′)`
    : null;

  return {
    viewBoxWidth: width,
    viewBoxHeight: height,
    scale,
    xyLineY: Number(xyLineY.toFixed(2)),
    xyStartX: 44,
    xyEndX: width - 44,
    lineLabel: problem.geometry.line_label,
    startName,
    endName,
    aPrime,
    bPrime,
    aTop,
    bTop,
    b1Prime,
    b2Top,
    locusBPrimeY: bPrime.y,
    locusBTopY: bTop.y,
    metrics: { tl, fv, tv, dep, theta, phi, alpha, beta, z1, y1, z2, y2 },
    isPerpHp,
    isPerpVp,
    isParallelBoth,
    topViewPointLabel,
    frontViewPointLabel,
  };
}

/**
 * Pure visual SVG serialization from pre-computed DeterministicDrawingGeometry.
 */
export function renderEngineeringSvg(
  geom: DeterministicDrawingGeometry,
  options?: { isDark?: boolean }
): string {
  const isDark = options?.isDark === true;
  const bg = isDark ? '#0f172a' : '#ffffff';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const borderColor = isDark ? '#334155' : '#cbd5e1';
  const xyColor = isDark ? '#e2e8f0' : '#0f172a';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#475569';
  const fvColor = isDark ? '#f87171' : '#dc2626'; // Front View (VP)
  const tvColor = isDark ? '#60a5fa' : '#2563eb'; // Top View (HP)
  const auxColor = isDark ? '#a78bfa' : '#7c3aed'; // True Length Auxiliary
  const locusColor = isDark ? '#475569' : '#94a3b8';
  const projColor = isDark ? '#64748b' : '#94a3b8';

  const { aPrime, bPrime, aTop, bTop, b1Prime, b2Top, metrics } = geom;
  const showRotatingAux = !geom.isPerpHp && !geom.isPerpVp && !geom.isParallelBoth;

  const fvRadius = Math.hypot(bPrime.x - aPrime.x, bPrime.y - aPrime.y);
  const tvRadius = Math.hypot(bTop.x - aTop.x, bTop.y - aTop.y);

  // Arc path from auxiliary endpoint to final view endpoint around start point
  const buildArcPath = (center: SvgPoint, from: SvgPoint, to: SvgPoint, r: number): string => {
    if (r < 2 || Math.hypot(from.x - to.x, from.y - to.y) < 1.5) return '';
    const cross = (from.x - center.x) * (to.y - center.y) - (from.y - center.y) * (to.x - center.x);
    const sweep = cross >= 0 ? 1 : 0;
    return `M ${from.x} ${from.y} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${to.x} ${to.y}`;
  };

  // Auxiliary vertical drops to loci for rotating-line method:
  // a'b2' (elevation length on a' horizontal line) -> rotated to b'
  const b2PrimeHoriz: SvgPoint = {
    x: Number((aPrime.x + metrics.fv * geom.scale).toFixed(2)),
    y: aPrime.y,
    label: '',
  };
  const b1TopHoriz: SvgPoint = {
    x: Number((aTop.x + metrics.tv * geom.scale).toFixed(2)),
    y: aTop.y,
    label: '',
  };

  const fvArc = showRotatingAux ? buildArcPath(aPrime, b2PrimeHoriz, bPrime, fvRadius) : '';
  const tvArc = showRotatingAux ? buildArcPath(aTop, b1TopHoriz, bTop, tvRadius) : '';

  const locusLeft = Math.min(aPrime.x, bPrime.x, b1Prime.x, b2Top.x) - 24;
  const locusRight = Math.max(aPrime.x, bPrime.x, b1Prime.x, b2Top.x) + 42;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geom.viewBoxWidth} ${geom.viewBoxHeight}" width="${geom.viewBoxWidth}" height="${geom.viewBoxHeight}" role="img" aria-label="Orthographic projections of straight line ${escapeXml(geom.lineLabel)}">`
  );

  // Defs: grid pattern & arrowheads
  parts.push(`<defs>
    <pattern id="edraw-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${gridColor}" stroke-width="1" />
    </pattern>
    <marker id="dim-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 4 L 0 7 z" fill="${textMuted}" />
    </marker>
  </defs>`);

  // Sheet background & border
  parts.push(`<rect x="0" y="0" width="${geom.viewBoxWidth}" height="${geom.viewBoxHeight}" fill="${bg}" />`);
  parts.push(`<rect x="12" y="12" width="${geom.viewBoxWidth - 24}" height="${geom.viewBoxHeight - 24}" rx="8" fill="url(#edraw-grid)" stroke="${borderColor}" stroke-width="1.2" />`);

  // Header metadata bar
  parts.push(
    `<text x="28" y="34" fill="${textPrimary}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" font-weight="700">ORTHOGRAPHIC PROJECTION · LINE ${escapeXml(geom.lineLabel)}</text>`
  );
  parts.push(
    `<text x="${geom.viewBoxWidth - 28}" y="34" text-anchor="end" fill="${textMuted}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">BIS SP 46:2003 FIRST-ANGLE · ${fmt(geom.scale, 2)} px/mm</text>`
  );

  // XY Reference Line
  parts.push(`<g data-layer="xy-reference">
    <line x1="${geom.xyStartX}" y1="${geom.xyLineY}" x2="${geom.xyEndX}" y2="${geom.xyLineY}" stroke="${xyColor}" stroke-width="1.6" />
    <text x="${geom.xyStartX - 14}" y="${geom.xyLineY + 4}" text-anchor="end" fill="${xyColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">X</text>
    <text x="${geom.xyEndX + 12}" y="${geom.xyLineY + 4}" text-anchor="start" fill="${xyColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">Y</text>
    <text x="${geom.xyStartX + 4}" y="${geom.xyLineY - 8}" fill="${fvColor}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">VP (FRONT VIEW)</text>
    <text x="${geom.xyStartX + 4}" y="${geom.xyLineY + 15}" fill="${tvColor}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">HP (TOP VIEW)</text>
  </g>`);

  // End Projectors (strictly vertical, perpendicular to XY)
  const startProjTop = Math.min(aPrime.y, aTop.y, geom.xyLineY) - 8;
  const startProjBot = Math.max(aPrime.y, aTop.y, geom.xyLineY) + 8;
  const endProjTop = Math.min(bPrime.y, bTop.y, geom.xyLineY) - 8;
  const endProjBot = Math.max(bPrime.y, bTop.y, geom.xyLineY) + 8;

  parts.push(`<g data-layer="projectors">
    <line x1="${aPrime.x}" y1="${startProjTop}" x2="${aTop.x}" y2="${startProjBot}" stroke="${projColor}" stroke-width="1" stroke-dasharray="4 3" />
    <line x1="${bPrime.x}" y1="${endProjTop}" x2="${bTop.x}" y2="${endProjBot}" stroke="${projColor}" stroke-width="1" stroke-dasharray="4 3" />
  </g>`);

  // Loci & Rotating-Line Auxiliary Constructions
  if (showRotatingAux) {
    parts.push(`<g data-layer="loci-and-auxiliary">
      <line x1="${locusLeft.toFixed(1)}" y1="${geom.locusBPrimeY}" x2="${locusRight.toFixed(1)}" y2="${geom.locusBPrimeY}" stroke="${locusColor}" stroke-width="1" stroke-dasharray="8 3 2 3" />
      <text x="${(locusRight + 6).toFixed(1)}" y="${geom.locusBPrimeY + 3}" fill="${textMuted}" font-family="ui-monospace, monospace" font-size="9.5">Locus of ${escapeXml(bPrime.label)}</text>
      <line x1="${locusLeft.toFixed(1)}" y1="${geom.locusBTopY}" x2="${locusRight.toFixed(1)}" y2="${geom.locusBTopY}" stroke="${locusColor}" stroke-width="1" stroke-dasharray="8 3 2 3" />
      <text x="${(locusRight + 6).toFixed(1)}" y="${geom.locusBTopY + 3}" fill="${textMuted}" font-family="ui-monospace, monospace" font-size="9.5">Locus of ${escapeXml(bTop.label)}</text>
      <line x1="${aPrime.x}" y1="${aPrime.y}" x2="${b1Prime.x}" y2="${b1Prime.y}" stroke="${auxColor}" stroke-width="1.4" stroke-dasharray="6 3" />
      <line x1="${aTop.x}" y1="${aTop.y}" x2="${b2Top.x}" y2="${b2Top.y}" stroke="${auxColor}" stroke-width="1.4" stroke-dasharray="6 3" />
      <circle cx="${b1Prime.x}" cy="${b1Prime.y}" r="3" fill="${auxColor}" />
      <text x="${(b1Prime.x + 6).toFixed(1)}" y="${(b1Prime.y - 6).toFixed(1)}" fill="${auxColor}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="600">${escapeXml(b1Prime.label)} (TL=${fmt(metrics.tl)})</text>
      <circle cx="${b2Top.x}" cy="${b2Top.y}" r="3" fill="${auxColor}" />
      <text x="${(b2Top.x + 6).toFixed(1)}" y="${(b2Top.y + 13).toFixed(1)}" fill="${auxColor}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="600">${escapeXml(b2Top.label)} (TL=${fmt(metrics.tl)})</text>
      ${fvArc ? `<path d="${fvArc}" fill="none" stroke="${fvColor}" stroke-opacity="0.55" stroke-width="1.1" stroke-dasharray="3 3" />` : ''}
      ${tvArc ? `<path d="${tvArc}" fill="none" stroke="${tvColor}" stroke-opacity="0.55" stroke-width="1.1" stroke-dasharray="3 3" />` : ''}
    </g>`);
  }

  // Final Front View (VP) — Thick continuous line
  parts.push(`<g data-layer="front-view">`);
  if (geom.isPerpVp && geom.frontViewPointLabel) {
    parts.push(`<circle cx="${aPrime.x}" cy="${aPrime.y}" r="4.5" fill="${fvColor}" />`);
    parts.push(
      `<text x="${(aPrime.x + 8).toFixed(1)}" y="${(aPrime.y - 8).toFixed(1)}" fill="${fvColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(geom.frontViewPointLabel)}</text>`
    );
  } else {
    parts.push(
      `<line x1="${aPrime.x}" y1="${aPrime.y}" x2="${bPrime.x}" y2="${bPrime.y}" stroke="${fvColor}" stroke-width="2.8" stroke-linecap="round" />`
    );
    parts.push(`<circle cx="${aPrime.x}" cy="${aPrime.y}" r="3.8" fill="${fvColor}" />`);
    parts.push(`<circle cx="${bPrime.x}" cy="${bPrime.y}" r="3.8" fill="${fvColor}" />`);
    parts.push(
      `<text x="${(aPrime.x - 10).toFixed(1)}" y="${(aPrime.y - 7).toFixed(1)}" text-anchor="end" fill="${fvColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(aPrime.label)}</text>`
    );
    parts.push(
      `<text x="${(bPrime.x - 6).toFixed(1)}" y="${(bPrime.y - 9).toFixed(1)}" text-anchor="end" fill="${fvColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(bPrime.label)}</text>`
    );
  }
  parts.push(`</g>`);

  // Final Top View (HP) — Thick continuous line
  parts.push(`<g data-layer="top-view">`);
  if (geom.isPerpHp && geom.topViewPointLabel) {
    parts.push(`<circle cx="${aTop.x}" cy="${aTop.y}" r="4.5" fill="${tvColor}" />`);
    parts.push(
      `<text x="${(aTop.x + 8).toFixed(1)}" y="${(aTop.y + 15).toFixed(1)}" fill="${tvColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(geom.topViewPointLabel)}</text>`
    );
  } else {
    parts.push(
      `<line x1="${aTop.x}" y1="${aTop.y}" x2="${bTop.x}" y2="${bTop.y}" stroke="${tvColor}" stroke-width="2.8" stroke-linecap="round" />`
    );
    parts.push(`<circle cx="${aTop.x}" cy="${aTop.y}" r="3.8" fill="${tvColor}" />`);
    parts.push(`<circle cx="${bTop.x}" cy="${bTop.y}" r="3.8" fill="${tvColor}" />`);
    parts.push(
      `<text x="${(aTop.x - 10).toFixed(1)}" y="${(aTop.y + 14).toFixed(1)}" text-anchor="end" fill="${tvColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(aTop.label)}</text>`
    );
    parts.push(
      `<text x="${(bTop.x - 6).toFixed(1)}" y="${(bTop.y + 16).toFixed(1)}" text-anchor="end" fill="${tvColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(bTop.label)}</text>`
    );
  }
  parts.push(`</g>`);

  // Dimension Callouts (Start HP/VP distances + DEP)
  const dimX = aPrime.x - 32;
  parts.push(`<g data-layer="dimensions">`);
  if (Math.abs(aPrime.y - geom.xyLineY) > 6) {
    parts.push(
      `<line x1="${dimX.toFixed(1)}" y1="${geom.xyLineY}" x2="${dimX.toFixed(1)}" y2="${aPrime.y}" stroke="${textMuted}" stroke-width="1" marker-start="url(#dim-arrow)" marker-end="url(#dim-arrow)" />`
    );
    parts.push(
      `<text x="${(dimX - 5).toFixed(1)}" y="${((geom.xyLineY + aPrime.y) / 2 + 3).toFixed(1)}" text-anchor="end" fill="${textMuted}" font-family="ui-monospace, monospace" font-size="10">${fmt(Math.abs(metrics.z1))} mm</text>`
    );
  }
  if (Math.abs(aTop.y - geom.xyLineY) > 6) {
    parts.push(
      `<line x1="${dimX.toFixed(1)}" y1="${geom.xyLineY}" x2="${dimX.toFixed(1)}" y2="${aTop.y}" stroke="${textMuted}" stroke-width="1" marker-start="url(#dim-arrow)" marker-end="url(#dim-arrow)" />`
    );
    parts.push(
      `<text x="${(dimX - 5).toFixed(1)}" y="${((geom.xyLineY + aTop.y) / 2 + 3).toFixed(1)}" text-anchor="end" fill="${textMuted}" font-family="ui-monospace, monospace" font-size="10">${fmt(Math.abs(metrics.y1))} mm</text>`
    );
  }
  if (Math.abs(bTop.x - aTop.x) > 12) {
    const depY = geom.viewBoxHeight - 54;
    parts.push(
      `<line x1="${aTop.x}" y1="${depY}" x2="${bTop.x}" y2="${depY}" stroke="${textMuted}" stroke-width="1" marker-start="url(#dim-arrow)" marker-end="url(#dim-arrow)" />`
    );
    parts.push(
      `<text x="${((aTop.x + bTop.x) / 2).toFixed(1)}" y="${depY - 5}" text-anchor="middle" fill="${textMuted}" font-family="ui-monospace, monospace" font-size="10">DEP = ${fmt(metrics.dep, 2)} mm</text>`
    );
  }
  parts.push(`</g>`);

  // Footer Summary Title Block (exact verified numeric values)
  const footerY = geom.viewBoxHeight - 24;
  const summaryText = `TL = ${fmt(metrics.tl, 2)} mm  |  FV = ${fmt(metrics.fv, 2)} mm  |  TV = ${fmt(metrics.tv, 2)} mm  |  θ = ${fmt(metrics.theta, 2)}°  |  φ = ${fmt(metrics.phi, 2)}°  |  α = ${fmt(metrics.alpha, 2)}°  |  β = ${fmt(metrics.beta, 2)}°`;
  parts.push(
    `<text x="${geom.viewBoxWidth / 2}" y="${footerY}" text-anchor="middle" fill="${textPrimary}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5" font-weight="600">${escapeXml(summaryText)}</text>`
  );

  parts.push(`</svg>`);
  return parts.join('\n');
}

/**
 * Converts a validated Stage 4 CanonicalEngineeringProblem into EDraw's LineProblemInput
 * so it seamlessly integrates with RotatingLineConstructionEngine & LinesModule.
 */
export function canonicalProblemToLineInput(
  problem: CanonicalEngineeringProblem
): LineProblemInput {
  if (problem.geometry.entity_type !== 'straight_line') {
    throw new Error('Only straight_line problems can be mapped to LineProblemInput.');
  }

  const startName = problem.geometry.endpoints.start;
  const endName = problem.geometry.endpoints.end;
  const tl = getMeasurementValue(problem, 'true_length') ?? 0;
  const fv = getMeasurementValue(problem, 'front_view_length') ?? 0;
  const tv = getMeasurementValue(problem, 'top_view_length') ?? 0;
  const dep = getMeasurementValue(problem, 'dep') ?? 0;
  const theta = getMeasurementValue(problem, 'theta_hp') ?? 0;
  const phi = getMeasurementValue(problem, 'phi_vp') ?? 0;
  const z1 = getMeasurementValue(problem, 'start_z_hp') ?? 0;
  const y1 = getMeasurementValue(problem, 'start_y_vp') ?? 0;
  const z2 = getMeasurementValue(problem, 'end_z_hp') ?? 0;
  const y2 = getMeasurementValue(problem, 'end_y_vp') ?? 0;

  const endBQuadrant: LineProblemInput['endBQuadrant'] =
    z2 < 0
      ? y2 < 0
        ? 'BELOW_BEHIND'
        : 'BELOW_FRONT'
      : y2 < 0
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

  return {
    mode: 'TRUE_LENGTH_ANGLES',
    nameA: startName,
    nameB: endName,
    color: '#2563eb',
    endA: {
      name: startName,
      hpRelation: z1 < 0 ? 'BELOW' : z1 === 0 ? 'ON' : 'ABOVE',
      distanceHp: Math.abs(z1),
      vpRelation: y1 < 0 ? 'BEHIND' : y1 === 0 ? 'ON' : 'IN_FRONT',
      distanceVp: Math.abs(y1),
    },
    endB: {
      name: endName,
      hpRelation: z2 < 0 ? 'BELOW' : z2 === 0 ? 'ON' : 'ABOVE',
      distanceHp: Math.abs(z2),
      vpRelation: y2 < 0 ? 'BEHIND' : y2 === 0 ? 'ON' : 'IN_FRONT',
      distanceVp: Math.abs(y2),
    },
    dep,
    trueLength: tl,
    thetaDeg: theta,
    phiDeg: phi,
    endBQuadrant,
    frontViewLength: fv,
    topViewLength: tv,
    targetQuadrantB,
  };
}

/**
 * Stage 5 Entry Point: Strictly validates readiness gate before generating deterministic SVG.
 */
export function runStage5SvgRenderer(
  problem: CanonicalEngineeringProblem,
  options?: { isDark?: boolean; width?: number; height?: number }
): Stage5RenderResult {
  const schemaCheck = validateCanonicalProblem(problem);
  if (!schemaCheck.ok) {
    return {
      ok: false,
      stage: 'stage_5_render_svg',
      error: `Cannot render malformed JSON: ${schemaCheck.errors.join('; ')}`,
      blocked_reason: 'Schema validation failed prior to Stage 5 rendering.',
    };
  }

  const validProblem = schemaCheck.data;
  if (
    !validProblem.validation.schema_valid ||
    !validProblem.validation.geometry_valid ||
    !validProblem.validation.ready_for_render ||
    !validProblem.drawing_instructions.ready_to_render
  ) {
    const reason =
      validProblem.drawing_instructions.blocked_reason ||
      `Rendering blocked because solver status is "${validProblem.validation.solver_status}".`;
    return {
      ok: false,
      stage: 'stage_5_render_svg',
      error: reason,
      blocked_reason: reason,
    };
  }

  if (
    validProblem.geometry.entity_type !== 'straight_line' ||
    !validProblem.geometry.solved_coordinates
  ) {
    return {
      ok: false,
      stage: 'stage_5_render_svg',
      error: 'Missing solved straight-line coordinates in validated JSON.',
      blocked_reason: 'Solved coordinates are required for deterministic SVG construction.',
    };
  }

  try {
    const geometry = computeDrawingGeometry(validProblem, {
      width: options?.width,
      height: options?.height,
    });
    const svg = renderEngineeringSvg(geometry, { isDark: options?.isDark });
    const lineInput = canonicalProblemToLineInput(validProblem);
    return {
      ok: true,
      stage: 'stage_5_render_svg',
      svg,
      geometry,
      lineInput,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      stage: 'stage_5_render_svg',
      error: `SVG renderer failed: ${msg}`,
      blocked_reason: msg,
    };
  }
}
