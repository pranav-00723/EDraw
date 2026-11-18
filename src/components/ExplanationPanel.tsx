/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ComputedPoint, QuadrantType } from '../types/projection';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface ExplanationPanelProps {
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
}

type ProofFocus = 'space' | 'fv' | 'tv' | null;

interface QuadrantSpec {
  id: QuadrantType;
  numeral: string;
  label: string;
  spacePosition: string;
  frontViewPos: string;
  topViewPos: string;
  drawingResult: string;
  explanation: string;
  /** Sample coordinates in side-profile SVG space relative to origin (210, 150) */
  sampleDx: number; // + right (in front of VP), - left (behind VP)
  sampleDy: number; // + up (above HP), - down (below HP)
  hpRotationDir: 'DOWN' | 'UP';
}

const QUADRANT_SPECS: QuadrantSpec[] = [
  {
    id: 'FIRST',
    numeral: 'I',
    label: '1st Quadrant',
    spacePosition: 'Above HP · In Front of VP',
    frontViewPos: 'Above XY',
    topViewPos: 'Below XY',
    drawingResult: 'a′ above XY · a below XY',
    explanation:
      'HP rotates 90° clockwise downward in front of VP, cleanly separating Elevation above XY and Plan below XY. This is the BIS SP 46:2003 standard.',
    sampleDx: 72,
    sampleDy: -64,
    hpRotationDir: 'DOWN',
  },
  {
    id: 'SECOND',
    numeral: 'II',
    label: '2nd Quadrant',
    spacePosition: 'Above HP · Behind VP',
    frontViewPos: 'Above XY',
    topViewPos: 'Above XY',
    drawingResult: 'Both a′ & a ABOVE XY',
    explanation:
      'Because the point is behind VP, the rear half of HP swings 90° clockwise upward onto VP, causing Top View and Front View to overlap above XY.',
    sampleDx: -72,
    sampleDy: -64,
    hpRotationDir: 'UP',
  },
  {
    id: 'THIRD',
    numeral: 'III',
    label: '3rd Quadrant',
    spacePosition: 'Below HP · Behind VP',
    frontViewPos: 'Below XY',
    topViewPos: 'Above XY',
    drawingResult: 'a above XY · a′ below XY',
    explanation:
      'HP swings upward behind VP while the point sits below HP, placing Plan above XY and Elevation below XY (Third-Angle convention).',
    sampleDx: -72,
    sampleDy: 64,
    hpRotationDir: 'UP',
  },
  {
    id: 'FOURTH',
    numeral: 'IV',
    label: '4th Quadrant',
    spacePosition: 'Below HP · In Front of VP',
    frontViewPos: 'Below XY',
    topViewPos: 'Below XY',
    drawingResult: 'Both a′ & a BELOW XY',
    explanation:
      'HP swings downward in front of VP while the point is already below HP, causing both Front View and Top View to fall below XY.',
    sampleDx: 72,
    sampleDy: 64,
    hpRotationDir: 'DOWN',
  },
];

