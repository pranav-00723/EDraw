/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Compass, Ruler, Square, Box, Layers, Moon, Sun, LayoutDashboard, ChevronRight } from 'lucide-react';
import { PlaneColorPicker } from '../PlaneColorPicker';
import { AppRoute } from '../../types/modules';

interface AppHeaderProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  hpColor: string;
  vpColor: string;
  onChangeHpColor: (c: string) => void;
  onChangeVpColor: (c: string) => void;
  onResetColors: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentRoute,
  onNavigate,
  hpColor,
  vpColor,
  onChangeHpColor,
  onChangeVpColor,
  onResetColors,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Platform Identity */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('/dashboard')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 font-sans">
                EDraw
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                Engineering Graphics
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Interactive 3D &amp; 2D Orthographic Platform
            </p>
          </div>
        </div>

        {/* Central Module Navigation Bar */}
        <nav className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium">
          {/* Dashboard */}
          <button
            onClick={() => onNavigate('/dashboard')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              currentRoute === '/' || currentRoute === '/dashboard'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          {/* V1: Projection of Points */}
          <button
            onClick={() => onNavigate('/projection-of-points')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              currentRoute === '/projection-of-points'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <span>V1: Points</span>
          </button>

          {/* V2: Projection of Straight Lines */}
          <button
            onClick={() => onNavigate('/projection-of-lines')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              currentRoute === '/projection-of-lines'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>V2: Straight Lines</span>
            <span className="px-1 py-0.2 text-[9px] font-mono rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
              NEW
            </span>
          </button>
        </nav>

        {/* Right Tools: Plane Colors & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Custom Plane Colors Selector */}
          <PlaneColorPicker
            hpColor={hpColor}
            vpColor={vpColor}
            onChangeHpColor={onChangeHpColor}
            onChangeVpColor={onChangeVpColor}
            onResetColors={onResetColors}
            isDark={isDark}
          />

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title={isDark ? 'Switch to Technical Light Drawing Canvas' : 'Switch to CAD Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
