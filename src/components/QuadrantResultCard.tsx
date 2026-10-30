import React from 'react';
import { ComputedPoint } from '../types/projection';
import { Compass, CheckCircle2 } from 'lucide-react';

interface QuadrantResultCardProps {
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
  hpColor?: string;
  vpColor?: string;
}

export const QuadrantResultCard: React.FC<QuadrantResultCardProps> = ({
  point,
  allPoints,
  onSelectPoint,
  isDark = false,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
}) => {
  if (!point) return null;

  // Evaluate matching rule
  const isAbove = point.z > 0;
  const isBelow = point.z < 0;
  const isOnHp = point.z === 0;

  const isInFront = point.y > 0;
  const isBehind = point.y < 0;
  const isOnVp = point.y === 0;

  const isQ1 = isAbove && isInFront;
  const isQ2 = isAbove && isBehind;
  const isQ3 = isBelow && isBehind;
  const isQ4 = isBelow && isInFront;

  // Primary rule text matching user specification:
  // HP above VP in front -->1st quadrant
  // HP below VP in front -->4th quadrant
  // HP above Behind VP--> 2nd quadrant
  // HP below Behind VP--->3rd quadrant
  let ruleStatement = '';
  let resultingQuadrantName = '';

  if (isQ1) {
    ruleStatement = 'HP above, VP in front ➔ 1st Quadrant';
    resultingQuadrantName = '1st Quadrant';
  } else if (isQ2) {
    ruleStatement = 'HP above, Behind VP ➔ 2nd Quadrant';
    resultingQuadrantName = '2nd Quadrant';
  } else if (isQ3) {
    ruleStatement = 'HP below, Behind VP ➔ 3rd Quadrant';
    resultingQuadrantName = '3rd Quadrant';
  } else if (isQ4) {
    ruleStatement = 'HP below, VP in front ➔ 4th Quadrant';
    resultingQuadrantName = '4th Quadrant';
  } else if (isOnHp && isOnVp) {
    ruleStatement = 'Point lies on both HP and VP ➔ On Reference Line XY';
    resultingQuadrantName = 'On XY Ground Line';
  } else if (isOnHp) {
    ruleStatement = `Point lies on HP & ${point.distVp} mm ${isInFront ? 'in front of VP' : 'behind VP'} ➔ Plane Boundary (On HP)`;
    resultingQuadrantName = 'On HP Boundary';
  } else if (isOnVp) {
    ruleStatement = `Point lies on VP & ${point.distHp} mm ${isAbove ? 'above HP' : 'below HP'} ➔ Plane Boundary (On VP)`;
    resultingQuadrantName = 'On VP Boundary';
  }

  return (
    <div className="flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
          <h2
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100"
          >
            ANSWER
          </h2>
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
              Result for Point {point.name}
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

        {/* View Projections Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vpColor }} />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Front View (VP): </span>
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
                <span className="font-semibold text-slate-800 dark:text-slate-200">Top View (HP): </span>
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
