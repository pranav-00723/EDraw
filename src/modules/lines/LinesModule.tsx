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
import { RotatingLineConstructionEngine } from './RotatingLineConstructionEngine';
import { ScanQuestionModal } from '../../components/ScanQuestionModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { MasterRegressionSuiteModal } from './MasterRegressionSuiteModal';
import {
  Sparkles,
  ShieldCheck,
  Box,
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  Compass,
} from 'lucide-react';

interface LinesModuleProps {
  hpColor: string;
  vpColor: string;
  onChangeHpColor: (c: string) => void;
  onChangeVpColor: (c: string) => void;
  isDark?: boolean;
  initialLineInput?: LineProblemInput;
}

const DEFAULT_LINE_INPUT: LineProblemInput = {
  mode: 'END_POINTS',
  nameA: 'A',
  nameB: 'B',
  color: '#2563eb',
  endA: {
    name: 'A',
    hpRelation: 'ABOVE',
    distanceHp: 35,
    vpRelation: 'IN_FRONT',
    distanceVp: 20,
  },
  endB: {
    name: 'B',
    hpRelation: 'ABOVE',
    distanceHp: 10,
    vpRelation: 'IN_FRONT',
    distanceVp: 20,
  },
  dep: 0,
  trueLength: 25,
  thetaDeg: 90,
  phiDeg: 0,
  endBQuadrant: 'ABOVE_FRONT',
  frontViewLength: 25,
  topViewLength: 0,
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
  const [activeTab, setActiveTab] = useState<'both' | '3d' | '2d' | 'rotating'>('both');
  const [mobileSection, setMobileSection] = useState<'all' | 'inputs' | 'views' | 'analysis'>('all');
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [isRegressionModalOpen, setIsRegressionModalOpen] = useState<boolean>(false);

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
    <div className="w-full px-3 sm:px-5 py-4 bg-[#F8F7FC]/60 dark:bg-slate-950/40">
      {/* Compact Workspace Toolbar (Matches Projection of Points) */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Mobile & Tablet Panel Filter Tabs */}
        <div className="flex lg:hidden items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 text-xs font-semibold overflow-x-auto max-w-full">
          {(
            [
              { id: 'all', label: 'All Panels', icon: null },
              { id: 'inputs', label: 'Inputs', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
              { id: 'analysis', label: 'Answer', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              { id: 'views', label: '3D & 2D', icon: <Box className="w-3.5 h-3.5" /> },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMobileSection(item.id)}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                mobileSection === item.id
                  ? 'bg-[#7138E8] text-white'
                  : 'text-[#77758F] dark:text-slate-300'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Active Line Summary (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#77758F] dark:text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-mono font-bold text-[11px] whitespace-nowrap">
            V2 · BIS SP 46
          </span>
          <span className="font-mono text-[11px] text-[#202044] dark:text-slate-300 tabular-nums whitespace-nowrap">
            Line <strong>{computedLine.nameA}{computedLine.nameB}</strong> · TL {computedLine.trueLength.toFixed(1)} mm · θ {computedLine.thetaDeg.toFixed(1)}° · φ {computedLine.phiDeg.toFixed(1)}°
          </span>
        </div>

        {/* Right Quick Controls */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setIsRegressionModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 hover:bg-[#F1EBFF] dark:hover:bg-purple-950/40 text-[#7138E8] dark:text-purple-300 text-xs font-semibold shadow-2xs cursor-pointer transition whitespace-nowrap"
            title="10 Master Regression Tests & Constraint Normalizer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Master Tests (10)</span>
            <span className="sm:hidden">Tests</span>
          </button>

          <button
            type="button"
            onClick={() => setIsScanModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold shadow-xs cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap"
            style={{
              background: 'linear-gradient(90deg, #7138E8 0%, #9565F5 100%)',
            }}
            title="Scan or paste textbook question to solve automatically"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>Scan Q ➔ Ans</span>
          </button>

          <div className="flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 text-[11px] font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'both'
                  ? 'bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300'
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
              }`}
            >
              Dual View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('3d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === '3d'
                  ? 'bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300'
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
              }`}
            >
              <Box className="w-3 h-3" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('2d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === '2d'
                  ? 'bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300'
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>2D</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rotating')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'rotating'
                  ? 'bg-[#7138E8] text-white shadow-2xs'
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Rotating Line (8 Steps)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Responsive EDRAW CAD Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[315px_minmax(0,1fr)] xl:grid-cols-[345px_minmax(0,1fr)] gap-4 items-start">
        {/* Left Column: Line Input Parameters */}
        <div
          className={`flex flex-col gap-4 ${
            mobileSection === 'all' || mobileSection === 'inputs'
              ? 'block'
              : 'hidden lg:block'
          }`}
        >
          <LineInputForm
            input={input}
            onChange={setInput}
            onReset={handleReset}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />
        </div>

        {/* Right Main Area: Answer Cards + Undisturbed 3D, 2D, Rotating Line & Theory */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Answer & Analysis Section */}
          <div
            className={`flex-col gap-4 ${
              mobileSection === 'all' || mobileSection === 'analysis'
                ? 'flex'
                : 'hidden lg:flex'
            }`}
          >
            {/* 1st Answer Output: Quadrant Status & End Point Positions */}
            <LineQuadrantCard
              line={computedLine}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
              onSelectQuadrantB={handleSelectQuadrantB}
              activeQuadrantB={input.targetQuadrantB}
            />

            {/* 2nd Answer Output: Parameters Displayed */}
            <LineParametersCard
              line={computedLine}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
            />
          </div>

          {/* 3D Cutting Representation, Generated Projection, Rotating Line & Theory (Undisturbed internals) */}
          <div
            className={`flex-col gap-5 ${
              mobileSection === 'all' || mobileSection === 'views'
                ? 'flex'
                : 'hidden lg:flex'
            }`}
          >
            {/* 3rd Answer Output: 3D Cutting Representation */}
            {(activeTab === 'both' || activeTab === '3d') && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
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
                <ErrorBoundary fallbackTitle="3D Line Simulation Encountered an Issue">
                  <LineThreeDView
                    line={computedLine}
                    hpColor={hpColor}
                    vpColor={vpColor}
                    onChangeHpColor={onChangeHpColor}
                    onChangeVpColor={onChangeVpColor}
                    isDark={isDark}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* 4th Answer Output: Generated Projection */}
            {(activeTab === 'both' || activeTab === '2d') && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1 flex-wrap gap-1">
                  <h2
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                    <span>GENERATED PROJECTION</span>
                  </h2>
                  <span className="text-[11px] font-mono text-slate-500">
                    Elevation ({computedLine.nameA.toLowerCase()}′{computedLine.nameB.toLowerCase()}′) • Plan ({computedLine.nameA.toLowerCase()}{computedLine.nameB.toLowerCase()}) • Thin Projectors (1.2px) • Pure Geometry
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

            {/* 5th View: Rotating Line Method (8 Steps) — Undisturbed */}
            {activeTab === 'rotating' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1 flex-wrap gap-1">
                  <h2
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                    <span>PURE GEOMETRICAL CONSTRUCTION — STEP-BY-STEP</span>
                  </h2>
                  <span className="text-[11px] font-mono text-slate-500">
                    Given-Data Ordered • Loci &amp; Arcs / Right Triangles • BIS SP 46:2003
                  </span>
                </div>
                <RotatingLineConstructionEngine
                  line={computedLine}
                  hpColor={hpColor}
                  vpColor={vpColor}
                  isDark={isDark}
                />
              </div>
            )}

            {/* Engineering Theory, Drafting Procedure & Classroom Problems — Undisturbed */}
            <LineTheoryPanel
              line={computedLine}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
              onSelectProblem={setInput}
            />
          </div>
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

      {/* Master Straight Line Solver & Regression Suite Modal */}
      <MasterRegressionSuiteModal
        isOpen={isRegressionModalOpen}
        onClose={() => setIsRegressionModalOpen(false)}
        onApplyLine={(scannedLine) => {
          setInput(scannedLine);
        }}
        isDark={isDark}
      />
    </div>
  );
};
