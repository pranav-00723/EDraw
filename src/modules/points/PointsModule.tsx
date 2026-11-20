/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { PointInput, PresetProblem } from '../../types/projection';
import { computePointCoordinates } from '../../utils/projectionMath';
import { PointInputForm } from '../../components/PointInputForm';
import { ThreeDView } from '../../components/ThreeDView';
import { TwoDOrthographicView } from '../../components/TwoDOrthographicView';
import { ExplanationPanel } from '../../components/ExplanationPanel';
import {
  PointQuadrantCard,
  PointParametersCard,
} from '../../components/QuadrantResultCard';
import { ScanQuestionModal } from '../../components/ScanQuestionModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Sparkles, Box, Layers, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

interface PointsModuleProps {
  hpColor: string;
  vpColor: string;
  onChangeHpColor: (c: string) => void;
  onChangeVpColor: (c: string) => void;
  isDark?: boolean;
  initialPointInput?: PointInput;
}

export const PointsModule: React.FC<PointsModuleProps> = ({
  hpColor,
  vpColor,
  onChangeHpColor,
  onChangeVpColor,
  isDark = false,
  initialPointInput,
}) => {
  // Active Points state — defaults to standard 1st Quadrant problem (Point A: 30mm above HP, 40mm in front of VP)
  const [points, setPoints] = useState<PointInput[]>([
    initialPointInput || {
      id: 'pt-default-1',
      name: 'A',
      color: '#7138E8',
      hpRelation: 'ABOVE',
      distanceHp: 30,
      vpRelation: 'IN_FRONT',
      distanceVp: 40,
      x: 0,
      showOptionalX: false,
    },
  ]);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(
    initialPointInput?.id || 'pt-default-1'
  );
  const [activeTab, setActiveTab] = useState<'both' | '3d' | '2d'>('both');
  const [mobileSection, setMobileSection] = useState<'all' | 'inputs' | 'views' | 'analysis'>('all');
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialPointInput) {
      setPoints([initialPointInput]);
      setSelectedPointId(initialPointInput.id);
    }
  }, [initialPointInput]);

  // Compute all points coordinates and projections
  const computedPoints = useMemo(() => {
    return points.map(computePointCoordinates);
  }, [points]);

  const selectedPoint = useMemo(() => {
    return (
      computedPoints.find((p) => p.id === selectedPointId) ||
      computedPoints[0] ||
      null
    );
  }, [computedPoints, selectedPointId]);

  // Point Management Handlers
  const handleAddPoint = (newPoint: PointInput) => {
    setPoints((prev) => [...prev, newPoint]);
    setSelectedPointId(newPoint.id);
  };

  const handleUpdatePoint = (updatedPoint: PointInput) => {
    setPoints((prev) =>
      prev.map((p) => (p.id === updatedPoint.id ? updatedPoint : p))
    );
    setSelectedPointId(updatedPoint.id);
  };

  const handleDeletePoint = (id: string) => {
    if (points.length <= 1) return; // Keep at least one point
    setPoints((prev) => prev.filter((p) => p.id !== id));
    if (selectedPointId === id) {
      const remaining = points.filter((p) => p.id !== id);
      setSelectedPointId(remaining[0]?.id || null);
    }
  };

  const handleResetAll = () => {
    const defaultPoint: PointInput = {
      id: `pt-${Date.now()}`,
      name: 'A',
      color: '#7138E8',
      hpRelation: 'ABOVE',
      distanceHp: 30,
      vpRelation: 'IN_FRONT',
      distanceVp: 40,
      x: 0,
      showOptionalX: false,
    };
    setPoints([defaultPoint]);
    setSelectedPointId(defaultPoint.id);
  };

  const handleLoadPreset = (preset: PresetProblem) => {
    const loadedPoints: PointInput[] = preset.points.map((p, idx) => ({
      ...p,
      id: `preset-${Date.now()}-${idx}`,
    }));
    setPoints(loadedPoints);
    setSelectedPointId(loadedPoints[0]?.id || null);
  };

  const handleGenerate = () => {
    // Triggers recalculation (reactive via useMemo)
  };

  return (
    <div className="w-full px-3 sm:px-5 py-4 bg-[#F8F7FC]/60 dark:bg-slate-950/40">
      {/* Compact Workspace Toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Mobile & Tablet Panel Filter Tabs */}
        <div className="flex lg:hidden items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 text-xs font-semibold overflow-x-auto max-w-full">
          {(
            [
              { id: 'all', label: 'All Panels', icon: null },
              { id: 'inputs', label: 'Inputs', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
              { id: 'views', label: '3D & 2D', icon: <Box className="w-3.5 h-3.5" /> },
              { id: 'analysis', label: 'Answer', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
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

        {/* Active Point Summary Pill (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#77758F] dark:text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-mono font-bold text-[11px]">
            V1 · BIS SP 46
          </span>
          {selectedPoint && (
            <span className="font-mono text-[11px] text-[#202044] dark:text-slate-300">
              Active: <strong>Point {selectedPoint.name}</strong> ({selectedPoint.x}, {selectedPoint.y}, {selectedPoint.z}) mm
            </span>
          )}
        </div>

        {/* Right Quick Controls: Scan Q->Ans + Layout Focus */}
        <div className="flex items-center gap-2 ml-auto">
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

          <div className="hidden sm:flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'both'
                  ? 'bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300'
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044]'
              }`}
            >
              <span>Dual View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('3d')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === '3d'
                  ? 'bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300'
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044]'
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
                  : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>2D</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column CAD + EdTech Layout (Matches Straight Lines Workspace) */}
      <div className="grid grid-cols-1 lg:grid-cols-[315px_minmax(0,1fr)] xl:grid-cols-[345px_minmax(0,1fr)] gap-4 items-start">
        {/* LEFT PANEL: Input Parameters */}
        <div
          className={`${
            mobileSection === 'all' || mobileSection === 'inputs'
              ? 'block'
              : 'hidden lg:block'
          }`}
        >
          <PointInputForm
            points={points}
            selectedPointId={selectedPointId}
            onAddPoint={handleAddPoint}
            onUpdatePoint={handleUpdatePoint}
            onDeletePoint={handleDeletePoint}
            onSelectPoint={setSelectedPointId}
            onResetAll={handleResetAll}
            onLoadPreset={handleLoadPreset}
            onGenerate={handleGenerate}
            hpColor={hpColor}
            vpColor={vpColor}
            onChangeHpColor={onChangeHpColor}
            onChangeVpColor={onChangeVpColor}
            isDark={isDark}
          />
        </div>

        {/* RIGHT MAIN AREA: Answer & Insights + 3D & 2D Views + Step-by-Step Construction */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Quadrant Banner + Key Details + Quick Insights */}
          <div
            className={`flex-col gap-3.5 ${
              mobileSection === 'all' || mobileSection === 'analysis'
                ? 'flex'
                : 'hidden lg:flex'
            }`}
          >
            <PointQuadrantCard
              point={selectedPoint}
              allPoints={computedPoints}
              onSelectPoint={setSelectedPointId}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
            />

            <PointParametersCard
              point={selectedPoint}
              allPoints={computedPoints}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
            />
          </div>

          {/* 3D Visualisation + Orthographic Projection + Step-by-Step Construction */}
          <div
            className={`flex-col gap-5 ${
              mobileSection === 'all' || mobileSection === 'views'
                ? 'flex'
                : 'hidden lg:flex'
            }`}
          >
            {(activeTab === 'both' || activeTab === '3d') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#77758F] dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7138E8]" />
                    <span>3D Cutting Representation</span>
                  </h2>
                  <span className="text-[11px] font-mono text-[#77758F] dark:text-slate-400">
                    HP • VP • Thin XY Line
                  </span>
                </div>
                <ErrorBoundary fallbackTitle="3D Simulation Encountered an Issue">
                  <ThreeDView
                    points={computedPoints}
                    selectedPointId={selectedPointId}
                    onSelectPoint={setSelectedPointId}
                    hpColor={hpColor}
                    vpColor={vpColor}
                    onChangeHpColor={onChangeHpColor}
                    onChangeVpColor={onChangeVpColor}
                    isDark={isDark}
                  />
                </ErrorBoundary>
              </div>
            )}

            {(activeTab === 'both' || activeTab === '2d') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 flex-wrap gap-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#77758F] dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Generated Projection</span>
                  </h2>
                  <span className="text-[11px] font-mono text-[#77758F] dark:text-slate-400">
                    VP: Lowercase with Prime (a′) • HP: Lowercase without Prime (a) • Thin XY Line
                  </span>
                </div>
                <TwoDOrthographicView
                  points={computedPoints}
                  selectedPointId={selectedPointId}
                  onSelectPoint={setSelectedPointId}
                  hpColor={hpColor}
                  vpColor={vpColor}
                  isDark={isDark}
                />
              </div>
            )}

            <ExplanationPanel
              point={selectedPoint}
              allPoints={computedPoints}
              onSelectPoint={setSelectedPointId}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Multimodal Scan Question Parser Modal */}
      <ScanQuestionModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        initialTopic="points"
        isDark={isDark}
        onApplyPoint={(scannedPoint) => {
          handleAddPoint(scannedPoint);
        }}
        onApplyLine={() => {}}
      />
    </div>
  );
};
