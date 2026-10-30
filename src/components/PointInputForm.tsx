import React, { useState, useEffect } from 'react';
import { PointInput, HpRelation, VpRelation, PresetProblem } from '../types/projection';
import { POINT_COLORS, MARKER_COLOR_GRID, SAMPLE_PROBLEMS } from '../utils/projectionMath';
import {
  Plus,
  Trash2,
  Check,
  Edit2,
  RefreshCw,
  BookOpen,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Layers,
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
  onGenerate: () => void;
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
  onLoadPreset,
  onGenerate,
  isDark = false,
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
      // Check duplicate name unless editing the same point
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
        setHpError('Enter a positive distance in mm, or check "On HP".');
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
        setVpError('Enter a positive distance in mm, or check "On VP".');
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
    };

    if (editingId) {
      onUpdatePoint(pointData);
    } else {
      onAddPoint(pointData);
    }

    handleResetForm();
    onGenerate();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Main Form Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        {/* Card Header & Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{editingId ? 'Edit Point Parameters' : 'Define Point Parameters'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                {points.length} {points.length === 1 ? 'Point' : 'Points'} Active
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Specify the point position relative to the Horizontal and Vertical planes.
            </p>
          </div>
          {editingId && (
            <button
              onClick={handleResetForm}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              + New Point
            </button>
          )}
        </div>

        {/* 1. Point Identifier & Marker Colour Grid */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Point Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={4}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                placeholder="e.g. A, B, P"
                className={`w-full px-3 py-1.5 text-xs font-mono rounded-lg border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 uppercase ${
                  nameError
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                }`}
              />
              {nameError && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            {/* Current Active Marker Preview & Custom Hex Selector */}
            <div className="flex items-center gap-2 pt-1 sm:pt-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
                <span className="w-3.5 h-3.5 rounded-full shadow-xs flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{color.toUpperCase()}</span>
              </div>
              <label
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition"
                title="Choose custom marker color"
              >
                <span>Custom</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-4 h-4 rounded cursor-pointer border-0 p-0 ml-0.5"
                />
              </label>
            </div>
          </div>

          {/* Marker Colour Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Marker Colour Grid
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                16 Curated Drafting Colors
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              {MARKER_COLOR_GRID.map((swatch) => {
                const isSelected = color.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    title={`${swatch.name} (${swatch.hex})`}
                    className={`h-7 rounded-md transition transform hover:scale-105 flex items-center justify-center relative shadow-xs ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-blue-600 dark:ring-blue-400 z-10 scale-105 shadow-md'
                        : 'hover:opacity-90'
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

        {/* 2. SECTION A — HORIZONTAL PLANE (HP) */}
        <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: hpColor }} />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Section A: Position Relative to HP
              </span>
              <label
                className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                title="Change HP Color"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hpColor }} />
                <span>HP Color</span>
                <input
                  type="color"
                  value={hpColor}
                  onChange={(e) => onChangeHpColor?.(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            {/* "On HP" Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={onHp}
                onChange={(e) => {
                  setOnHp(e.target.checked);
                  setHpError(null);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Lies On HP (Height = 0)</span>
            </label>
          </div>

          {/* Above vs Below HP (Contradiction-proof selector) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition ${onHp ? 'opacity-40 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Direction Relative to HP
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  disabled={onHp}
                  onClick={() => setHpChoice('ABOVE')}
                  className={`py-1 text-xs font-medium rounded-md transition ${
                    hpChoice === 'ABOVE' && !onHp
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Above HP
                </button>
                <button
                  type="button"
                  disabled={onHp}
                  onClick={() => setHpChoice('BELOW')}
                  className={`py-1 text-xs font-medium rounded-md transition ${
                    hpChoice === 'BELOW' && !onHp
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Below HP
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Distance ({hpChoice === 'ABOVE' ? 'Above' : 'Below'} HP) in mm
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={onHp}
                  value={onHp ? 0 : distanceHp}
                  onChange={(e) => {
                    setDistanceHp(e.target.value);
                    setHpError(null);
                  }}
                  className={`w-full px-3 py-1.5 text-xs font-mono rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 pr-10 ${
                    hpError
                      ? 'border-red-500 focus:ring-red-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-mono pointer-events-none">
                  mm
                </span>
              </div>
            </div>
          </div>

          {hpError && (
            <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{hpError}</span>
            </p>
          )}
        </div>

        {/* 3. SECTION B — VERTICAL PLANE (VP) */}
        <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: vpColor }} />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Section B: Position Relative to VP
              </span>
              <label
                className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                title="Change VP Color"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vpColor }} />
                <span>VP Color</span>
                <input
                  type="color"
                  value={vpColor}
                  onChange={(e) => onChangeVpColor?.(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>

            {/* "On VP" Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={onVp}
                onChange={(e) => {
                  setOnVp(e.target.checked);
                  setVpError(null);
                }}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Lies On VP (Depth = 0)</span>
            </label>
          </div>

          {/* In Front vs Behind VP */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition ${onVp ? 'opacity-40 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Direction Relative to VP
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  disabled={onVp}
                  onClick={() => setVpChoice('IN_FRONT')}
                  className={`py-1 text-xs font-medium rounded-md transition ${
                    vpChoice === 'IN_FRONT' && !onVp
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  In Front of VP
                </button>
                <button
                  type="button"
                  disabled={onVp}
                  onClick={() => setVpChoice('BEHIND')}
                  className={`py-1 text-xs font-medium rounded-md transition ${
                    vpChoice === 'BEHIND' && !onVp
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Behind VP
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Distance ({vpChoice === 'IN_FRONT' ? 'In Front of' : 'Behind'} VP) in mm
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={onVp}
                  value={onVp ? 0 : distanceVp}
                  onChange={(e) => {
                    setDistanceVp(e.target.value);
                    setVpError(null);
                  }}
                  className={`w-full px-3 py-1.5 text-xs font-mono rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 pr-10 ${
                    vpError
                      ? 'border-red-500 focus:ring-red-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-red-500'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-mono pointer-events-none">
                  mm
                </span>
              </div>
            </div>
          </div>

          {vpError && (
            <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{vpError}</span>
            </p>
          )}
        </div>

        {/* 4. OPTIONAL LATERAL X COORDINATE (ALONG GROUND LINE XY) */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showOptionalX}
                onChange={(e) => setShowOptionalX(e.target.checked)}
                className="rounded border-slate-300 text-slate-700 focus:ring-slate-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Enable Lateral Offset along XY Axis (Optional X)</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Default X = 0 mm
            </span>
          </div>

          {showOptionalX && (
            <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Lateral X (mm):
              </span>
              <input
                type="number"
                step="5"
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                placeholder="0"
                className="w-28 px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <span className="text-[11px] text-slate-400">
                (Negative = left of origin, Positive = right)
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons: Add/Update Point & Generate */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
          >
            {editingId ? (
              <>
                <Check className="w-4 h-4" />
                <span>Update Point {name.toUpperCase()}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Point {name.toUpperCase()}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onGenerate}
            className="flex items-center gap-1.5 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm"
            title="Recalculate and update 3D & 2D views"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate Projection</span>
          </button>

          <button
            type="button"
            onClick={onResetAll}
            className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-xs transition"
            title="Reset all points to default"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Point List Table / Chips */}
      {points.length > 0 && (
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Configured Points in Drawing
            </span>
            <span className="text-[10px] text-slate-400">
              Click a point to highlight in 3D &amp; 2D
            </span>
          </div>

          <div className="space-y-1.5">
            {points.map((pt) => {
              const isSelected = pt.id === selectedPointId;
              return (
                <div
                  key={pt.id}
                  onClick={() => onSelectPoint(pt.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: pt.color }}
                    />
                    <div>
                      <span className="font-bold font-mono text-slate-900 dark:text-slate-100 mr-2">
                        Point {pt.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {pt.hpRelation === 'ON' ? 'On HP' : `${pt.distanceHp}mm ${pt.hpRelation.toLowerCase()}`}, {' '}
                        {pt.vpRelation === 'ON' ? 'On VP' : `${pt.distanceVp}mm ${pt.vpRelation === 'IN_FRONT' ? 'in front' : 'behind'}`}
                        {pt.showOptionalX && pt.x !== 0 && ` (X: ${pt.x}mm)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onSelectPoint(pt.id)}
                      className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                      title="Edit point"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {points.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeletePoint(pt.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition"
                        title="Delete point"
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
