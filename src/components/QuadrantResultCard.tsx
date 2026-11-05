import React from 'react';
import { ComputedPoint } from '../types/projection';
import { Compass, CheckCircle2, Ruler, Layers } from 'lucide-react';

interface QuadrantCardProps {
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
  hpColor?: string;
  vpColor?: string;
}

/**
 * 1st Answer Output: The Quadrant
 */
export const PointQuadrantCard: React.FC<QuadrantCardProps> = ({
  point,
  allPoints,
  onSelectPoint,
  isDark = false,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
}) => {
  if (!point) return null;

  const validQuads = point.validQuadrants || [1];
  const isQ1 = validQuads.includes(1);
  const isQ2 = validQuads.includes(2);
  const isQ3 = validQuads.includes(3);
  const isQ4 = validQuads.includes(4);

  let resultingQuadrantName = '';
  if (validQuads.length === 4) {
    resultingQuadrantName = 'Quadrants 1, 2, 3, 4 (On XY Line)';
  } else if (validQuads.includes(1) && validQuads.includes(4)) {
    resultingQuadrantName = 'Quadrants 1 & 4 (On HP, In Front of VP)';
  } else if (validQuads.includes(2) && validQuads.includes(3)) {
    resultingQuadrantName = 'Quadrants 2 & 3 (On HP, Behind VP)';
  } else if (validQuads.includes(1) && validQuads.includes(2)) {
    resultingQuadrantName = 'Quadrants 1 & 2 (On VP, Above HP)';
  } else if (validQuads.includes(3) && validQuads.includes(4)) {
    resultingQuadrantName = 'Quadrants 3 & 4 (On VP, Below HP)';
  } else if (validQuads.includes(1)) {
    resultingQuadrantName = '1st Quadrant';
  } else if (validQuads.includes(2)) {
    resultingQuadrantName = '2nd Quadrant';
  } else if (validQuads.includes(3)) {
    resultingQuadrantName = '3rd Quadrant';
  } else if (validQuads.includes(4)) {
    resultingQuadrantName = '4th Quadrant';
  }

  return (
    <div className="flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="text-xl tracking-wider text-slate-900 dark:text-slate-100"
              >
                ANSWER
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                1. QUADRANT
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Spatial Quadrant Location for Point {point.name}
            </p>
          </div>
        </div>

        {allPoints.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-sans">Active Point:</span>
            {allPoints.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPoint && onSelectPoint(p.id)}
                className={`px-2 py-0.5 rounded font-mono font-bold transition text-xs ${
                  p.id === point.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-4 flex flex-col gap-4">
        {/* Identified Quadrant Hero Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50/80 dark:from-slate-800/80 dark:via-slate-800/50 dark:to-slate-900/80 border border-blue-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quadrant Placement for Point {point.name}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
              <span>
                HP: {point.hpRelation === 'ON' ? 'On HP' : `${point.distHp} mm ${point.hpRelation === 'ABOVE' ? 'Above HP' : 'Below HP'}`}
              </span>
              <span className="text-slate-400">•</span>
              <span>
                VP: {point.vpRelation === 'ON' ? 'On VP' : `${point.distVp} mm ${point.vpRelation === 'IN_FRONT' ? 'In Front of VP' : 'Behind VP'}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-mono text-sm font-bold shadow-sm">
            <Compass className="w-4 h-4 text-blue-200" />
            <span>{resultingQuadrantName}</span>
          </div>
        </div>

        {/* 4 Quadrants Reference Grid with Active Highlight */}
        <div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
            Standard Quadrant Rule Mapping
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {/* Rule 1 */}
            <div
              className={`p-2.5 rounded-lg border transition ${
                isQ1
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs font-bold ring-1 ring-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>HP above, VP in front</span>
                <span className="flex items-center gap-1 font-bold">
                  ➔ 1st quadrant
                  {isQ1 && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ml-1" />}
                </span>
              </div>
            </div>

            {/* Rule 2 */}
            <div
              className={`p-2.5 rounded-lg border transition ${
                isQ2
                  ? 'border-red-500 bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200 shadow-xs font-bold ring-1 ring-red-400'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>HP above, Behind VP</span>
                <span className="flex items-center gap-1 font-bold">
                  ➔ 2nd quadrant
                  {isQ2 && <CheckCircle2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400 ml-1" />}
                </span>
              </div>
            </div>

            {/* Rule 3 */}
            <div
              className={`p-2.5 rounded-lg border transition ${
                isQ3
                  ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-xs font-bold ring-1 ring-emerald-400'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>HP below, Behind VP</span>
                <span className="flex items-center gap-1 font-bold">
                  ➔ 3rd quadrant
                  {isQ3 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-1" />}
                </span>
              </div>
            </div>

            {/* Rule 4 */}
            <div
              className={`p-2.5 rounded-lg border transition ${
                isQ4
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-xs font-bold ring-1 ring-purple-400'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>HP below, VP in front</span>
                <span className="flex items-center gap-1 font-bold">
                  ➔ 4th quadrant
                  {isQ4 && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 ml-1" />}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 2nd Answer Output: The Parameters Displayed
 */
export const PointParametersCard: React.FC<QuadrantCardProps> = ({
  point,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
}) => {
  if (!point) return null;

  return (
    <div className="flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="text-xl tracking-wider text-slate-900 dark:text-slate-100"
              >
                ANSWER
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                2. PARAMETERS DISPLAYED
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Coordinates, Distances from Reference Planes &amp; Projections
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold">
          Point {point.name}
        </div>
      </div>

      {/* Parameters Content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Grid of Key Numerical Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Distance to HP */}
          <div
            className="p-3 rounded-xl border flex flex-col justify-between"
            style={{ borderColor: `${hpColor}40`, backgroundColor: `${hpColor}0d` }}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: hpColor }}>
              <span>Distance to HP</span>
              <span className="text-[10px] font-mono">|z|</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {point.distHp}
              </span>
              <span className="text-xs font-mono text-slate-500">mm</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono">
              {point.hpRelation === 'ON' ? 'On HP' : point.hpRelation === 'ABOVE' ? 'Above HP' : 'Below HP'}
            </div>
          </div>

          {/* Distance to VP */}
          <div
            className="p-3 rounded-xl border flex flex-col justify-between"
            style={{ borderColor: `${vpColor}40`, backgroundColor: `${vpColor}0d` }}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: vpColor }}>
              <span>Distance to VP</span>
              <span className="text-[10px] font-mono">|y|</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {point.distVp}
              </span>
              <span className="text-xs font-mono text-slate-500">mm</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono">
              {point.vpRelation === 'ON' ? 'On VP' : point.vpRelation === 'IN_FRONT' ? 'In Front of VP' : 'Behind VP'}
            </div>
          </div>

          {/* Front View Label on VP */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span>Front View (VP)</span>
              <span className="text-[10px] font-mono">Elevation</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono" style={{ color: vpColor }}>
                {point.frontViewLabel}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono truncate">
              {point.frontViewDesc}
            </div>
          </div>

          {/* Top View Label on HP */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span>Top View (HP)</span>
              <span className="text-[10px] font-mono">Plan</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono" style={{ color: hpColor }}>
                {point.topViewLabel}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono truncate">
              {point.topViewDesc}
            </div>
          </div>
        </div>

        {/* View Projections Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vpColor }} />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Elevation Projector: </span>
                <span className="text-slate-600 dark:text-slate-400">{point.frontViewDesc}</span>
              </div>
            </div>
            <span className="font-mono font-bold text-sm" style={{ color: vpColor }}>
              {point.frontViewLabel}
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hpColor }} />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Plan Projector: </span>
                <span className="text-slate-600 dark:text-slate-400">{point.topViewDesc}</span>
              </div>
            </div>
            <span className="font-mono font-bold text-sm" style={{ color: hpColor }}>
              {point.topViewLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const QuadrantResultCard = PointQuadrantCard;
