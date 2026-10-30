/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ComputedLine, LineProblemInput } from '../../types/lines';
import { SAMPLE_LINE_PROBLEMS } from '../../utils/linesMath';
import {
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  Ruler,
  Compass,
  CheckCircle2,
  BookmarkCheck,
  ArrowRight,
} from 'lucide-react';

interface LineTheoryPanelProps {
  line: ComputedLine;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
  onSelectProblem?: (input: LineProblemInput) => void;
}

export const LineTheoryPanel: React.FC<LineTheoryPanelProps> = ({
  line,
  hpColor,
  vpColor,
  isDark = false,
  onSelectProblem,
}) => {
  const [activeTab, setActiveTab] = useState<'procedure' | 'problems' | 'traces'>('procedure');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
              Engineering Theory &amp; Drafting Procedure
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              BIS SP 46 / ISO 128 Projection Principles
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('procedure')}
            className={`px-3 py-1 rounded-md transition ${
              activeTab === 'procedure'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Drafting Steps
          </button>
          <button
            onClick={() => setActiveTab('problems')}
            className={`px-3 py-1 rounded-md transition ${
              activeTab === 'problems'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Classroom Standard Problems
          </button>
          <button
            onClick={() => setActiveTab('traces')}
            className={`px-3 py-1 rounded-md transition ${
              activeTab === 'traces'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Traces (HT &amp; VT)
          </button>
        </div>
      </div>

      {/* Tab 1: Step-by-Step Drafting Procedure */}
      {activeTab === 'procedure' && (
        <div className="flex flex-col gap-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 font-sans">
            Standard rotating-line drafting procedure for line <strong>{line.nameA}{line.nameB}</strong>:
          </div>

          <div className="space-y-2.5 font-sans">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                1
              </span>
              <div>
                <strong>Draw XY Ground Line &amp; Projector of Reference End:</strong>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Draw reference line XY. Erect a vertical projector line for End {line.nameA}. Mark front view <em>{line.aFront.label}</em> at distance {Math.abs(line.zA)} mm from XY, and top view <em>{line.aTop.label}</em> at distance {Math.abs(line.yA)} mm from XY.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                2
              </span>
              <div>
                <strong>Establish Locus Lines of Second End:</strong>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Draw thin horizontal dashed lines parallel to XY: the locus line of <em>{line.bFront.label}</em> across the elevation plane, and the locus line of <em>{line.bTop.label}</em> across the plan plane.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                3
              </span>
              <div>
                <strong>Rotating Line Construction for True Length &amp; Inclinations:</strong>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Using center <em>{line.aFront.label}</em> and compass radius equal to True Length ({line.trueLength.toFixed(1)} mm), swing an arc cutting the locus of <em>{line.bFront.label}</em> to locate <em>{line.b1Front.label}</em>. The inclination of <em>{line.aFront.label}{line.b1Front.label}</em> to XY yields true inclination θ = {line.thetaDeg.toFixed(1)}°.
                  Similarly, in plan with center <em>{line.aTop.label}</em> and radius {line.trueLength.toFixed(1)} mm, swing an arc to locus of <em>{line.bTop.label}</em> to locate <em>{line.b2Top.label}</em> (true inclination φ = {line.phiDeg.toFixed(1)}°).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                4
              </span>
              <div>
                <strong>Final Views (Elevation &amp; Plan):</strong>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Connect <em>{line.aFront.label}{line.bFront.label}</em> with a thick solid line for Elevation (length = {line.frontViewLength.toFixed(1)} mm, angle α = {line.alphaDeg.toFixed(1)}°).
                  Connect <em>{line.aTop.label}{line.bTop.label}</em> with a thick solid line for Plan (length = {line.topViewLength.toFixed(1)} mm, angle β = {line.betaDeg.toFixed(1)}°).
                  Both final views <em>{line.bFront.label}</em> and <em>{line.bTop.label}</em> lie on the exact same vertical projector line perpendicular to XY.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Classroom Standard Problems */}
      {activeTab === 'problems' && (
        <div className="flex flex-col gap-3 text-xs">
          <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 font-sans flex items-center justify-between">
            <span>Select a curriculum benchmark problem from Indian University &amp; Technical Board syllabi:</span>
            <span className="text-[10px] font-mono text-slate-400">BIS SP 46:2003 / ISO 128</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {SAMPLE_LINE_PROBLEMS.map((sample) => (
              <div
                key={sample.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-400 dark:hover:border-blue-600 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {sample.title}
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {sample.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed font-sans">
                    {sample.description}
                  </p>
                </div>

                {onSelectProblem && (
                  <button
                    type="button"
                    onClick={() => onSelectProblem(sample.input)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-semibold shrink-0 shadow-xs flex items-center gap-1.5 transition"
                  >
                    <span>Load Problem</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Traces Theory (HT & VT) */}
      {activeTab === 'traces' && (
        <div className="flex flex-col gap-3 text-xs text-slate-700 dark:text-slate-300 font-sans">
          <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
            <h4 className="font-bold text-amber-900 dark:text-amber-200 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              What are Traces?
            </h4>
            <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              The point of intersection of a straight line (or its extension) with the principal reference planes (HP and VP) is known as its trace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                Horizontal Trace (HT)
              </span>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
                <li>Intersection with Horizontal Plane (HP).</li>
                <li>To locate in 2D: Extend the Front View (a′b′) until it cuts the reference line XY at <strong>h′</strong>.</li>
                <li>From h′, draw a vertical projector line perpendicular to XY to meet the extended Top View (ab) at <strong>h (HT)</strong>.</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                Vertical Trace (VT)
              </span>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
                <li>Intersection with Vertical Plane (VP).</li>
                <li>To locate in 2D: Extend the Top View (ab) until it cuts the reference line XY at <strong>v</strong>.</li>
                <li>From v, draw a vertical projector line perpendicular to XY to meet the extended Front View (a′b′) at <strong>v′ (VT)</strong>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
