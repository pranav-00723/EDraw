/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LineProblemInput } from '../../types/lines';
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
      onChange({
        ...result.lineInput,
        hiddenA: input.hiddenA,
        hiddenB: input.hiddenB,
      });
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

  const handleResetAll = () => {
    setFlexInput(createDefaultFlexibleInput());
    setFlexWarnings([]);
    setFlexErrors([]);
    onReset();
  };

  const hiddenOptionCount = (input.hiddenA ? 1 : 0) + (input.hiddenB ? 1 : 0);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] overflow-hidden flex flex-col">
      {/* Header */}
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
            onClick={handleResetAll}
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
        <div className="p-4 space-y-3.5">
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
                    onChange={(e) => onChange({ ...input, hiddenA: e.target.checked })}
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
                    onChange={(e) => onChange({ ...input, hiddenB: e.target.checked })}
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
  );
};
