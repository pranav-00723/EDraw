/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ComputedLine, LineProblemInput } from '../../types/lines';
import { SAMPLE_LINE_PROBLEMS } from '../../utils/linesMath';
import { PictorialDraftingStages } from './PictorialDraftingStages';
import { PictorialTracesDiagram } from './PictorialTracesDiagram';
import {
  BookOpen,
  ArrowRight,
  Compass,
  CheckCircle2,
  Sparkles,
  Layers,
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-5 text-slate-100">
      {/* Top Header & Tab Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold tracking-tight text-white font-sans">
              Engineering Theory &amp; Drafting Procedure
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              BIS SP 46:2003 / ISO 128 Projection Principles
            </p>
          </div>
        </div>

        {/* Tab Switcher (Matches User Mockup Screenshot) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('procedure')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'procedure'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Drafting Steps (Pictorial)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('problems')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'problems'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Classroom Standard Problems
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('traces')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'traces'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Traces (HT &amp; VT)
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB 1: PICTORIAL STEP-BY-STEP DRAFTING PROCEDURE */}
      {/* ================================================================ */}
      {activeTab === 'procedure' && (
        <PictorialDraftingStages
          line={line}
          hpColor={hpColor}
          vpColor={vpColor}
          isDark={isDark}
        />
      )}

      {/* ================================================================ */}
      {/* TAB 2: CLASSROOM STANDARD PROBLEMS */}
      {/* ================================================================ */}
      {activeTab === 'problems' && (
        <div className="flex flex-col gap-3 text-xs">
          <div className="text-[11px] text-slate-400 bg-slate-800/60 p-3 rounded-lg border border-slate-800 font-sans flex items-center justify-between">
            <span>Select a curriculum benchmark problem from Indian University &amp; Technical Board syllabi:</span>
            <span className="text-[10px] font-mono text-blue-400 font-semibold">BIS SP 46 / ISO 128</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {SAMPLE_LINE_PROBLEMS.map((sample) => (
              <div
                key={sample.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-850/60 hover:border-blue-500/80 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-blue-400 transition font-sans">
                      {sample.title}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-mono font-semibold rounded bg-blue-950 text-blue-300 border border-blue-800">
                      {sample.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed font-sans">
                    {sample.description}
                  </p>
                </div>

                {onSelectProblem && (
                  <button
                    type="button"
                    onClick={() => onSelectProblem(sample.input)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold shrink-0 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
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

      {/* ================================================================ */}
      {/* TAB 3: TRACES (HT & VT) WITH PICTORIAL EXTENSION DIAGRAM */}
      {/* ================================================================ */}
      {activeTab === 'traces' && (
        <div className="flex flex-col gap-4 text-xs">
          {/* Pictorial Traces Canvas */}
          <PictorialTracesDiagram
            line={line}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />

          {/* Theoretical Rules & Calculations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Horizontal Trace (HT) */}
            <div className="p-3.5 rounded-xl bg-slate-850/70 border border-slate-800 flex flex-col gap-2">
              <span className="font-bold text-white text-xs flex items-center gap-2 font-sans">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: hpColor }} />
                <span>Horizontal Trace (HT) — Intersection with HP</span>
              </span>
              <ul className="space-y-1.5 text-[11.5px] text-slate-300 list-disc list-inside leading-relaxed font-sans">
                <li>
                  <strong>2D Procedure:</strong> Extend Front View <em>a′b′</em> until it intersects reference line XY at <strong>h′</strong>.
                </li>
                <li>
                  From <strong>h′</strong>, draw a vertical projector perpendicular to XY to meet the extended Top View <em>ab</em> at <strong>h (HT)</strong>.
                </li>
                <li>
                  <strong>Current Status:</strong>{' '}
                  {line.ht.exists ? (
                    <span className="font-mono text-emerald-400 font-bold">
                      HT exists at ({line.ht.x.toFixed(1)}, {line.ht.y.toFixed(1)}, 0) mm
                    </span>
                  ) : (
                    <span className="font-mono text-amber-400">
                      Line is parallel to HP (HT does not exist).
                    </span>
                  )}
                </li>
              </ul>
            </div>

            {/* Vertical Trace (VT) */}
            <div className="p-3.5 rounded-xl bg-slate-850/70 border border-slate-800 flex flex-col gap-2">
              <span className="font-bold text-white text-xs flex items-center gap-2 font-sans">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: vpColor }} />
                <span>Vertical Trace (VT) — Intersection with VP</span>
              </span>
              <ul className="space-y-1.5 text-[11.5px] text-slate-300 list-disc list-inside leading-relaxed font-sans">
                <li>
                  <strong>2D Procedure:</strong> Extend Top View <em>ab</em> until it intersects reference line XY at <strong>v</strong>.
                </li>
                <li>
                  From <strong>v</strong>, draw a vertical projector perpendicular to XY to meet the extended Front View <em>a′b′</em> at <strong>v′ (VT)</strong>.
                </li>
                <li>
                  <strong>Current Status:</strong>{' '}
                  {line.vt.exists ? (
                    <span className="font-mono text-amber-400 font-bold">
                      VT exists at ({line.vt.x.toFixed(1)}, 0, {line.vt.z.toFixed(1)}) mm
                    </span>
                  ) : (
                    <span className="font-mono text-amber-400">
                      Line is parallel to VP (VT does not exist).
                    </span>
                  )}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
