/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComputedLine, TargetQuadrantB } from '../../types/lines';
import {
  Compass,
  Ruler,
  MapPin,
  BarChart2,
  Eye,
  Check,
  Info,
} from 'lucide-react';

interface LineResultCardProps {
  line: ComputedLine;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
  onSelectQuadrantB?: (q: TargetQuadrantB) => void;
  activeQuadrantB?: TargetQuadrantB;
}

const getQuadrantName = (z: number, y: number): { name: string; badge: string } => {
  if (z > 0 && y > 0) return { name: '1st Quadrant', badge: 'Above HP, In Front of VP' };
  if (z > 0 && y < 0) return { name: '2nd Quadrant', badge: 'Above HP, Behind VP' };
  if (z < 0 && y < 0) return { name: '3rd Quadrant', badge: 'Below HP, Behind VP' };
  if (z < 0 && y > 0) return { name: '4th Quadrant', badge: 'Below HP, In Front of VP' };
  if (z === 0 && y === 0) return { name: 'On Ground Line XY', badge: 'Lies on Both Planes' };
  if (z === 0) return { name: 'On HP Boundary', badge: y > 0 ? 'On HP, In Front of VP' : 'On HP, Behind VP' };
  if (y === 0) return { name: 'On VP Boundary', badge: z > 0 ? 'On VP, Above HP' : 'On VP, Below HP' };
  return { name: '1st Quadrant', badge: 'Standard Orientation' };
};

/**
 * 1st Answer Output: Purple Gradient Quadrant Status Card + End Point Positions
 */
