/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppRoute } from './types/modules';
import { AppHeader } from './components/navigation/AppHeader';
import { DashboardView } from './components/navigation/DashboardView';
import { PointsModule } from './modules/points/PointsModule';
import { LinesModule } from './modules/lines/LinesModule';
import { QuestionToGraphicsGenerator } from './components/questionGenerator/QuestionToGraphicsGenerator';
import { ScanQuestionModal } from './components/ScanQuestionModal';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Resilient route resolution supporting:
 * - Direct paths: /projection-of-points, /projection-of-lines, /dashboard, /
 * - Hash routes: #points, #lines, #projection-of-points, #projection-of-lines, #dashboard
 * - Sandboxed iframes without pushState permissions
 */
export const resolveRoute = (input?: string): AppRoute => {
  const target = (
    input ||
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.hash}`
      : '')
  ).toLowerCase();

  if (target.includes('generator') || target.includes('question') || target.includes('ai')) return '/question-generator';
  if (target.includes('line')) return '/projection-of-lines';
  if (target.includes('point')) return '/projection-of-points';
  return '/dashboard';
};

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isGlobalScanOpen, setIsGlobalScanOpen] = useState<boolean>(false);

  // Plane Colors state (HP & VP) shared across all modules
  const [hpColor, setHpColor] = useState<string>('#2563eb');
  const [vpColor, setVpColor] = useState<string>('#dc2626');

  const handleResetColors = () => {
    setHpColor('#2563eb');
    setVpColor('#dc2626');
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => resolveRoute());

  // Listen to both popstate and hashchange events for maximum sandbox/iframe compatibility
  useEffect(() => {
    const handleRouteSync = () => {
      setCurrentRoute(resolveRoute());
    };

    window.addEventListener('popstate', handleRouteSync);
    window.addEventListener('hashchange', handleRouteSync);

    return () => {
      window.removeEventListener('popstate', handleRouteSync);
      window.removeEventListener('hashchange', handleRouteSync);
    };
  }, []);

  const navigateTo = (route: AppRoute) => {
    const resolved = resolveRoute(route);
    setCurrentRoute(resolved);

    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ route: resolved }, '', resolved);
      } catch {
        // Fallback for sandboxed iframes without pushState permissions
      }
      try {
        const hashTag =
          resolved === '/question-generator'
            ? 'generator'
            : resolved === '/projection-of-lines'
            ? 'lines'
            : resolved === '/projection-of-points'
            ? 'points'
            : 'dashboard';
        if (window.location.hash.replace(/^#/, '') !== hashTag) {
          window.location.hash = hashTag;
        }
      } catch {}
    }
  };

  const [pendingScannedLine, setPendingScannedLine] = useState<any>(null);
  const [pendingScannedPoint, setPendingScannedPoint] = useState<any>(null);

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      } transition-colors duration-200 flex flex-col justify-between`}
    >
      <div>
        {/* Shared Top Navigation Bar */}
        <AppHeader
          currentRoute={currentRoute}
          onNavigate={navigateTo}
          hpColor={hpColor}
          vpColor={vpColor}
          onChangeHpColor={setHpColor}
          onChangeVpColor={setVpColor}
          onResetColors={handleResetColors}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          onOpenScanModal={() => setIsGlobalScanOpen(true)}
        />

        {/* Dynamic Route View protected by ErrorBoundary */}
        <main>
          <ErrorBoundary
            fallbackTitle="Module Interface Error"
            onReset={() => navigateTo('/dashboard')}
          >
            {currentRoute === '/question-generator' ? (
              <QuestionToGraphicsGenerator
                hpColor={hpColor}
                vpColor={vpColor}
                isDark={isDark}
                onNavigateToLineModule={(scannedLn) => {
                  setPendingScannedLine(scannedLn);
                  navigateTo('/projection-of-lines');
                }}
              />
            ) : currentRoute === '/projection-of-points' ? (
              <PointsModule
                hpColor={hpColor}
                vpColor={vpColor}
                onChangeHpColor={setHpColor}
                onChangeVpColor={setVpColor}
                isDark={isDark}
                initialPointInput={pendingScannedPoint || undefined}
              />
            ) : currentRoute === '/projection-of-lines' ? (
              <LinesModule
                hpColor={hpColor}
                vpColor={vpColor}
                onChangeHpColor={setHpColor}
                onChangeVpColor={setVpColor}
                isDark={isDark}
                initialLineInput={pendingScannedLine || undefined}
              />
            ) : (
              <DashboardView
                onNavigate={navigateTo}
                hpColor={hpColor}
                vpColor={vpColor}
                isDark={isDark}
              />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Shared Educational Engineering Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 py-6 px-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">EDraw Engineering Graphics</span>
            <span>•</span>
            <span>V1: Points &amp; V2: Straight Lines</span>
          </div>
          <div className="text-center sm:text-right">
            Adheres to BIS SP 46:2003 &amp; ISO 128 Standard Engineering Drawing Conventions
          </div>
        </div>
      </footer>

      {/* Global Multimodal Scan Question Parser Modal */}
      <ScanQuestionModal
        isOpen={isGlobalScanOpen}
        onClose={() => setIsGlobalScanOpen(false)}
        isDark={isDark}
        onApplyPoint={(scannedPt) => {
          setPendingScannedPoint(scannedPt);
          navigateTo('/projection-of-points');
        }}
        onApplyLine={(scannedLn) => {
          setPendingScannedLine(scannedLn);
          navigateTo('/projection-of-lines');
        }}
      />
    </div>
  );
}
