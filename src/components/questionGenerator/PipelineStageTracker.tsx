/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  CircleDashed,
  ArrowRight,
} from 'lucide-react';
import type { PipelineStageName, PipelineStageTrace, StageExecutionStatus } from '../../pipeline/schema';

interface PipelineStageTrackerProps {
  stages: PipelineStageTrace[];
  isRunning: boolean;
  failedStage: string | null;
}

const CANONICAL_STAGES: ReadonlyArray<{ stage: PipelineStageName; shortLabel: string; stepNum: number }> = [
  { stage: 'stage_1_ocr', shortLabel: 'OCR Extraction', stepNum: 1 },
  { stage: 'stage_2_initial_json', shortLabel: 'Initial JSON', stepNum: 2 },
  { stage: 'stage_3_python_solver', shortLabel: 'Python Solver', stepNum: 3 },
  { stage: 'stage_4_validate_json', shortLabel: 'Update & Validate', stepNum: 4 },
  { stage: 'stage_5_render_svg', shortLabel: 'SVG Renderer', stepNum: 5 },
];

function getStatusStyles(status: StageExecutionStatus) {
  switch (status) {
    case 'completed':
      return {
        card: 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30',
        badge: 'text-emerald-700 dark:text-emerald-300',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      };
    case 'blocked':
      return {
        card: 'border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30',
        badge: 'text-amber-800 dark:text-amber-300',
        icon: <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      };
    case 'failed':
      return {
        card: 'border-rose-300 dark:border-rose-800/80 bg-rose-50/80 dark:bg-rose-950/30',
        badge: 'text-rose-700 dark:text-rose-300',
        icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
      };
    case 'running':
      return {
        card: 'border-blue-300 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-950/30',
        badge: 'text-blue-700 dark:text-blue-300',
        icon: <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />,
      };
    default:
      return {
        card: 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60',
        badge: 'text-slate-500 dark:text-slate-400',
        icon: <CircleDashed className="w-4 h-4 text-slate-400 shrink-0" />,
      };
  }
}

export const PipelineStageTracker: React.FC<PipelineStageTrackerProps> = ({
  stages,
  isRunning,
  failedStage,
}) => {
  const traceMap = new Map<PipelineStageName, PipelineStageTrace>();
  for (const s of stages) {
    traceMap.set(s.stage, s);
  }

  return (
    <div
      data-testid="pipeline-stage-tracker"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Strict 5-Stage Engineering Pipeline
        </span>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          {isRunning
            ? 'Executing sequential stages...'
            : failedStage
            ? `Halted at ${failedStage.replace(/_/g, ' ')}`
            : stages.length === 5 && stages.every((s) => s.status === 'completed')
            ? 'All 5 stages validated & rendered'
            : 'Ready'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {CANONICAL_STAGES.map((item, idx) => {
          const trace = traceMap.get(item.stage);
          const status: StageExecutionStatus = isRunning
            ? 'running'
            : trace?.status ?? 'pending';
          const styles = getStatusStyles(status);

          return (
            <div key={item.stage} className="flex items-stretch gap-1.5">
              <div
                data-testid={`stage-card-${item.stage}`}
                data-status={status}
                className={`flex-1 rounded-xl border p-2.5 transition flex flex-col justify-between gap-1 ${styles.card}`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {styles.icon}
                    <span className={`text-xs font-bold truncate ${styles.badge}`}>
                      {item.stepNum}. {item.shortLabel}
                    </span>
                  </div>
                  {trace && !isRunning && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {trace.duration_ms}ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                  {isRunning
                    ? 'Processing...'
                    : trace?.summary || 'Waiting for upstream stage'}
                </p>
              </div>
              {idx < CANONICAL_STAGES.length - 1 && (
                <div className="hidden xl:flex items-center text-slate-300 dark:text-slate-700">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
