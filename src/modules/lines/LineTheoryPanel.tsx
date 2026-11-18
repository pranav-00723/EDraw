/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ComputedLine, LineProblemInput } from '../../types/lines';
import { SAMPLE_LINE_PROBLEMS } from '../../utils/linesMath';
import { PictorialDraftingStages } from './PictorialDraftingStages';
import { PictorialTracesDiagram } from './PictorialTracesDiagram';
import { ArrowRight } from 'lucide-react';

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

  const tabMeta = {
    procedure: {
      title: `Drafting Theory & Rotating Line Procedure`,
      takeaway: `Step-by-step BIS SP 46:2003 construction for line ${line.nameA}${line.nameB} (TL = ${line.trueLength.toFixed(1)} mm, θ = ${line.thetaDeg.toFixed(1)}°, φ = ${line.phiDeg.toFixed(1)}°).`,
    },
    problems: {
      title: 'Standard Curriculum Benchmarks',
      takeaway:
        'Select any classic university or technical board straight-line problem to load its parameters directly into the simulator.',
    },
    traces: {
      title: 'Horizontal & Vertical Traces (HT & VT)',
      takeaway:
        'Extend the Front View and Top View to meet XY and drop perpendicular projectors to locate where the infinite line pierces HP and VP.',
    },
  }[activeTab];

  return (
    <section
      aria-label="Straight Line Theory & Drafting Studio"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Grand Architectural Masthead */}
      <header className="px-6 pt-6 pb-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
        <div className="pb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Straight-Line Theory Studio</span>
            <span aria-hidden="true">·</span>
            <span>BIS SP 46:2003</span>
            <span aria-hidden="true">·</span>
            <span>ISO 128</span>
          </div>

          <h3
            style={{ fontFamily: "'Fraunces', Georgia, serif", textWrap: 'balance' }}
            className="mt-1.5 text-2xl sm:text-[26px] font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-snug"
          >
            {tabMeta.title}
          </h3>

          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {tabMeta.takeaway}
          </p>
        </div>

        {/* Clean Underline Tab Navigation */}
        <nav
          role="tablist"
          aria-label="Line theory sections"
          className="flex items-center gap-6 overflow-x-auto -mb-px"
        >
          {[
            { id: 'procedure' as const, num: '01', label: 'Drafting Steps' },
            { id: 'problems' as const, num: '02', label: 'Standard Problems' },
            { id: 'traces' as const, num: '03', label: 'Traces (HT & VT)' },
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

      <div className="p-6">
        {/* TAB 1: PICTORIAL STEP-BY-STEP DRAFTING PROCEDURE */}
        {activeTab === 'procedure' && (
          <PictorialDraftingStages
            line={line}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />
        )}

        {/* TAB 2: CLASSROOM STANDARD PROBLEMS */}
        {activeTab === 'problems' && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
            {SAMPLE_LINE_PROBLEMS.map((sample, idx) => (
              <div
                key={sample.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{String(idx + 1).padStart(2, '0')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{sample.badge}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {sample.title}
                  </h4>
                  <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                    {sample.description}
                  </p>
                </div>

                {onSelectProblem && (
                  <button
                    type="button"
                    onClick={() => onSelectProblem(sample.input)}
                    className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap self-start sm:self-center"
                  >
                    <span>Load Problem</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: TRACES (HT & VT) */}
        {activeTab === 'traces' && (
          <div className="flex flex-col gap-6">
            <PictorialTracesDiagram
              line={line}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              {/* Horizontal Trace (HT) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: hpColor }} />
                    <span>Horizontal Trace (HT)</span>
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Pierces HP
                  </span>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Extend Front View <em>a′b′</em> to meet XY at <strong>h′</strong>, then drop a vertical projector to meet the extended Top View <em>ab</em> at <strong>h (HT)</strong>.
                </p>
                <div className="pt-1 font-mono text-xs tabular-nums">
                  {line.ht.exists ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      HT at ({line.ht.x.toFixed(1)}, {line.ht.y.toFixed(1)}, 0) mm
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      Parallel to HP — HT does not exist
                    </span>
                  )}
                </div>
              </div>

              {/* Vertical Trace (VT) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: vpColor }} />
                    <span>Vertical Trace (VT)</span>
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Pierces VP
                  </span>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Extend Top View <em>ab</em> to meet XY at <strong>v</strong>, then draw a vertical projector to meet the extended Front View <em>a′b′</em> at <strong>v′ (VT)</strong>.
                </p>
                <div className="pt-1 font-mono text-xs tabular-nums">
                  {line.vt.exists ? (
                    <span className="text-blue-700 dark:text-blue-400 font-semibold">
                      VT at ({line.vt.x.toFixed(1)}, 0, {line.vt.z.toFixed(1)}) mm
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      Parallel to VP — VT does not exist
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
