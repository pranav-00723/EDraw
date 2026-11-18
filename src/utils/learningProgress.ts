/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LearningState {
  studentName: string;
  visitedModules: string[];
  completedModules: string[];
  problemsSolved: number;
  scansCompleted: number;
  learningSeconds: number;
  weeklyActivity: number[]; // Mon (0) .. Sun (6)
  lastUpdated: string;
}

const STORAGE_KEY = 'edraw_learning_state_v1';

export const DEFAULT_LEARNING_STATE: LearningState = {
  studentName: 'Student',
  visitedModules: [],
  completedModules: [],
  problemsSolved: 0,
  scansCompleted: 0,
  learningSeconds: 0,
  weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
  lastUpdated: new Date().toISOString(),
};

export function loadLearningState(): LearningState {
  if (typeof window === 'undefined') return DEFAULT_LEARNING_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LEARNING_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LEARNING_STATE,
      ...parsed,
      visitedModules: Array.isArray(parsed.visitedModules) ? parsed.visitedModules : [],
      completedModules: Array.isArray(parsed.completedModules) ? parsed.completedModules : [],
      weeklyActivity:
        Array.isArray(parsed.weeklyActivity) && parsed.weeklyActivity.length === 7
          ? parsed.weeklyActivity
          : [0, 0, 0, 0, 0, 0, 0],
    };
  } catch {
    return DEFAULT_LEARNING_STATE;
  }
}

export function saveLearningState(state: LearningState): LearningState {
  const next = { ...state, lastUpdated: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors in sandboxed iframes
    }
  }
  return next;
}

export function getTodayWeekdayIndex(): number {
  const day = new Date().getDay(); // 0 = Sun, 1 = Mon .. 6 = Sat
  return day === 0 ? 6 : day - 1;
}

export function formatLearningHours(seconds: number): string {
  if (seconds <= 0) return '0.0 hrs';
  const hours = seconds / 3600;
  if (hours < 0.1) {
    const mins = Math.max(1, Math.round(seconds / 60));
    return `${mins} min`;
  }
  return `${hours.toFixed(1)} hrs`;
}

export function getModuleProgressPercent(moduleId: string, state: LearningState): number {
  if (state.completedModules.includes(moduleId)) return 100;
  if (state.visitedModules.includes(moduleId)) return 50;
  return 0;
}

export interface AchievementItem {
  id: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
}

export function computeAchievements(state: LearningState): AchievementItem[] {
  return [
    {
      id: 'points-explorer',
      title: 'Point Explorer',
      subtitle: 'Open Projection of Points',
      unlocked: state.visitedModules.includes('points'),
    },
    {
      id: 'line-constructor',
      title: 'Line Constructor',
      subtitle: 'Open Straight Lines Lab',
      unlocked: state.visitedModules.includes('lines'),
    },
    {
      id: 'problem-solver',
      title: 'Problem Solver',
      subtitle: 'Solve or scan a problem',
      unlocked: state.problemsSolved > 0 || state.scansCompleted > 0,
    },
    {
      id: 'module-master',
      title: 'Module Complete',
      subtitle: 'Complete any syllabus unit',
      unlocked: state.completedModules.length > 0,
    },
  ];
}
