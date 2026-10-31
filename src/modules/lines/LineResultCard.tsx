/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComputedLine, TargetQuadrantB } from '../../types/lines';
import { Compass, Ruler, MapPin, CheckCircle2, Sparkles, Eye, Check } from 'lucide-react';

interface LineResultCardProps {
  line: ComputedLine;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
  onSelectQuadrantB?: (q: TargetQuadrantB) => void;
  activeQuadrantB?: TargetQuadrantB;
}

const getQuadrantName = (z: number, y: number): { name: string; badge: string; color: string } => {
  if (z > 0 && y > 0) return { name: '1st Quadrant', badge: 'Above HP, In Front of VP', color: 'text-blue-600 dark:text-blue-400' };
  if (z > 0 && y < 0) return { name: '2nd Quadrant', badge: 'Above HP, Behind VP', color: 'text-red-600 dark:text-red-400' };
  if (z < 0 && y < 0) return { name: '3rd Quadrant', badge: 'Below HP, Behind VP', color: 'text-emerald-600 dark:text-emerald-400' };
  if (z < 0 && y > 0) return { name: '4th Quadrant', badge: 'Below HP, In Front of VP', color: 'text-purple-600 dark:text-purple-400' };
  if (z === 0 && y === 0) return { name: 'On Ground Line XY', badge: 'Lies on Both Planes', color: 'text-amber-600' };
  if (z === 0) return { name: 'On HP Boundary', badge: y > 0 ? 'On HP, In Front of VP' : 'On HP, Behind VP', color: 'text-blue-600' };
  if (y === 0) return { name: 'On VP Boundary', badge: z > 0 ? 'On VP, Above HP' : 'On VP, Below HP', color: 'text-red-600' };
  return { name: '1st Quadrant', badge: 'Standard Orientation', color: 'text-blue-600' };
};

/**
 * 1st Answer Output: The Quadrant & Position of Points
 */
