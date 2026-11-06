/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ComputedPoint, QuadrantType } from '../types/projection';
import {
  Compass,
  CheckCircle2,
  BookOpen,
  Info,
  Layers,
  ArrowRight,
  Eye,
  RotateCw,
} from 'lucide-react';

interface ExplanationPanelProps {
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  point,
  allPoints,
  onSelectPoint,
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'rules' | 'quadrants'>('details');
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>('FIRST');

  if (!point) {
    return (
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
        No point selected. Add or select a point to see its technical explanation.
      </div>
    );
  }

  const getBadgeStyle = (q: string) => {
    switch (q) {
      case 'FIRST':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'SECOND':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
      case 'THIRD':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'FOURTH':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    }
  };

  return (
    <div className="flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header with Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 bg-slate-50 dark:bg-slate-850 gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-sans">
            Pedagogical Engineering Analysis &amp; Theory
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'details'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            Point {point.name} Result (Pictorial)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            Rules &amp; 90° Fold (Pictorial)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quadrants')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'quadrants'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            Quadrant Matrix (Pictorial)
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* ============================================================== */}
        {/* TAB 1: POINT SPECIFIC TECHNICAL BREAKDOWN & MINI PICTOGRAM */}
        {/* ============================================================== */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Classification Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-800 shadow"
                  style={{ backgroundColor: point.color }}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-sans">
                    <span>Point {point.name}</span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono">
                      (Orthographic Projection)
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    Position: {point.hpRelation === 'ON' ? 'On HP' : `${point.distHp} mm ${point.hpRelation === 'ABOVE' ? 'Above HP' : 'Below HP'}`}, {point.vpRelation === 'ON' ? 'On VP' : `${point.distVp} mm ${point.vpRelation === 'IN_FRONT' ? 'In Front of VP' : 'Behind VP'}`}
                  </div>
                </div>
              </div>

              {allPoints.length > 1 && (
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400">Switch:</span>
                  {allPoints.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPoint && onSelectPoint(p.id)}
                      className={`px-2 py-0.5 rounded font-mono font-bold transition cursor-pointer ${
                        p.id === point.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-100'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pictorial 2D Projection Diagram for Selected Point — White Drawing Sheet */}
            <div className="relative w-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-white p-2 shadow-sm">
              <svg viewBox="0 0 660 250" className="w-full h-auto select-none block bg-white" style={{ minHeight: '230px' }}>
                <defs>
                  {/* Subtle Technical Drawing Sheet Grid */}
                  <pattern id="pencil-sheet-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="0.6"
                    />
                  </pattern>

                  {/* Pencil Dimension Arrowheads */}
                  <marker
                    id="pencil-arrow-start"
                    viewBox="0 0 10 10"
                    refX="0"
                    refY="5"
                    markerWidth="4.5"
                    markerHeight="4.5"
                    orient="auto"
                  >
                    <path d="M 10 2 L 0 5 L 10 8 z" fill="#475569" />
                  </marker>
                  <marker
                    id="pencil-arrow-end"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="4.5"
                    markerHeight="4.5"
                    orient="auto"
                  >
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#475569" />
                  </marker>
                </defs>

                {/* Pure White Drawing Sheet Background */}
                <rect width="660" height="250" fill="#ffffff" />
                <rect width="660" height="250" fill="url(#pencil-sheet-grid)" />

                {/* Drawing Sheet Outer Border & Inner Margins (Standard Technical Drafting Sheet Border) */}
                <rect
                  x="10"
                  y="10"
                  width="640"
                  height="230"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1.2"
                />
                <rect
                  x="14"
                  y="14"
                  width="632"
                  height="222"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="0.6"
                />

                {/* Reference Ground Line (X - Y) drawn with HB Pencil */}
                {(() => {
                  const originY = 125;
                  const projX = 230; // Offset left to leave generous space for annotations on right

                  // Dynamic Scaling: Prevents points going out of bounds for ANY value (>40mm, 80mm, 100mm, etc.)
                  const maxDist = Math.max(Math.abs(point.frontViewY), Math.abs(point.topViewY), 10);
                  const availableHalfHeight = 85; // Margins: 125 - 85 = 40px top, 125 + 85 = 210px bottom
                  const scale = Math.min(1.8, availableHalfHeight / maxDist);

                  const elevY = originY - point.frontViewY * scale;
                  const planY = originY - point.topViewY * scale;
                  const viewsCoincide = Math.abs(elevY - planY) < 2.0;

                  // Thin Continuous Projector Line (2H Pencil — No Dotted/Dashed Line!)
                  const projMinY = Math.min(elevY, planY, originY) - 18;
                  const projMaxY = Math.max(elevY, planY, originY) + 18;

                  // Clean dark drafting colors for high legibility on white sheet
                  const textColor = '#0f172a';
                  const pencilGray = '#475569';
                  const pencilFaint = '#64748b';

                  // Offsets for dimension lines to avoid overlapping
                  const dimFvX = projX + 160;
                  const dimTvX = projX + 195;

                  return (
                    <g>
                      {/* XY Ground Reference Line (Crisp HB pencil drafting line) */}
                      <line
                        x1="28"
                        y1={originY}
                        x2="628"
                        y2={originY}
                        stroke={textColor}
                        strokeWidth="1.6"
                      />
                      <circle cx="28" cy={originY} r="2" fill={textColor} />
                      <circle cx="628" cy={originY} r="2" fill={textColor} />

                      {/* Reference Line End Labels X and Y */}
                      <text
                        x="20"
                        y={originY + 5}
                        fill={textColor}
                        fontSize="15"
                        fontWeight="bold"
                        fontFamily="'JetBrains Mono', monospace"
                        textAnchor="end"
                      >
                        X
                      </text>
                      <text
                        x="635"
                        y={originY + 5}
                        fill={textColor}
                        fontSize="15"
                        fontWeight="bold"
                        fontFamily="'JetBrains Mono', monospace"
                        textAnchor="start"
                      >
                        Y
                      </text>

                      {/* Pencil Sheet Plane Indicators (VP above XY, HP below XY in First Angle) */}
                      <text
                        x="34"
                        y={originY - 12}
                        fill={pencilFaint}
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="'Space Grotesk', monospace"
                        letterSpacing="1"
                      >
                        VP (VERTICAL PLANE)
                      </text>
                      <text
                        x="34"
                        y={originY + 20}
                        fill={pencilFaint}
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="'Space Grotesk', monospace"
                        letterSpacing="1"
                      >
                        HP (HORIZONTAL PLANE)
                      </text>

                      {/* PROJECTOR LINE: Continuous thin solid line (2H Pencil standard, NEVER dotted) */}
                      <line
                        x1={projX}
                        y1={projMinY}
                        x2={projX}
                        y2={projMaxY}
                        stroke={pencilGray}
                        strokeWidth="1.0"
                      />

                      {/* Projector Intersection with Ground Line XY */}
                      <circle cx={projX} cy={originY} r="2" fill={textColor} />
                      <text
                        x={projX - 8}
                        y={originY + 12}
                        fill={pencilFaint}
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        o
                      </text>

                      {/* 1. FRONT VIEW POINT a' (Elevation on VP) */}
                      <g>
                        {/* 2H Pencil Crosshair */}
                        <line x1={projX - 4} y1={elevY} x2={projX + 4} y2={elevY} stroke="#ef4444" strokeWidth="0.8" />
                        <line x1={projX} y1={elevY - 4} x2={projX} y2={elevY + 4} stroke="#ef4444" strokeWidth="0.8" />

                        {/* Graphite Point Dot */}
                        <circle
                          cx={projX}
                          cy={elevY}
                          r="3.5"
                          fill="#ef4444"
                          stroke={isDark ? '#ffffff' : '#1e293b'}
                          strokeWidth="1.2"
                        />

                        {/* Pencil Lettering: a' */}
                        <text
                          x={projX - 10}
                          y={elevY + (point.frontViewY >= 0 ? -4 : 12)}
                          fill="#ef4444"
                          fontSize="13"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="end"
                        >
                          {viewsCoincide ? `${point.frontViewLabel} (${point.topViewLabel})` : point.frontViewLabel}
                        </text>

                        {/* Informative Drafting Note */}
                        <text
                          x={projX + 10}
                          y={elevY + (point.frontViewY >= 0 ? -5 : 12)}
                          fill={isDark ? '#fca5a5' : '#b91c1c'}
                          fontSize="10"
                          fontWeight="600"
                          fontFamily="'Space Grotesk', sans-serif"
                        >
                          {point.frontViewLabel} — Front View ({point.distHp} mm {point.hpRelation === 'ABOVE' ? 'above' : point.hpRelation === 'BELOW' ? 'below' : 'on'} HP)
                        </text>

                        {/* Continuous Thin Extension & Dimension Lines for Elevation */}
                        {point.distHp > 0 && (
                          <g>
                            <line x1={projX + 4} y1={elevY} x2={dimFvX + 6} y2={elevY} stroke={pencilFaint} strokeWidth="0.8" />
                            <line x1={projX + 4} y1={originY} x2={dimFvX + 6} y2={originY} stroke={pencilFaint} strokeWidth="0.8" />
                            <line
                              x1={dimFvX}
                              y1={originY}
                              x2={dimFvX}
                              y2={elevY}
                              stroke={isDark ? '#f87171' : '#dc2626'}
                              strokeWidth="1.0"
                              markerStart="url(#pencil-arrow-start)"
                              markerEnd="url(#pencil-arrow-end)"
                            />
                            <text
                              x={dimFvX + 4}
                              y={(originY + elevY) / 2 + 4}
                              fill={isDark ? '#fca5a5' : '#b91c1c'}
                              fontSize="9.5"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono', monospace"
                              textAnchor="start"
                            >
                              h = {point.distHp} mm
                            </text>
                          </g>
                        )}
                      </g>

                      {/* 2. TOP VIEW POINT a (Plan on HP) if not strictly coincident */}
                      {!viewsCoincide && (
                        <g>
                          {/* 2H Pencil Crosshair */}
                          <line x1={projX - 4} y1={planY} x2={projX + 4} y2={planY} stroke="#3b82f6" strokeWidth="0.8" />
                          <line x1={projX} y1={planY - 4} x2={projX} y2={planY + 4} stroke="#3b82f6" strokeWidth="0.8" />

                          {/* Graphite Point Dot */}
                          <circle
                            cx={projX}
                            cy={planY}
                            r="3.5"
                            fill="#3b82f6"
                            stroke={isDark ? '#ffffff' : '#1e293b'}
                            strokeWidth="1.2"
                          />

                          {/* Pencil Lettering: a */}
                          <text
                            x={projX - 10}
                            y={planY + (point.topViewY >= 0 ? -4 : 12)}
                            fill="#3b82f6"
                            fontSize="13"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="end"
                          >
                            {point.topViewLabel}
                          </text>

                          {/* Informative Drafting Note */}
                          <text
                            x={projX + 10}
                            y={planY + (point.topViewY >= 0 ? -5 : 12)}
                            fill={isDark ? '#93c5fd' : '#1d4ed8'}
                            fontSize="10"
                            fontWeight="600"
                            fontFamily="'Space Grotesk', sans-serif"
                          >
                            {point.topViewLabel} — Top View ({point.distVp} mm {point.vpRelation === 'IN_FRONT' ? 'in front of' : point.vpRelation === 'BEHIND' ? 'behind' : 'on'} VP)
                          </text>

                          {/* Continuous Thin Extension & Dimension Lines for Plan */}
                          {point.distVp > 0 && (
                            <g>
                              <line x1={projX + 4} y1={planY} x2={dimTvX + 6} y2={planY} stroke={pencilFaint} strokeWidth="0.8" />
                              <line x1={projX + 4} y1={originY} x2={dimTvX + 6} y2={originY} stroke={pencilFaint} strokeWidth="0.8" />
                              <line
                                x1={dimTvX}
                                y1={originY}
                                x2={dimTvX}
                                y2={planY}
                                stroke={isDark ? '#60a5fa' : '#2563eb'}
                                strokeWidth="1.0"
                                markerStart="url(#pencil-arrow-start)"
                                markerEnd="url(#pencil-arrow-end)"
                              />
                              <text
                                x={dimTvX + 4}
                                y={(originY + planY) / 2 + 4}
                                fill={isDark ? '#93c5fd' : '#1d4ed8'}
                                fontSize="9.5"
                                fontWeight="bold"
                                fontFamily="'JetBrains Mono', monospace"
                                textAnchor="start"
                              >
                                d = {point.distVp} mm
                              </text>
                            </g>
                          )}
                        </g>
                      )}

                      {/* Technical Drawing Sheet Title Stamp (Bottom-Right, Quadrant removed) */}
                      <g transform="translate(450, 182)">
                        <rect
                          x="0"
                          y="0"
                          width="192"
                          height="50"
                          rx="3"
                          fill="#f8fafc"
                          stroke="#cbd5e1"
                          strokeWidth="0.8"
                        />
                        <text
                          x="8"
                          y="15"
                          fill="#0f172a"
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          DRAWING SHEET (2D PROJECTION)
                        </text>
                        <text
                          x="8"
                          y="29"
                          fill="#334155"
                          fontSize="8.5"
                          fontWeight="600"
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          POINT {point.name} • ORTHOGRAPHIC VIEW
                        </text>
                        <text
                          x="8"
                          y="42"
                          fill="#64748b"
                          fontSize="8"
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          CONTINUOUS 2H PROJECTOR (BIS SP 46)
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </svg>

              <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-800 bg-white/95 px-2.5 py-0.5 rounded border border-slate-300 shadow-xs pointer-events-none">
                White Drawing Sheet • Pencil Sketch
              </div>
            </div>

            {/* Explanation Prose */}
            <div className="p-3 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Geometrical Explanation</span>
              </div>
              <p>{point.explanation}</p>
            </div>

            {/* 2D Orthographic Mapping Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>Front View (Elevation)</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                    {point.frontViewLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                  <div>Position: <strong className="text-slate-900 dark:text-slate-200">{point.frontViewDesc}</strong></div>
                  <div>Projected on: Vertical Plane (VP)</div>
                  <div>Distance from HP: {point.distHp} mm</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>Top View (Plan)</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {point.topViewLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                  <div>Position: <strong className="text-slate-900 dark:text-slate-200">{point.topViewDesc}</strong></div>
                  <div>Projected on: Horizontal Plane (HP)</div>
                  <div>Distance from VP: {point.distVp} mm</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: RULES OF PROJECTION WITH 3D PICTORIAL FOLDING DIAGRAM */}
        {/* ============================================================== */}
        {activeTab === 'rules' && (
          <div className="space-y-4 text-xs">
            {/* Pictorial 3D Dihedral Quadrant & 90° Clockwise Rotation Schematic */}
            <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-slate-700 bg-[#0b1329]">
              <svg viewBox="0 0 680 200" className="w-full h-full select-none">
                <pattern id="rules-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#16274a" strokeWidth="0.8" opacity="0.6" />
                </pattern>
                <rect width="680" height="200" fill="url(#rules-grid)" />

                {/* Left Side: 3D Dihedral Perspective */}
                <g transform="translate(60, 20)">
                  {/* VP Plane (Vertical) */}
                  <polygon points="120,10 240,10 240,150 120,150" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" />
                  <text x={180} y={30} fill="#fca5a5" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    VP (Vertical)
                  </text>

                  {/* HP Plane (Horizontal) */}
                  <polygon points="40,90 200,90 280,70 120,70" fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
                  <text x={90} y={110} fill="#93c5fd" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    HP (Horizontal)
                  </text>

                  {/* XY Line */}
                  <line x1={120} y1={80} x2={240} y2={80} stroke="#f8fafc" strokeWidth="2.5" />
                  <text x={110} y={84} fill="#fff" fontSize="11" fontWeight="bold">X</text>
                  <text x={245} y={84} fill="#fff" fontSize="11" fontWeight="bold">Y</text>

                  {/* 90° Clockwise Rotation Arrow on HP */}
                  <path d="M 170 95 A 35 35 0 0 1 180 145" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4,3" markerEnd="url(#arrow-amber)" />
                  <text x={190} y={125} fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    90° CW Fold
                  </text>

                  {/* Observer Eye */}
                  <circle cx={20} cy={80} r="7" fill="#10b981" />
                  <text x={20} y={105} fill="#6ee7b7" fontSize="10" textAnchor="middle" fontWeight="bold">
                    Front Eye
                  </text>
                </g>

                {/* Arrow from 3D to 2D Sheet */}
                <g transform="translate(370, 95)">
                  <line x1={0} y1={0} x2={40} y2={0} stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow-dim)" />
                  <text x={20} y={-10} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    Unfolds to 2D
                  </text>
                </g>

                {/* Right Side: Resulting Flat 2D Orthographic Sheet */}
                <g transform="translate(440, 25)">
                  <rect x={0} y={0} width={180} height={140} fill="#0f172a" stroke="#475569" strokeWidth="1.5" rx="6" />
                  <line x1={10} y1={70} x2={170} y2={70} stroke="#f8fafc" strokeWidth="2" />
                  <text x={12} y={64} fill="#fff" fontSize="11" fontWeight="bold">X</text>
                  <text x={160} y={64} fill="#fff" fontSize="11" fontWeight="bold">Y</text>

                  {/* VP Zone */}
                  <text x={90} y={35} fill="#f87171" fontSize="11" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                    VP (Elevation a′)
                  </text>

                  {/* HP Zone (Folded down) */}
                  <text x={90} y={115} fill="#60a5fa" fontSize="11" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                    HP (Plan a)
                  </text>

                  {/* Common Projector line (continuous thin line) */}
                  <line x1={90} y1={15} x2={90} y2={125} stroke="#64748b" strokeWidth="1.0" />
                  <circle cx={90} cy={42} r="4" fill="#ef4444" />
                  <circle cx={90} cy={98} r="4" fill="#3b82f6" />
                </g>
              </svg>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2 font-sans">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>The 5 Golden Rules of Engineering Point Projection</span>
              </h3>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300 text-[11.5px] leading-relaxed font-sans">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">1.</span>
                  <span>
                    <strong>Reference Line (XY):</strong> Intersection of Horizontal Plane (HP) and Vertical Plane (VP). Drawn as a continuous horizontal reference line.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">2.</span>
                  <span>
                    <strong>Front View / Elevation (a′):</strong> Projected onto VP. Its distance from XY equals the distance of the point from HP. Marked with a <strong>prime (′)</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">3.</span>
                  <span>
                    <strong>Top View / Plan (a):</strong> Projected onto HP. Its distance from XY equals the distance of the point from VP. Marked <strong>without prime</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">4.</span>
                  <span>
                    <strong>90° Clockwise Rotation of HP:</strong> HP is always rotated <strong>90° clockwise</strong> about XY to align coplanar with VP for drawing on a 2D sheet.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">5.</span>
                  <span>
                    <strong>Common Projector:</strong> The Front View (a′) and Top View (a) always lie on the exact same vertical projector perpendicular to XY.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: COMPLETE QUADRANT MATRIX WITH INTERACTIVE PICTOGRAM */}
        {/* ============================================================== */}
        {activeTab === 'quadrants' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Interactive 4-Quadrant Cross Section SVG */}
            <div className="relative w-full h-[240px] rounded-xl overflow-hidden border border-slate-700 bg-[#0b1329] p-2">
              <svg viewBox="0 0 600 220" className="w-full h-full select-none">
                <pattern id="quad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#16274a" strokeWidth="0.8" opacity="0.6" />
                </pattern>
                <rect width="600" height="220" fill="url(#quad-grid)" />

                {/* Vertical Plane (VP) axis */}
                <line x1={300} y1={20} x2={300} y2={200} stroke="#ef4444" strokeWidth="2" opacity="0.8" />
                <text x={310} y={30} fill="#fca5a5" fontSize="10" fontFamily="monospace">Above HP (VP)</text>
                <text x={310} y={195} fill="#fca5a5" fontSize="10" fontFamily="monospace">Below HP (VP)</text>

                {/* Horizontal Plane (HP) axis */}
                <line x1={80} y1={110} x2={520} y2={110} stroke="#3b82f6" strokeWidth="2" opacity="0.8" />
                <text x={90} y={100} fill="#93c5fd" fontSize="10" fontFamily="monospace">Behind VP (HP)</text>
                <text x={430} y={100} fill="#93c5fd" fontSize="10" fontFamily="monospace">In Front of VP (HP)</text>

                {/* Origin XY */}
                <circle cx={300} cy={110} r="4" fill="#ffffff" />
                <text x={280} y={125} fill="#ffffff" fontSize="12" fontWeight="bold">XY</text>

                {/* 1st Quadrant Box */}
                <g
                  onClick={() => setSelectedQuadrant('FIRST')}
                  className="cursor-pointer group"
                >
                  <rect
                    x={310}
                    y={25}
                    width={190}
                    height={75}
                    fill={selectedQuadrant === 'FIRST' ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.08)'}
                    stroke={selectedQuadrant === 'FIRST' ? '#3b82f6' : '#1e3a8a'}
                    strokeWidth="1.5"
                    rx="6"
                  />
                  <text x={405} y={55} fill="#60a5fa" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    1st Quadrant
                  </text>
                  <text x={405} y={75} fill="#93c5fd" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    a′ Above, a Below XY
                  </text>
                </g>

                {/* 2nd Quadrant Box */}
                <g
                  onClick={() => setSelectedQuadrant('SECOND')}
                  className="cursor-pointer group"
                >
                  <rect
                    x={100}
                    y={25}
                    width={190}
                    height={75}
                    fill={selectedQuadrant === 'SECOND' ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.08)'}
                    stroke={selectedQuadrant === 'SECOND' ? '#ef4444' : '#7f1d1d'}
                    strokeWidth="1.5"
                    rx="6"
                  />
                  <text x={195} y={55} fill="#f87171" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    2nd Quadrant
                  </text>
                  <text x={195} y={75} fill="#fca5a5" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    Both a′ &amp; a ABOVE XY
                  </text>
                </g>

                {/* 3rd Quadrant Box */}
                <g
                  onClick={() => setSelectedQuadrant('THIRD')}
                  className="cursor-pointer group"
                >
                  <rect
                    x={100}
                    y={120}
                    width={190}
                    height={75}
                    fill={selectedQuadrant === 'THIRD' ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.08)'}
                    stroke={selectedQuadrant === 'THIRD' ? '#10b981' : '#064e3b'}
                    strokeWidth="1.5"
                    rx="6"
                  />
                  <text x={195} y={150} fill="#34d399" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    3rd Quadrant
                  </text>
                  <text x={195} y={170} fill="#6ee7b7" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    a Above, a′ Below XY (3rd Angle)
                  </text>
                </g>

                {/* 4th Quadrant Box */}
                <g
                  onClick={() => setSelectedQuadrant('FOURTH')}
                  className="cursor-pointer group"
                >
                  <rect
                    x={310}
                    y={120}
                    width={190}
                    height={75}
                    fill={selectedQuadrant === 'FOURTH' ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.08)'}
                    stroke={selectedQuadrant === 'FOURTH' ? '#a855f7' : '#581c87'}
                    strokeWidth="1.5"
                    rx="6"
                  />
                  <text x={405} y={150} fill="#c084fc" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    4th Quadrant
                  </text>
                  <text x={405} y={170} fill="#d8b4fe" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    Both a′ &amp; a BELOW XY
                  </text>
                </g>
              </svg>

              <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-300 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-700">
                Click any quadrant to inspect
              </div>
            </div>

            {/* Quadrant Matrix Table */}
            <div className="overflow-x-auto text-xs">
              <table className="w-full border-collapse border border-slate-200 dark:border-slate-700 text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Quadrant</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Position in Space</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Front View (a′)</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Top View (a)</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">2D Drawing Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  <tr className={`hover:bg-blue-50/30 dark:hover:bg-blue-950/20 ${selectedQuadrant === 'FIRST' ? 'bg-blue-50 dark:bg-blue-950/40 font-bold' : ''}`}>
                    <td className="p-2 text-blue-600 font-bold">1st Quadrant</td>
                    <td className="p-2">Above HP, In Front of VP</td>
                    <td className="p-2 text-red-600 font-semibold">Above XY</td>
                    <td className="p-2 text-blue-600 font-semibold">Below XY</td>
                    <td className="p-2 font-sans font-medium">a′ above, a below XY</td>
                  </tr>
                  <tr className={`hover:bg-red-50/30 dark:hover:bg-red-950/20 ${selectedQuadrant === 'SECOND' ? 'bg-red-50 dark:bg-red-950/40 font-bold' : ''}`}>
                    <td className="p-2 text-red-600 font-bold">2nd Quadrant</td>
                    <td className="p-2">Above HP, Behind VP</td>
                    <td className="p-2 text-red-600 font-semibold">Above XY</td>
                    <td className="p-2 text-blue-600 font-semibold">Above XY</td>
                    <td className="p-2 font-sans font-semibold text-amber-600">Both views ABOVE XY</td>
                  </tr>
                  <tr className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 ${selectedQuadrant === 'THIRD' ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold' : ''}`}>
                    <td className="p-2 text-emerald-600 font-bold">3rd Quadrant</td>
                    <td className="p-2">Below HP, Behind VP</td>
                    <td className="p-2 text-red-600 font-semibold">Below XY</td>
                    <td className="p-2 text-blue-600 font-semibold">Above XY</td>
                    <td className="p-2 font-sans font-medium">a above, a′ below XY (3rd Angle)</td>
                  </tr>
                  <tr className={`hover:bg-purple-50/30 dark:hover:bg-purple-950/20 ${selectedQuadrant === 'FOURTH' ? 'bg-purple-50 dark:bg-purple-950/40 font-bold' : ''}`}>
                    <td className="p-2 text-purple-600 font-bold">4th Quadrant</td>
                    <td className="p-2">Below HP, In Front of VP</td>
                    <td className="p-2 text-red-600 font-semibold">Below XY</td>
                    <td className="p-2 text-blue-600 font-semibold">Below XY</td>
                    <td className="p-2 font-sans font-semibold text-purple-600">Both views BELOW XY</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
