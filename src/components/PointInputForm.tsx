import React, { useState, useEffect } from 'react';
import { PointInput, HpRelation, VpRelation, PresetProblem } from '../types/projection';
import { POINT_COLORS, MARKER_COLOR_GRID } from '../utils/projectionMath';
import {
  Plus,
  Trash2,
  Check,
  Edit2,
  AlertCircle,
} from 'lucide-react';

interface PointInputFormProps {
  points: PointInput[];
  selectedPointId: string | null;
  onAddPoint: (point: PointInput) => void;
  onUpdatePoint: (point: PointInput) => void;
  onDeletePoint: (id: string) => void;
  onSelectPoint: (id: string) => void;
  onResetAll: () => void;
  onLoadPreset: (preset: PresetProblem) => void;
  onGenerate?: () => void;
  isDark?: boolean;
  hpColor?: string;
  vpColor?: string;
  onChangeHpColor?: (color: string) => void;
  onChangeVpColor?: (color: string) => void;
}

export const PointInputForm: React.FC<PointInputFormProps> = ({
  points,
  selectedPointId,
  onAddPoint,
  onUpdatePoint,
  onDeletePoint,
  onSelectPoint,
  onResetAll,
  onGenerate,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  onChangeHpColor,
  onChangeVpColor,
}) => {
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('A');
  const [color, setColor] = useState(POINT_COLORS[0]);

  // HP Fields
  const [hpChoice, setHpChoice] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [distanceHp, setDistanceHp] = useState<string>('30');
  const [onHp, setOnHp] = useState<boolean>(false);

  // VP Fields
  const [vpChoice, setVpChoice] = useState<'IN_FRONT' | 'BEHIND'>('IN_FRONT');
  const [distanceVp, setDistanceVp] = useState<string>('40');
  const [onVp, setOnVp] = useState<boolean>(false);

  // Optional X Coordinate
  const [showOptionalX, setShowOptionalX] = useState<boolean>(false);
  const [coordX, setCoordX] = useState<string>('0');

  // Hidden Point Bracket Notation
  const [isHidden, setIsHidden] = useState<boolean>(false);

  // Error messages
  const [nameError, setNameError] = useState<string | null>(null);
  const [hpError, setHpError] = useState<string | null>(null);
  const [vpError, setVpError] = useState<string | null>(null);

  // Load selected point into form when selected or editing
  useEffect(() => {
    if (!selectedPointId) return;
    const pt = points.find((p) => p.id === selectedPointId);
    if (pt) {
      setEditingId(pt.id);
      setName(pt.name);
      setColor(pt.color);
      setIsHidden(!!pt.isHidden);
      setOnHp(pt.hpRelation === 'ON');
      if (pt.hpRelation !== 'ON') {
        setHpChoice(pt.hpRelation);
        setDistanceHp(String(pt.distanceHp));
      }
      setOnVp(pt.vpRelation === 'ON');
      if (pt.vpRelation !== 'ON') {
        setVpChoice(pt.vpRelation);
        setDistanceVp(String(pt.distanceVp));
      }
      setShowOptionalX(pt.showOptionalX);
      setCoordX(String(pt.x));
    }
  }, [selectedPointId, points]);

  // Generate next default point name (A, B, C...)
  const getNextAvailableName = () => {
    const existingNames = new Set(points.map((p) => p.name.toUpperCase()));
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < letters.length; i++) {
      if (!existingNames.has(letters[i])) {
        return letters[i];
      }
    }
    return `P${points.length + 1}`;
  };

  const handleResetForm = () => {
    setEditingId(null);
    setName(getNextAvailableName());
    setColor(POINT_COLORS[points.length % POINT_COLORS.length]);
    setIsHidden(false);
    setOnHp(false);
    setHpChoice('ABOVE');
    setDistanceHp('30');
    setOnVp(false);
    setVpChoice('IN_FRONT');
    setDistanceVp('40');
    setShowOptionalX(false);
    setCoordX('0');
    setNameError(null);
    setHpError(null);
    setVpError(null);
  };

  // Validation
  const validateForm = () => {
    let isValid = true;
    const cleanName = name.trim().toUpperCase();

    if (!cleanName) {
      setNameError('Point name is required (e.g. A, B, P).');
      isValid = false;
    } else {
      const isDuplicate = points.some(
        (p) => p.name.toUpperCase() === cleanName && p.id !== editingId
      );
      if (isDuplicate) {
        setNameError(`Point "${cleanName}" already exists. Use a unique name.`);
        isValid = false;
      } else {
        setNameError(null);
      }
    }

    if (!onHp) {
      const valHp = Number(distanceHp);
      if (isNaN(valHp) || valHp <= 0) {
        setHpError('Enter a positive distance in mm, or check "Lies On HP".');
        isValid = false;
      } else {
        setHpError(null);
      }
    } else {
      setHpError(null);
    }

    if (!onVp) {
      const valVp = Number(distanceVp);
      if (isNaN(valVp) || valVp <= 0) {
        setVpError('Enter a positive distance in mm, or check "Lies On VP".');
        isValid = false;
      } else {
        setVpError(null);
      }
    } else {
      setVpError(null);
    }

    return isValid;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const hpRelation: HpRelation = onHp ? 'ON' : hpChoice;
    const distHpNum = onHp ? 0 : Math.abs(Number(distanceHp) || 0);

    const vpRelation: VpRelation = onVp ? 'ON' : vpChoice;
    const distVpNum = onVp ? 0 : Math.abs(Number(distanceVp) || 0);

    const xVal = showOptionalX ? Number(coordX) || 0 : 0;

    const pointData: PointInput = {
      id: editingId || `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim().toUpperCase(),
      color,
      hpRelation,
      distanceHp: distHpNum,
      vpRelation,
      distanceVp: distVpNum,
      x: xVal,
      showOptionalX,
      isHidden,
    };

    if (editingId) {
      onUpdatePoint(pointData);
    } else {
      onAddPoint(pointData);
      handleResetForm();
    }

    onGenerate?.();
  };

  return (
    <div className="flex flex-col gap-4 w-full font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Unified Engineering Parameter Inspector */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800">
        {/* Panel Header */}
        <div className="px-5 py-4 flex items-start justify-between gap-3 bg-slate-50/60 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Point Parameters' : 'Define Point Parameters'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {points.length} {points.length === 1 ? 'Point' : 'Points'} Active
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Relative to HP &amp; VP</span>
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              + New Point
            </button>
          )}
        </div>

        {/* 1. Point Identifier & Marker Colour */}
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Point Name Input */}
            <div className="sm:col-span-5">
              <label
                htmlFor="point-name-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Point Name <span className="text-red-500">*</span>
              </label>
              <input
                id="point-name-input"
                type="text"
                maxLength={4}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                placeholder="e.g. A"
                className={`w-full h-9 px-3 text-sm font-mono font-semibold uppercase tracking-wider rounded-md border bg-slate-50/70 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 transition-colors ${
                  nameError
                    ? 'border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/15'
                }`}
              />
            </div>

            {/* Active Marker Hex Readout + Custom Color Trigger */}
            <div className="sm:col-span-7">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Active Marker Colour
              </span>
              <div className="h-9 flex items-center justify-between rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-xs border border-black/15 dark:border-white/20 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200 truncate">
                    {color.toUpperCase()}
                  </span>
                </div>

                <label
                  className="h-full px-3 flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shrink-0"
                  title="Choose custom marker color"
                >
                  <span>Custom</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-4 h-4 rounded-xs cursor-pointer border-0 p-0 bg-transparent"
                  />
                </label>
              </div>
            </div>
          </div>

          {nameError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{nameError}</span>
            </p>
          )}

          {/* Marker Colour Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Marker Swatches
              </span>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                16 Drafting Colors
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-md bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              {MARKER_COLOR_GRID.map((swatch) => {
                const isSelected = color.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    title={`${swatch.name} (${swatch.hex})`}
                    aria-label={`Select color ${swatch.name}`}
                    aria-pressed={isSelected}
                    className={`h-7 rounded-sm border border-black/10 dark:border-white/10 transition-opacity flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950'
                        : 'hover:opacity-85'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. HORIZONTAL PLANE (HP) */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0 border border-black/10 dark:border-white/15"
                style={{ backgroundColor: hpColor }}
              />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Horizontal Plane (HP)
              </h3>
              <label
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-[11px] font-mono text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                title="Change HP Color"
              >
                <span
                  className="w-2 h-2 rounded-xs"
                  style={{ backgroundColor: hpColor }}
                />
                <span>Color</span>
                <input
                  type="color"
                  value={hpColor}
                  onChange={(e) => onChangeHpColor?.(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={onHp}
                onChange={(e) => {
                  setOnHp(e.target.checked);
                  setHpError(null);
                }}
                className="rounded-xs border-slate-300 dark:border-slate-600 accent-blue-600 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Lies On HP (Height = 0)</span>
            </label>
          </div>

          <div
            className={`grid grid-cols-1 sm:grid-cols-12 gap-3 transition-opacity duration-150 ${
              onHp ? 'opacity-45 pointer-events-none' : ''
            }`}
          >
            <div className="sm:col-span-7">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Direction Relative to HP
              </span>
              <div className="grid grid-cols-2 p-0.5 h-9 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  disabled={onHp}
                  onClick={() => setHpChoice('ABOVE')}
                  className={`px-2 text-xs rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    hpChoice === 'ABOVE' && !onHp
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {hpChoice === 'ABOVE' && !onHp && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: hpColor }}
                    />
                  )}
                  <span>Above HP</span>
                </button>
                <button
                  type="button"
                  disabled={onHp}
                  onClick={() => setHpChoice('BELOW')}
                  className={`px-2 text-xs rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    hpChoice === 'BELOW' && !onHp
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {hpChoice === 'BELOW' && !onHp && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: hpColor }}
                    />
                  )}
                  <span>Below HP</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-5">
              <label
                htmlFor="distance-hp-input"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 truncate"
              >
                {hpChoice === 'ABOVE' ? 'Above' : 'Below'} HP
              </label>
              <div
                className={`h-9 flex items-center rounded-md border bg-white dark:bg-slate-950/60 overflow-hidden focus-within:ring-2 transition-colors ${
                  hpError
                    ? 'border-red-500 focus-within:ring-red-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus-within:border-blue-600 focus-within:ring-blue-600/15'
                }`}
              >
                <input
                  id="distance-hp-input"
                  type="number"
                  min="0"
                  step="1"
                  disabled={onHp}
                  value={onHp ? 0 : distanceHp}
                  onChange={(e) => {
                    setDistanceHp(e.target.value);
                    setHpError(null);
                  }}
                  className="w-full h-full px-3 text-xs font-mono font-medium tabular-nums bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <span className="h-full px-2.5 flex items-center bg-slate-50 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-500 dark:text-slate-400 select-none">
                  mm
                </span>
              </div>
            </div>
          </div>

          {hpError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{hpError}</span>
            </p>
          )}
        </div>

        {/* 3. VERTICAL PLANE (VP) */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0 border border-black/10 dark:border-white/15"
                style={{ backgroundColor: vpColor }}
              />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Vertical Plane (VP)
              </h3>
              <label
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-[11px] font-mono text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                title="Change VP Color"
              >
                <span
                  className="w-2 h-2 rounded-xs"
                  style={{ backgroundColor: vpColor }}
                />
                <span>Color</span>
                <input
                  type="color"
                  value={vpColor}
                  onChange={(e) => onChangeVpColor?.(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={onVp}
                onChange={(e) => {
                  setOnVp(e.target.checked);
                  setVpError(null);
                }}
                className="rounded-xs border-slate-300 dark:border-slate-600 accent-blue-600 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Lies On VP (Depth = 0)</span>
            </label>
          </div>

          <div
            className={`grid grid-cols-1 sm:grid-cols-12 gap-3 transition-opacity duration-150 ${
              onVp ? 'opacity-45 pointer-events-none' : ''
            }`}
          >
            <div className="sm:col-span-7">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Direction Relative to VP
              </span>
              <div className="grid grid-cols-2 p-0.5 h-9 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  disabled={onVp}
                  onClick={() => setVpChoice('IN_FRONT')}
                  className={`px-2 text-xs rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    vpChoice === 'IN_FRONT' && !onVp
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {vpChoice === 'IN_FRONT' && !onVp && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: vpColor }}
                    />
                  )}
                  <span>In Front</span>
                </button>
                <button
                  type="button"
                  disabled={onVp}
                  onClick={() => setVpChoice('BEHIND')}
                  className={`px-2 text-xs rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    vpChoice === 'BEHIND' && !onVp
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {vpChoice === 'BEHIND' && !onVp && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: vpColor }}
                    />
                  )}
                  <span>Behind VP</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-5">
              <label
                htmlFor="distance-vp-input"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 truncate"
              >
                {vpChoice === 'IN_FRONT' ? 'In Front of' : 'Behind'} VP
              </label>
              <div
                className={`h-9 flex items-center rounded-md border bg-white dark:bg-slate-950/60 overflow-hidden focus-within:ring-2 transition-colors ${
                  vpError
                    ? 'border-red-500 focus-within:ring-red-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus-within:border-blue-600 focus-within:ring-blue-600/15'
                }`}
              >
                <input
                  id="distance-vp-input"
                  type="number"
                  min="0"
                  step="1"
                  disabled={onVp}
                  value={onVp ? 0 : distanceVp}
                  onChange={(e) => {
                    setDistanceVp(e.target.value);
                    setVpError(null);
                  }}
                  className="w-full h-full px-3 text-xs font-mono font-medium tabular-nums bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <span className="h-full px-2.5 flex items-center bg-slate-50 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-500 dark:text-slate-400 select-none">
                  mm
                </span>
              </div>
            </div>
          </div>

          {vpError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{vpError}</span>
            </p>
          )}
        </div>

        {/* 4. OPTIONAL LATERAL X & HIDDEN BRACKET OPTIONS */}
        <div className="px-5 py-4 space-y-3">
          {/* Optional X Coordinate */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={showOptionalX}
                  onChange={(e) => setShowOptionalX(e.target.checked)}
                  className="rounded-xs border-slate-300 dark:border-slate-600 accent-blue-600 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Lateral Offset along XY (Optional X)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                X = 0 mm
              </span>
            </div>

            {showOptionalX && (
              <div className="mt-2.5 pl-5.5 flex flex-wrap items-center gap-3">
                <div className="h-8 w-32 flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15">
                  <input
                    type="number"
                    step="5"
                    value={coordX}
                    onChange={(e) => setCoordX(e.target.value)}
                    placeholder="0"
                    aria-label="Lateral X in millimeters"
                    className="w-full h-full px-2.5 text-xs font-mono tabular-nums bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <span className="h-full px-2 flex items-center bg-slate-50 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-500 dark:text-slate-400 select-none">
                    mm
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Negative = left, Positive = right
                </span>
              </div>
            )}
          </div>

          {/* Hidden Point Bracket Notation Toggle */}
          <label className="flex items-start gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              checked={isHidden}
              onChange={(e) => setIsHidden(e.target.checked)}
              className="mt-0.5 rounded-xs border-slate-300 dark:border-slate-600 accent-blue-600 w-3.5 h-3.5 cursor-pointer shrink-0"
            />
            <span className="leading-relaxed">
              Point is Hidden / Obstructed{' '}
              <span className="font-mono text-slate-500 dark:text-slate-400">
                ({name.toLowerCase()}), ({name.toLowerCase()}′)
              </span>
            </span>
          </label>
        </div>

        {/* 5. Action Buttons */}
        <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-950/40 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer whitespace-nowrap"
          >
            {editingId ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Update Point {name.toUpperCase()} &amp; Project</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add Point {name.toUpperCase()} &amp; Project</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onResetAll}
            className="h-9 px-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Reset all points to default"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Configured Points List */}
      {points.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Configured Points in Drawing
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Select to inspect
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {points.map((pt) => {
              const isSelected = pt.id === selectedPointId;
              return (
                <div
                  key={pt.id}
                  onClick={() => onSelectPoint(pt.id)}
                  className={`px-4 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/35'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0 border border-black/10 dark:border-white/15"
                      style={{ backgroundColor: pt.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          Point {pt.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
                        {pt.hpRelation === 'ON'
                          ? 'On HP'
                          : `${pt.distanceHp}mm ${pt.hpRelation.toLowerCase()}`}
                        {' · '}
                        {pt.vpRelation === 'ON'
                          ? 'On VP'
                          : `${pt.distanceVp}mm ${pt.vpRelation === 'IN_FRONT' ? 'in front' : 'behind'}`}
                        {pt.showOptionalX && pt.x !== 0 && ` · X: ${pt.x}mm`}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPoint(pt.id)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit point"
                      aria-label={`Edit Point ${pt.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {points.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeletePoint(pt.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete point"
                        aria-label={`Delete Point ${pt.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
