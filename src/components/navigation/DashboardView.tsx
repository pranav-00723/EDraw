/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MODULE_REGISTRY, AppRoute } from '../../types/modules';
import {
  Compass,
  Ruler,
  Square,
  Box,
  Scissors,
  ArrowRight,
  Camera,
  FileText,
  BookOpen,
  Layers,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (route: AppRoute) => void;
  onOpenScanModal?: () => void;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenScanModal,
  hpColor,
  vpColor,
}) => {
  const activeModules = MODULE_REGISTRY.filter((m) => m.status === 'active');
  const upcomingModules = MODULE_REGISTRY.filter((m) => m.status === 'upcoming');

  const getIcon = (name: string) => {
    switch (name) {
      case 'Compass':
        return <Compass className="w-5 h-5" />;
      case 'Ruler':
        return <Ruler className="w-5 h-5" />;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-12 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Section 1: Drafting Studio Hero */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>First-Angle Projection</span>
            <span aria-hidden="true">·</span>
            <span>BIS SP 46:2003</span>
            <span aria-hidden="true">·</span>
            <span>ISO 128</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.12] [text-wrap:balance]">
            Spatial geometry, drafted to engineering standard.
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            Inspect 3D Cartesian space side-by-side with 2D orthographic projections. Built for students and educators working with Points, Straight Lines, Rotating Line constructions, and Traces.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          {/* Primary & Secondary Action Cluster */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/projection-of-lines')}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors duration-150 flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span>Projection of Straight Line</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/projection-of-points')}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors duration-150 flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span>Projection of Points</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onOpenScanModal && (
              <button
                type="button"
                onClick={onOpenScanModal}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-400 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Scan Problem</span>
              </button>
            )}
          </div>

          {/* Quiet Reference Summary Strip */}
          <div className="grid grid-cols-3 gap-6 sm:gap-8 shrink-0">
            <div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                3D + 2D
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Synchronized Views
              </div>
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                4 Quadrants
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                HP &amp; VP Solver
              </div>
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                HT · VT
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Loci &amp; Traces
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Active Interactive Workspaces */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Active Drafting Modules
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Interactive 3D spatial engines paired with BIS-compliant 2D orthographic sheets
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            2 Simulation Labs · 1 Problem Generator
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeModules.map((mod) => {
            const isLines = mod.id === 'lines';
            return (
              <div
                key={mod.id}
                onClick={() => onNavigate(mod.route as AppRoute)}
                className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-150 cursor-pointer"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                        isLines ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                    >
                      {getIcon(mod.iconName)}
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Module {mod.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      {mod.subtitle}
                    </p>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {mod.badges.join(' · ')}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(mod.route as AppRoute);
                    }}
                    className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-blue-600 dark:bg-slate-800 dark:hover:bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    <span>Launch {mod.code} Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Question-to-Graphics Generator Card */}
          <div
            onClick={() => onNavigate('/question-generator')}
            className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Parser Lab
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Question-to-Graphics Generator
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Text, Textbook OCR &amp; Rotating Line Constructions
                </p>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Parse university exam questions into structured geometric constraints, inspect step-by-step construction diagrams, or send parameters directly into the 3D studio.
              </p>
            </div>

            <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Textbook Presets · Constraint Validator · Step Replay
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('/question-generator');
                }}
                className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-blue-600 dark:bg-slate-800 dark:hover:bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <span>Open Question Generator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Syllabus Roadmap & Standards */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Syllabus Roadmap
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planned engineering graphics modules (V3–V5) · BIS SP 46:2003 &amp; ISO 128
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                style={{ backgroundColor: hpColor }}
              />
              HP Plane
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                style={{ backgroundColor: vpColor }}
              />
              VP Plane
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {upcomingModules.map((mod) => (
            <div key={mod.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(mod.iconName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {mod.code}. {mod.title}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                    Upcoming
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {mod.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