export const LineQuadrantCard: React.FC<LineResultCardProps> = ({
  line,
  hpColor,
  vpColor,
  onSelectQuadrantB,
}) => {
  const quadA = getQuadrantName(line.zA, line.yA);
  const quadB = getQuadrantName(line.zB, line.yB);

  const isSameQuadrant = quadA.name === quadB.name;
  const overallSummary = isSameQuadrant
    ? `Entire line ${line.nameA}${line.nameB} is situated in the ${quadA.name}.`
    : `Line ${line.nameA}${line.nameB} extends across quadrants from ${quadA.name} to ${quadB.name}.`;

  const apparent = line.apparentSolution;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Purple Gradient Quadrant Banner (Matches Projection of Points) */}
      <div
        className="relative rounded-2xl p-4 sm:p-5 text-white shadow-[0_12px_28px_-10px_rgba(113,56,232,0.55)] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #7138E8 0%, #9565F5 100%)',
        }}
      >
        {/* Subtle 3D Cube Wireframe Watermark */}
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -right-3 -bottom-3 w-28 h-28 text-white/[0.15]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M50 10L85 30V70L50 90L15 70V30L50 10Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M50 10V50M50 50L85 70M50 50L15 70M15 30L50 50L85 30"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white/25">
              <Check className="w-5 h-5 stroke-[2.75]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] sm:text-base font-bold leading-snug text-white">
                {isSameQuadrant ? `Line ${line.nameA}${line.nameB} in ${quadA.name}` : `${quadA.name} ➔ ${quadB.name}`}
              </h3>
              <p className="text-xs text-white/85 mt-0.5">
                {overallSummary}
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 text-xs font-semibold text-white shrink-0">
            {line.orientationTitle}
          </div>
        </div>
      </div>

      {/* End Points Quadrant Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#F0ECF9] dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[#202044] dark:text-slate-100 leading-tight">
                Quadrant &amp; End Point Positions
              </h3>
              <p className="text-[11px] text-[#77758F] dark:text-slate-400">
                Spatial coordinates of End {line.nameA} and End {line.nameB}
              </p>
            </div>
          </div>
        </div>

        {/* Orientation Description Callout */}
        <div className="p-3 rounded-xl bg-[#F1EBFF]/65 dark:bg-purple-950/30 border border-[#E8E2F5] dark:border-purple-900/50 text-xs text-[#202044] dark:text-slate-200 leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 text-[#7138E8] dark:text-purple-300 shrink-0 mt-0.5" />
          <span>{line.orientationDesc}</span>
        </div>

        {/* End Points Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* End Point A */}
          <div className="p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC] dark:bg-slate-800/50 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="text-[#202044] dark:text-slate-100 font-bold">
                End Point {line.nameA} (Ref)
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700 text-[#7138E8] dark:text-purple-300 text-[11px] font-mono font-bold">
                {quadA.name}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#77758F] dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: hpColor }} />
                  <span>HP Position</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-200">
                  {line.zA === 0 ? 'On HP' : `${Math.abs(line.zA).toFixed(1)} mm ${line.zA > 0 ? 'Above' : 'Below'}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#77758F] dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: vpColor }} />
                  <span>VP Position</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-200">
                  {line.yA === 0 ? 'On VP' : `${Math.abs(line.yA).toFixed(1)} mm ${line.yA > 0 ? 'In Front' : 'Behind'}`}
                </span>
              </div>
            </div>
          </div>

          {/* End Point B */}
          <div className="p-3.5 rounded-xl border border-[#D8C9FB] dark:border-purple-900/60 bg-[#F1EBFF]/55 dark:bg-purple-950/25 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
              <span className="text-[#202044] dark:text-slate-100 font-bold">
                Active End Point {line.nameB}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#7138E8] text-white text-[11px] font-mono font-bold">
                {quadB.name}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#77758F] dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: hpColor }} />
                  <span>HP Position</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-[#5B24CE] dark:text-purple-300">
                  {line.zB === 0 ? 'On HP' : `${Math.abs(line.zB).toFixed(2)} mm ${line.zB > 0 ? 'Above' : 'Below'}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#77758F] dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: vpColor }} />
                  <span>VP Position</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-[#5B24CE] dark:text-purple-300">
                  {line.yB === 0 ? 'On VP' : `${Math.abs(line.yB).toFixed(2)} mm ${line.yB > 0 ? 'In Front' : 'Behind'}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ALL 4 QUADRANTS SOLUTION GRID (Apparent Values Mode) */}
        {apparent && apparent.quadrantSolutions && (
          <div className="p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC] dark:bg-slate-950/40 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E8E2F5] dark:border-slate-800">
              <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                Position of Point {line.nameB} Across All 4 Quadrants
              </span>
              <span className="text-[11px] font-mono font-semibold text-[#7138E8] dark:text-purple-300">
                Quadrants (i)–(iv)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {apparent.quadrantSolutions.map((sol) => {
                const isCurrent = quadB.name.startsWith(
                  sol.quadrantNum === 'i'
                    ? '1st'
                    : sol.quadrantNum === 'ii'
                    ? '2nd'
                    : sol.quadrantNum === 'iii'
                    ? '3rd'
                    : '4th'
                );
                return (
                  <div
                    key={sol.quadrantKey}
                    className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                      isCurrent
                        ? 'border-[#7138E8] bg-white dark:bg-slate-900 shadow-xs ring-1 ring-[#7138E8]/20'
                        : 'border-[#E8E2F5] dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 hover:border-[#9565F5]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#202044] dark:text-slate-200 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#F1EBFF] dark:bg-purple-950 text-[#7138E8] dark:text-purple-300">
                          {sol.quadrantNum}
                        </span>
                        <span>{sol.quadrantLabel}</span>
                      </span>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] font-mono">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          Viewing
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-[#77758F] dark:text-slate-400">
                        <span>HP:</span>
                        <strong className="text-[#202044] dark:text-slate-100 tabular-nums">
                          {sol.distHp.toFixed(2)} mm {sol.hpRelation === 'ABOVE' ? 'Above HP' : 'Below HP'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[#77758F] dark:text-slate-400">
                        <span>VP:</span>
                        <strong className="text-[#202044] dark:text-slate-100 tabular-nums">
                          {sol.distVp.toFixed(2)} mm {sol.vpRelation === 'IN_FRONT' ? 'In Front of VP' : 'Behind VP'}
                        </strong>
                      </div>
                    </div>

                    {onSelectQuadrantB && (
                      <button
                        type="button"
                        onClick={() => onSelectQuadrantB(sol.quadrantKey)}
                        className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-gradient-to-r from-[#7138E8] to-[#9565F5] text-white shadow-2xs'
                            : 'bg-[#F1EBFF]/75 dark:bg-slate-800 text-[#7138E8] dark:text-slate-300 hover:bg-[#E6DAFF] dark:hover:bg-slate-700'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'Active View' : `Show Part (${sol.quadrantNum}) in 3D & 2D`}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 2nd Answer Output: Key Details & Engineering Parameters Card
 */
export const LineParametersCard: React.FC<LineResultCardProps> = ({
  line,
  hpColor,
  vpColor,
}) => {
  const apparent = line.apparentSolution;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] p-4 sm:p-5 flex flex-col gap-4">
      {/* Header (Matches Projection of Points Key Details) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F0ECF9] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#202044] dark:text-slate-100 leading-tight">
              Key Details &amp; Projected Parameters
            </h3>
            <p className="text-[11px] text-[#77758F] dark:text-slate-400">
              True Length, Projected Lengths, Inclinations &amp; Traces
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-mono font-bold text-[11px]">
          Line {line.nameA}{line.nameB}
        </span>
      </div>

      {/* Solved True Length Graphical Summary Banner */}
      {line.isSolvedFromApparent && apparent && (
        <div className="p-3.5 rounded-xl border border-[#D8C9FB] dark:border-purple-800 bg-[#F1EBFF]/70 dark:bg-purple-950/35 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#5B24CE] dark:text-purple-200 tabular-nums">
              Graphical Result: True Length (TL) = {apparent.calculatedTL.toFixed(1)} mm
            </span>
            <span className="text-[10px] font-mono font-bold text-[#7138E8] dark:text-purple-300">
              Measured on Sheet
            </span>
          </div>
          <p className="text-xs text-[#202044] dark:text-slate-300 leading-relaxed">
            Plotted from Front View (<strong>{apparent.el} mm</strong>), Top View (<strong>{apparent.pl} mm</strong>), and Projector Distance (<strong>{apparent.dep} mm</strong>). Rotating views to locus lines gives <strong>TL = {apparent.calculatedTL.toFixed(1)} mm</strong>, <strong>θ = {apparent.thetaDeg.toFixed(1)}°</strong>, and <strong>φ = {apparent.phiDeg.toFixed(1)}°</strong>.
          </p>
        </div>
      )}

      {/* Core Engineering Lengths Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* True Length (TL) */}
        <div className="p-3 rounded-xl border border-[#D8C9FB] dark:border-purple-900/60 bg-[#F1EBFF]/60 dark:bg-purple-950/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#7138E8] dark:text-purple-300">
            <span>True Length (TL)</span>
            <span className="text-[10px] font-mono">
              {line.isSolvedFromApparent ? 'Solved' : `${line.nameA}${line.nameB}`}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100">
              {line.trueLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#77758F]">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-[#77758F] dark:text-slate-400 font-mono">
            {line.isSolvedFromApparent ? 'Measured on Sheet' : 'Length in Space'}
          </div>
        </div>

        {/* Front View Length (EL) */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{
            borderColor: `${vpColor}35`,
            backgroundColor: `${vpColor}0a`,
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: vpColor }}>
            <span>Front View (EL)</span>
            <span className="text-[10px] font-mono">{line.nameA.toLowerCase()}′{line.nameB.toLowerCase()}′</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100">
              {line.frontViewLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#77758F]">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-[#77758F] dark:text-slate-400 font-mono">
            Elevation on VP
          </div>
        </div>

        {/* Top View Length (PL) */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{
            borderColor: `${hpColor}35`,
            backgroundColor: `${hpColor}0a`,
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: hpColor }}>
            <span>Top View (PL)</span>
            <span className="text-[10px] font-mono">{line.nameA.toLowerCase()}{line.nameB.toLowerCase()}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100">
              {line.topViewLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#77758F]">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-[#77758F] dark:text-slate-400 font-mono">
            Plan on HP
          </div>
        </div>

        {/* Distance between end projectors (DEP) */}
        <div className="p-3 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC] dark:bg-slate-800/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-[#202044] dark:text-slate-300 font-semibold">
            <span>Projector Dist (DEP)</span>
            <span className="text-[10px] font-mono text-[#77758F]">XY</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100">
              {line.dep.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#77758F]">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-[#77758F] dark:text-slate-400 font-mono">
            Along XY Line
          </div>
        </div>
      </div>

      {/* Angles Section: True Inclinations vs Apparent Angles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* True Inclinations */}
        <div className="p-3.5 rounded-xl bg-[#F8F7FC] dark:bg-slate-800/45 border border-[#E8E2F5] dark:border-slate-800 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-[#202044] dark:text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#7138E8]" />
              <span>True Inclinations (3D Space)</span>
            </span>
            <span className="text-[10px] font-mono text-[#77758F]">Actual</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700">
              <div className="text-[10px] text-[#77758F] flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                <span>Angle with HP (θ)</span>
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100 mt-1">
                {line.thetaDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-[#77758F] mt-0.5">
                True inclination to HP
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700">
              <div className="text-[10px] text-[#77758F] flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                <span>Angle with VP (φ)</span>
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100 mt-1">
                {line.phiDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-[#77758F] mt-0.5">
                True inclination to VP
              </div>
            </div>
          </div>
        </div>

        {/* Apparent Angles */}
        <div className="p-3.5 rounded-xl bg-[#F8F7FC] dark:bg-slate-800/45 border border-[#E8E2F5] dark:border-slate-800 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-[#202044] dark:text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-[#7138E8]" />
              <span>Apparent Angles (with XY)</span>
            </span>
            <span className="text-[10px] font-mono text-[#77758F]">2D Sheet</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700">
              <div className="text-[10px] text-[#77758F] flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                <span>Front View Angle (α)</span>
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100 mt-1">
                {line.alphaDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-[#77758F] mt-0.5">
                Elevation angle to XY
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700">
              <div className="text-[10px] text-[#77758F] flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                <span>Top View Angle (β)</span>
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#202044] dark:text-slate-100 mt-1">
                {line.betaDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-[#77758F] mt-0.5">
                Plan angle to XY
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traces of the Line (HT & VT) */}
      <div className="p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC] dark:bg-slate-800/35 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#202044] dark:text-slate-200 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#7138E8]" />
            <span>Traces of the Line (HT &amp; VT)</span>
          </span>
          <span className="text-[10px] font-mono text-[#77758F]">Piercing Points</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Horizontal Trace */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#202044] dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hpColor }} />
                <span>Horizontal Trace (HT)</span>
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md ${
                  line.ht.exists
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-[#F8F7FC] text-[#77758F] dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {line.ht.exists ? 'Exists' : 'No HT'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#77758F] dark:text-slate-400 leading-snug">
              {line.ht.description}
            </p>
          </div>

          {/* Vertical Trace */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#202044] dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: vpColor }} />
                <span>Vertical Trace (VT)</span>
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md ${
                  line.vt.exists
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-[#F8F7FC] text-[#77758F] dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {line.vt.exists ? 'Exists' : 'No VT'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#77758F] dark:text-slate-400 leading-snug">
              {line.vt.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LineResultCard = LineParametersCard;
