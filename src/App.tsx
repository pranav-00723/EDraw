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
import { ScanQuestionModal } from './components/ScanQuestionModal';

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

  // URL / Route state with popstate listener for clean browser history support
  const getInitialRoute = (): AppRoute => {
    if (typeof window === 'undefined') return '/dashboard';
    const path = window.location.pathname;
    const hash = window.location.hash;

    if (path === '/projection-of-points' || hash === '#points') return '/projection-of-points';
    if (path === '/projection-of-lines' || hash === '#lines') return '/projection-of-lines';
    if (path === '/dashboard' || hash === '#dashboard') return '/dashboard';
    // Default to dashboard or points if root
    return '/dashboard';
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', route);
      } catch (e) {
        // Fallback for sandboxed iframes without pushState permission
        window.location.hash = route.replace('/', '');
      }
    }
  };

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

        {/* Dynamic Route View */}
        <main>
          {(currentRoute === '/' || currentRoute === '/dashboard') && (
            <DashboardView
              onNavigate={navigateTo}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
            />
          )}

          {currentRoute === '/projection-of-points' && (
            <PointsModule
              hpColor={hpColor}
              vpColor={vpColor}
              onChangeHpColor={setHpColor}
              onChangeVpColor={setVpColor}
              isDark={isDark}
            />
          )}

          {currentRoute === '/projection-of-lines' && (
            <LinesModule
              hpColor={hpColor}
              vpColor={vpColor}
              onChangeHpColor={setHpColor}
              onChangeVpColor={setVpColor}
              isDark={isDark}
            />
          )}
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
        onApplyPoint={() => {
          navigateTo('/projection-of-points');
        }}
        onApplyLine={() => {
          navigateTo('/projection-of-lines');
        }}
      />
    </div>
  );
}
