/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComputedLine } from '../../types/lines';
import { Compass, Ruler, MapPin, CheckCircle2, Layers } from 'lucide-react';

interface LineResultCardProps {
  line: ComputedLine;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
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
 * 1st Answer Output: The Quadrant
 */
export const LineQuadrantCard: React.FC<LineResultCardProps> = ({
  line,
  hpColor,
  vpColor,
  isDark = false,
}) => {
  const quadA = getQuadrantName(line.zA, line.yA);
  const quadB = getQuadrantName(line.zB, line.yB);

  const isSameQuadrant = quadA.name === quadB.name;
  const overallSummary = isSameQuadrant
    ? `Entire line ${line.nameA}${line.nameB} is situated in the ${quadA.name}.`
    : `Line ${line.nameA}${line.nameB} extends across quadrants from ${quadA.name} to ${quadB.name}.`;

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
                1. QUADRANT
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Spatial Quadrant Location for Line {line.nameA}{line.nameB}
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

      {/* End Point Quadrants Grid */}
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
                {line.zA === 0 ? 'On HP' : `${Math.abs(line.zA)} mm ${line.zA > 0 ? 'Above HP' : 'Below HP'}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>VP Position:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {line.yA === 0 ? 'On VP' : `${Math.abs(line.yA)} mm ${line.yA > 0 ? 'In Front of VP' : 'Behind VP'}`}
              </span>
            </div>
          </div>
        </div>

        {/* End Point B Quadrant */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              End Point {line.nameB} (Second End)
            </span>
            <span className="font-bold text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              {quadB.name}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>HP Position:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {line.zB === 0 ? 'On HP' : `${Math.abs(line.zB)} mm ${line.zB > 0 ? 'Above HP' : 'Below HP'}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>VP Position:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {line.yB === 0 ? 'On VP' : `${Math.abs(line.yB)} mm ${line.yB > 0 ? 'In Front of VP' : 'Behind VP'}`}
              </span>
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
export const LineParametersCard: React.FC<LineResultCardProps> = ({
  line,
  hpColor,
  vpColor,
  isDark = false,
}) => {
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

      {/* Core Engineering Parameters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* True Length (TL) */}
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
            <span>True Length (TL)</span>
            <span className="text-[10px] font-mono">Line {line.nameA}{line.nameB}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-blue-900 dark:text-blue-100">
              {line.trueLength.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Length in Space
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

      {/* Angles Section: True Inclinations vs Apparent Angles (No formulas displayed) */}
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