const GOLDEN_LAWS = [
  {
    num: '01',
    title: 'Reference Line (XY)',
    body: 'The intersection hinge between the Horizontal Plane (HP) and Vertical Plane (VP), drawn as a continuous thin line.',
  },
  {
    num: '02',
    title: 'Elevation on VP (a′)',
    body: 'Distance of the Front View from XY equals the true height of the point above or below HP. Always marked with a prime (′).',
  },
  {
    num: '03',
    title: 'Plan on HP (a)',
    body: 'Distance of the Top View from XY equals the true depth of the point in front of or behind VP. Marked lowercase without prime.',
  },
  {
    num: '04',
    title: '90° Clockwise Unfolding',
    body: 'HP always rotates 90° clockwise about XY so both planes lie coplanar on a flat 2D engineering sheet.',
  },
  {
    num: '05',
    title: 'Common Vertical Projector',
    body: 'Front View (a′) and Top View (a) always share a single continuous 2H projector perpendicular to XY.',
  },
];

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  point,
  allPoints,
  onSelectPoint,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'rules' | 'quadrants'>('details');
  const [proofFocus, setProofFocus] = useState<ProofFocus>(null);
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>('FIRST');

  // Interactive 90° fold animation state
  const [foldAngleDeg, setFoldAngleDeg] = useState<number>(90);
  const [isPlayingFold, setIsPlayingFold] = useState<boolean>(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlayingFold) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setFoldAngleDeg(90);
      setIsPlayingFold(false);
      return;
    }

    let lastTs: number | null = null;
    const step = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      setFoldAngleDeg((prev) => {
        const next = prev + dt * 42;
        if (next >= 90) {
          setIsPlayingFold(false);
          return 90;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlayingFold]);

  const handleTogglePlayFold = () => {
    if (isPlayingFold) {
      setIsPlayingFold(false);
    } else {
      if (foldAngleDeg >= 89) setFoldAngleDeg(0);
      setIsPlayingFold(true);
    }
  };

  if (!point) {
    return (
      <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
        Select or add a point to inspect its orthographic proof and spatial geometry.
      </div>
    );
  }

  // Drafting Palette (Theme-Aware, WCAG AA Contrast)
  const sheetBg = isDark ? '#0b1220' : '#fcfcfd';
  const gridStroke = isDark ? '#17233b' : '#eef2f6';
  const frameOuter = isDark ? '#334155' : '#1e293b';
  const frameInner = isDark ? '#1e293b' : '#cbd5e1';
  const inkPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const inkSecondary = isDark ? '#94a3b8' : '#475569';
  const inkMuted = isDark ? '#64748b' : '#64748b';
  const titleBlockFill = isDark ? '#0f192d' : '#f8fafc';

  const hpPositionText =
    point.hpRelation === 'ON'
      ? 'On HP (0 mm)'
      : `${point.distHp} mm ${point.hpRelation === 'ABOVE' ? 'above HP' : 'below HP'}`;

  const vpPositionText =
    point.vpRelation === 'ON'
      ? 'On VP (0 mm)'
      : `${point.distVp} mm ${point.vpRelation === 'IN_FRONT' ? 'in front of VP' : 'behind VP'}`;

  const activeSpec =
    QUADRANT_SPECS.find((q) => q.id === selectedQuadrant) || QUADRANT_SPECS[0];

  // Dynamic headline and 1-sentence takeaway per active tab
  const mastheadMeta = {
    details: {
      title: `Orthographic Proof — Point ${point.name}`,
      takeaway: `Front view ${point.frontViewLabel} lands ${point.frontViewDesc.toLowerCase()}; top view ${point.topViewLabel} lands ${point.topViewDesc.toLowerCase()}.`,
    },
    rules: {
      title: 'The 90° Clockwise Unfolding Principle',
      takeaway:
        'Rotate the Horizontal Plane 90° clockwise around XY to unfold 3D space onto a single 2D drawing sheet.',
    },
    quadrants: {
      title: 'Four-Quadrant Spatial Atlas',
      takeaway: `${activeSpec.label} (${activeSpec.spacePosition}) produces ${activeSpec.drawingResult}.`,
    },
  }[activeTab];

  // Fold interpolation for Tab 2
  const foldRad = (foldAngleDeg * Math.PI) / 180;
  const foldProgress = Math.max(0, Math.min(1, foldAngleDeg / 90));
  // 3D HP front edge drops toward coplanar VP bottom; back edge rises behind VP
  const hpFrontDrop = 46 * Math.sin(foldRad);
  const hpFrontDepth = 82 * Math.cos(foldRad);
  const hpBackLift = 38 * Math.sin(foldRad);
  const hpBackDepth = 64 * Math.cos(foldRad);

  // Sample point in Tab 2 unfolding diagram
  const samplePointX = 188;
  const sampleElevationY = 66; // p' on VP
  const samplePlanYOnHp = 114 + hpFrontDrop * 0.62;
  const samplePlanXOnHp = samplePointX - hpFrontDepth * 0.42;

  return (
    <section
      aria-label="Pedagogical Engineering Analysis"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      {/* ================================================================= */}
      {/* GRAND ARCHITECTURAL MASTHEAD                                      */}
      {/* ================================================================= */}
      <header className="px-6 pt-6 pb-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>Drafting Theory Studio</span>
              <span aria-hidden="true">·</span>
              <span>First-Angle Projection</span>
              <span aria-hidden="true">·</span>
              <span>BIS SP 46:2003</span>
            </div>

            <h2
              style={{ fontFamily: "'Fraunces', Georgia, serif", textWrap: 'balance' }}
              className="mt-1.5 text-2xl sm:text-[26px] font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-snug"
            >
              {mastheadMeta.title}
            </h2>

            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {mastheadMeta.takeaway}
            </p>
          </div>

          {/* Active Point Switcher (when multiple points exist) */}
          {allPoints.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0 self-start lg:self-end pb-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Active Point</span>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                {allPoints.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPoint && onSelectPoint(p.id)}
                    className={`px-2.5 py-1 rounded-md font-mono text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      p.id === point.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clean Architectural Underline Navigation */}
        <nav
          role="tablist"
          aria-label="Pedagogical sections"
          className="flex items-center gap-6 overflow-x-auto -mb-px"
        >
          {[
            { id: 'details' as const, num: '01', label: `Point ${point.name} Proof` },
            { id: 'rules' as const, num: '02', label: '90° Unfolding Lab' },
            { id: 'quadrants' as const, num: '03', label: 'Quadrant Atlas' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  active
                    ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-50 font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="font-mono text-[11px] opacity-70 tabular-nums">{tab.num}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* ================================================================= */}
      {/* TAB 1: SPLIT-PANE ORTHOGRAPHIC PLATE + INTERACTIVE 3-STEP PROOF   */}
      {/* ================================================================= */}
      <div className="p-6">
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
            {/* Left 7 Columns: Spacious Interactive Drafting Plate */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/80">
                <svg
                  viewBox="0 0 640 310"
                  className="w-full h-full select-none block"
                  style={{ minHeight: '270px', backgroundColor: sheetBg }}
                  role="img"
                  aria-label={`Interactive orthographic plate for Point ${point.name}`}
                >
                  <defs>
                    <pattern id="folio-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke={gridStroke} strokeWidth="0.8" />
                    </pattern>

                    <marker id="folio-arrow-vp-s" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 10 2 L 0 5 L 10 8 z" fill={vpColor} />
                    </marker>
                    <marker id="folio-arrow-vp-e" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 2 L 10 5 L 0 8 z" fill={vpColor} />
                    </marker>

                    <marker id="folio-arrow-hp-s" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 10 2 L 0 5 L 10 8 z" fill={hpColor} />
                    </marker>
                    <marker id="folio-arrow-hp-e" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 2 L 10 5 L 0 8 z" fill={hpColor} />
                    </marker>
                  </defs>

                  <rect width="640" height="310" fill={sheetBg} />
                  <rect width="640" height="310" fill="url(#folio-grid)" />

                  {/* Architectural Double Border */}
                  <rect x="12" y="12" width="616" height="286" fill="none" stroke={frameOuter} strokeWidth="1.2" />
                  <rect x="17" y="17" width="606" height="276" fill="none" stroke={frameInner} strokeWidth="0.6" />

                  {(() => {
                    const originY = 155;
                    const projX = 210;
                    const maxDist = Math.max(Math.abs(point.frontViewY), Math.abs(point.topViewY), 10);
                    const scale = Math.min(2.1, 102 / maxDist);

                    const elevY = originY - point.frontViewY * scale;
                    const planY = originY - point.topViewY * scale;
                    const viewsCoincide = Math.abs(elevY - planY) < 2.5;

                    const projMinY = Math.min(elevY, planY, originY) - 20;
                    const projMaxY = Math.max(elevY, planY, originY) + 20;

                    const dimFvX = projX + 205;
                    const dimTvX = projX + 260;

                    const fvOpacity = proofFocus === 'tv' ? 0.28 : 1;
                    const tvOpacity = proofFocus === 'fv' ? 0.28 : 1;

                    return (
                      <g>
                        {/* Plane Zone Markers */}
                        <text x="34" y="38" fill={vpColor} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace" opacity={fvOpacity}>
                          VP · VERTICAL PLANE (ELEVATION)
                        </text>
                        <text x="34" y="280" fill={hpColor} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace" opacity={tvOpacity}>
                          HP · HORIZONTAL PLANE (PLAN)
                        </text>

                        {/* Reference Line XY */}
                        <line x1="32" y1={originY} x2="606" y2={originY} stroke={inkPrimary} strokeWidth="1.7" />
                        <circle cx="32" cy={originY} r="2.2" fill={inkPrimary} />
                        <circle cx="606" cy={originY} r="2.2" fill={inkPrimary} />
                        <text x="26" y={originY + 5} fill={inkPrimary} fontSize="13" fontWeight="700" fontFamily="'JetBrains Mono', monospace" textAnchor="end">
                          X
                        </text>
                        <text x="613" y={originY + 5} fill={inkPrimary} fontSize="13" fontWeight="700" fontFamily="'JetBrains Mono', monospace" textAnchor="start">
                          Y
                        </text>

                        {/* Common 2H Projector Line */}
                        <line x1={projX} y1={projMinY} x2={projX} y2={projMaxY} stroke={inkSecondary} strokeWidth="1.05" />
                        <circle cx={projX} cy={originY} r="2.5" fill={inkPrimary} />
                        <text x={projX - 9} y={originY + 13} fill={inkMuted} fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="end">
                          o
                        </text>

                        {/* FRONT VIEW a' */}
                        <g
                          opacity={fvOpacity}
                          className="cursor-pointer transition-opacity duration-150"
                          onMouseEnter={() => setProofFocus('fv')}
                          onMouseLeave={() => setProofFocus(null)}
                        >
                          {proofFocus === 'fv' && (
                            <circle cx={projX} cy={elevY} r="12" fill={vpColor} opacity="0.16" />
                          )}
                          <line x1={projX - 6} y1={elevY} x2={projX + 6} y2={elevY} stroke={vpColor} strokeWidth="1" />
                          <line x1={projX} y1={elevY - 6} x2={projX} y2={elevY + 6} stroke={vpColor} strokeWidth="1" />
                          <circle cx={projX} cy={elevY} r="4.5" fill={vpColor} stroke={sheetBg} strokeWidth="1.5" />

                          <text
                            x={projX - 12}
                            y={elevY + (point.frontViewY >= 0 ? -4 : 13)}
                            fill={vpColor}
                            fontSize="14"
                            fontWeight="700"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="end"
                          >
                            {viewsCoincide ? `${point.frontViewLabel} (${point.topViewLabel})` : point.frontViewLabel}
                          </text>

                          <text
                            x={projX + 12}
                            y={elevY + (point.frontViewY >= 0 ? -5 : 13)}
                            fill={inkPrimary}
                            fontSize="10.5"
                            fontWeight="600"
                            fontFamily="'Plus Jakarta Sans', sans-serif"
                          >
                            Front View · {point.distHp} mm {point.hpRelation === 'ABOVE' ? 'above' : point.hpRelation === 'BELOW' ? 'below' : 'on'} HP
                          </text>

                          {point.distHp > 0 && (
                            <g>
                              <line x1={projX + 6} y1={elevY} x2={dimFvX + 6} y2={elevY} stroke={inkMuted} strokeWidth="0.7" strokeDasharray="3,2" />
                              <line x1={projX + 6} y1={originY} x2={dimFvX + 6} y2={originY} stroke={inkMuted} strokeWidth="0.7" strokeDasharray="3,2" />
                              <line
                                x1={dimFvX}
                                y1={originY}
                                x2={dimFvX}
                                y2={elevY}
                                stroke={vpColor}
                                strokeWidth="1.2"
                                markerStart="url(#folio-arrow-vp-s)"
                                markerEnd="url(#folio-arrow-vp-e)"
                              />
                              <text
                                x={dimFvX + 6}
                                y={(originY + elevY) / 2 + 4}
                                fill={vpColor}
                                fontSize="10"
                                fontWeight="700"
                                fontFamily="'JetBrains Mono', monospace"
                              >
                                h={point.distHp}
                              </text>
                            </g>
                          )}
                        </g>

                        {/* TOP VIEW a */}
                        {!viewsCoincide && (
                          <g
                            opacity={tvOpacity}
                            className="cursor-pointer transition-opacity duration-150"
                            onMouseEnter={() => setProofFocus('tv')}
                            onMouseLeave={() => setProofFocus(null)}
                          >
                            {proofFocus === 'tv' && (
                              <circle cx={projX} cy={planY} r="12" fill={hpColor} opacity="0.16" />
                            )}
                            <line x1={projX - 6} y1={planY} x2={projX + 6} y2={planY} stroke={hpColor} strokeWidth="1" />
                            <line x1={projX} y1={planY - 6} x2={projX} y2={planY + 6} stroke={hpColor} strokeWidth="1" />
                            <circle cx={projX} cy={planY} r="4.5" fill={hpColor} stroke={sheetBg} strokeWidth="1.5" />

                            <text
                              x={projX - 12}
                              y={planY + (point.topViewY >= 0 ? -4 : 13)}
                              fill={hpColor}
                              fontSize="14"
                              fontWeight="700"
                              fontFamily="'JetBrains Mono', monospace"
                              textAnchor="end"
                            >
                              {point.topViewLabel}
                            </text>

                            <text
                              x={projX + 12}
                              y={planY + (point.topViewY >= 0 ? -5 : 13)}
                              fill={inkPrimary}
                              fontSize="10.5"
                              fontWeight="600"
                              fontFamily="'Plus Jakarta Sans', sans-serif"
                            >
                              Top View · {point.distVp} mm {point.vpRelation === 'IN_FRONT' ? 'in front of' : point.vpRelation === 'BEHIND' ? 'behind' : 'on'} VP
                            </text>

                            {point.distVp > 0 && (
                              <g>
                                <line x1={projX + 6} y1={planY} x2={dimTvX + 6} y2={planY} stroke={inkMuted} strokeWidth="0.7" strokeDasharray="3,2" />
                                <line x1={projX + 6} y1={originY} x2={dimTvX + 6} y2={originY} stroke={inkMuted} strokeWidth="0.7" strokeDasharray="3,2" />
                                <line
                                  x1={dimTvX}
                                  y1={originY}
                                  x2={dimTvX}
                                  y2={planY}
                                  stroke={hpColor}
                                  strokeWidth="1.2"
                                  markerStart="url(#folio-arrow-hp-s)"
                                  markerEnd="url(#folio-arrow-hp-e)"
                                />
                                <text
                                  x={dimTvX + 6}
                                  y={(originY + planY) / 2 + 4}
                                  fill={hpColor}
                                  fontSize="10"
                                  fontWeight="700"
                                  fontFamily="'JetBrains Mono', monospace"
                                >
                                  d={point.distVp}
                                </text>
                              </g>
                            )}
                          </g>
                        )}

                        {/* Architectural Title Block */}
                        <g transform="translate(454, 240)">
                          <rect x="0" y="0" width="162" height="48" fill={titleBlockFill} stroke={frameInner} strokeWidth="0.9" />
                          <line x1="0" y1="18" x2="162" y2="18" stroke={frameInner} strokeWidth="0.7" />
                          <text x="8" y="12.5" fill={inkPrimary} fontSize="8.5" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                            PLATE 01 · POINT {point.name}
                          </text>
                          <text x="8" y="30" fill={inkSecondary} fontSize="8.2" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
                            ELEV {point.frontViewLabel} · PLAN {point.topViewLabel}
                          </text>
                          <text x="8" y="42" fill={inkMuted} fontSize="7.6" fontFamily="'JetBrains Mono', monospace">
                            1ST ANGLE · CONTINUOUS 2H
                          </text>
                        </g>
                      </g>
                    );
                  })()}
                </svg>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Hover any step on the right or any point on the plate to isolate its projection ray.
              </p>
            </div>

            {/* Right 5 Columns: Interactive 3-Step Visual Proof + Coordinate Ledger */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-5">
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                {/* Step 01 */}
                <button
                  type="button"
                  onMouseEnter={() => setProofFocus('space')}
                  onMouseLeave={() => setProofFocus(null)}
                  onClick={() => setProofFocus(proofFocus === 'space' ? null : 'space')}
                  className={`w-full text-left py-3.5 px-2 -mx-2 rounded-lg transition-colors duration-150 cursor-pointer ${
                    proofFocus === 'space'
                      ? 'bg-slate-100/80 dark:bg-slate-800/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                      STEP 01 · SPATIAL LOCUS
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {point.name}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {hpPositionText} and {vpPositionText}.
                  </p>
                </button>

                {/* Step 02 */}
                <button
                  type="button"
                  onMouseEnter={() => setProofFocus('fv')}
                  onMouseLeave={() => setProofFocus(null)}
                  onClick={() => setProofFocus(proofFocus === 'fv' ? null : 'fv')}
                  className={`w-full text-left py-3.5 px-2 -mx-2 rounded-lg transition-colors duration-150 cursor-pointer ${
                    proofFocus === 'fv'
                      ? 'bg-slate-100/80 dark:bg-slate-800/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold flex items-center gap-2 tabular-nums" style={{ color: vpColor }}>
                      <span className="inline-block w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                      STEP 02 · FRONT VIEW (VP)
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums" style={{ color: vpColor }}>
                      {point.frontViewLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {point.frontViewDesc}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Projected onto VP at height h = {point.distHp} mm from XY.
                  </p>
                </button>

                {/* Step 03 */}
                <button
                  type="button"
                  onMouseEnter={() => setProofFocus('tv')}
                  onMouseLeave={() => setProofFocus(null)}
                  onClick={() => setProofFocus(proofFocus === 'tv' ? null : 'tv')}
                  className={`w-full text-left py-3.5 px-2 -mx-2 rounded-lg transition-colors duration-150 cursor-pointer ${
                    proofFocus === 'tv'
                      ? 'bg-slate-100/80 dark:bg-slate-800/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold flex items-center gap-2 tabular-nums" style={{ color: hpColor }}>
                      <span className="inline-block w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                      STEP 03 · TOP VIEW (HP ROTATED 90° CW)
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums" style={{ color: hpColor }}>
                      {point.topViewLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {point.topViewDesc}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Projected onto HP at depth d = {point.distVp} mm, then unfolded onto sheet.
                  </p>
                </button>
              </div>

              {/* Clean Geometrical Rationale + Tabular Coordinates */}
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {point.explanation}
                </p>

                <dl className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                  <div>
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">Elevation (h)</dt>
                    <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {point.distHp} mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">Plan Depth (d)</dt>
                    <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {point.distVp} mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">Views</dt>
                    <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {point.frontViewLabel} / {point.topViewLabel}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: INTERACTIVE 90° UNFOLDING LAB + 5 GOLDEN LAWS              */}
        {/* ================================================================= */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* Left 7 Columns: Live Animated 3D-to-2D Unfolding Stage */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Scrub & Playback Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlayFold}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isPlayingFold ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlayingFold ? 'Pause Fold' : foldAngleDeg >= 89 ? 'Replay 90° Fold' : 'Animate Fold'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlayingFold(false);
                      setFoldAngleDeg(0);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset 0°</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-xs">
                  <label
                    htmlFor="folio-fold-angle"
                    className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums"
                  >
                    Fold: {Math.round(foldAngleDeg)}° CW
                  </label>
                  <input
                    id="folio-fold-angle"
                    type="range"
                    min={0}
                    max={90}
                    step={1}
                    value={foldAngleDeg}
                    onChange={(e) => {
                      setIsPlayingFold(false);
                      setFoldAngleDeg(Number(e.target.value));
                    }}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Unfolding Schematic Canvas */}
              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/80">
                <svg
                  viewBox="0 0 640 260"
                  className="w-full h-auto select-none block"
                  style={{ minHeight: '240px', backgroundColor: sheetBg }}
                  role="img"
                  aria-label="Interactive 3D dihedral to 2D sheet unfolding simulation"
                >
                  <defs>
                    <pattern id="unfold-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke={gridStroke} strokeWidth="0.8" />
                    </pattern>
                    <marker id="unfold-arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#d97706" />
                    </marker>
                    <marker id="unfold-arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={inkSecondary} />
                    </marker>
                  </defs>

                  <rect width="640" height="260" fill={sheetBg} />
                  <rect width="640" height="260" fill="url(#unfold-grid)" />

                  {/* Left: Dihedral Planes */}
                  <g transform="translate(24, 24)">
                    {/* Rear HP half (behind VP, rotates UP as foldAngle increases) */}
                    <polygon
                      points={`115,96 245,96 ${245 + hpBackDepth * 0.55},${96 - hpBackLift - hpBackDepth * 0.25} ${115 + hpBackDepth * 0.55},${96 - hpBackLift - hpBackDepth * 0.25}`}
                      fill={isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.06)'}
                      stroke={hpColor}
                      strokeWidth="1.1"
                      strokeDasharray="4,3"
                    />

                    {/* Stationary Vertical Plane (VP) */}
                    <polygon
                      points="115,18 245,18 245,176 115,176"
                      fill={isDark ? 'rgba(220,38,38,0.14)' : 'rgba(220,38,38,0.07)'}
                      stroke={vpColor}
                      strokeWidth="1.5"
                    />
                    <text x="180" y="34" fill={vpColor} fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                      VP (FIXED)
                    </text>

                    {/* Front HP half (rotates DOWNWARD 90° CW) */}
                    <polygon
                      points={`115,96 245,96 ${245 - hpFrontDepth * 0.65},${96 + hpFrontDrop + hpFrontDepth * 0.35} ${115 - hpFrontDepth * 0.65},${96 + hpFrontDrop + hpFrontDepth * 0.35}`}
                      fill={isDark ? 'rgba(37,99,235,0.22)' : 'rgba(37,99,235,0.12)'}
                      stroke={hpColor}
                      strokeWidth="1.5"
                    />
                    <text
                      x={132 - hpFrontDepth * 0.4}
                      y={114 + hpFrontDrop + hpFrontDepth * 0.28}
                      fill={hpColor}
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      HP ({Math.round(foldAngleDeg)}°)
                    </text>

                    {/* XY Hinge Line */}
                    <line x1="115" y1="96" x2="245" y2="96" stroke={inkPrimary} strokeWidth="2.2" />
                    <text x="108" y="100" fill={inkPrimary} fontSize="11" fontWeight="700" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
                      X
                    </text>
                    <text x="252" y="100" fill={inkPrimary} fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      Y
                    </text>

                    {/* Sample point projections in 3D space */}
                    <circle cx={samplePointX} cy={sampleElevationY} r="3.5" fill={vpColor} />
                    <text x={samplePointX + 7} y={sampleElevationY + 3} fill={vpColor} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      p′
                    </text>

                    <circle cx={samplePlanXOnHp} cy={samplePlanYOnHp} r="3.5" fill={hpColor} />
                    <text x={samplePlanXOnHp - 12} y={samplePlanYOnHp + 4} fill={hpColor} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      p
                    </text>

                    {/* 90° CW Rotation Arc */}
                    <path
                      d="M 218 106 A 36 36 0 0 1 226 156"
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="1.8"
                      strokeDasharray="4,3"
                      markerEnd="url(#unfold-arrow-amber)"
                    />
                    <text x="234" y="138" fill="#d97706" fontSize="9.5" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      90° CW
                    </text>

                    {/* Observer Direction */}
                    <text x="24" y="94" fill={inkSecondary} fontSize="9.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
                      FRONT EYE
                    </text>
                    <line x1="24" y1="100" x2="86" y2="100" stroke={inkSecondary} strokeWidth="1.2" markerEnd="url(#unfold-arrow-ink)" />
                  </g>

                  {/* Unfolding Arrow */}
                  <g transform="translate(336, 120)">
                    <line x1="0" y1="0" x2="44" y2="0" stroke={inkSecondary} strokeWidth="1.8" markerEnd="url(#unfold-arrow-ink)" />
                    <text x="22" y="-10" fill={inkSecondary} fontSize="9.5" fontWeight="600" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                      2D Sheet
                    </text>
                  </g>

                  {/* Right: Flat 2D Sheet Result */}
                  <g transform="translate(402, 34)">
                    <rect x="0" y="0" width="212" height="190" fill={titleBlockFill} stroke={frameInner} strokeWidth="1.2" rx="4" />
                    <line x1="16" y1="95" x2="196" y2="95" stroke={inkPrimary} strokeWidth="1.8" />
                    <text x="16" y="88" fill={inkPrimary} fontSize="10.5" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      X
                    </text>
                    <text x="188" y="88" fill={inkPrimary} fontSize="10.5" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      Y
                    </text>

                    <text x="106" y="22" fill={vpColor} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                      VP ZONE (ABOVE XY)
                    </text>
                    <text x="106" y="176" fill={hpColor} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                      HP ZONE (FOLDED {Math.round(foldAngleDeg)}°)
                    </text>

                    {/* Common 2H Projector */}
                    <line x1="92" y1="34" x2="92" y2="156" stroke={inkMuted} strokeWidth="1" />

                    {/* Elevation p' */}
                    <circle cx="92" cy="54" r="4" fill={vpColor} />
                    <text x="102" y="58" fill={vpColor} fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                      p′ (Elevation)
                    </text>

                    {/* Plan p */}
                    <circle cx="92" cy={95 + 42 * Math.max(0.18, foldProgress)} r="4" fill={hpColor} />
                    <text
                      x="102"
                      y={99 + 42 * Math.max(0.18, foldProgress)}
                      fill={hpColor}
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      p (Plan)
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Right 5 Columns: Five Golden Laws */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Five Laws of Point Projection
                </h3>
                <span className="font-mono text-xs text-slate-400">Axioms 01–05</span>
              </div>
              <ol className="divide-y divide-slate-200 dark:divide-slate-800">
                {GOLDEN_LAWS.map((law) => (
                  <li key={law.num} className="py-3.5 flex items-baseline gap-4">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                      {law.num}
                    </span>
                    <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {law.title}:
                      </span>{' '}
                      {law.body}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: INTERACTIVE QUADRANT ATLAS (RAY TRACER + SELECTOR)         */}
        {/* ================================================================= */}
        {activeTab === 'quadrants' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
            {/* Left 6 Columns: Live Side-Profile Ray Tracer SVG */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/80">
                <svg
                  viewBox="0 0 440 300"
                  className="w-full h-full select-none block"
                  style={{ minHeight: '260px', backgroundColor: sheetBg }}
                  role="img"
                  aria-label="Interactive side-profile cross section showing VP, HP, and quadrant projection rays"
                >
                  <defs>
                    <pattern id="atlas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke={gridStroke} strokeWidth="0.8" />
                    </pattern>
                    <marker id="atlas-arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#d97706" />
                    </marker>
                  </defs>

                  <rect width="440" height="300" fill={sheetBg} />
                  <rect width="440" height="300" fill="url(#atlas-grid)" />

                  {/* Clickable Quadrant Zones */}
                  {QUADRANT_SPECS.map((q) => {
                    const isSel = selectedQuadrant === q.id;
                    const box =
                      q.id === 'FIRST'
                        ? { x: 224, y: 26, w: 184, h: 120 }
                        : q.id === 'SECOND'
                        ? { x: 32, y: 26, w: 184, h: 120 }
                        : q.id === 'THIRD'
                        ? { x: 32, y: 154, w: 184, h: 120 }
                        : { x: 224, y: 154, w: 184, h: 120 };

                    return (
                      <g
                        key={q.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect ${q.label}`}
                        onClick={() => setSelectedQuadrant(q.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedQuadrant(q.id);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      >
                        <rect
                          x={box.x}
                          y={box.y}
                          width={box.w}
                          height={box.h}
                          rx="4"
                          fill={
                            isSel
                              ? isDark
                                ? 'rgba(37,99,235,0.18)'
                                : 'rgba(37,99,235,0.08)'
                              : 'transparent'
                          }
                          stroke={isSel ? hpColor : frameInner}
                          strokeWidth={isSel ? '1.6' : '0.7'}
                        />
                        <text
                          x={box.x + (q.id === 'SECOND' || q.id === 'THIRD' ? 12 : box.w - 12)}
                          y={box.y + (q.id === 'FIRST' || q.id === 'SECOND' ? 20 : box.h - 10)}
                          fill={isSel ? inkPrimary : inkMuted}
                          fontSize="11"
                          fontWeight="700"
                          textAnchor={q.id === 'SECOND' || q.id === 'THIRD' ? 'start' : 'end'}
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          Q{q.numeral}
                        </text>
                      </g>
                    );
                  })}

                  {/* VP & HP Principal Axes */}
                  <line x1="220" y1="16" x2="220" y2="284" stroke={vpColor} strokeWidth="2" />
                  <line x1="20" y1="150" x2="420" y2="150" stroke={hpColor} strokeWidth="2" />

                  <text x="226" y="24" fill={vpColor} fontSize="9.5" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                    VP
                  </text>
                  <text x="412" y="144" fill={hpColor} fontSize="9.5" fontWeight="700" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
                    HP
                  </text>

                  {/* Origin XY */}
                  <circle cx="220" cy="150" r="4" fill={inkPrimary} />
                  <text x="212" y="164" fill={inkPrimary} fontSize="10" fontWeight="700" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
                    XY
                  </text>

                  {/* Live Ray Tracer for Selected Quadrant */}
                  {(() => {
                    const cx = 220;
                    const cy = 150;
                    const px = cx + activeSpec.sampleDx;
                    const py = cy + activeSpec.sampleDy;
                    const rotatedPy =
                      activeSpec.hpRotationDir === 'DOWN'
                        ? cy + Math.abs(activeSpec.sampleDx)
                        : cy - Math.abs(activeSpec.sampleDx);

                    return (
                      <g>
                        {/* Projection Rays to VP (horizontal) & HP (vertical) */}
                        <line x1={px} y1={py} x2={cx} y2={py} stroke={vpColor} strokeWidth="1.2" strokeDasharray="3,3" />
                        <line x1={px} y1={py} x2={px} y2={cy} stroke={hpColor} strokeWidth="1.2" strokeDasharray="3,3" />

                        {/* 90° CW Rotation Arc from HP onto VP */}
                        <path
                          d={`M ${px} ${cy} A ${Math.abs(activeSpec.sampleDx)} ${Math.abs(activeSpec.sampleDx)} 0 0 1 ${cx} ${rotatedPy}`}
                          fill="none"
                          stroke="#d97706"
                          strokeWidth="1.6"
                          strokeDasharray="4,3"
                          markerEnd="url(#atlas-arrow-amber)"
                        />

                        {/* Point P in Space */}
                        <circle cx={px} cy={py} r="5" fill={inkPrimary} stroke={sheetBg} strokeWidth="1.5" />
                        <text
                          x={px + (activeSpec.sampleDx > 0 ? 9 : -9)}
                          y={py + 4}
                          fill={inkPrimary}
                          fontSize="11.5"
                          fontWeight="700"
                          textAnchor={activeSpec.sampleDx > 0 ? 'start' : 'end'}
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          P
                        </text>

                        {/* Elevation p' on VP */}
                        <circle cx={cx} cy={py} r="4" fill={vpColor} />
                        <text x={cx + 8} y={py + 4} fill={vpColor} fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
                          p′
                        </text>

                        {/* Plan p on HP & rotated position on sheet */}
                        <circle cx={px} cy={cy} r="3.5" fill={hpColor} opacity="0.55" />
                        <circle cx={cx} cy={rotatedPy} r="4" fill={hpColor} />
                        <text x={cx - 9} y={rotatedPy + 4} fill={hpColor} fontSize="11" fontWeight="700" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
                          p
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Click any quadrant on the cross-section or list to trace its 90° clockwise ray unfolding.
              </p>
            </div>

            {/* Right 6 Columns: Quadrant Selector Rows & Outcome */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-4">
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                {QUADRANT_SPECS.map((q) => {
                  const isSel = selectedQuadrant === q.id;
                  const matchesActivePoint = point.validQuadrants?.includes(
                    q.id === 'FIRST' ? 1 : q.id === 'SECOND' ? 2 : q.id === 'THIRD' ? 3 : 4
                  );

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuadrant(q.id)}
                      className={`w-full text-left py-3.5 px-3 -mx-1 rounded-lg transition-colors duration-150 cursor-pointer flex items-center justify-between gap-4 ${
                        isSel
                          ? 'bg-slate-100/90 dark:bg-slate-800/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 w-5">
                            {q.numeral}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {q.label}
                          </span>
                          {matchesActivePoint && (
                            <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-medium">
                              · Current Point {point.name}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 pl-7 text-xs text-slate-500 dark:text-slate-400">
                          {q.spacePosition}
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs shrink-0 tabular-nums">
                        <div className="font-semibold" style={{ color: vpColor }}>
                          a′ {q.frontViewPos}
                        </div>
                        <div className="font-semibold mt-0.5" style={{ color: hpColor }}>
                          a {q.topViewPos}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Quadrant Outcome Detail */}
              <div className="pt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400">
                    2D Result ({activeSpec.label})
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {activeSpec.drawingResult}
                  </span>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeSpec.explanation}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
