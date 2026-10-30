import React, { useState, useRef, useEffect } from 'react';
import { Palette, RotateCcw, Check, ChevronDown } from 'lucide-react';

export const HP_COLOR_PRESETS = [
  { label: 'Royal Blue (Classic)', value: '#2563eb' },
  { label: 'Sky Blue', value: '#0284c7' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Emerald Green', value: '#16a34a' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Deep Purple', value: '#7c3aed' },
];

export const VP_COLOR_PRESETS = [
  { label: 'Crimson Red (Classic)', value: '#dc2626' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Vibrant Orange', value: '#ea580c' },
  { label: 'Amber Gold', value: '#d97706' },
  { label: 'Magenta Pink', value: '#db2777' },
  { label: 'Dark Maroon', value: '#991b1b' },
];

interface PlaneColorPickerProps {
  hpColor: string;
  vpColor: string;
  onChangeHpColor: (color: string) => void;
  onChangeVpColor: (color: string) => void;
  onResetColors: () => void;
  isDark?: boolean;
}

export const PlaneColorPicker: React.FC<PlaneColorPickerProps> = ({
  hpColor,
  vpColor,
  onChangeHpColor,
  onChangeVpColor,
  onResetColors,
  isDark = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isDefaultColors = hpColor === '#2563eb' && vpColor === '#dc2626';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition shadow-xs"
        title="Customize Horizontal Plane (HP) and Vertical Plane (VP) Colors"
      >
        <Palette className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Plane Colors:</span>
        <div className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full border border-white dark:border-slate-800 shadow-xs"
            style={{ backgroundColor: hpColor }}
            title={`HP Color: ${hpColor}`}
          />
          <span className="text-[10px] font-mono text-slate-400">HP</span>
          <span
            className="w-3 h-3 rounded-full border border-white dark:border-slate-800 shadow-xs ml-1"
            style={{ backgroundColor: vpColor }}
            title={`VP Color: ${vpColor}`}
          />
          <span className="text-[10px] font-mono text-slate-400">VP</span>
        </div>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
              <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Select Plane Colors</span>
            </div>
            {!isDefaultColors && (
              <button
                type="button"
                onClick={onResetColors}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 transition"
                title="Reset to classic Engineering Blue & Red"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* 1. Horizontal Plane (HP) Color Picker */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-xs"
                  style={{ backgroundColor: hpColor }}
                />
                <span>Horizontal Plane (HP) Color</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-400 uppercase">{hpColor}</span>
                <input
                  type="color"
                  value={hpColor}
                  onChange={(e) => onChangeHpColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                  title="Custom color"
                />
              </div>
            </div>

            {/* HP Preset Swatches */}
            <div className="grid grid-cols-6 gap-1.5">
              {HP_COLOR_PRESETS.map((preset) => {
                const isSelected = hpColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onChangeHpColor(preset.value)}
                    className={`h-7 rounded-md transition transform hover:scale-105 flex items-center justify-center relative ${
                      isSelected ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-100' : 'opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Vertical Plane (VP) Color Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-xs"
                  style={{ backgroundColor: vpColor }}
                />
                <span>Vertical Plane (VP) Color</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-400 uppercase">{vpColor}</span>
                <input
                  type="color"
                  value={vpColor}
                  onChange={(e) => onChangeVpColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                  title="Custom color"
                />
              </div>
            </div>

            {/* VP Preset Swatches */}
            <div className="grid grid-cols-6 gap-1.5">
              {VP_COLOR_PRESETS.map((preset) => {
                const isSelected = vpColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onChangeVpColor(preset.value)}
                    className={`h-7 rounded-md transition transform hover:scale-105 flex items-center justify-center relative ${
                      isSelected ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-100' : 'opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
            Applies across 3D planes, view projectors, and 2D drawing marks
          </div>
        </div>
      )}
    </div>
  );
};