export const LineQuadrantCard: React.FC<LineResultCardProps> = ({
  line,
  hpColor,
  vpColor,
  isDark = false,
  onSelectQuadrantB,
  activeQuadrantB,
}) => {
  const quadA = getQuadrantName(line.zA, line.yA);
  const quadB = getQuadrantName(line.zB, line.yB);

  const isSameQuadrant = quadA.name === quadB.name;
  const overallSummary = isSameQuadrant
    ? `Entire line ${line.nameA}${line.nameB} is situated in the ${quadA.name}.`
    : `Line ${line.nameA}${line.nameB} extends across quadrants from ${quadA.name} to ${quadB.name}.`;

  const apparent = line.apparentSolution;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
      {/* Output Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
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
                1. QUADRANT &amp; POINT POSITIONS
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Spatial Location of Line {line.nameA}{line.nameB} and End Points
            </p>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span>{isSameQuadrant ? quadA.name : `${quadA.name} ➔ ${quadB.name}`}</span>
        </div>
      </div>

      {/* Traversal Summary Text */}
      <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed font-sans">
        {overallSummary} {line.orientationDesc}
      </div>

      {/* Active End Points Quadrants Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* End Point A Quadrant */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              End Point {line.nameA} (Reference End)
            </span>
            <span className="font-bold text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              {quadA.name}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>HP Position:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {line.zA === 0 ? 'On HP' : `${Math.abs(line.zA).toFixed(1)} mm ${line.zA > 0 ? 'Above HP' : 'Below HP'}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>VP Position:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {line.yA === 0 ? 'On VP' : `${Math.abs(line.yA).toFixed(1)} mm ${line.yA > 0 ? 'In Front of VP' : 'Behind VP'}`}
              </span>
            </div>
          </div>
        </div>

        {/* End Point B Quadrant */}
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              Active End Point {line.nameB} Position
            </span>
            <span className="font-bold text-xs font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
              {quadB.name}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>HP Position:</span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                {line.zB === 0 ? 'On HP' : `${Math.abs(line.zB).toFixed(2)} mm ${line.zB > 0 ? 'Above HP' : 'Below HP'}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>VP Position:</span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                {line.yB === 0 ? 'On VP' : `${Math.abs(line.yB).toFixed(2)} mm ${line.yB > 0 ? 'In Front of VP' : 'Behind VP'}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ALL 4 QUADRANTS SOLUTION GRID (Question B1 Parts i, ii, iii, iv) */}
      {apparent && apparent.quadrantSolutions && (
        <div className="mt-2 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Position of Point {line.nameB} Across All 4 Quadrants
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              Quadrant (i) to (iv) Solutions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {apparent.quadrantSolutions.map((sol) => {
              const isCurrent = quadB.name.startsWith(sol.quadrantNum === 'i' ? '1st' : sol.quadrantNum === 'ii' ? '2nd' : sol.quadrantNum === 'iii' ? '3rd' : '4th');
              return (
                <div
                  key={sol.quadrantKey}
                  className={`p-3 rounded-lg border transition flex flex-col justify-between ${
                    isCurrent
                      ? 'border-emerald-500 bg-white dark:bg-slate-900 shadow-xs ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300">
                        {sol.quadrantNum}
                      </span>
                      <span>{sol.quadrantLabel}</span>
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 font-mono">
                        <Check className="w-3 h-3" />
                        Viewing
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>HP:</span>
                      <strong className="text-slate-900 dark:text-slate-100">
                        {sol.distHp.toFixed(2)} mm {sol.hpRelation === 'ABOVE' ? 'Above HP' : 'Below HP'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>VP:</span>
                      <strong className="text-slate-900 dark:text-slate-100">
                        {sol.distVp.toFixed(2)} mm {sol.vpRelation === 'IN_FRONT' ? 'In Front of VP' : 'Behind VP'}
                      </strong>
                    </div>
                  </div>

                  {onSelectQuadrantB && (
                    <button
                      type="button"
                      onClick={() => onSelectQuadrantB(sol.quadrantKey)}
                      className={`mt-2 py-1 px-2 rounded text-[10px] font-mono font-semibold transition flex items-center justify-center gap-1 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
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
  );
};

/**
 * 2nd Answer Output: The Parameters Displayed
 */
export const LineParametersCard: React.FC<LineResultCardProps> = ({
  line,
  hpColor,
  vpColor,
  isDark = false,
}) => {
  const apparent = line.apparentSolution;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
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
              True Length, Projected Lengths, Inclinations &amp; Traces
            </p>
          </div>
        </div>

        {/* Orientation Badge */}
        <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{line.orientationTitle}</span>
        </div>
      </div>

      {/* SOLVED TRUE LENGTH BANNER (When solved from apparent values / Question B1) */}
      {line.isSolvedFromApparent && apparent && (
        <div className="p-4 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-950/40 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Calculated Answer: True Length (TL) = {apparent.calculatedTL.toFixed(2)} mm
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
              Exact: √{Math.round(apparent.calculatedTL * apparent.calculatedTL)} mm
            </span>
          </div>

          <div className="text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-purple-200 dark:border-purple-800/80 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span>Given: FV Length (EL) = <strong>{apparent.el} mm</strong></span>
              <span>TV Length (PL) = <strong>{apparent.pl} mm</strong></span>
              <span>Projector Dist (DEP) = <strong>{apparent.dep} mm</strong></span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                • Elevation Δz = √(EL² − DEP²) = √({apparent.el}² − {apparent.dep}²) = <strong>{apparent.deltaZ.toFixed(2)} mm</strong>
              </div>
              <div>
                • Plan Δy = √(PL² − DEP²) = √({apparent.pl}² − {apparent.dep}²) = <strong>{apparent.deltaY.toFixed(2)} mm</strong>
              </div>
            </div>
            <div className="pt-1 text-xs text-purple-900 dark:text-purple-200 font-bold">
              • True Length: TL = √(EL² + Δy²) = √({apparent.el}² + {apparent.deltaY.toFixed(2)}²) = √(4900 + 2000) = √6900 = {apparent.calculatedTL.toFixed(2)} mm
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div>• True angle with HP (θ) = arcsin(Δz / TL) = <strong>{apparent.thetaDeg.toFixed(2)}°</strong></div>
              <div>• True angle with VP (φ) = arcsin(Δy / TL) = <strong>{apparent.phiDeg.toFixed(2)}°</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Core Engineering Parameters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* True Length (TL) */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between ${
          line.isSolvedFromApparent
            ? 'border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30'
            : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-blue-300">
            <span>True Length (TL)</span>
            {line.isSolvedFromApparent ? (
              <span className="text-[9px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/70 px-1 py-0.2 rounded">
                Solved
              </span>
            ) : (
              <span className="text-[10px] font-mono">Line {line.nameA}{line.nameB}</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${
              line.isSolvedFromApparent ? 'text-purple-950 dark:text-purple-100' : 'text-blue-900 dark:text-blue-100'
            }`}>
              {line.trueLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {line.isSolvedFromApparent ? 'Calculated Answer' : 'Length in Space'}
          </div>
        </div>

        {/* Front View Length (Elevation Length, EL) */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between transition-colors"
          style={{
            borderColor: `${vpColor}40`,
            backgroundColor: `${vpColor}0d`,
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: vpColor }}>
            <span>Front View (EL)</span>
            <span className="text-[10px] font-mono">{line.nameA.toLowerCase()}′{line.nameB.toLowerCase()}′</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {line.frontViewLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Elevation on VP
          </div>
        </div>

        {/* Top View Length (Plan Length, PL) */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between transition-colors"
          style={{
            borderColor: `${hpColor}40`,
            backgroundColor: `${hpColor}0d`,
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: hpColor }}>
            <span>Top View (PL)</span>
            <span className="text-[10px] font-mono">{line.nameA.toLowerCase()}{line.nameB.toLowerCase()}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {line.topViewLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Plan on HP
          </div>
        </div>

        {/* Distance between end projectors (DEP) */}
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
            <span>Projector Dist (DEP)</span>
            <span className="text-[10px] font-mono">along XY</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {line.dep.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Δx Projector
          </div>
        </div>
      </div>

      {/* Angles Section: True Inclinations vs Apparent Angles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* True Inclinations with Reference Planes */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-purple-600" />
              True Inclinations (in 3D Space)
            </span>
            <span className="text-[10px] font-mono text-slate-400">Actual Angles</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                Angle with HP (θ)
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                {line.thetaDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                True inclination to HP
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                Angle with VP (φ)
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                {line.phiDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                True inclination to VP
              </div>
            </div>
          </div>
        </div>

        {/* Apparent Angles with XY Line */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-blue-600" />
              Apparent Angles (with XY Line)
            </span>
            <span className="text-[10px] font-mono text-slate-400">2D Projections</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                Front View Angle (α)
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                {line.alphaDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Elevation inclination to XY
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                Top View Angle (β)
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                {line.betaDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Plan inclination to XY
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traces of the Line (HT & VT) */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-500" />
            Traces of the Line (HT &amp; VT)
          </span>
          <span className="text-[10px] font-mono text-slate-400">Piercing Points</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Horizontal Trace (HT) */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hpColor }} />
                Horizontal Trace (HT)
              </span>
              <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${line.ht.exists ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                {line.ht.exists ? 'Exists' : 'No HT'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-sans leading-tight">
              {line.ht.description}
            </p>
          </div>

          {/* Vertical Trace (VT) */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vpColor }} />
                Vertical Trace (VT)
              </span>
              <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${line.vt.exists ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                {line.vt.exists ? 'Exists' : 'No VT'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-sans leading-tight">
              {line.vt.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LineResultCard = LineParametersCard;
