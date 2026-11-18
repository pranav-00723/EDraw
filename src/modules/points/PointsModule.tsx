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
import { PointQuadrantCard, PointParametersCard } from '../../components/QuadrantResultCard';
import { ScanQuestionModal } from '../../components/ScanQuestionModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Sparkles } from 'lucide-react';

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
  // Active Points state
  // Default to standard initial problem: Point A (30 mm above HP, 40 mm in front of VP)
  const [points, setPoints] = useState<PointInput[]>([
    initialPointInput || {
      id: 'pt-default-1',
      name: 'A',
      color: '#2563eb',
      hpRelation: 'ABOVE',
      distanceHp: 30,
      vpRelation: 'IN_FRONT',
      distanceVp: 40,
      x: 0,
      showOptionalX: false,
    },
  ]);

  useEffect(() => {
    if (initialPointInput) {
      setPoints([initialPointInput]);
      setSelectedPointId(initialPointInput.id);
    }
  }, [initialPointInput]);

  const [selectedPointId, setSelectedPointId] = useState<string | null>('pt-default-1');
  const [activeTab, setActiveTab] = useState<'both' | '3d' | '2d'>('both');
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  // Compute all points coordinates and projections
  const computedPoints = useMemo(() => {
    return points.map(computePointCoordinates);
  }, [points]);

  const selectedPoint = useMemo(() => {
    return computedPoints.find((p) => p.id === selectedPointId) || computedPoints[0] || null;
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
      color: '#2563eb',
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
    // Triggers recalculation (already reactive via useMemo)
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Module Title Ribbon */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              MODULE V1
            </span>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Projection of Points
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single &amp; Multi-Point Analysis relative to Horizontal Plane (HP) and Vertical Plane (VP)
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

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Form & Point Management */}
        <div className="lg:col-span-4 flex flex-col gap-4">
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

        {/* Right Column: 4 Sequenced Answer Outputs & Detailed Explanations */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1st Answer Output: The Quadrant */}
          <PointQuadrantCard
            point={selectedPoint}
            allPoints={computedPoints}
            onSelectPoint={setSelectedPointId}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />

          {/* 2nd Answer Output: The Parameters Displayed */}
          <PointParametersCard
            point={selectedPoint}
            allPoints={computedPoints}
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
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
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

          {/* Generated 2D Orthographic Projection */}
          {(activeTab === 'both' || activeTab === '2d') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-xs" />
                  <span>GENERATED PROJECTION</span>
                </h2>
                <span className="text-[11px] font-mono text-slate-500">
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

          {/* Pedagogical Explanation & Engineering Rules Panel */}
          <ExplanationPanel
            point={selectedPoint}
            allPoints={computedPoints}
            onSelectPoint={setSelectedPointId}
            isDark={isDark}
          />
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
        onApplyLine={() => {
          // If user scanned a line while in points module, inform or apply
        }}
      />
    </div>
  );
};
