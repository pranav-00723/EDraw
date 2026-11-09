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
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (route: AppRoute) => void;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  hpColor,
  vpColor,
  isDark = false,
}) => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'Compass':
        return <Compass className="w-5 h-5" />;
      case 'Ruler':
        return <Ruler className="w-5 h-5" />;
      case 'Square':
        return <Square className="w-5 h-5" />;
      case 'Box':
        return <Box className="w-5 h-5" />;
      case 'Scissors':
        return <Scissors className="w-5 h-5" />;
      default:
        return <Layers className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-10 shadow-lg border border-blue-900/40">
        <div className="relative z-10 max-w-3xl flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-mono font-medium w-fit">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Interactive Engineering Graphics Learning Suite</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
            Welcome to <span className="text-blue-400">EDraw</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
            A specialized simulator for engineering students and educators. Explore 3D spatial geometry side-by-side with 2D standard orthographic projections adhering to BIS SP 46 and ISO 128 conventions.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-blue-800/60 text-xs text-slate-300 font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Dual 3D + 2D View
            </span>
            <span className="text-blue-400">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Custom HP &amp; VP Colors
            </span>
            <span className="text-blue-400">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Accurate True Length &amp; Traces
            </span>
          </div>
        </div>

        {/* Subtle geometric background motif */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden md:flex items-center justify-center">
          <Ruler className="w-72 h-72 text-white" />
        </div>
      </div>

      {/* Spotlight: Intelligent Question-to-Graphics Generator */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/40 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                NEW FEATURE
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Intelligent Question-to-Graphics Generator
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Enter any engineering drawing problem in natural language or upload a textbook photo. EDraw interprets the geometry, extracts structured data, runs deterministic math, and draws the complete 8-step Rotating Line Method projection with zero gaps and full mathematical validation!
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('/question-generator')}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 shadow-md shadow-purple-500/20"
        >
          <span>Launch AI Solver</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Modules Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
              Curriculum Modules
            </h2>
            <p className="text-xs text-slate-500">
              Select an active module or explore upcoming engineering topics
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULE_REGISTRY.map((mod) => {
            const isActive = mod.status === 'active';
            return (
              <div
                key={mod.id}
                className={`rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md cursor-pointer'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800/80 opacity-75'
                }`}
                onClick={() => {
                  if (isActive) onNavigate(mod.route as AppRoute);
                }}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                          mod.id === 'points'
                            ? 'bg-blue-600'
                            : mod.id === 'lines'
                            ? 'bg-emerald-600'
                            : 'bg-slate-400 dark:bg-slate-700'
                        }`}
                      >
                        {getIcon(mod.iconName)}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                          {mod.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                          {mod.title}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md ${
                        isActive
                          ? mod.id === 'lines'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isActive ? (mod.id === 'lines' ? 'NEW V2' : 'ACTIVE') : 'UPCOMING'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                    {mod.description}
                  </p>

                  {/* Feature Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {mod.badges.map((b, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {isActive ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(mod.route as AppRoute);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-blue-600 dark:bg-slate-800 dark:hover:bg-blue-600 text-white font-sans text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <span>Launch Module</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="w-full text-center py-1.5 text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Planned in Architecture Roadmap</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engineering Standards Reference Box */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Indian &amp; International Standards Compliance
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Built rigorously adhering to Bureau of Indian Standards (BIS SP 46:2003) and ISO 128 Engineering Drawing standards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            First Angle Projection
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            ISO / BIS Tolerances
          </span>
        </div>
      </div>
    </div>
  );
};
