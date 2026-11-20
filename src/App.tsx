/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppRoute } from './types/modules';
import { AppHeader } from './components/navigation/AppHeader';
import { AppSidebar, SidebarSectionId } from './components/navigation/AppSidebar';
import { SettingsModal } from './components/navigation/SettingsModal';
import { DashboardView } from './components/navigation/DashboardView';
import { PointsModule } from './modules/points/PointsModule';
import { LinesModule } from './modules/lines/LinesModule';
import { QuestionToGraphicsGenerator } from './components/questionGenerator/QuestionToGraphicsGenerator';
import { ScanQuestionModal } from './components/ScanQuestionModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  LearningState,
  DEFAULT_LEARNING_STATE,
  loadLearningState,
  saveLearningState,
  getTodayWeekdayIndex,
} from './utils/learningProgress';

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

  if (target.includes('generator') || target.includes('question') || target.includes('ai')) {
    return '/question-generator';
  }
  if (target.includes('line')) return '/projection-of-lines';
  if (target.includes('point')) return '/projection-of-points';
  return '/dashboard';
};

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isGlobalScanOpen, setIsGlobalScanOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('edraw_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('edraw_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Plane Colors state (HP & VP) shared across all modules
  const [hpColor, setHpColor] = useState<string>('#2563eb');
  const [vpColor, setVpColor] = useState<string>('#dc2626');

  const handleResetColors = () => {
    setHpColor('#2563eb');
    setVpColor('#dc2626');
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => resolveRoute());
  const [dashboardAnchor, setDashboardAnchor] = useState<'dashboard' | 'roadmap' | 'progress'>('dashboard');

  // Real session & localStorage learning progress
  const [learningState, setLearningState] = useState<LearningState>(() => loadLearningState());

  const updateLearning = useCallback((updater: (prev: LearningState) => LearningState) => {
    setLearningState((prev) => saveLearningState(updater(prev)));
  }, []);

  // Track module visits automatically on route change
  useEffect(() => {
    const visitedId =
      currentRoute === '/projection-of-points'
        ? 'points'
        : currentRoute === '/projection-of-lines'
        ? 'lines'
        : currentRoute === '/question-generator'
        ? 'generator'
        : null;

    if (visitedId) {
      updateLearning((prev) => {
        if (prev.visitedModules.includes(visitedId)) return prev;
        return {
          ...prev,
          visitedModules: [...prev.visitedModules, visitedId],
        };
      });
    }
  }, [currentRoute, updateLearning]);

  // Track active studio duration cleanly while user works in any module
  useEffect(() => {
    if (currentRoute === '/dashboard' || currentRoute === '/') return;
    const interval = window.setInterval(() => {
      updateLearning((prev) => ({
        ...prev,
        learningSeconds: prev.learningSeconds + 15,
      }));
    }, 15000);
    return () => window.clearInterval(interval);
  }, [currentRoute, updateLearning]);

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

  const navigateTo = useCallback((route: AppRoute) => {
    const resolved = resolveRoute(route);
    setCurrentRoute(resolved);
    if (resolved !== '/dashboard') {
      setDashboardAnchor('dashboard');
    }

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
  }, []);

  const scrollToDashboardSection = useCallback((sectionId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const handleSelectSidebarSection = useCallback(
    (section: SidebarSectionId, route?: AppRoute) => {
      if (section === 'roadmap') {
        setDashboardAnchor('roadmap');
        navigateTo('/dashboard');
        scrollToDashboardSection('syllabus-roadmap');
        return;
      }
      if (section === 'progress') {
        setDashboardAnchor('progress');
        navigateTo('/dashboard');
        scrollToDashboardSection('learning-analytics');
        return;
      }
      if (section === 'dashboard') {
        setDashboardAnchor('dashboard');
        navigateTo('/dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (route) {
        navigateTo(route);
      }
    },
    [navigateTo, scrollToDashboardSection]
  );

  const activeSidebarSection: SidebarSectionId = isSettingsOpen
    ? 'settings'
    : currentRoute === '/projection-of-points'
    ? 'points'
    : currentRoute === '/projection-of-lines'
    ? 'lines'
    : currentRoute === '/question-generator'
    ? 'generator'
    : dashboardAnchor;

  const handleRecordProblemSolved = useCallback(() => {
    const todayIdx = getTodayWeekdayIndex();
    updateLearning((prev) => {
      const nextWeekly = [...prev.weeklyActivity];
      nextWeekly[todayIdx] = (nextWeekly[todayIdx] || 0) + 1;
      return {
        ...prev,
        problemsSolved: prev.problemsSolved + 1,
        scansCompleted: prev.scansCompleted + 1,
        weeklyActivity: nextWeekly,
      };
    });
  }, [updateLearning]);

  const handleToggleModuleComplete = useCallback(
    (moduleId: string) => {
      updateLearning((prev) => {
        const exists = prev.completedModules.includes(moduleId);
        return {
          ...prev,
          completedModules: exists
            ? prev.completedModules.filter((id) => id !== moduleId)
            : [...prev.completedModules, moduleId],
        };
      });
    },
    [updateLearning]
  );

  const [pendingScannedLine, setPendingScannedLine] = useState<any>(null);
  const [pendingScannedPoint, setPendingScannedPoint] = useState<any>(null);

  return (
    <div
      className={`min-h-screen font-['Space_Grotesk',sans-serif] ${
        isDark
          ? 'dark bg-slate-950 text-slate-100'
          : 'bg-[#F8F7FC] text-[#202044]'
      } transition-colors duration-200`}
    >
      <div className="max-w-[1600px] mx-auto min-h-screen flex">
        {/* Vertical Purple Gradient Sidebar */}
        <AppSidebar
          activeSection={activeSidebarSection}
          onSelectSection={handleSelectSidebarSection}
          onOpenScanModal={() => setIsGlobalScanOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
        />

        {/* Rounded Main Workspace Shell */}
        <div className="flex-1 min-w-0 p-2 sm:p-3 lg:p-4 flex flex-col">
          <div className="flex-1 rounded-[26px] bg-white dark:bg-slate-900 border border-[#ECE8F8] dark:border-slate-800 shadow-[0_20px_60px_-15px_rgba(96,53,181,0.08)] flex flex-col justify-between overflow-x-hidden">
            <div>
              {/* Workspace Top Header */}
              <AppHeader
                currentRoute={currentRoute}
                onNavigate={navigateTo}
                onSelectSection={handleSelectSidebarSection}
                studentName={learningState.studentName}
                hpColor={hpColor}
                vpColor={vpColor}
                onChangeHpColor={setHpColor}
                onChangeVpColor={setVpColor}
                onResetColors={handleResetColors}
                isDark={isDark}
                onToggleTheme={() => setIsDark(!isDark)}
                onOpenScanModal={() => setIsGlobalScanOpen(true)}
                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
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
                        handleRecordProblemSolved();
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
                      onOpenScanModal={() => setIsGlobalScanOpen(true)}
                      hpColor={hpColor}
                      vpColor={vpColor}
                      isDark={isDark}
                      learningState={learningState}
                      onToggleModuleComplete={handleToggleModuleComplete}
                      onScrollToSection={scrollToDashboardSection}
                    />
                  )}
                </ErrorBoundary>
              </main>
            </div>

            {/* Clean Educational Standards Footer */}
            <footer className="mt-6 border-t border-[#F0ECF9] dark:border-slate-800 py-4 px-5 sm:px-7 text-xs text-[#77758A] dark:text-slate-400">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#202033] dark:text-slate-200">
                    EDraw Engineering Graphics
                  </span>
                  <span>·</span>
                  <span>V1 Points · V2 Straight Lines</span>
                </div>
                <div className="text-center sm:text-right">
                  Adheres to BIS SP 46:2003 &amp; ISO 128 Standard Engineering Drawing Conventions
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* Global Multimodal Scan Question Parser Modal */}
      <ScanQuestionModal
        isOpen={isGlobalScanOpen}
        onClose={() => setIsGlobalScanOpen(false)}
        isDark={isDark}
        onApplyPoint={(scannedPt) => {
          setPendingScannedPoint(scannedPt);
          handleRecordProblemSolved();
          navigateTo('/projection-of-points');
        }}
        onApplyLine={(scannedLn) => {
          setPendingScannedLine(scannedLn);
          handleRecordProblemSolved();
          navigateTo('/projection-of-lines');
        }}
      />

      {/* Workspace Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        studentName={learningState.studentName}
        onChangeStudentName={(name) =>
          updateLearning((prev) => ({ ...prev, studentName: name }))
        }
        hpColor={hpColor}
        vpColor={vpColor}
        onChangeHpColor={setHpColor}
        onChangeVpColor={setVpColor}
        onResetColors={handleResetColors}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onResetProgress={() =>
          setLearningState(saveLearningState(DEFAULT_LEARNING_STATE))
        }
      />
    </div>
  );
}
