/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  MASTER_REGRESSION_TESTS,
} from '../../utils/regressionDataset';
import {
  parseTextToNormalizedModel,
} from '../../utils/straightLineMasterSolver';
import {
  NormalizedConstraintModel,
  RegressionTestDefinition,
} from '../../types/masterLines';
import { LineProblemInput } from '../../types/lines';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Sparkles,
  Clipboard,
  ShieldCheck,
  ChevronRight,
  Layers,
  HelpCircle,
  X,
  ArrowRight,
} from 'lucide-react';

interface MasterRegressionSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLine: (input: LineProblemInput) => void;
  isDark?: boolean;
}

export const MasterRegressionSuiteModal: React.FC<MasterRegressionSuiteModalProps> = ({
  isOpen,
  onClose,
  onApplyLine,
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<'suite' | 'tester' | 'inspector'>('suite');
  const [testResults, setTestResults] = useState<Record<string, {
    passed: boolean;
    statusMatch: boolean;
    valuesMatch: boolean;
    model: NormalizedConstraintModel;
    executionTimeMs: number;
    errorNote?: string;
  }>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);

  // Custom question tester state
  const [customText, setCustomText] = useState('');
  const [customModel, setCustomModel] = useState<NormalizedConstraintModel | null>(null);

  // Inspector model
  const [selectedModel, setSelectedModel] = useState<NormalizedConstraintModel | null>(null);

  if (!isOpen) return null;

  const runSingleTest = (test: RegressionTestDefinition) => {
    const start = performance.now();
    const model = parseTextToNormalizedModel(test.question, 'TEST_SUITE');
    const elapsed = Math.round((performance.now() - start) * 10) / 10;

    const statusMatch = model.validation_status === test.expectedStatus;
    let valuesMatch = true;

    if (test.expectedValues.trueLength !== undefined && model.true_length_mm !== null) {
      if (Math.abs(model.true_length_mm - test.expectedValues.trueLength) > 0.5) valuesMatch = false;
    }
    if (test.expectedValues.frontViewLength !== undefined && model.front_view_length_mm !== null) {
      if (Math.abs(model.front_view_length_mm - test.expectedValues.frontViewLength) > 0.5) valuesMatch = false;
    }
    if (test.expectedValues.topViewLength !== undefined && model.top_view_length_mm !== null) {
      if (Math.abs(model.top_view_length_mm - test.expectedValues.topViewLength) > 0.5) valuesMatch = false;
    }
    if (test.expectedValues.thetaDeg !== undefined && model.inclination_hp_deg !== null) {
      if (Math.abs(model.inclination_hp_deg - test.expectedValues.thetaDeg) > 0.5) valuesMatch = false;
    }
    if (test.expectedValues.phiDeg !== undefined && model.inclination_vp_deg !== null) {
      if (Math.abs(model.inclination_vp_deg - test.expectedValues.phiDeg) > 0.5) valuesMatch = false;
    }

    const passed = statusMatch && valuesMatch;

    setTestResults((prev) => ({
      ...prev,
      [test.id]: {
        passed,
        statusMatch,
        valuesMatch,
        model,
        executionTimeMs: elapsed,
      },
    }));

    return passed;
  };

  const runAllTests = () => {
    setIsRunningAll(true);
    let allPassed = true;
    MASTER_REGRESSION_TESTS.forEach((test) => {
      const ok = runSingleTest(test);
      if (!ok) allPassed = false;
    });
    setIsRunningAll(false);
  };

  const handleTestCustom = (text: string) => {
    setCustomText(text);
    if (text.trim().length > 6) {
      const model = parseTextToNormalizedModel(text, 'CLIPBOARD');
      setCustomModel(model);
      setSelectedModel(model);
    } else {
      setCustomModel(null);
    }
  };

  const handleLoadTestToCanvas = (model: NormalizedConstraintModel) => {
    if (model.candidate_solutions.length > 0) {
      const line = model.candidate_solutions[0];
      onApplyLine(line.input);
      onClose();
    }
  };

  const passCount = Object.values(testResults).filter((r) => r.passed).length;
  const totalRun = Object.keys(testResults).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Master Geometry Solver &amp; Regression Suite
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                  HEAD 1 - HEAD 4
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                10 Master Tests • Constraint Normalization • Contradiction Detection • Deterministic Solver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Batch Runner Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('suite')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'suite'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              10 Master Regression Tests ({totalRun > 0 ? `${passCount}/${MASTER_REGRESSION_TESTS.length} Passed` : 'Ready'})
            </button>
            <button
              onClick={() => setActiveTab('tester')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'tester'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Live Custom Question Solver
            </button>
            {selectedModel && (
              <button
                onClick={() => setActiveTab('inspector')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === 'inspector'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Constraint Model Inspector
              </button>
            )}
          </div>

          {activeTab === 'suite' && (
            <button
              onClick={runAllTests}
              disabled={isRunningAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs cursor-pointer transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Execute All 10 Tests</span>
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: 10 Master Regression Tests */}
          {activeTab === 'suite' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>Verified against BIS SP 46:2003 geometry and exact Euclidean straight line constraints.</span>
                <span>{totalRun > 0 ? `${passCount} of ${MASTER_REGRESSION_TESTS.length} Tests Passing (100% Target)` : 'Click Execute or Test to evaluate'}</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {MASTER_REGRESSION_TESTS.map((test) => {
                  const res = testResults[test.id];
                  const hasRun = !!res;
                  const passed = res?.passed;

                  return (
                    <div
                      key={test.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        hasRun
                          ? passed
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            TEST {test.number}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {test.question}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">
                            Expected: {test.expectedStatus}
                          </span>
                          <span>•</span>
                          <span>{test.expectedExplanation}</span>
                        </div>

                        {hasRun && (
                          <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-mono text-slate-400">
                              Time: {res.executionTimeMs}ms
                            </span>
                            <span>•</span>
                            <span className={res.statusMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 font-bold'}>
                              Status: {res.model.validation_status} ({res.statusMatch ? 'MATCH' : 'MISMATCH'})
                            </span>
                            {res.model.contradiction_explanation && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                ➔ {res.model.contradiction_explanation}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => {
                            runSingleTest(test);
                            const m = parseTextToNormalizedModel(test.question, 'TEST_SUITE');
                            setSelectedModel(m);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
                        >
                          Run Test
                        </button>

                        {hasRun && res.model.candidate_solutions.length > 0 && (
                          <button
                            onClick={() => handleLoadTestToCanvas(res.model)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                            title="Plot projections on orthographic canvas"
                          >
                            <span>Plot Canvas</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {hasRun && (
                          <button
                            onClick={() => {
                              setSelectedModel(res.model);
                              setActiveTab('inspector');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Inspect Normalized Constraint Model"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                        )}

                        {hasRun && (
                          passed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Live Custom Question Tester */}
          {activeTab === 'tester' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Type or Paste Any Engineering Graphics Question:</span>
                  <span className="text-[11px] font-normal text-slate-400">Natural language, abbreviations, mixed formats</span>
                </label>
                <textarea
                  rows={3}
                  value={customText}
                  onChange={(e) => handleTestCustom(e.target.value)}
                  placeholder="e.g. A Line PQ 80mm long is inclined at 30 degrees to the HP and parallel to the VP. Point P is 25mm above HP and 20mm in front of VP. Draw its projections."
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sample Quick Questions to click */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px]">Quick Samples:</span>
                <button
                  type="button"
                  onClick={() => handleTestCustom('Draw the projection of a line AB 50mm long, parallel to VP and perpendicular to HP. Point A is 30mm above HP and 25mm in front of VP.')}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                >
                  s5.png (50mm Perp HP)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestCustom('A Line AB 25mm is parallel to the VP and perpendicular to the HP. Point A is 35mm above the HP and 20mm in front of the VP. B is 10 mm above the HP.')}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                >
                  qn.jfif (25mm Perp HP)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestCustom('A 100 mm line has a top-view length of 60 mm and a front-view length of 80 mm.')}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                >
                  TEST 9 (Zero DEP)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestCustom('A line has true length 50 mm and a top-view length of 60 mm.')}
                  className="px-2 py-1 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-mono text-[11px]"
                >
                  TEST 4 (Contradiction)
                </button>
              </div>

              {customModel && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {customModel.categoryTitle}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        customModel.validation_status === 'VALID'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : customModel.validation_status === 'INCONSISTENT_CONSTRAINTS'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {customModel.validation_status}
                      </span>
                    </div>

                    {customModel.candidate_solutions.length > 0 && (
                      <button
                        onClick={() => handleLoadTestToCanvas(customModel)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <span>Apply &amp; Plot on Canvas</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {customModel.contradiction_explanation && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                      <strong>Contradiction Detected: </strong> {customModel.contradiction_explanation}
                    </div>
                  )}

                  {customModel.missing_constraints_explanation && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300">
                      <strong>Underdetermined Notice: </strong> {customModel.missing_constraints_explanation}
                    </div>
                  )}

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">True Length</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{customModel.true_length_mm ?? '—'} mm</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">θ (HP) / φ (VP)</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {customModel.inclination_hp_deg ?? '0'}° / {customModel.inclination_vp_deg ?? '0'}°
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">Front View (EL)</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {customModel.candidate_solutions[0]?.frontViewLength?.toFixed(1) ?? '—'} mm
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">Top View (PL)</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {customModel.candidate_solutions[0]?.topViewLength?.toFixed(1) ?? '—'} mm
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Normalized Constraint Model Inspector */}
          {activeTab === 'inspector' && selectedModel && (
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Normalized Constraint Model Specification (HEAD 2)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Internal normalized representation shared by Manual, OCR, and Clipboard pipelines.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {selectedModel.category}
                </span>
              </div>

              {/* Grid of normalized parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Line Entities</span>
                  <div>Name: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.endpoint_A.name}{selectedModel.endpoint_B.name}</strong></div>
                  <div>True Length: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.true_length_mm ?? 'null'} mm</strong></div>
                  <div>Input Mode: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.input_mode}</strong></div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Endpoint A Coordinates</span>
                  <div>Z (HP): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.endpoint_A.distHp ?? 'null'} mm ({selectedModel.endpoint_A.hpRelation ?? 'null'})</strong></div>
                  <div>Y (VP): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.endpoint_A.distVp ?? 'null'} mm ({selectedModel.endpoint_A.vpRelation ?? 'null'})</strong></div>
                  <div>X: <strong className="text-slate-800 dark:text-slate-200">0 mm (reference)</strong></div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Endpoint B Coordinates</span>
                  <div>Z (HP): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.endpoint_B.distHp ?? 'null'} mm ({selectedModel.endpoint_B.hpRelation ?? 'null'})</strong></div>
                  <div>Y (VP): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.endpoint_B.distVp ?? 'null'} mm ({selectedModel.endpoint_B.vpRelation ?? 'null'})</strong></div>
                  <div>DEP (dX): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.dep_projector_distance_mm ?? 'null'} mm</strong></div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Angles &amp; Inclinations</span>
                  <div>θ (HP): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.inclination_hp_deg ?? 'null'}°</strong></div>
                  <div>φ (VP): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.inclination_vp_deg ?? 'null'}°</strong></div>
                  <div>α (Apparent FV): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.front_view_angle_deg ?? 'null'}°</strong></div>
                  <div>β (Apparent TV): <strong className="text-slate-800 dark:text-slate-200">{selectedModel.top_view_angle_deg ?? 'null'}°</strong></div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Traces (SL-12 / TEST 8)</span>
                  <div>HT: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.known_traces.ht?.exists ? (selectedModel.known_traces.ht.isFiniteSegment ? 'Finite Segment Pierces HP' : 'Infinite Extension Pierces HP') : 'No HT (Parallel to HP)'}</strong></div>
                  <div>VT: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.known_traces.vt?.exists ? (selectedModel.known_traces.vt.isFiniteSegment ? 'Finite Segment Pierces VP' : 'Infinite Extension Pierces VP') : 'No VT (Parallel to VP)'}</strong></div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Degrees of Freedom &amp; Validation</span>
                  <div>Status: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.validation_status}</strong></div>
                  <div>Degrees of Freedom: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.degrees_of_freedom}</strong></div>
                  <div>Valid Solutions: <strong className="text-slate-800 dark:text-slate-200">{selectedModel.solution_count}</strong></div>
                </div>
              </div>

              {/* Step-by-Step Construction Procedure */}
              <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-sans">
                  Construction Sequence ({selectedModel.construction_method} Method):
                </span>
                <div className="space-y-1.5 font-sans">
                  {selectedModel.construction_steps.map((st) => (
                    <div key={st.step} className="flex items-start gap-2 text-xs">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        Step {st.step}:
                      </span>
                      <div>
                        <strong>{st.title}</strong> — {st.description} <span className="text-[10px] font-mono text-slate-400">[{st.pencilGrade} • {st.tool}]</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
