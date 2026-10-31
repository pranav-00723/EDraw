/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LineProblemInput,
  LineInputMode,
  EndPointSpec,
  TargetQuadrantB,
} from '../../types/lines';
import {
  Ruler,
  Compass,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
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
  isDark = false,
}) => {
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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
              Line Problem Definition
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Line {input.nameA}{input.nameB} Specifications
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition text-xs flex items-center gap-1 font-mono cursor-pointer"
          title="Reset to default problem"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Input Mode Selector (3 Modes including Apparent Values) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Problem Input Method</span>
          <span className="text-[10px] text-slate-400 font-normal">Choose formulation</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => updateField('mode', 'APPARENT_VALUES')}
            className={`py-2 px-2 rounded-md transition text-center flex flex-col items-center justify-center gap-0.5 ${
              input.mode === 'APPARENT_VALUES'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="font-semibold">Apparent Values</span>
            <span className="text-[10px] opacity-80">(Find TL &amp; Quadrants)</span>
          </button>
          <button
            type="button"
            onClick={() => updateField('mode', 'TRUE_LENGTH_ANGLES')}
            className={`py-2 px-2 rounded-md transition text-center flex flex-col items-center justify-center gap-0.5 ${
              input.mode === 'TRUE_LENGTH_ANGLES'
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="font-semibold">True Length &amp; Angles</span>
            <span className="text-[10px] opacity-80">(TL, θ, φ given)</span>
          </button>
          <button
            type="button"
            onClick={() => updateField('mode', 'END_POINTS')}
            className={`py-2 px-2 rounded-md transition text-center flex flex-col items-center justify-center gap-0.5 ${
              input.mode === 'END_POINTS'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="font-semibold">End Points &amp; DEP</span>
            <span className="text-[10px] opacity-80">(Both ends fixed)</span>
          </button>
        </div>
      </div>

      {/* Line Identification */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
        <div>
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
            End Point 1 Name
          </label>
          <input
            type="text"
            maxLength={3}
            value={input.nameA}
            onChange={(e) => updateField('nameA', e.target.value.toUpperCase())}
            className="w-full px-2.5 py-1.5 text-xs font-bold font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
            End Point 2 Name
          </label>
          <input
            type="text"
            maxLength={3}
            value={input.nameB}
            onChange={(e) => updateField('nameB', e.target.value.toUpperCase())}
            className="w-full px-2.5 py-1.5 text-xs font-bold font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* End Point A Specifications */}
      <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            Position of End {input.nameA} (Reference End)
          </span>
          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
            Fixes (x=0)
          </span>
        </div>

        {/* End A with HP */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
              Relative to Horizontal Plane (HP)
            </span>
            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 select-none">
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
                className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
              />
              <span className={input.endA.hpRelation === 'ON' ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}>On HP</span>
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
              className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
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
                className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
            </div>
          </div>
        </div>

        {/* End A with VP */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
              Relative to Vertical Plane (VP)
            </span>
            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 select-none">
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
                className="w-3.5 h-3.5 rounded accent-red-600 cursor-pointer"
              />
              <span className={input.endA.vpRelation === 'ON' ? 'font-semibold text-red-600 dark:text-red-400' : ''}>On VP</span>
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
              className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
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
                className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODE 1: APPARENT VALUES (WHEN TRUE LENGTH IS NOT GIVEN) */}
      {input.mode === 'APPARENT_VALUES' && (
        <div className="flex flex-col gap-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20">
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2.5">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Apparent Values &amp; Projections (Find True Length)
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300">
              Exam Pattern (B1)
            </span>
          </div>

          {/* Option to Disable True Length / Status Box */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  True Length of Line (TL): <span className="text-purple-600 dark:text-purple-400 font-normal">Disabled (Unknown)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Calculated automatically: TL ≈ {previewTL.toFixed(1)} mm
                </span>
              </div>
            </div>
            <span className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              Given in Answer
            </span>
          </div>

          {/* Apparent Lengths (Front View & Top View) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Front View Length (Elevation Length, EL) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                Front View Length (EL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={input.frontViewLength || 70}
                  onChange={(e) => updateField('frontViewLength', Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-full text-xs px-2.5 py-1.5 font-mono font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-8"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">a′b′ line length</span>
            </div>

            {/* Top View Length (Plan Length, PL) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                Top View Length (PL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={input.topViewLength || 60}
                  onChange={(e) => updateField('topViewLength', Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-full text-xs px-2.5 py-1.5 font-mono font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-8"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">ab line length</span>
            </div>
          </div>

          {/* Sub-form: Given DEP vs Given Apparent Angles (α, β) */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Projector Distance / Apparent Angles</span>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => updateField('apparentInputType', 'LENGTHS_DEP')}
                  className={`px-2 py-0.5 rounded transition ${
                    input.apparentInputType !== 'LENGTHS_ANGLES'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  DEP (mm)
                </button>
                <button
                  type="button"
                  onClick={() => updateField('apparentInputType', 'LENGTHS_ANGLES')}
                  className={`px-2 py-0.5 rounded transition ${
                    input.apparentInputType === 'LENGTHS_ANGLES'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Angles (α, β)
                </button>
              </div>
            </div>

            {input.apparentInputType !== 'LENGTHS_ANGLES' ? (
              /* DEP Input Box */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">Distance Between Projectors (DEP)</span>
                  <span className="text-[10px] font-mono text-slate-400">along XY axis</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="300"
                    step="1"
                    value={input.dep !== undefined ? input.dep : 40}
                    onChange={(e) => updateField('dep', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs px-2.5 py-1.5 font-mono font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-8"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
                </div>

                {isDepTooLarge && (
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>DEP ({dep}mm) cannot exceed min(FV, TV) = {previewMaxDep}mm. Clamped for projection validity.</span>
                  </div>
                )}

                {/* Real-time calculated apparent angles preview */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500 pt-1">
                  <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    FV Angle (α): <strong className="text-slate-800 dark:text-slate-200">{previewAlpha.toFixed(1)}°</strong>
                  </div>
                  <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    TV Angle (β): <strong className="text-slate-800 dark:text-slate-200">{previewBeta.toFixed(1)}°</strong>
                  </div>
                </div>
              </div>
            ) : (
              /* Apparent Angles (alpha, beta) Input Boxes */
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
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
                        // Also update DEP to match
                        const newDep = Math.round(el * Math.cos((val * Math.PI) / 180));
                        updateField('dep', newDep);
                      }}
                      className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-6"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">°</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
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
                        // Also update DEP to match
                        const newDep = Math.round(pl * Math.cos((val * Math.PI) / 180));
                        updateField('dep', newDep);
                      }}
                      className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-6"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">°</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEPARATE STANDALONE QUADRANT SELECTION CARD */}
      {input.mode === 'APPARENT_VALUES' && (
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              Target Quadrant for End Point {input.nameB}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Default: 1st Quadrant
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
              Select Quadrant Location for Point {input.nameB}:
            </label>
            <select
              value={input.targetQuadrantB || 'FIRST'}
              onChange={(e) => updateField('targetQuadrantB', e.target.value as TargetQuadrantB)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="FIRST">1st Quadrant (i) — Above HP, In Front of VP (Default)</option>
              <option value="SECOND">2nd Quadrant (ii) — Above HP, Behind VP</option>
              <option value="THIRD">3rd Quadrant (iii) — Below HP, Behind VP</option>
              <option value="FOURTH">4th Quadrant (iv) — Below HP, In Front of VP</option>
            </select>
          </div>

          {/* Quadrant description & spatial summary */}
          <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/40 text-[11px] text-blue-950 dark:text-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-sans">
              <span className="font-bold font-mono text-blue-700 dark:text-blue-300">
                {(input.targetQuadrantB || 'FIRST') === 'FIRST' && '1st Quadrant:'}
                {input.targetQuadrantB === 'SECOND' && '2nd Quadrant:'}
                {input.targetQuadrantB === 'THIRD' && '3rd Quadrant:'}
                {input.targetQuadrantB === 'FOURTH' && '4th Quadrant:'}
              </span>
              <span>
                {(input.targetQuadrantB || 'FIRST') === 'FIRST' && 'Point B is situated Above HP and In Front of VP'}
                {input.targetQuadrantB === 'SECOND' && 'Point B is situated Above HP and Behind VP'}
                {input.targetQuadrantB === 'THIRD' && 'Point B is situated Below HP and Behind VP'}
                {input.targetQuadrantB === 'FOURTH' && 'Point B is situated Below HP and In Front of VP'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: END POINTS (ABSOLUTE COORDS) */}
      {input.mode === 'END_POINTS' && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Position of End {input.nameB}
            </span>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
              End Point 2
            </span>
          </div>

          {/* End B with HP */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                Relative to Horizontal Plane (HP)
              </span>
              <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 select-none">
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
                  className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer"
                />
                <span className={input.endB.hpRelation === 'ON' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}>On HP</span>
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
                className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
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
                  className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
              </div>
            </div>
          </div>

          {/* End B with VP */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                Relative to Vertical Plane (VP)
              </span>
              <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 select-none">
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
                  className="w-3.5 h-3.5 rounded accent-red-600 cursor-pointer"
                />
                <span className={input.endB.vpRelation === 'ON' ? 'font-semibold text-red-600 dark:text-red-400' : ''}>On VP</span>
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
                className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
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
                  className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
              </div>
            </div>
          </div>

          {/* Distance between end projectors (DEP) */}
          <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Distance Between End Projectors (DEP)
              </label>
              <span className="text-[10px] text-slate-400 font-mono">along XY</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="300"
                step="1"
                value={input.dep}
                onChange={(e) => updateField('dep', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-xs px-2.5 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-8"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: TRUE LENGTH & ANGLES */}
      {input.mode === 'TRUE_LENGTH_ANGLES' && (
        <div className="flex flex-col gap-3.5 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              True Length &amp; True Inclinations
            </span>
            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
              Direct Formulation
            </span>
          </div>

          {/* Switch to Apparent Values mode banner */}
          <button
            type="button"
            onClick={() => updateField('mode', 'APPARENT_VALUES')}
            className="p-2 rounded-lg border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-left hover:bg-purple-50 dark:hover:bg-purple-950/50 transition flex items-center justify-between gap-2"
          >
            <div>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 block">
                Don't have True Length given in the question?
              </span>
              <span className="text-[10px] text-slate-500">
                Switch to Apparent Values mode to disable TL and calculate it from FV/TV lengths.
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-purple-600 shrink-0" />
          </button>

          {/* True Length */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                True Length of Line (TL)
              </label>
              <span className="text-[10px] font-mono text-slate-400">Actual length AB</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="5"
                max="300"
                step="1"
                value={input.trueLength}
                onChange={(e) => updateField('trueLength', Math.max(5, parseFloat(e.target.value) || 5))}
                className="w-full text-xs px-2.5 py-1.5 font-mono font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-8"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
            </div>
          </div>

          {/* Angles: Theta (with HP) and Phi (with VP) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
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
                  className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-6"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">°</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
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
                  className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-6"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">°</span>
              </div>
            </div>
          </div>

          {/* Validation Notice for Angles Condition */}
          {isAngleConditionViolated ? (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Spatial Limit Exceeded:</strong> In 3D space, the line cannot simultaneously make these inclinations with both HP and VP. Please reduce θ or φ.
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Valid 3D Spatial Angles: θ = {input.thetaDeg}°, φ = {input.phiDeg}°</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
