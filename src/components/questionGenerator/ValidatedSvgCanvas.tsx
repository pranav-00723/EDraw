/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Code2,
  Compass,
} from 'lucide-react';
import type { CanonicalEngineeringProblem } from '../../pipeline/schema';
import { getMeasurementValue } from '../../pipeline/schema';
import type { LineProblemInput } from '../../types/lines';
import { computeLineProjection } from '../../utils/linesMath';
import { RotatingLineConstructionEngine } from '../../modules/lines/RotatingLineConstructionEngine';

interface ValidatedSvgCanvasProps {
  svg: string | null;
  validatedJson: CanonicalEngineeringProblem | null;
  lineInput: LineProblemInput | null;
  error: string | null;
  configurationHint?: string;
  failedStage: string | null;
  isRunning: boolean;
  hpColor: string;
  vpColor: string;
  isDark: boolean;
  onJumpToInitialJson: () => void;
}

export const ValidatedSvgCanvas: React.FC<ValidatedSvgCanvasProps> = ({
  svg,
  validatedJson,
  lineInput,
  error,
  configurationHint,
  failedStage,
  isRunning,
  hpColor,
  vpColor,
  isDark,
  onJumpToInitialJson,
}) => {
  const [renderMode, setRenderMode] = useState<'svg' | 'interactive'>('svg');

  const isValidatedReady = Boolean(
    validatedJson && validatedJson.validation.ready_for_render && svg
  );

  // Render SVG via UTF-8 data URI inside <img> so scripts can never execute in the host DOM
  const svgDataUrl = useMemo(() => {
    if (!svg) return null;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [svg]);

  const computedInteractiveLine = useMemo(() => {
    if (!isValidatedReady || !lineInput) return null;
    return computeLineProjection(lineInput);
  }, [isValidatedReady, lineInput]);

  const handleDownloadSvg = () => {
    if (!svg || !validatedJson) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label =
      validatedJson.geometry.entity_type === 'straight_line'
        ? validatedJson.geometry.line_label
        : validatedJson.problem_id;
    a.href = url;
    a.download = `EDraw_${label}_${validatedJson.problem_id}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isRunning) {
    return (
      <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3 min-h-[420px]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Running deterministic Python geometry solver &amp; validation...
        </p>
        <p className="text-xs text-slate-500">
          Drawing generation will remain locked until Stage 4 validation succeeds.
        </p>
      </div>
    );
  }

  if (!isValidatedReady) {
    const solverStatus = validatedJson?.validation.solver_status ?? 'error';
    const issues = validatedJson?.validation.issues ?? [];
    const ambiguities = validatedJson?.validation.ambiguities ?? [];
    const missingRequirements = validatedJson?.validation.missing_requirements ?? [];
    const uncertainReadings = validatedJson?.source.uncertain_readings ?? [];

    return (
      <div
        role="alert"
        data-testid="stage5-blocked-panel"
        className="p-5 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Stage 5 Drawing Blocked — Validation Gate Enforced
              </h3>
              <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                {error ||
                  validatedJson?.drawing_instructions.blocked_reason ||
                  'The problem is not uniquely and validly solved. EDraw will not fabricate missing dimensions or draw contradictory geometry.'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 shrink-0">
            {failedStage === 'stage_1_ocr' ? 'OCR FAILED' : solverStatus}
          </span>
        </div>

        {configurationHint && (
          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/70 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-bold block mb-1">OCR Configuration Note:</span>
            <span>{configurationHint}</span>
          </div>
        )}

        {uncertainReadings.length > 0 && (
          <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-800/70 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Uncertain OCR Readings (Not Silently Overwritten)
            </span>
            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {uncertainReadings.map((u) => (
                <li key={u.id} className="font-mono text-[11px]">
                  <span className="font-bold text-rose-700 dark:text-rose-300">"{u.raw_token}"</span> — {u.reason}
                  {u.suggested_interpretation && (
                    <span className="text-slate-500"> (Suggestion: {u.suggested_interpretation})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ambiguities.length > 0 && (
          <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/70 flex flex-col gap-2">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Multiple Valid Geometric Branches Detected
            </span>
            {ambiguities.map((amb) => (
              <div key={amb.id} className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <p>{amb.reason}</p>
                {amb.candidates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {amb.candidates.map((cand, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]"
                      >
                        Branch {i + 1}: {JSON.stringify(cand)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {missingRequirements.length > 0 && (
          <div
            data-testid="missing-requirements-list"
            className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/85 border border-amber-300/80 dark:border-amber-800/80 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Missing Geometric Requirements ({missingRequirements.length} Needed to Solve)
              </span>
              <span className="text-[10px] font-mono uppercase text-amber-800/80 dark:text-amber-300/80">
                Python Solver Diagnostics
              </span>
            </div>
            <ul className="space-y-2">
              {missingRequirements.map((req) => (
                <li
                  key={req.id}
                  data-testid={`missing-req-${req.parameter}`}
                  className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-slate-950/60 border border-amber-200/70 dark:border-slate-800 flex flex-col gap-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/70 text-amber-950 dark:text-amber-200 font-mono text-[10px] font-bold uppercase">
                        {req.category}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {req.label}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {req.parameter} ({req.unit})
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {req.reason}
                  </p>
                  {req.alternatives.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mr-1">
                        Or provide:
                      </span>
                      {req.alternatives.map((alt) => (
                        <span
                          key={alt}
                          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]"
                        >
                          {alt}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90 font-medium">
                    Tip: {req.example_fix}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {issues.length > 0 && (
          <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Diagnostic Issues ({issues.length})
            </span>
            <ul className="space-y-1">
              {issues.map((iss, idx) => (
                <li
                  key={`${iss.code}_${idx}`}
                  className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2"
                >
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold shrink-0">
                    {iss.code}
                  </span>
                  <span>{iss.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onJumpToInitialJson}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Edit Stage 2 Initial JSON &amp; Re-Solve in Python</span>
          </button>
        </div>
      </div>
    );
  }

  const geom = validatedJson!.geometry;
  const lineLabel = geom.entity_type === 'straight_line' ? geom.line_label : validatedJson!.problem_id;
  const startLabel = geom.entity_type === 'straight_line' ? geom.endpoints.start : 'A';
  const endLabel = geom.entity_type === 'straight_line' ? geom.endpoints.end : 'B';
  const coords = geom.entity_type === 'straight_line' ? geom.solved_coordinates : null;

  const tl = getMeasurementValue(validatedJson!, 'true_length');
  const fv = getMeasurementValue(validatedJson!, 'front_view_length');
  const tv = getMeasurementValue(validatedJson!, 'top_view_length');
  const dep = getMeasurementValue(validatedJson!, 'dep');
  const theta = getMeasurementValue(validatedJson!, 'theta_hp');
  const phi = getMeasurementValue(validatedJson!, 'phi_vp');
  const alpha = getMeasurementValue(validatedJson!, 'alpha_fv');
  const beta = getMeasurementValue(validatedJson!, 'beta_tv');

  return (
    <div className="flex flex-col gap-3">
      {/* Mode Switcher & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Line {lineLabel} — Stage 4 Validated Drawing
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
            BIS SP 46 First-Angle
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setRenderMode('svg')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                renderMode === 'svg'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Deterministic SVG</span>
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('interactive')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                renderMode === 'interactive'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>8-Step Interactive</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSvg}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-semibold transition flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {renderMode === 'svg' ? (
        <div
          data-testid="stage5-svg-preview"
          data-line-label={lineLabel}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-xs"
        >
          {svgDataUrl && (
            <img
              src={svgDataUrl}
              alt={`First-Angle Orthographic Projection of Straight Line ${lineLabel} with Front View ${startLabel.toLowerCase()}′${endLabel.toLowerCase()}′ and Top View ${startLabel.toLowerCase()}${endLabel.toLowerCase()}`}
              className="w-full h-auto block"
            />
          )}

          {/* Deterministic Coordinate & Measurement Summary Strip */}
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">True Length (TL)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {tl !== null ? `${tl.toFixed(2)} mm` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">
                FV ({coords?.front_view.start.label}{coords?.front_view.end.label}) / TV ({coords?.top_view.start.label}{coords?.top_view.end.label})
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {fv !== null ? fv.toFixed(2) : '—'} / {tv !== null ? tv.toFixed(2) : '—'} mm
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">DEP / θ / φ</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {dep !== null ? `${dep.toFixed(2)} mm` : '—'} · {theta !== null ? `${theta.toFixed(1)}°` : '—'} · {phi !== null ? `${phi.toFixed(1)}°` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">Apparent α / β</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {alpha !== null ? `${alpha.toFixed(1)}°` : '—'} / {beta !== null ? `${beta.toFixed(1)}°` : '—'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        computedInteractiveLine && (
          <RotatingLineConstructionEngine
            line={computedInteractiveLine}
            hpColor={hpColor}
            vpColor={vpColor}
            isDark={isDark}
          />
        )
      )}
    </div>
  );
};
