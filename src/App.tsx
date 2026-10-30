import React, { useState, useMemo } from 'react';
import { PointInput, PresetProblem } from './types/projection';
import { computePointCoordinates, SAMPLE_PROBLEMS, POINT_COLORS } from './utils/projectionMath';
import { PointInputForm } from './components/PointInputForm';
import { ThreeDView } from './components/ThreeDView';
import { TwoDOrthographicView } from './components/TwoDOrthographicView';
import { ExplanationPanel } from './components/ExplanationPanel';
import { QuadrantResultCard } from './components/QuadrantResultCard';
import { PlaneColorPicker } from './components/PlaneColorPicker';
import {
  Compass,
  Moon,
  Sun,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(false);

  // Plane Colors state (HP & VP)
  const [hpColor, setHpColor] = useState<string>('#2563eb');
  const [vpColor, setVpColor] = useState<string>('#dc2626');

  const handleResetColors = () => {
    setHpColor('#2563eb');
    setVpColor('#dc2626');
  };

  // Active Points state
  // Default to standard initial problem: Point A (30 mm above HP, 40 mm in front of VP)
  const [points, setPoints] = useState<PointInput[]>([
    {
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

  const [selectedPointId, setSelectedPointId] = useState<string | null>('pt-default-1');
  const [activeTab, setActiveTab] = useState<'both' | '3d' | '2d'>('both');

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
    // Triggers recalculation (already reactive via useMemo, but provides user feedback)
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors duration-200`}>
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
                  ED2 — Projection of Points
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                  ISO / BIS Standard
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Interactive 3D Visualization &amp; Orthographic Projection (HP &amp; VP)
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Tabs (Desktop) */}
            <div className="hidden md:flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
              <button
                onClick={() => setActiveTab('both')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeTab === 'both'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Dual View (3D + 2D)
              </button>
              <button
                onClick={() => setActiveTab('3d')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeTab === '3d'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                3D Cartesian
              </button>
              <button
                onClick={() => setActiveTab('2d')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeTab === '2d'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                2D Orthographic
              </button>
            </div>

            {/* Plane Colors Selector Tool */}
            <PlaneColorPicker
              hpColor={hpColor}
              vpColor={vpColor}
              onChangeHpColor={setHpColor}
              onChangeVpColor={setVpColor}
              onResetColors={handleResetColors}
              isDark={isDark}
            />

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title={isDark ? 'Switch to Technical Light Drawing Canvas' : 'Switch to CAD Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
              onChangeHpColor={setHpColor}
              onChangeVpColor={setVpColor}
              isDark={isDark}
            />
          </div>

          {/* Right Column: Answer, 3D Representation, Generated Projection & Detailed Explanations */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Answer: Quadrant Determination according to HP & VP details */}
            <QuadrantResultCard
              point={selectedPoint}
              allPoints={computedPoints}
              onSelectPoint={setSelectedPointId}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
            />

            {/* 3D Cartesian Representation */}
            {(activeTab === 'both' || activeTab === '3d') && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    className="text-lg sm:text-xl tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                    <span>3D REPRESENTATION</span>
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
                <ThreeDView
                  points={computedPoints}
                  selectedPointId={selectedPointId}
                  onSelectPoint={setSelectedPointId}
                  hpColor={hpColor}
                  vpColor={vpColor}
                  onChangeHpColor={setHpColor}
                  onChangeVpColor={setVpColor}
                  isDark={isDark}
                />
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
      </main>

      {/* Footer with Educational Note */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px]">
          <div>
            Engineering Drawing Interactive Simulator • First &amp; Third Angle Projections
          </div>
          <div>
            Built according to BIS SP 46 &amp; ISO 128 Drawing Standards
          </div>
        </div>
      </footer>
    </div>
  );
}
