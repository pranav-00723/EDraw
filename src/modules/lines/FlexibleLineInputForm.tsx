/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FlexibleLineInput,
  FlexibleEndPoint,
} from '../../utils/flexibleLineSolver';
import { HpRelation, VpRelation } from '../../types/projection';
import { Sparkles, Trash2, AlertTriangle } from 'lucide-react';

interface FlexibleLineInputFormProps {
  value: FlexibleLineInput;
  onChange: (updated: FlexibleLineInput) => void;
  onSolve: () => void;
  onClear: () => void;
  warnings?: string[];
  errors?: string[];
  hpColor: string;
  vpColor: string;
}

export const FlexibleLineInputForm: React.FC<FlexibleLineInputFormProps> = ({
  value,
  onChange,
  onSolve,
  onClear,
  warnings = [],
  errors = [],
  hpColor,
  vpColor,
}) => {
  const updateField = <K extends keyof FlexibleLineInput>(
    key: K,
    val: FlexibleLineInput[K]
  ) => {
    onChange({ ...value, [key]: val });
  };

  const updateEnd = (
    which: 'end1' | 'end2',
    patch: Partial<FlexibleEndPoint>
  ) => {
    onChange({
      ...value,
      [which]: { ...value[which], ...patch },
    });
  };

  const renderEndPointSection = (
    which: 'end1' | 'end2',
    label: string,
    ep: FlexibleEndPoint
  ) => (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-sans">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">Name:</span>
          <input
            type="text"
            maxLength={2}
            value={ep.name}
            onChange={(e) => updateEnd(which, { name: e.target.value.toUpperCase() })}
            placeholder={which === 'end1' ? 'A' : 'B'}
            className="w-12 px-2 py-1 text-xs font-mono font-bold text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Position relative to HP */}
      <div className="grid grid-cols-12 gap-1.5 items-center">
        <span
          className="col-span-3 text-[11px] font-mono font-semibold"
          style={{ color: hpColor }}
        >
          wrt HP
        </span>
        <select
          value={ep.hpRelation}
          onChange={(e) =>
            updateEnd(which, {
              hpRelation: e.target.value as HpRelation | '',
              distanceHp: e.target.value === 'ON' ? '0' : ep.distanceHp,
            })
          }
          className="col-span-5 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
        >
          <option value="">-- Empty --</option>
          <option value="ABOVE">Above HP</option>
          <option value="BELOW">Below HP</option>
          <option value="ON">On HP (0)</option>
        </select>
        <div className="col-span-4 relative">
          <input
            type="number"
            min="0"
            step="any"
            disabled={ep.hpRelation === 'ON'}
            value={ep.hpRelation === 'ON' ? '0' : ep.distanceHp}
            onChange={(e) =>
              updateEnd(which, {
                distanceHp: e.target.value,
                hpRelation: ep.hpRelation || 'ABOVE',
              })
            }
            placeholder="mm"
            className="w-full px-2 py-1 pr-7 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-50"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
            mm
          </span>
        </div>
      </div>

      {/* Position relative to VP */}
      <div className="grid grid-cols-12 gap-1.5 items-center">
        <span
          className="col-span-3 text-[11px] font-mono font-semibold"
          style={{ color: vpColor }}
        >
          wrt VP
        </span>
        <select
          value={ep.vpRelation}
          onChange={(e) =>
            updateEnd(which, {
              vpRelation: e.target.value as VpRelation | '',
              distanceVp: e.target.value === 'ON' ? '0' : ep.distanceVp,
            })
          }
          className="col-span-5 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
        >
          <option value="">-- Empty --</option>
          <option value="IN_FRONT">In Front of VP</option>
          <option value="BEHIND">Behind VP</option>
          <option value="ON">On VP (0)</option>
        </select>
        <div className="col-span-4 relative">
          <input
            type="number"
            min="0"
            step="any"
            disabled={ep.vpRelation === 'ON'}
            value={ep.vpRelation === 'ON' ? '0' : ep.distanceVp}
            onChange={(e) =>
              updateEnd(which, {
                distanceVp: e.target.value,
                vpRelation: ep.vpRelation || 'IN_FRONT',
              })
            }
            placeholder="mm"
            className="w-full px-2 py-1 pr-7 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-50"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
            mm
          </span>
        </div>
      </div>
    </div>
  );

  const renderNumberField = (
    label: string,
    unit: string,
    fieldKey: keyof FlexibleLineInput,
    placeholder = 'Empty'
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          step="any"
          min="0"
          value={value[fieldKey] as string}
          onChange={(e) => updateField(fieldKey, e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 pr-8 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          Enter <strong>any</strong> known values from your question and leave the rest empty.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-mono text-slate-500 hover:text-rose-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      {/* Point 1 & Point 2 */}
      {renderEndPointSection('end1', '1. Point 1 (Start End)', value.end1)}
      {renderEndPointSection('end2', '2. Point 2 (Other End)', value.end2)}

      {/* True Length & DEP */}
      <div className="grid grid-cols-2 gap-2.5">
        {renderNumberField('3. True Length (TL)', 'mm', 'trueLength')}
        {renderNumberField('10. End Projectors (DEP)', 'mm', 'dep')}
      </div>

      {/* True Inclinations */}
      <div className="grid grid-cols-2 gap-2.5">
        {renderNumberField('4. True Angle wrt HP (θ)', '°', 'thetaDeg')}
        {renderNumberField('5. True Angle wrt VP (φ)', '°', 'phiDeg')}
      </div>

      {/* Apparent Lengths */}
      <div className="grid grid-cols-2 gap-2.5">
        {renderNumberField('6. Front View Length', 'mm', 'frontViewLength')}
        {renderNumberField('7. Top View Length', 'mm', 'topViewLength')}
      </div>

      {/* Apparent Inclinations */}
      <div className="grid grid-cols-2 gap-2.5">
        {renderNumberField('8. FV Angle wrt XY (α)', '°', 'alphaDeg')}
        {renderNumberField('9. TV Angle wrt XY (β)', '°', 'betaDeg')}
      </div>

      {/* Horizontal Trace (HT) & Vertical Trace (VT) */}
      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col gap-2.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-sans">
          11. Traces (HT &amp; VT)
        </span>

        {/* HT relative to VP */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <span className="col-span-3 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
            HT wrt VP
          </span>
          <select
            value={value.htVpRelation}
            onChange={(e) =>
              updateField('htVpRelation', e.target.value as VpRelation | '')
            }
            className="col-span-5 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            <option value="">-- Empty --</option>
            <option value="IN_FRONT">In Front of VP</option>
            <option value="BEHIND">Behind VP</option>
            <option value="ON">On XY (0)</option>
          </select>
          <div className="col-span-4 relative">
            <input
              type="number"
              min="0"
              step="any"
              disabled={value.htVpRelation === 'ON'}
              value={value.htVpRelation === 'ON' ? '0' : value.htDistanceVp}
              onChange={(e) => {
                onChange({
                  ...value,
                  htDistanceVp: e.target.value,
                  htVpRelation: value.htVpRelation || 'IN_FRONT',
                });
              }}
              placeholder="mm"
              className="w-full px-2 py-1 pr-7 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-50"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
              mm
            </span>
          </div>
        </div>

        {/* VT relative to HP */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <span className="col-span-3 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
            VT wrt HP
          </span>
          <select
            value={value.vtHpRelation}
            onChange={(e) =>
              updateField('vtHpRelation', e.target.value as HpRelation | '')
            }
            className="col-span-5 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            <option value="">-- Empty --</option>
            <option value="ABOVE">Above HP</option>
            <option value="BELOW">Below HP</option>
            <option value="ON">On XY (0)</option>
          </select>
          <div className="col-span-4 relative">
            <input
              type="number"
              min="0"
              step="any"
              disabled={value.vtHpRelation === 'ON'}
              value={value.vtHpRelation === 'ON' ? '0' : value.vtDistanceHp}
              onChange={(e) => {
                onChange({
                  ...value,
                  vtDistanceHp: e.target.value,
                  vtHpRelation: value.vtHpRelation || 'ABOVE',
                });
              }}
              placeholder="mm"
              className="w-full px-2 py-1 pr-7 text-xs font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-50"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
              mm
            </span>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Conflicting Values Detected — Please check your values again:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && errors.length === 0 && (
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>{warnings.join(' ')}</div>
        </div>
      )}

      <button
        type="button"
        onClick={onSolve}
        className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        Solve &amp; Plot Projections
      </button>
    </div>
  );
};
