/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LineProblemInput,
  LineInputMode,
  SampleLineProblem,
} from '../../types/lines';
import { SAMPLE_LINE_PROBLEMS } from '../../utils/linesMath';
import {
  Ruler,
  Compass,
  Sparkles,
  Layers,
  RotateCcw,
  AlertTriangle,
  Info,
  CheckCircle2,
  BookOpen,
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

  const updateEndA = (key: string, value: any) => {
    onChange({
      ...input,
      endA: { ...input.endA, [key]: value },
    });
  };

  const updateEndB = (key: string, value: any) => {
    onChange({
      ...input,
      endB: { ...input.endB, [key]: value },
    });
  };

  // Check mathematical viability for true angles
  const thetaRad = (input.thetaDeg * Math.PI) / 180;
  const phiRad = (input.phiDeg * Math.PI) / 180;
  const angleConditionSum =
    Math.sin(thetaRad) * Math.sin(thetaRad) + Math.sin(phiRad) * Math.sin(phiRad);
  const isAngleConditionViolated = input.mode === 'TRUE_LENGTH_ANGLES' && angleConditionSum > 1.0001;

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
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition text-xs flex items-center gap-1 font-mono"
          title="Reset to default problem"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Input Mode Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Problem Input Method</span>
          <span className="text-[10px] text-slate-400 font-normal">Choose formulation</span>
        </label>
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => updateField('mode', 'END_POINTS')}
            className={`py-2 px-2.5 rounded-md transition text-center ${
              input.mode === 'END_POINTS'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            End Points &amp; Projector Distance (DEP)
          </button>
          <button
            type="button"
            onClick={() => updateField('mode', 'TRUE_LENGTH_ANGLES')}
            className={`py-2 px-2.5 rounded-md transition text-center ${
              input.mode === 'TRUE_LENGTH_ANGLES'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            True Length (TL) &amp; True Angles (θ, φ)
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
            <label className="flex items-center gap-1 text-[10px] cursor-pointer text-slate-500">
              <input
                type="checkbox"
                checked={input.endA.hpRelation === 'ON'}
                onChange={(e) => {
                  updateEndA('hpRelation', e.target.checked ? 'ON' : 'ABOVE');
                  if (e.target.checked) updateEndA('distanceHp', 0);
                }}
                className="rounded text-blue-600"
              />
              <span>On HP</span>
            </label>
          </div>
          {input.endA.hpRelation !== 'ON' && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={input.endA.hpRelation}
                onChange={(e) => updateEndA('hpRelation', e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="ABOVE">Above HP</option>
                <option value="BELOW">Below HP</option>
              </select>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="1"
                  value={input.endA.distanceHp}
                  onChange={(e) => updateEndA('distanceHp', Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
              </div>
            </div>
          )}
        </div>

        {/* End A with VP */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
              Relative to Vertical Plane (VP)
            </span>
            <label className="flex items-center gap-1 text-[10px] cursor-pointer text-slate-500">
              <input
                type="checkbox"
                checked={input.endA.vpRelation === 'ON'}
                onChange={(e) => {
                  updateEndA('vpRelation', e.target.checked ? 'ON' : 'IN_FRONT');
                  if (e.target.checked) updateEndA('distanceVp', 0);
                }}
                className="rounded text-red-600"
              />
              <span>On VP</span>
            </label>
          </div>
          {input.endA.vpRelation !== 'ON' && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={input.endA.vpRelation}
                onChange={(e) => updateEndA('vpRelation', e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="IN_FRONT">In Front of VP</option>
                <option value="BEHIND">Behind VP</option>
              </select>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="1"
                  value={input.endA.distanceVp}
                  onChange={(e) => updateEndA('distanceVp', Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Specific Inputs */}
      {input.mode === 'END_POINTS' ? (
        /* End Point B Specifications */
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
              <label className="flex items-center gap-1 text-[10px] cursor-pointer text-slate-500">
                <input
                  type="checkbox"
                  checked={input.endB.hpRelation === 'ON'}
                  onChange={(e) => {
                    updateEndB('hpRelation', e.target.checked ? 'ON' : 'ABOVE');
                    if (e.target.checked) updateEndB('distanceHp', 0);
                  }}
                  className="rounded text-emerald-600"
                />
                <span>On HP</span>
              </label>
            </div>
            {input.endB.hpRelation !== 'ON' && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={input.endB.hpRelation}
                  onChange={(e) => updateEndB('hpRelation', e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="ABOVE">Above HP</option>
                  <option value="BELOW">Below HP</option>
                </select>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="300"
                    step="1"
                    value={input.endB.distanceHp}
                    onChange={(e) => updateEndB('distanceHp', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
                </div>
              </div>
            )}
          </div>

          {/* End B with VP */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                Relative to Vertical Plane (VP)
              </span>
              <label className="flex items-center gap-1 text-[10px] cursor-pointer text-slate-500">
                <input
                  type="checkbox"
                  checked={input.endB.vpRelation === 'ON'}
                  onChange={(e) => {
                    updateEndB('vpRelation', e.target.checked ? 'ON' : 'IN_FRONT');
                    if (e.target.checked) updateEndB('distanceVp', 0);
                  }}
                  className="rounded text-red-600"
                />
                <span>On VP</span>
              </label>
            </div>
            {input.endB.vpRelation !== 'ON' && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={input.endB.vpRelation}
                  onChange={(e) => updateEndB('vpRelation', e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="IN_FRONT">In Front of VP</option>
                  <option value="BEHIND">Behind VP</option>
                </select>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="300"
                    step="1"
                    value={input.endB.distanceVp}
                    onChange={(e) => updateEndB('distanceVp', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs px-2 py-1.5 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pr-7"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-mono">mm</span>
                </div>
              </div>
            )}
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
      ) : (
        /* True Length & Angles Inputs */
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
