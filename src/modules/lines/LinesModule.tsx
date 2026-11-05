/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { LineProblemInput } from '../../types/lines';
import { computeLineProjection } from '../../utils/linesMath';
import { LineInputForm } from './LineInputForm';
import { LineQuadrantCard, LineParametersCard } from './LineResultCard';
import { LineThreeDView } from './LineThreeDView';
import { LineTwoDOrthographicView } from './LineTwoDOrthographicView';
import { LineTheoryPanel } from './LineTheoryPanel';
import { ScanQuestionModal } from '../../components/ScanQuestionModal';
import { Sparkles } from 'lucide-react';

interface LinesModuleProps {
  hpColor: string;
  vpColor: string;
  onChangeHpColor: (c: string) => void;
  onChangeVpColor: (c: string) => void;
  isDark?: boolean;
  initialLineInput?: LineProblemInput;
}

const DEFAULT_LINE_INPUT: LineProblemInput = {
  mode: 'TRUE_LENGTH_ANGLES',
  nameA: 'A',
  nameB: 'B',
  color: '#2563eb',
  endA: {
    name: 'A',
    hpRelation: 'ABOVE',
    distanceHp: 20,
    vpRelation: 'IN_FRONT',
    distanceVp: 30,
  },
  endB: {
    name: 'B',
    hpRelation: 'ABOVE',
    distanceHp: 60,
    vpRelation: 'IN_FRONT',
    distanceVp: 86,
  },
  dep: 50,
  trueLength: 80,
  thetaDeg: 30,
  phiDeg: 45,
  endBQuadrant: 'ABOVE_FRONT',
  frontViewLength: 70,
  topViewLength: 60,
  apparentInputType: 'LENGTHS_DEP',
  targetQuadrantB: 'FIRST',
};

export const LinesModule: React.FC<LinesModuleProps> = ({
  hpColor,
  vpColor,
  onChangeHpColor,
  onChangeVpColor,
  isDark = false,
  initialLineInput,
}) => {
  const [input, setInput] = useState<LineProblemInput>(initialLineInput || DEFAULT_LINE_INPUT);
  const [activeTab, setActiveTab] = useState<'both' | '3d' | '2d'>('both');
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialLineInput) {
      setInput(initialLineInput);
    }
  }, [initialLineInput]);

  // Reactively compute all 3D coordinates, projections, lengths, angles, and traces
  const computedLine = useMemo(() => {
    return computeLineProjection(input);
  }, [input]);

  const handleReset = () => {
    setInput(DEFAULT_LINE_INPUT);
  };

  const handleSelectQuadrantB = (quadrant: any) => {
    setInput((prev) => ({
      ...prev,
      mode: 'APPARENT_VALUES',
      targetQuadrantB: quadrant,
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Module Title Ribbon */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              MODULE V2
            </span>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Projection of Straight Lines
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            True Length (TL), True Angles (θ, φ), Apparent Angles (α, β), Rotating Line Method &amp; Traces (HT, VT)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Scan Question Button */}
          <button
            onClick={() => setIsScanModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition"
            title="Scan or paste textbook question to solve automatically"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Scan Q ➔ Ans</span>
          </button>

          {/* View Layout Tabs */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === 'both'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Dual View (3D + 2D)
          </button>
          <button
            onClick={() => setActiveTab('3d')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === '3d'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            3D Cartesian
          </button>
          <button
            onClick={() => setActiveTab('2d')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeTab === '2d'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            2D Orthographic
          </button>
        </div>
      </div>
    </div>

      {/* Main Grid: Form on Left, Output Views on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Line Input Form */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <LineInputForm
            input={input}
            onChange={setInput}
            onReset={handleReset}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />
        </div>

        {/* Right Column: 4 Sequenced Answer Outputs & Theory */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1st Answer Output: The Quadrant */}
          <LineQuadrantCard
            line={computedLine}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
            onSelectQuadrantB={handleSelectQuadrantB}
            activeQuadrantB={input.targetQuadrantB}
          />

          {/* 2nd Answer Output: The Parameters Displayed */}
          <LineParametersCard
            line={computedLine}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />

          {/* 3rd Answer Output: 3D Cutting Representation */}
          {(activeTab === 'both' || activeTab === '3d') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-xs" />
                  <span>3D CUTTING REPRESENTATION</span>
                </h2>
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: hpColor }} />
                    HP
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: vpColor }} />
                    VP
                  </span>
                  <span>• Thin XY Line</span>
                </div>
              </div>
              <LineThreeDView
                line={computedLine}
                hpColor={hpColor}
                vpColor={vpColor}
                onChangeHpColor={onChangeHpColor}
                onChangeVpColor={onChangeVpColor}
                isDark={isDark}
              />
            </div>
          )}

          {/* 4th Answer Output: Generated Projection */}
          {(activeTab === 'both' || activeTab === '2d') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                  <span>GENERATED PROJECTION</span>
                </h2>
                <span className="text-[11px] font-mono text-slate-500">
                  Elevation (a′b′) • Plan (ab) • Thin Projectors (1.2px) • Rotating Method
                </span>
              </div>
              <LineTwoDOrthographicView
                line={computedLine}
                hpColor={hpColor}
                vpColor={vpColor}
                isDark={isDark}
              />
            </div>
          )}

          {/* Engineering Theory, Drafting Procedure & Classroom Problems */}
          <LineTheoryPanel
            line={computedLine}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
            onSelectProblem={setInput}
          />
        </div>
      </div>

      {/* Multimodal Scan Question Parser Modal */}
      <ScanQuestionModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        initialTopic="lines"
        isDark={isDark}
        onApplyPoint={() => {
          // If a point is parsed while in lines module
        }}
        onApplyLine={(scannedLine) => {
          setInput(scannedLine);
        }}
      />
    </div>
  );
};
