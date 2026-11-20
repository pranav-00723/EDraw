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
import { Play, Trash2, AlertTriangle } from 'lucide-react';

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

  const inputClass =
    'w-full h-8 px-2.5 text-xs font-mono font-semibold tabular-nums rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none transition-all disabled:opacity-50 disabled:bg-[#F8F7FC] dark:disabled:bg-slate-800/60';

  const selectClass =
    'w-full h-8 px-2 text-xs font-medium rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none cursor-pointer transition-all';

  const renderEndPointSection = (
    which: 'end1' | 'end2',
    label: string,
    ep: FlexibleEndPoint
  ) => (
    <div className="p-3 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/80 dark:bg-slate-950/40 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[#77758F] dark:text-slate-400">
            Name
          </span>
          <input
            type="text"
            maxLength={2}
            value={ep.name}
            onChange={(e) => updateEnd(which, { name: e.target.value.toUpperCase() })}
            placeholder={which === 'end1' ? 'A' : 'B'}
            aria-label={`${label} name`}
            className="w-11 h-7 px-1.5 text-xs font-mono font-bold text-center uppercase rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none"
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
          aria-label={`${label} relation to HP`}
          onChange={(e) =>
            updateEnd(which, {
              hpRelation: e.target.value as HpRelation | '',
              distanceHp: e.target.value === 'ON' ? '0' : ep.distanceHp,
            })
          }
          className={`col-span-5 ${selectClass}`}
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
            aria-label={`${label} distance from HP in mm`}
            onChange={(e) =>
              updateEnd(which, {
                distanceHp: e.target.value,
                hpRelation: ep.hpRelation || 'ABOVE',
              })
            }
            placeholder="mm"
            className={`${inputClass} pr-7`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F]">
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
          aria-label={`${label} relation to VP`}
          onChange={(e) =>
            updateEnd(which, {
              vpRelation: e.target.value as VpRelation | '',
              distanceVp: e.target.value === 'ON' ? '0' : ep.distanceVp,
            })
          }
          className={`col-span-5 ${selectClass}`}
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
            aria-label={`${label} distance from VP in mm`}
            onChange={(e) =>
              updateEnd(which, {
                distanceVp: e.target.value,
                vpRelation: ep.vpRelation || 'IN_FRONT',
              })
            }
            placeholder="mm"
            className={`${inputClass} pr-7`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F]">
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
    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/40">
      <label className="col-span-7 text-[11.5px] font-semibold text-[#202044] dark:text-slate-200 leading-tight">
        {label}
      </label>
      <div className="col-span-5 relative">
        <input
          type="number"
          step="any"
          min="0"
          value={value[fieldKey] as string}
          onChange={(e) => updateField(fieldKey, e.target.value)}
          placeholder={placeholder}
          className="w-full h-8 px-2.5 pr-7 text-xs font-mono font-semibold tabular-nums rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none transition-all"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F]">
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-[#77758F] dark:text-slate-400 leading-snug">
          Enter <strong className="text-[#202044] dark:text-slate-200">any</strong> known values from the problem and leave unknowns blank.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-semibold text-[#77758F] hover:text-rose-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* 1–11 Sequential Input Parameters */}
      {renderEndPointSection('end1', '1. Point 1 (Start End)', value.end1)}
      {renderEndPointSection('end2', '2. Point 2 (Other End)', value.end2)}
      {renderNumberField('3. True Length (TL)', 'mm', 'trueLength')}
      {renderNumberField('4. True Angle wrt HP (θ)', '°', 'thetaDeg')}
      {renderNumberField('5. True Angle wrt VP (φ)', '°', 'phiDeg')}
      {renderNumberField('6. Front View Length', 'mm', 'frontViewLength')}
      {renderNumberField('7. Top View Length', 'mm', 'topViewLength')}
      {renderNumberField('8. FV Angle wrt XY (α)', '°', 'alphaDeg')}
      {renderNumberField('9. TV Angle wrt XY (β)', '°', 'betaDeg')}
      {renderNumberField('10. End Projectors (DEP)', 'mm', 'dep')}

      {/* 11. Horizontal Trace (HT) & Vertical Trace (VT) */}
      <div className="p-3 rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/80 dark:bg-slate-950/40 flex flex-col gap-2.5">
        <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
          11. Traces (HT &amp; VT)
        </span>

        {/* HT relative to VP */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <span className="col-span-3 text-[11px] font-mono font-semibold text-[#77758F] dark:text-slate-300">
            HT wrt VP
          </span>
          <select
            value={value.htVpRelation}
            aria-label="HT relative to VP"
            onChange={(e) =>
              updateField('htVpRelation', e.target.value as VpRelation | '')
            }
            className={`col-span-5 ${selectClass}`}
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
              aria-label="HT distance from VP"
              onChange={(e) => {
                onChange({
                  ...value,
                  htDistanceVp: e.target.value,
                  htVpRelation: value.htVpRelation || 'IN_FRONT',
                });
              }}
              placeholder="mm"
              className={`${inputClass} pr-7`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F]">
              mm
            </span>
          </div>
        </div>

        {/* VT relative to HP */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <span className="col-span-3 text-[11px] font-mono font-semibold text-[#77758F] dark:text-slate-300">
            VT wrt HP
          </span>
          <select
            value={value.vtHpRelation}
            aria-label="VT relative to HP"
            onChange={(e) =>
              updateField('vtHpRelation', e.target.value as HpRelation | '')
            }
            className={`col-span-5 ${selectClass}`}
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
              aria-label="VT distance from HP"
              onChange={(e) => {
                onChange({
                  ...value,
                  vtDistanceHp: e.target.value,
                  vtHpRelation: value.vtHpRelation || 'ABOVE',
                });
              }}
              placeholder="mm"
              className={`${inputClass} pr-7`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F]">
              mm
            </span>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Conflicting Values Detected:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && errors.length === 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>{warnings.join(' ')}</div>
        </div>
      )}

      <button
        type="button"
        onClick={onSolve}
        className="w-full h-10 px-4 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_10px_24px_-8px_rgba(113,56,232,0.55)] hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
        style={{
          background: 'linear-gradient(90deg, #7138E8 0%, #9565F5 100%)',
        }}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Solve &amp; Plot Projections</span>
      </button>
    </div>
  );
};
