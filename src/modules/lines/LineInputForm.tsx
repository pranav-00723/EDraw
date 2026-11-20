/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LineProblemInput,
  EndPointSpec,
  TargetQuadrantB,
} from '../../types/lines';
import {
  FlexibleLineInput,
  createDefaultFlexibleInput,
  solveFlexibleLineInput,
} from '../../utils/flexibleLineSolver';
import { FlexibleLineInputForm } from './FlexibleLineInputForm';
import {
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Settings2,
} from 'lucide-react';

interface LineInputFormProps {
  input: LineProblemInput;
  onChange: (updated: LineProblemInput) => void;
  onReset: () => void;
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
}

export const LineInputForm: React.FC<LineInputFormProps> = ({
  input,
  onChange,
  onReset,
  hpColor,
  vpColor,
}) => {
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(true);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState<boolean>(false);
  const [isFlexibleView, setIsFlexibleView] = useState<boolean>(true);
  const [flexInput, setFlexInput] = useState<FlexibleLineInput>(() =>
    createDefaultFlexibleInput()
  );
  const [flexWarnings, setFlexWarnings] = useState<string[]>([]);
  const [flexErrors, setFlexErrors] = useState<string[]>([]);

  const handleSolveFlexible = () => {
    const result = solveFlexibleLineInput(flexInput, input.color);
    setFlexWarnings(result.warnings);
    setFlexErrors(result.errors);
    if (result.errors.length === 0) {
      onChange(result.lineInput);
    }
  };

  const handleClearFlexible = () => {
    setFlexInput({
      end1: { name: 'A', hpRelation: '', distanceHp: '', vpRelation: '', distanceVp: '' },
      end2: { name: 'B', hpRelation: '', distanceHp: '', vpRelation: '', distanceVp: '' },
      trueLength: '',
      thetaDeg: '',
      phiDeg: '',
      frontViewLength: '',
      topViewLength: '',
      alphaDeg: '',
      betaDeg: '',
      dep: '',
      htVpRelation: '',
      htDistanceVp: '',
      vtHpRelation: '',
      vtDistanceHp: '',
    });
    setFlexWarnings([]);
    setFlexErrors([]);
  };

  const updateField = <K extends keyof LineProblemInput>(
    field: K,
    value: LineProblemInput[K]
  ) => {
    onChange({ ...input, [field]: value });
  };

  const updateEndA = (keyOrUpdates: string | Partial<EndPointSpec>, value?: any) => {
    if (typeof keyOrUpdates === 'string') {
      onChange({
        ...input,
        endA: { ...input.endA, [keyOrUpdates]: value },
      });
    } else {
      onChange({
        ...input,
        endA: { ...input.endA, ...keyOrUpdates },
      });
    }
  };

  const updateEndB = (keyOrUpdates: string | Partial<EndPointSpec>, value?: any) => {
    if (typeof keyOrUpdates === 'string') {
      onChange({
        ...input,
        endB: { ...input.endB, [keyOrUpdates]: value },
      });
    } else {
      onChange({
        ...input,
        endB: { ...input.endB, ...keyOrUpdates },
      });
    }
  };

  // Check mathematical viability for true angles
  const thetaRad = (input.thetaDeg * Math.PI) / 180;
  const phiRad = (input.phiDeg * Math.PI) / 180;
  const angleConditionSum =
    Math.sin(thetaRad) * Math.sin(thetaRad) + Math.sin(phiRad) * Math.sin(phiRad);
  const isAngleConditionViolated = input.mode === 'TRUE_LENGTH_ANGLES' && angleConditionSum > 1.0001;

  // For apparent values mode: compute preview of TL and apparent angles
  const el = input.frontViewLength || 70;
  const pl = input.topViewLength || 60;
  const dep = input.dep !== undefined ? input.dep : 40;
  const previewMaxDep = Math.min(el, pl);
  const previewDep = Math.min(dep, previewMaxDep);
  const previewDz = Math.sqrt(Math.max(0, el * el - previewDep * previewDep));
  const previewDy = Math.sqrt(Math.max(0, pl * pl - previewDep * previewDep));
  const previewTL = Math.sqrt(previewDep * previewDep + previewDz * previewDz + previewDy * previewDy);
  const previewAlpha = el > 0 ? (Math.acos(Math.min(1, previewDep / el)) * 180) / Math.PI : 0;
  const previewBeta = pl > 0 ? (Math.acos(Math.min(1, previewDep / pl)) * 180) / Math.PI : 0;
  const isDepTooLarge = dep > previewMaxDep;

  const hiddenOptionCount = (input.hiddenA ? 1 : 0) + (input.hiddenB ? 1 : 0);

  const inputCls =
    'w-full h-8 px-2.5 text-xs font-mono font-semibold tabular-nums rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-950/60 text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  const selectCls =
    'w-full h-8 px-2 text-xs font-medium rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-950/60 text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none cursor-pointer transition-all';

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] overflow-hidden flex flex-col">
      {/* Header (Matches Projection of Points Input Parameters) */}
      <div className="px-4 py-3.5 border-b border-[#F0ECF9] dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-[#202044] dark:text-slate-100 leading-tight truncate">
              Input Parameters
            </h2>
            <p className="text-[11px] text-[#77758F] dark:text-slate-400 leading-tight truncate">
              Line {input.nameA}{input.nameB} Specifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="px-2 py-1 rounded-lg bg-[#F8F7FC] dark:bg-slate-800 hover:bg-[#F1EBFF] dark:hover:bg-purple-950/50 text-[#77758F] hover:text-[#7138E8] dark:text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap border border-[#E8E2F5] dark:border-slate-700"
            title="Reset to default problem"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPanelExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[#F8F7FC] dark:hover:bg-slate-800 text-[#77758F] dark:text-slate-400 transition-colors cursor-pointer"
            aria-label={isPanelExpanded ? 'Collapse input parameters' : 'Expand input parameters'}
          >
            {isPanelExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isPanelExpanded && (
        <div className="p-4 space-y-4">
          {/* Input Mode Selector (4 Formulations) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                Problem Input Method
              </span>
              <span className="text-[11px] text-[#77758F] dark:text-slate-400">
                Choose formulation
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-[#F8F7FC] dark:bg-slate-800/80 border border-[#E8E2F5] dark:border-slate-700 p-1.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setIsFlexibleView(true)}
                className={`py-2 px-2 rounded-lg transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isFlexibleView
                    ? 'bg-gradient-to-r from-[#7138E8] to-[#9565F5] text-white shadow-xs font-semibold'
                    : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                }`}
              >
                <span className="font-semibold leading-tight">All Parameters</span>
                <span className="text-[10px] opacity-85">Enter any knowns</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFlexibleView(false);
                  updateField('mode', 'APPARENT_VALUES');
                }}
                className={`py-2 px-2 rounded-lg transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  !isFlexibleView && input.mode === 'APPARENT_VALUES'
                    ? 'bg-gradient-to-r from-[#7138E8] to-[#9565F5] text-white shadow-xs font-semibold'
                    : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                }`}
              >
                <span className="font-semibold leading-tight">Apparent Values</span>
                <span className="text-[10px] opacity-85">Find TL &amp; Quadrants</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFlexibleView(false);
                  updateField('mode', 'TRUE_LENGTH_ANGLES');
                }}
                className={`py-2 px-2 rounded-lg transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  !isFlexibleView && input.mode === 'TRUE_LENGTH_ANGLES'
                    ? 'bg-gradient-to-r from-[#7138E8] to-[#9565F5] text-white shadow-xs font-semibold'
                    : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                }`}
              >
                <span className="font-semibold leading-tight">True Length &amp; Angles</span>
                <span className="text-[10px] opacity-85">TL, θ, φ given</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFlexibleView(false);
                  updateField('mode', 'END_POINTS');
                }}
                className={`py-2 px-2 rounded-lg transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  !isFlexibleView && input.mode === 'END_POINTS'
                    ? 'bg-gradient-to-r from-[#7138E8] to-[#9565F5] text-white shadow-xs font-semibold'
                    : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                }`}
              >
                <span className="font-semibold leading-tight">End Points &amp; DEP</span>
                <span className="text-[10px] opacity-85">Both ends fixed</span>
              </button>
            </div>
          </div>

          {isFlexibleView ? (
            <FlexibleLineInputForm
              value={flexInput}
              onChange={setFlexInput}
              onSolve={handleSolveFlexible}
              onClear={handleClearFlexible}
              warnings={flexWarnings}
              errors={flexErrors}
              hpColor={hpColor}
              vpColor={vpColor}
            />
          ) : (
            <div className="space-y-4">
              {/* Line Identification */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#F8F7FC] dark:bg-slate-950/50 border border-[#E8E2F5] dark:border-slate-800">
                <div>
                  <label className="text-[11px] font-semibold text-[#77758F] dark:text-slate-400 block mb-1">
                    End Point 1 Name
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={input.nameA}
                    onChange={(e) => updateField('nameA', e.target.value.toUpperCase())}
                    className="w-full h-8 px-2.5 text-xs font-bold font-mono uppercase rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#77758F] dark:text-slate-400 block mb-1">
                    End Point 2 Name
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={input.nameB}
                    onChange={(e) => updateField('nameB', e.target.value.toUpperCase())}
                    className="w-full h-8 px-2.5 text-xs font-bold font-mono uppercase rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none"
                  />
                </div>
              </div>

              {/* End Point A Specifications */}
              <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                    Position of End {input.nameA} (Reference End)
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300">
                    x = 0
                  </span>
                </div>

                {/* End A with HP */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#202044] dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                      <span>Relative to HP</span>
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200 select-none">
                      <input
                        type="checkbox"
                        checked={input.endA.hpRelation === 'ON'}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          updateEndA({
                            hpRelation: isChecked ? 'ON' : 'ABOVE',
                            distanceHp: isChecked ? 0 : (input.endA.distanceHp === 0 ? 30 : input.endA.distanceHp),
                          });
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#7138E8] cursor-pointer"
                      />
                      <span className={input.endA.hpRelation === 'ON' ? 'font-semibold text-[#7138E8] dark:text-purple-300' : ''}>
                        On HP
                      </span>
                    </label>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 transition-opacity ${input.endA.hpRelation === 'ON' ? 'opacity-60' : ''}`}>
                    <select
                      value={input.endA.hpRelation}
                      onChange={(e) => {
                        const val = e.target.value as 'ABOVE' | 'BELOW' | 'ON';
                        if (val === 'ON') {
                          updateEndA({ hpRelation: 'ON', distanceHp: 0 });
                        } else {
                          updateEndA({
                            hpRelation: val,
                            distanceHp: input.endA.distanceHp === 0 ? 30 : input.endA.distanceHp,
                          });
                        }
                      }}
                      className={selectCls}
                    >
                      <option value="ABOVE">Above HP</option>
                      <option value="BELOW">Below HP</option>
                      <option value="ON">On HP (0 mm)</option>
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        disabled={input.endA.hpRelation === 'ON'}
                        value={input.endA.hpRelation === 'ON' ? 0 : input.endA.distanceHp}
                        onChange={(e) => updateEndA('distanceHp', Math.max(0, parseFloat(e.target.value) || 0))}
                        className={`${inputCls} pr-7`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                        mm
                      </span>
                    </div>
                  </div>
                </div>

                {/* End A with VP */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#202044] dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                      <span>Relative to VP</span>
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200 select-none">
                      <input
                        type="checkbox"
                        checked={input.endA.vpRelation === 'ON'}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          updateEndA({
                            vpRelation: isChecked ? 'ON' : 'IN_FRONT',
                            distanceVp: isChecked ? 0 : (input.endA.distanceVp === 0 ? 35 : input.endA.distanceVp),
                          });
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#7138E8] cursor-pointer"
                      />
                      <span className={input.endA.vpRelation === 'ON' ? 'font-semibold text-[#7138E8] dark:text-purple-300' : ''}>
                        On VP
                      </span>
                    </label>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 transition-opacity ${input.endA.vpRelation === 'ON' ? 'opacity-60' : ''}`}>
                    <select
                      value={input.endA.vpRelation}
                      onChange={(e) => {
                        const val = e.target.value as 'IN_FRONT' | 'BEHIND' | 'ON';
                        if (val === 'ON') {
                          updateEndA({ vpRelation: 'ON', distanceVp: 0 });
                        } else {
                          updateEndA({
                            vpRelation: val,
                            distanceVp: input.endA.distanceVp === 0 ? 35 : input.endA.distanceVp,
                          });
                        }
                      }}
                      className={selectCls}
                    >
                      <option value="IN_FRONT">In Front of VP</option>
                      <option value="BEHIND">Behind VP</option>
                      <option value="ON">On VP (0 mm)</option>
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        disabled={input.endA.vpRelation === 'ON'}
                        value={input.endA.vpRelation === 'ON' ? 0 : input.endA.distanceVp}
                        onChange={(e) => updateEndA('distanceVp', Math.max(0, parseFloat(e.target.value) || 0))}
                        className={`${inputCls} pr-7`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                        mm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODE 1: APPARENT VALUES (WHEN TRUE LENGTH IS NOT GIVEN) */}
              {input.mode === 'APPARENT_VALUES' && (
                <div className="space-y-3.5">
                  <div className="flex flex-col gap-3.5 p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between border-b border-[#E8E2F5] dark:border-slate-800 pb-2">
                      <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                        Apparent Values &amp; Projections
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-[#7138E8] dark:text-purple-300">
                        Find TL
                      </span>
                    </div>

                    {/* True Length Auto-Computed Status Box */}
                    <div className="p-2.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#F1EBFF] dark:bg-purple-950 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-[#202044] dark:text-slate-200 block truncate">
                            True Length (TL): Unknown
                          </span>
                          <span className="text-[10px] text-[#77758F] font-mono tabular-nums">
                            Calculated: TL ≈ {previewTL.toFixed(1)} mm
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Apparent Lengths (Front View & Top View) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#202044] dark:text-slate-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                          <span>FV Length (EL)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="300"
                            step="1"
                            value={input.frontViewLength || 70}
                            onChange={(e) => updateField('frontViewLength', Math.max(1, parseFloat(e.target.value) || 0))}
                            className={`${inputCls} pr-7`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                            mm
                          </span>
                        </div>
                        <span className="text-[10px] text-[#77758F] font-mono block">a′b′ length</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#202044] dark:text-slate-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                          <span>TV Length (PL)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="300"
                            step="1"
                            value={input.topViewLength || 60}
                            onChange={(e) => updateField('topViewLength', Math.max(1, parseFloat(e.target.value) || 0))}
                            className={`${inputCls} pr-7`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                            mm
                          </span>
                        </div>
                        <span className="text-[10px] text-[#77758F] font-mono block">ab length</span>
                      </div>
                    </div>

                    {/* Sub-form: Given DEP vs Given Apparent Angles (α, β) */}
                    <div className="space-y-2 pt-2 border-t border-[#E8E2F5] dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="text-[#202044] dark:text-slate-300">Projector / Angles</span>
                        <div className="flex items-center p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-700 text-[10px]">
                          <button
                            type="button"
                            onClick={() => updateField('apparentInputType', 'LENGTHS_DEP')}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                              input.apparentInputType !== 'LENGTHS_ANGLES'
                                ? 'bg-[#7138E8] text-white font-bold'
                                : 'text-[#77758F] dark:text-slate-300'
                            }`}
                          >
                            DEP (mm)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField('apparentInputType', 'LENGTHS_ANGLES')}
                            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                              input.apparentInputType === 'LENGTHS_ANGLES'
                                ? 'bg-[#7138E8] text-white font-bold'
                                : 'text-[#77758F] dark:text-slate-300'
                            }`}
                          >
                            Angles (α, β)
                          </button>
                        </div>
                      </div>

                      {input.apparentInputType !== 'LENGTHS_ANGLES' ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#77758F] dark:text-slate-400">
                              Distance Between Projectors (DEP)
                            </span>
                            <span className="text-[10px] font-mono text-[#77758F]">along XY</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              step="1"
                              value={input.dep !== undefined ? input.dep : 40}
                              onChange={(e) => updateField('dep', Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`${inputCls} pr-7`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                              mm
                            </span>
                          </div>

                          {isDepTooLarge && (
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>DEP ({dep}mm) cannot exceed min(FV, TV) = {previewMaxDep}mm. Clamped for projection validity.</span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#77758F] pt-1">
                            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800">
                              FV Angle (α): <strong className="text-[#202044] dark:text-slate-200 tabular-nums">{previewAlpha.toFixed(1)}°</strong>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800">
                              TV Angle (β): <strong className="text-[#202044] dark:text-slate-200 tabular-nums">{previewBeta.toFixed(1)}°</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-medium text-[#77758F] dark:text-slate-400 block mb-1">
                              Front View Angle (α)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="89.9"
                                step="0.5"
                                placeholder={previewAlpha.toFixed(1)}
                                value={input.alphaDeg !== undefined ? input.alphaDeg : parseFloat(previewAlpha.toFixed(1))}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateField('alphaDeg', val);
                                  const newDep = Math.round(el * Math.cos((val * Math.PI) / 180));
                                  updateField('dep', newDep);
                                }}
                                className={`${inputCls} pr-6`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                                °
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-[#77758F] dark:text-slate-400 block mb-1">
                              Top View Angle (β)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="89.9"
                                step="0.5"
                                placeholder={previewBeta.toFixed(1)}
                                value={input.betaDeg !== undefined ? input.betaDeg : parseFloat(previewBeta.toFixed(1))}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateField('betaDeg', val);
                                  const newDep = Math.round(pl * Math.cos((val * Math.PI) / 180));
                                  updateField('dep', newDep);
                                }}
                                className={`${inputCls} pr-6`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                                °
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target Quadrant for End Point B */}
                  <div className="p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/40 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                        Target Quadrant for End {input.nameB}
                      </span>
                      <span className="text-[10px] font-mono text-[#77758F]">Default: Q1</span>
                    </div>

                    <select
                      value={input.targetQuadrantB || 'FIRST'}
                      onChange={(e) => updateField('targetQuadrantB', e.target.value as TargetQuadrantB)}
                      className="w-full h-9 px-2.5 text-xs font-semibold rounded-xl border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none cursor-pointer"
                    >
                      <option value="FIRST">1st Quadrant (i) — Above HP, In Front of VP</option>
                      <option value="SECOND">2nd Quadrant (ii) — Above HP, Behind VP</option>
                      <option value="THIRD">3rd Quadrant (iii) — Below HP, Behind VP</option>
                      <option value="FOURTH">4th Quadrant (iv) — Below HP, In Front of VP</option>
                    </select>

                    <p className="text-[11px] text-[#5B24CE] dark:text-purple-300 bg-[#F1EBFF]/75 dark:bg-purple-950/35 px-2.5 py-2 rounded-lg">
                      {(input.targetQuadrantB || 'FIRST') === 'FIRST' && `Point ${input.nameB} is situated Above HP and In Front of VP`}
                      {input.targetQuadrantB === 'SECOND' && `Point ${input.nameB} is situated Above HP and Behind VP`}
                      {input.targetQuadrantB === 'THIRD' && `Point ${input.nameB} is situated Below HP and Behind VP`}
                      {input.targetQuadrantB === 'FOURTH' && `Point ${input.nameB} is situated Below HP and In Front of VP`}
                    </p>
                  </div>
                </div>
              )}

              {/* MODE 2: END POINTS (ABSOLUTE COORDS) */}
              {input.mode === 'END_POINTS' && (
                <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                      Position of End {input.nameB}
                    </span>
                    <span className="text-[10px] font-mono text-[#7138E8] dark:text-purple-300">
                      End Point 2
                    </span>
                  </div>

                  {/* End B with HP */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#202044] dark:text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                        <span>Relative to HP</span>
                      </span>
                      <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200 select-none">
                        <input
                          type="checkbox"
                          checked={input.endB.hpRelation === 'ON'}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            updateEndB({
                              hpRelation: isChecked ? 'ON' : 'ABOVE',
                              distanceHp: isChecked ? 0 : (input.endB.distanceHp === 0 ? 20 : input.endB.distanceHp),
                            });
                          }}
                          className="w-3.5 h-3.5 rounded accent-[#7138E8] cursor-pointer"
                        />
                        <span className={input.endB.hpRelation === 'ON' ? 'font-semibold text-[#7138E8] dark:text-purple-300' : ''}>
                          On HP
                        </span>
                      </label>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 transition-opacity ${input.endB.hpRelation === 'ON' ? 'opacity-60' : ''}`}>
                      <select
                        value={input.endB.hpRelation}
                        onChange={(e) => {
                          const val = e.target.value as 'ABOVE' | 'BELOW' | 'ON';
                          if (val === 'ON') {
                            updateEndB({ hpRelation: 'ON', distanceHp: 0 });
                          } else {
                            updateEndB({
                              hpRelation: val,
                              distanceHp: input.endB.distanceHp === 0 ? 20 : input.endB.distanceHp,
                            });
                          }
                        }}
                        className={selectCls}
                      >
                        <option value="ABOVE">Above HP</option>
                        <option value="BELOW">Below HP</option>
                        <option value="ON">On HP (0 mm)</option>
                      </select>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="300"
                          step="1"
                          disabled={input.endB.hpRelation === 'ON'}
                          value={input.endB.hpRelation === 'ON' ? 0 : input.endB.distanceHp}
                          onChange={(e) => updateEndB('distanceHp', Math.max(0, parseFloat(e.target.value) || 0))}
                          className={`${inputCls} pr-7`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                          mm
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* End B with VP */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#202044] dark:text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                        <span>Relative to VP</span>
                      </span>
                      <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200 select-none">
                        <input
                          type="checkbox"
                          checked={input.endB.vpRelation === 'ON'}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            updateEndB({
                              vpRelation: isChecked ? 'ON' : 'IN_FRONT',
                              distanceVp: isChecked ? 0 : (input.endB.distanceVp === 0 ? 20 : input.endB.distanceVp),
                            });
                          }}
                          className="w-3.5 h-3.5 rounded accent-[#7138E8] cursor-pointer"
                        />
                        <span className={input.endB.vpRelation === 'ON' ? 'font-semibold text-[#7138E8] dark:text-purple-300' : ''}>
                          On VP
                        </span>
                      </label>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 transition-opacity ${input.endB.vpRelation === 'ON' ? 'opacity-60' : ''}`}>
                      <select
                        value={input.endB.vpRelation}
                        onChange={(e) => {
                          const val = e.target.value as 'IN_FRONT' | 'BEHIND' | 'ON';
                          if (val === 'ON') {
                            updateEndB({ vpRelation: 'ON', distanceVp: 0 });
                          } else {
                            updateEndB({
                              vpRelation: val,
                              distanceVp: input.endB.distanceVp === 0 ? 20 : input.endB.distanceVp,
                            });
                          }
                        }}
                        className={selectCls}
                      >
                        <option value="IN_FRONT">In Front of VP</option>
                        <option value="BEHIND">Behind VP</option>
                        <option value="ON">On VP (0 mm)</option>
                      </select>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="300"
                          step="1"
                          disabled={input.endB.vpRelation === 'ON'}
                          value={input.endB.vpRelation === 'ON' ? 0 : input.endB.distanceVp}
                          onChange={(e) => updateEndB('distanceVp', Math.max(0, parseFloat(e.target.value) || 0))}
                          className={`${inputCls} pr-7`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                          mm
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Distance between end projectors (DEP) */}
                  <div className="pt-2 border-t border-[#E8E2F5] dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#202044] dark:text-slate-300">
                        Distance Between Projectors (DEP)
                      </label>
                      <span className="text-[10px] text-[#77758F] font-mono">along XY</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        value={input.dep}
                        onChange={(e) => updateField('dep', Math.max(0, parseFloat(e.target.value) || 0))}
                        className={`${inputCls} pr-7`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                        mm
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: TRUE LENGTH & ANGLES */}
              {input.mode === 'TRUE_LENGTH_ANGLES' && (
                <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                      True Length &amp; True Inclinations
                    </span>
                    <span className="text-[10px] font-mono text-[#7138E8] dark:text-purple-300">
                      TL, θ, φ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateField('mode', 'APPARENT_VALUES')}
                    className="p-2.5 rounded-xl border border-[#E8E2F5] dark:border-purple-900/50 bg-[#F1EBFF]/75 dark:bg-purple-950/35 text-left hover:bg-[#F1EBFF] dark:hover:bg-purple-950/60 transition flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-[#5B24CE] dark:text-purple-300 block">
                        True Length not given in question?
                      </span>
                      <span className="text-[10px] text-[#77758F] dark:text-slate-400">
                        Switch to Apparent Values mode to compute TL from FV/TV.
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#7138E8] shrink-0" />
                  </button>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#202044] dark:text-slate-300">
                        True Length of Line (TL)
                      </label>
                      <span className="text-[10px] font-mono text-[#77758F]">Actual length</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="300"
                        step="1"
                        value={input.trueLength}
                        onChange={(e) => updateField('trueLength', Math.max(5, parseFloat(e.target.value) || 5))}
                        className={`${inputCls} pr-7`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                        mm
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#202044] dark:text-slate-300 block mb-1">
                        Inclination to HP (θ)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="90"
                          step="0.5"
                          value={input.thetaDeg}
                          onChange={(e) => updateField('thetaDeg', Math.min(90, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className={`${inputCls} pr-6`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                          °
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#202044] dark:text-slate-300 block mb-1">
                        Inclination to VP (φ)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="90"
                          step="0.5"
                          value={input.phiDeg}
                          onChange={(e) => updateField('phiDeg', Math.min(90, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className={`${inputCls} pr-6`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#77758F] font-mono">
                          °
                        </span>
                      </div>
                    </div>
                  </div>

                  {isAngleConditionViolated ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Spatial Limit Exceeded:</strong> In 3D space, sin²θ + sin²φ cannot exceed 1 (θ + φ ≤ 90°). Please reduce θ or φ.
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#77758F] font-mono flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Valid 3D Spatial Angles: θ = {input.thetaDeg}°, φ = {input.phiDeg}°</span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Options (Collapsible Hidden Bracket Toggles) */}
              <div className="rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/70 dark:bg-slate-950/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsAdditionalOpen((v) => !v)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold text-[#202044] dark:text-slate-200 hover:bg-[#F1EBFF]/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-[#7138E8] dark:text-purple-400" />
                    <span>Additional Options</span>
                    {hiddenOptionCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-[#7138E8] text-white">
                        {hiddenOptionCount}
                      </span>
                    )}
                  </span>
                  {isAdditionalOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#77758F]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#77758F]" />
                  )}
                </button>

                {isAdditionalOpen && (
                  <div className="px-3 pb-3 pt-2 space-y-2 border-t border-[#E8E2F5] dark:border-slate-800 text-[11px]">
                    <label className="flex items-start gap-2 text-[#202044] dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!input.hiddenA}
                        onChange={(e) => updateField('hiddenA', e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 rounded-xs accent-[#7138E8] cursor-pointer shrink-0"
                      />
                      <span>
                        End {input.nameA} Hidden / Obstructed{' '}
                        <span className="font-mono text-[#77758F]">
                          ({input.nameA.toLowerCase()}), ({input.nameA.toLowerCase()}′)
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-[#202044] dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!input.hiddenB}
                        onChange={(e) => updateField('hiddenB', e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 rounded-xs accent-[#7138E8] cursor-pointer shrink-0"
                      />
                      <span>
                        End {input.nameB} Hidden / Obstructed{' '}
                        <span className="font-mono text-[#77758F]">
                          ({input.nameB.toLowerCase()}), ({input.nameB.toLowerCase()}′)
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
