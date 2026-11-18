/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MODULE_REGISTRY, AppRoute } from '../../types/modules';
import {
  Compass,
  Ruler,
  Square,
  Box,
  Scissors,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  Award,
  Check,
} from 'lucide-react';
import {
  LearningState,
  formatLearningHours,
  getModuleProgressPercent,
  computeAchievements,
} from '../../utils/learningProgress';
import pointsCardImg from '../../assets/images/edraw_points_card_1795028176937.jpg';
import linesCardImg from '../../assets/images/edraw_lines_card_1795028178511.jpg';
import generatorCardImg from '../../assets/images/edraw_generator_card_1795028176831.jpg';

interface DashboardViewProps {
  onNavigate: (route: AppRoute) => void;
  onOpenScanModal?: () => void;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
  learningState: LearningState;
  onToggleModuleComplete: (moduleId: string) => void;
  onScrollToSection?: (sectionId: string) => void;
}

function CircularProgressRing({
  percent,
  size = 50,
  strokeWidth = 4.5,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-[#EDE7FB] dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#7952D6"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-[11px] font-bold font-mono tabular-nums text-[#202033] dark:text-slate-100">
        {percent}%
      </span>
    </div>
  );
}

/**
 * Generates a smooth SVG cubic bezier path through data points
 */
function buildSmoothSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  hpColor,
  vpColor,
  isDark = false,
  learningState,
  onToggleModuleComplete,
  onScrollToSection,
}) => {
  const [chartMode, setChartMode] = useState<'module' | 'weekly'>('module');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const pointsProgress = getModuleProgressPercent('points', learningState);
  const linesProgress = getModuleProgressPercent('lines', learningState);
  const generatorProgress =
    learningState.scansCompleted > 0 || learningState.visitedModules.includes('generator')
      ? 100
      : 0;

  const achievements = useMemo(() => computeAchievements(learningState), [learningState]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // Chart data derived exclusively from real state (never fabricated grades)
  const chartSeries = useMemo(() => {
    if (chartMode === 'module') {
      return [
        { label: 'V1 Points', value: pointsProgress, unit: '%' },
        { label: 'V2 Lines', value: linesProgress, unit: '%' },
        { label: 'V3 Planes', value: 0, unit: '%' },
        { label: 'V4 Solids', value: 0, unit: '%' },
        { label: 'V5 Sections', value: 0, unit: '%' },
      ];
    }
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => ({
      label: d,
      value: learningState.weeklyActivity[i] || 0,
      unit: ' solved',
    }));
  }, [chartMode, pointsProgress, linesProgress, learningState.weeklyActivity]);

  const chartGeometry = useMemo(() => {
    const w = 480;
    const h = 175;
    const padL = 36;
    const padR = 20;
    const padT = 22;
    const padB = 28;
    const usableW = w - padL - padR;
    const usableH = h - padT - padB;
    const maxVal =
      chartMode === 'module'
        ? 100
        : Math.max(5, ...chartSeries.map((item) => item.value));

    const coords = chartSeries.map((item, idx) => {
      const x =
        chartSeries.length === 1
          ? padL + usableW / 2
          : padL + (idx / (chartSeries.length - 1)) * usableW;
      const y = padT + usableH - (item.value / maxVal) * usableH;
      return { ...item, x, y };
    });

    const linePath = buildSmoothSvgPath(coords);
    const baselineY = padT + usableH;
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`
        : '';

    const yTicks =
      chartMode === 'module'
        ? [0, 25, 50, 75, 100]
        : [0, Math.round(maxVal * 0.5), maxVal];

    return { w, h, padL, padR, padT, baselineY, coords, linePath, areaPath, maxVal, yTicks };
  }, [chartSeries, chartMode]);

  const getIcon = (name: string) => {
    switch (name) {
      case 'Compass':
        return <Compass className="w-4 h-4" />;
      case 'Ruler':
        return <Ruler className="w-4 h-4" />;
      case 'Square':
        return <Square className="w-4 h-4" />;
      case 'Box':
        return <Box className="w-4 h-4" />;
      case 'Scissors':
        return <Scissors className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  return (
    <div className="px-4 sm:px-7 py-6 sm:py-7 flex flex-col gap-8">
      {/* SECTION 1: Continue Learning / Active Modules */}
      <section aria-labelledby="continue-learning-heading" className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1
              id="continue-learning-heading"
              className="text-lg sm:text-xl font-bold text-[#202033] dark:text-slate-100 tracking-tight"
            >
              Continue Learning
            </h1>
            <p className="text-xs text-[#77758A] dark:text-slate-400 mt-0.5">
              Interactive 3D spatial laboratories and orthographic projection solvers
            </p>
          </div>

          <button
            type="button"
            onClick={() => onScrollToSection?.('syllabus-roadmap')}
            className="px-4 py-1.5 rounded-full border border-[#E5DFF5] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#F2EDFF] dark:hover:bg-slate-700 text-xs font-semibold text-[#6035B5] dark:text-purple-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            View Roadmap
          </button>
        </div>

        {/* 3 Active Learning Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* CARD 1: Projection of Points */}
          <div className="group rounded-[22px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(96,53,181,0.10)] hover:shadow-[0_16px_36px_-12px_rgba(96,53,181,0.18)] hover:border-[#D5C9F7] dark:hover:border-purple-700 transition-all duration-200 p-4 flex flex-col justify-between gap-4">
            <div>
              {/* 3D Illustration */}
              <div
                onClick={() => onNavigate('/projection-of-points')}
                className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-[#F2EDFF] dark:bg-slate-800 cursor-pointer"
              >
                {!imgErrors.points ? (
                  <img
                    src={pointsCardImg}
                    alt="3D Cartesian coordinate system with highlighted point P and orthographic projections"
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, points: true }))}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#6035B5] dark:text-purple-300">
                    <Compass className="w-10 h-10" />
                    <span className="text-xs font-semibold">3D Cartesian Point Space</span>
                  </div>
                )}
              </div>

              {/* Title & Progress Ring */}
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-[#202033] dark:text-slate-100 leading-snug">
                    Projection of Points
                  </h2>
                  <p className="text-xs text-[#77758A] dark:text-slate-400 mt-1.5 leading-relaxed">
                    Analyze coordinates across all 4 quadrants with synchronized 3D planes and 2D projections.
                  </p>
                </div>
                <CircularProgressRing percent={pointsProgress} />
              </div>

              <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-[#77758A] dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: hpColor }}
                  />
                  HP / VP Planes
                </span>
                <span aria-hidden="true">·</span>
                <span>Module V1</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/projection-of-points')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 hover:bg-[#7952D6] dark:hover:bg-[#7952D6] text-[#6035B5] dark:text-purple-200 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CARD 2: Projection of Straight Lines */}
          <div className="group rounded-[22px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(96,53,181,0.10)] hover:shadow-[0_16px_36px_-12px_rgba(96,53,181,0.18)] hover:border-[#D5C9F7] dark:hover:border-purple-700 transition-all duration-200 p-4 flex flex-col justify-between gap-4">
            <div>
              {/* 3D Illustration */}
              <div
                onClick={() => onNavigate('/projection-of-lines')}
                className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-[#F2EDFF] dark:bg-slate-800 cursor-pointer"
              >
                {!imgErrors.lines ? (
                  <img
                    src={linesCardImg}
                    alt="3D inclined straight line AB with HP and VP projections and inclination angles"
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, lines: true }))}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#6035B5] dark:text-purple-300">
                    <Ruler className="w-10 h-10" />
                    <span className="text-xs font-semibold">3D Inclined Straight Line</span>
                  </div>
                )}
              </div>

              {/* Title & Progress Ring */}
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-[#202033] dark:text-slate-100 leading-snug">
                    Projection of Straight Lines
                  </h2>
                  <p className="text-xs text-[#77758A] dark:text-slate-400 mt-1.5 leading-relaxed">
                    Compute True Length, θ &amp; φ inclinations, Rotating Line Method, loci, and HT/VT traces.
                  </p>
                </div>
                <CircularProgressRing percent={linesProgress} />
              </div>

              <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-[#77758A] dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: vpColor }}
                  />
                  Rotating Line &amp; Traces
                </span>
                <span aria-hidden="true">·</span>
                <span>Module V2</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/projection-of-lines')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#7952D6] hover:bg-[#6035B5] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CARD 3: Question-to-Graphics Generator */}
          <div className="group rounded-[22px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(96,53,181,0.10)] hover:shadow-[0_16px_36px_-12px_rgba(96,53,181,0.18)] hover:border-[#D5C9F7] dark:hover:border-purple-700 transition-all duration-200 p-4 flex flex-col justify-between gap-4 md:col-span-2 xl:col-span-1">
            <div>
              {/* 3D Illustration */}
              <div
                onClick={() => onNavigate('/question-generator')}
                className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-[#F2EDFF] dark:bg-slate-800 cursor-pointer"
              >
                {!imgErrors.generator ? (
                  <img
                    src={generatorCardImg}
                    alt="Engineering drawing question sheet transforming into a 3D wireframe projection diagram"
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, generator: true }))}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#6035B5] dark:text-purple-300">
                    <Layers className="w-10 h-10" />
                    <span className="text-xs font-semibold">Question-to-Graphics Engine</span>
                  </div>
                )}
              </div>

              {/* Title & Progress Ring */}
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-[#202033] dark:text-slate-100 leading-snug">
                    Question-to-Graphics Generator
                  </h2>
                  <p className="text-xs text-[#77758A] dark:text-slate-400 mt-1.5 leading-relaxed">
                    Transform textbook problems into validated geometric constraints and step-by-step drawings.
                  </p>
                </div>
                <CircularProgressRing percent={generatorProgress} />
              </div>

              <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-[#77758A] dark:text-slate-400">
                <span>Text &amp; OCR Parser</span>
                <span aria-hidden="true">·</span>
                <span>Step Replay</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/question-generator')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 hover:bg-[#7952D6] dark:hover:bg-[#7952D6] text-[#6035B5] dark:text-purple-200 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Generator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: Learning Analytics Section */}
      <section
        id="learning-analytics"
        aria-labelledby="learning-analytics-heading"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
      >
        {/* Left: Learning Progress Chart (6 cols) */}
        <div className="lg:col-span-6 rounded-[22px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(96,53,181,0.08)] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="learning-analytics-heading"
                className="text-base font-bold text-[#202033] dark:text-slate-100"
              >
                Learning Progress
              </h2>
              <p className="text-xs text-[#77758A] dark:text-slate-400 mt-0.5">
                {chartMode === 'module'
                  ? 'Completion across curriculum units (V1–V5)'
                  : 'Problems solved per day this week'}
              </p>
            </div>

            <div className="relative">
              <select
                value={chartMode}
                onChange={(e) => {
                  setChartMode(e.target.value as 'module' | 'weekly');
                  setHoveredIdx(null);
                }}
                aria-label="Select learning chart view"
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-full border border-[#E5DFF5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-800 text-xs font-semibold text-[#202033] dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7952D6]/30"
              >
                <option value="module">By Module</option>
                <option value="weekly">This Week</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#77758A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Smooth Lavender Area Spline Chart */}
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.h}`}
              className="w-full h-48 sm:h-52 overflow-visible"
              role="img"
              aria-label="Learning progress area chart"
            >
              <defs>
                <linearGradient id="edrawAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7952D6" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#F2EDFF" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Y-Axis Gridlines & Labels */}
              {chartGeometry.yTicks.map((tick) => {
                const y =
                  chartGeometry.padT +
                  (chartGeometry.baselineY - chartGeometry.padT) *
                    (1 - tick / chartGeometry.maxVal);
                return (
                  <g key={tick}>
                    <line
                      x1={chartGeometry.padL}
                      y1={y}
                      x2={chartGeometry.w - chartGeometry.padR}
                      y2={y}
                      stroke={isDark ? '#1e293b' : '#F0ECF9'}
                      strokeWidth="1"
                    />
                    <text
                      x={chartGeometry.padL - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill={isDark ? '#94a3b8' : '#77758A'}
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Area */}
              {chartGeometry.areaPath && (
                <path d={chartGeometry.areaPath} fill="url(#edrawAreaFill)" />
              )}

              {/* Smooth Curve Stroke */}
              {chartGeometry.linePath && (
                <path
                  d={chartGeometry.linePath}
                  fill="none"
                  stroke="#7952D6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Data Points + Interactive Hover */}
              {chartGeometry.coords.map((pt, idx) => {
                const isHovered = hoveredIdx === idx;
                return (
                  <g
                    key={pt.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={chartGeometry.padT}
                        x2={pt.x}
                        y2={chartGeometry.baselineY}
                        stroke="#7952D6"
                        strokeOpacity="0.35"
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#FFFFFF"
                      stroke="#7952D6"
                      strokeWidth="2.25"
                    />
                    {isHovered && (
                      <g transform={`translate(${Math.min(Math.max(pt.x - 40, 20), chartGeometry.w - 100)}, ${Math.max(pt.y - 34, 0)})`}>
                        <rect
                          width="84"
                          height="24"
                          rx="8"
                          fill="#202033"
                        />
                        <text
                          x="42"
                          y="15.5"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="600"
                        >
                          {pt.value}
                          {pt.unit}
                        </text>
                      </g>
                    )}
                    <text
                      x={pt.x}
                      y={chartGeometry.baselineY + 18}
                      textAnchor="middle"
                      fill={isDark ? '#94a3b8' : '#77758A'}
                      fontSize="10.5"
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right: KPI Strip + Recent Achievements (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-5">
          {/* Top 3 Real Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Completed Modules */}
            <div className="rounded-[20px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_28px_-12px_rgba(96,53,181,0.08)] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#77758A] dark:text-slate-400">
                  Completed Modules
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 flex items-center justify-center text-[#7952D6] shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#202033] dark:text-slate-100">
                  {learningState.completedModules.length} / {MODULE_REGISTRY.length}
                </div>
                <div className="text-[11px] text-[#77758A] dark:text-slate-400 mt-0.5">
                  2 interactive modules live
                </div>
              </div>
            </div>

            {/* Practice Problems Solved */}
            <div className="rounded-[20px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_28px_-12px_rgba(96,53,181,0.08)] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#77758A] dark:text-slate-400">
                  Problems Solved
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 flex items-center justify-center text-[#7952D6] shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#202033] dark:text-slate-100">
                  {learningState.problemsSolved}
                </div>
                <div className="text-[11px] text-[#77758A] dark:text-slate-400 mt-0.5">
                  {learningState.problemsSolved === 0
                    ? 'Solve or scan to log'
                    : 'Tracked in your session'}
                </div>
              </div>
            </div>

            {/* Learning Hours */}
            <div className="rounded-[20px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_28px_-12px_rgba(96,53,181,0.08)] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#77758A] dark:text-slate-400">
                  Learning Hours
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 flex items-center justify-center text-[#7952D6] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#202033] dark:text-slate-100">
                  {formatLearningHours(learningState.learningSeconds)}
                </div>
                <div className="text-[11px] text-[#77758A] dark:text-slate-400 mt-0.5">
                  Active studio duration
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Recent Achievements Card */}
          <div className="rounded-[22px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_28px_-12px_rgba(96,53,181,0.08)] p-5 flex-1 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#202033] dark:text-slate-100">
                Recent Achievements
              </h3>
              <span className="text-xs font-bold font-mono tabular-nums text-[#7952D6] dark:text-purple-300">
                {unlockedCount}/{achievements.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`rounded-2xl p-3 flex flex-col items-center text-center gap-2 border transition-colors ${
                    ach.unlocked
                      ? 'bg-[#F8F7FC] dark:bg-purple-950/30 border-[#E2D9FA] dark:border-purple-800/60'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 opacity-70'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      ach.unlocked
                        ? 'bg-gradient-to-br from-[#7952D6] to-[#6035B5] text-white shadow-sm'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-[#202033] dark:text-slate-100 leading-tight">
                      {ach.title}
                    </div>
                    <div className="text-[10px] text-[#77758A] dark:text-slate-400 mt-0.5 leading-tight">
                      {ach.subtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Syllabus Roadmap (V1 - V5) */}
      <section
        id="syllabus-roadmap"
        aria-labelledby="syllabus-roadmap-heading"
        className="rounded-[22px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(96,53,181,0.08)] p-5 sm:p-6 flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="syllabus-roadmap-heading"
              className="text-base sm:text-lg font-bold text-[#202033] dark:text-slate-100"
            >
              Syllabus Roadmap
            </h2>
            <p className="text-xs text-[#77758A] dark:text-slate-400 mt-0.5">
              Structured Engineering Graphics curriculum aligned with BIS SP 46:2003 &amp; ISO 128
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-[#77758A] dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7952D6]" />
              In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              Upcoming
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {MODULE_REGISTRY.map((mod) => {
            const isActive = mod.status === 'active';
            const isCompleted = learningState.completedModules.includes(mod.id);
            const statusLabel = !isActive
              ? 'Upcoming'
              : isCompleted
              ? 'Completed'
              : 'In Progress';

            return (
              <div
                key={mod.id}
                onClick={() => {
                  if (isActive) onNavigate(mod.route as AppRoute);
                }}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                  isActive
                    ? 'bg-[#FAF9FE] dark:bg-slate-800/60 border-[#E5DFF5] dark:border-slate-700 hover:border-[#7952D6] cursor-pointer'
                    : 'bg-slate-50/60 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-80'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : isActive
                          ? 'bg-[#F2EDFF] text-[#6035B5] dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-slate-200/80 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {getIcon(mod.iconName)}
                    </div>

                    <span
                      className={`text-[11px] font-semibold font-mono ${
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isActive
                          ? 'text-[#6035B5] dark:text-purple-300'
                          : 'text-[#77758A] dark:text-slate-500'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono font-semibold text-[#77758A] dark:text-slate-400">
                      {mod.code}
                    </div>
                    <h3 className="text-xs font-bold text-[#202033] dark:text-slate-100 leading-snug mt-0.5">
                      {mod.title}
                    </h3>
                    <p className="text-[11px] text-[#77758A] dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {mod.subtitle}
                    </p>
                  </div>
                </div>

                {isActive ? (
                  <div className="pt-2 border-t border-[#ECE8F8] dark:border-slate-700/70 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleModuleComplete(mod.id);
                      }}
                      className={`text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-[#77758A] hover:text-[#6035B5] dark:text-slate-400 dark:hover:text-purple-300'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                    </button>

                    <span className="text-[11px] font-semibold text-[#7952D6] dark:text-purple-300 flex items-center gap-0.5">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-[#77758A] dark:text-slate-500">
                    Planned Module
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
