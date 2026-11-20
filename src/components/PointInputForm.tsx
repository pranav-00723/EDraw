import React, { useState, useEffect, useMemo } from 'react';
import {
  PointInput,
  HpRelation,
  VpRelation,
  PresetProblem,
} from '../types/projection';
import {
  POINT_COLORS,
  MARKER_COLOR_GRID,
  SAMPLE_PROBLEMS,
} from '../utils/projectionMath';
import {
  ChevronUp,
  ChevronDown,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Edit2,
  AlertCircle,
  Settings2,
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
  onLoadPreset,
  onGenerate,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  onChangeHpColor,
  onChangeVpColor,
}) => {
  // Collapse & section toggles
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('A');
  const [color, setColor] = useState(MARKER_COLOR_GRID[0].hex);

  // HP Fields (Z height)
  const [hpChoice, setHpChoice] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [distanceHp, setDistanceHp] = useState<string>('30');
  const [onHp, setOnHp] = useState<boolean>(false);

  // VP Fields (Y depth)
  const [vpChoice, setVpChoice] = useState<'IN_FRONT' | 'BEHIND'>('IN_FRONT');
  const [distanceVp, setDistanceVp] = useState<string>('40');
  const [onVp, setOnVp] = useState<boolean>(false);

  // Lateral X Coordinate
  const [showOptionalX, setShowOptionalX] = useState<boolean>(false);
  const [coordX, setCoordX] = useState<string>('0');

  // Hidden Point Bracket Notation
  const [isHidden, setIsHidden] = useState<boolean>(false);

  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [hpError, setHpError] = useState<string | null>(null);
  const [vpError, setVpError] = useState<string | null>(null);

  // Sync form state when selectedPointId or points change
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
      } else {
        setDistanceHp('0');
      }
      setOnVp(pt.vpRelation === 'ON');
      if (pt.vpRelation !== 'ON') {
        setVpChoice(pt.vpRelation);
        setDistanceVp(String(pt.distanceVp));
      } else {
        setDistanceVp('0');
      }
      setShowOptionalX(pt.showOptionalX);
      setCoordX(String(pt.x));
      setNameError(null);
      setHpError(null);
      setVpError(null);
    }
  }, [selectedPointId, points]);

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

  // Derive current quadrant dropdown value
  const quadrantSelectValue = useMemo(() => {
    if (onHp && onVp) return 'ON_BOTH_XY';
    if (onHp) return vpChoice === 'IN_FRONT' ? 'ON_HP_IN_FRONT' : 'ON_HP_BEHIND';
    if (onVp) return hpChoice === 'ABOVE' ? 'ON_VP_ABOVE' : 'ON_VP_BELOW';
    if (hpChoice === 'ABOVE' && vpChoice === 'IN_FRONT') return 'FIRST';
    if (hpChoice === 'ABOVE' && vpChoice === 'BEHIND') return 'SECOND';
    if (hpChoice === 'BELOW' && vpChoice === 'BEHIND') return 'THIRD';
    return 'FOURTH';
  }, [onHp, onVp, hpChoice, vpChoice]);

  const handleQuadrantChange = (val: string) => {
    setHpError(null);
    setVpError(null);
    switch (val) {
      case 'FIRST':
        setOnHp(false);
        setOnVp(false);
        setHpChoice('ABOVE');
        setVpChoice('IN_FRONT');
        if (Number(distanceHp) <= 0) setDistanceHp('30');
        if (Number(distanceVp) <= 0) setDistanceVp('40');
        break;
      case 'SECOND':
        setOnHp(false);
        setOnVp(false);
        setHpChoice('ABOVE');
        setVpChoice('BEHIND');
        if (Number(distanceHp) <= 0) setDistanceHp('30');
        if (Number(distanceVp) <= 0) setDistanceVp('40');
        break;
      case 'THIRD':
        setOnHp(false);
        setOnVp(false);
        setHpChoice('BELOW');
        setVpChoice('BEHIND');
        if (Number(distanceHp) <= 0) setDistanceHp('30');
        if (Number(distanceVp) <= 0) setDistanceVp('40');
        break;
      case 'FOURTH':
        setOnHp(false);
        setOnVp(false);
        setHpChoice('BELOW');
        setVpChoice('IN_FRONT');
        if (Number(distanceHp) <= 0) setDistanceHp('30');
        if (Number(distanceVp) <= 0) setDistanceVp('40');
        break;
      case 'ON_HP_IN_FRONT':
        setOnHp(true);
        setOnVp(false);
        setVpChoice('IN_FRONT');
        if (Number(distanceVp) <= 0) setDistanceVp('40');
        break;
      case 'ON_HP_BEHIND':
        setOnHp(true);
        setOnVp(false);
        setVpChoice('BEHIND');
        if (Number(distanceVp) <= 0) setDistanceVp('40');
        break;
      case 'ON_VP_ABOVE':
        setOnHp(false);
        setOnVp(true);
        setHpChoice('ABOVE');
        if (Number(distanceHp) <= 0) setDistanceHp('30');
        break;
      case 'ON_VP_BELOW':
        setOnHp(false);
        setOnVp(true);
        setHpChoice('BELOW');
        if (Number(distanceHp) <= 0) setDistanceHp('30');
        break;
      case 'ON_BOTH_XY':
        setOnHp(true);
        setOnVp(true);
        break;
    }
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
        setHpError('Enter a positive distance (> 0 mm) or check "Lies On HP".');
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
        setVpError('Enter a positive distance (> 0 mm) or check "Lies On VP".');
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

    const rawX = Number(coordX) || 0;
    const effectiveShowX = showOptionalX || rawX !== 0;

    const pointData: PointInput = {
      id:
        editingId ||
        `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim().toUpperCase(),
      color,
      hpRelation,
      distanceHp: distHpNum,
      vpRelation,
      distanceVp: distVpNum,
      x: effectiveShowX ? rawX : 0,
      showOptionalX: effectiveShowX,
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const activeSpecialCount =
    (showOptionalX && Number(coordX) !== 0 ? 1 : 0) + (isHidden ? 1 : 0);

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Main Edit / New Point Parameters Card */}
      <form
        onSubmit={handleFormSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#F0ECF9] dark:border-slate-800 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[14px] font-bold text-[#202044] dark:text-slate-100 leading-tight">
                {editingId ? 'Edit Point Parameters' : 'New Point Parameters'}
              </h2>
              <span className="text-[11px] font-mono font-semibold text-[#7138E8] dark:text-purple-300">
                {points.length} {points.length === 1 ? 'Point' : 'Points'} Active
              </span>
            </div>
            <p className="text-[11px] text-[#77758F] dark:text-slate-400 mt-1 leading-snug">
              Specify the point position relative to the Horizontal and Vertical planes.
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-2 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 hover:bg-[#E6DAFF] dark:hover:bg-purple-900/60 text-[#7138E8] dark:text-purple-300 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
              title="Start creating a new point"
            >
              <Plus className="w-3 h-3 shrink-0" />
              <span>New Point</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPanelExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-[#F8F7FC] dark:hover:bg-slate-800 text-[#77758F] dark:text-slate-400 transition-colors cursor-pointer"
              aria-label={isPanelExpanded ? 'Collapse point parameters' : 'Expand point parameters'}
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
            {/* 1. Point Name + Hex Readout + Custom Picker */}
            <div>
              <label
                htmlFor="point-name-input"
                className="block text-xs font-bold text-[#202044] dark:text-slate-100 mb-1.5"
              >
                Point Name <span className="text-rose-500">*</span>
              </label>

              <div className="flex items-center gap-1.5">
                <input
                  id="point-name-input"
                  type="text"
                  maxLength={4}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder="A"
                  className={`min-w-0 flex-1 h-9 px-3 text-xs font-mono font-bold uppercase rounded-xl border bg-[#F8F7FC] dark:bg-slate-950/60 text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 transition-all ${
                    nameError
                      ? 'border-red-500 focus:ring-red-500/20'
                      : 'border-[#E8E2F5] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/15'
                  }`}
                />

                {/* Active Hex Display */}
                <div
                  className="h-9 px-2.5 rounded-xl border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-950/60 flex items-center gap-1.5 shrink-0"
                  title={`Active marker color: ${color.toUpperCase()}`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-200 uppercase">
                    {color.toUpperCase()}
                  </span>
                </div>

                {/* Custom Color Picker Button */}
                <label
                  className="h-9 px-2.5 rounded-xl border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-950/60 hover:bg-[#F1EBFF] dark:hover:bg-slate-800 text-[#202044] dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors whitespace-nowrap"
                  title="Pick a custom marker color"
                >
                  <span>Custom</span>
                  <span
                    className="w-3.5 h-3.5 rounded-xs border border-black/15 dark:border-white/25 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>

              {nameError && (
                <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            {/* 2. Marker Colour Grid (16 Curated Drafting Colors) */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                  Marker Colour Grid
                </span>
                <span className="text-[11px] text-[#77758F] dark:text-slate-400">
                  16 Curated Drafting Colors
                </span>
              </div>

              <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-[#F8F7FC] dark:bg-slate-950/50 border border-[#E8E2F5] dark:border-slate-800">
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
                      className={`h-7 rounded-md transition-transform flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-[#7138E8] dark:ring-white ring-offset-1 ring-offset-[#F8F7FC] dark:ring-offset-slate-950 scale-[1.04]'
                          : 'opacity-90 hover:opacity-100 hover:scale-[1.03]'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Section A: Position Relative to HP */}
            <div className="rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/45 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: hpColor }}
                  />
                  <span className="text-xs font-bold text-[#202044] dark:text-slate-100 leading-snug">
                    Section A: Position Relative to HP
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 w-full sm:w-auto ml-auto">
                  <label
                    className="px-2 py-1 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F1EBFF] dark:hover:bg-slate-800 text-[10px] font-semibold text-[#202044] dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    title="Customize Horizontal Plane (HP) color"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: hpColor }}
                    />
                    <span>HP Color</span>
                    <input
                      type="color"
                      value={hpColor}
                      onChange={(e) => onChangeHpColor?.(e.target.value)}
                      className="sr-only"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#202044] dark:text-slate-300 cursor-pointer select-none leading-tight whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={onHp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOnHp(checked);
                        if (checked) {
                          setDistanceHp('0');
                        } else if (Number(distanceHp) <= 0) {
                          setDistanceHp('30');
                        }
                        setHpError(null);
                      }}
                      className="w-3.5 h-3.5 rounded-xs accent-[#7138E8] cursor-pointer shrink-0"
                    />
                    <span>Lies On HP (Height = 0)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-2 items-end">
                {/* Direction Relative to HP */}
                <div className="space-y-1 min-w-0">
                  <span className="block text-[10.5px] font-medium text-[#77758F] dark:text-slate-400 truncate">
                    Direction Relative to HP
                  </span>
                  <div className="grid grid-cols-2 p-0.5 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOnHp(false);
                        setHpChoice('ABOVE');
                        if (Number(distanceHp) <= 0) setDistanceHp('30');
                        setHpError(null);
                      }}
                      className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer text-center leading-tight ${
                        !onHp && hpChoice === 'ABOVE'
                          ? 'text-white shadow-xs'
                          : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                      }`}
                      style={
                        !onHp && hpChoice === 'ABOVE'
                          ? { backgroundColor: hpColor }
                          : undefined
                      }
                    >
                      Above HP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOnHp(false);
                        setHpChoice('BELOW');
                        if (Number(distanceHp) <= 0) setDistanceHp('30');
                        setHpError(null);
                      }}
                      className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer text-center leading-tight ${
                        !onHp && hpChoice === 'BELOW'
                          ? 'text-white shadow-xs'
                          : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                      }`}
                      style={
                        !onHp && hpChoice === 'BELOW'
                          ? { backgroundColor: hpColor }
                          : undefined
                      }
                    >
                      Below HP
                    </button>
                  </div>
                </div>

                {/* Distance Relative to HP */}
                <div className="space-y-1 min-w-0">
                  <label
                    htmlFor="distance-hp-input"
                    className="block text-[10.5px] font-medium text-[#77758F] dark:text-slate-400 truncate"
                  >
                    Distance ({onHp ? 'On HP' : hpChoice === 'ABOVE' ? 'Above HP' : 'Below HP'})
                  </label>
                  <div className="relative">
                    <input
                      id="distance-hp-input"
                      type="number"
                      min="0"
                      step="1"
                      disabled={onHp}
                      value={onHp ? 0 : distanceHp}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (Number(val) === 0 && val !== '') {
                          setOnHp(true);
                          setDistanceHp('0');
                        } else {
                          setOnHp(false);
                          setDistanceHp(val);
                        }
                        setHpError(null);
                      }}
                      className={`w-full h-9 pl-2.5 pr-8 rounded-lg border bg-white dark:bg-slate-900 text-xs font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        hpError
                          ? 'border-red-500 focus:ring-red-500/20'
                          : 'border-[#E8E2F5] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/15'
                      }`}
                      title="Distance relative to HP in mm"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F] dark:text-slate-400 pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
              </div>

              {hpError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{hpError}</span>
                </p>
              )}
            </div>

            {/* 4. Section B: Position Relative to VP */}
            <div className="rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/75 dark:bg-slate-950/45 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: vpColor }}
                  />
                  <span className="text-xs font-bold text-[#202044] dark:text-slate-100 leading-snug">
                    Section B: Position Relative to VP
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 w-full sm:w-auto ml-auto">
                  <label
                    className="px-2 py-1 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F1EBFF] dark:hover:bg-slate-800 text-[10px] font-semibold text-[#202044] dark:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    title="Customize Vertical Plane (VP) color"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: vpColor }}
                    />
                    <span>VP Color</span>
                    <input
                      type="color"
                      value={vpColor}
                      onChange={(e) => onChangeVpColor?.(e.target.value)}
                      className="sr-only"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#202044] dark:text-slate-300 cursor-pointer select-none leading-tight whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={onVp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOnVp(checked);
                        if (checked) {
                          setDistanceVp('0');
                        } else if (Number(distanceVp) <= 0) {
                          setDistanceVp('40');
                        }
                        setVpError(null);
                      }}
                      className="w-3.5 h-3.5 rounded-xs accent-[#7138E8] cursor-pointer shrink-0"
                    />
                    <span>Lies On VP (Depth = 0)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] gap-2 items-end">
                {/* Direction Relative to VP */}
                <div className="space-y-1 min-w-0">
                  <span className="block text-[10.5px] font-medium text-[#77758F] dark:text-slate-400 truncate">
                    Direction Relative to VP
                  </span>
                  <div className="grid grid-cols-2 p-0.5 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOnVp(false);
                        setVpChoice('IN_FRONT');
                        if (Number(distanceVp) <= 0) setDistanceVp('40');
                        setVpError(null);
                      }}
                      className={`py-1 px-1 rounded-md text-[10.5px] font-semibold transition-all cursor-pointer text-center leading-tight ${
                        !onVp && vpChoice === 'IN_FRONT'
                          ? 'text-white shadow-xs'
                          : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                      }`}
                      style={
                        !onVp && vpChoice === 'IN_FRONT'
                          ? { backgroundColor: vpColor }
                          : undefined
                      }
                    >
                      In Front of VP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOnVp(false);
                        setVpChoice('BEHIND');
                        if (Number(distanceVp) <= 0) setDistanceVp('40');
                        setVpError(null);
                      }}
                      className={`py-1 px-1 rounded-md text-[10.5px] font-semibold transition-all cursor-pointer text-center leading-tight ${
                        !onVp && vpChoice === 'BEHIND'
                          ? 'text-white shadow-xs'
                          : 'text-[#77758F] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-200'
                      }`}
                      style={
                        !onVp && vpChoice === 'BEHIND'
                          ? { backgroundColor: vpColor }
                          : undefined
                      }
                    >
                      Behind VP
                    </button>
                  </div>
                </div>

                {/* Distance Relative to VP */}
                <div className="space-y-1 min-w-0">
                  <label
                    htmlFor="distance-vp-input"
                    className="block text-[10.5px] font-medium text-[#77758F] dark:text-slate-400 truncate"
                  >
                    Distance ({onVp ? 'On VP' : vpChoice === 'IN_FRONT' ? 'In Front' : 'Behind VP'})
                  </label>
                  <div className="relative">
                    <input
                      id="distance-vp-input"
                      type="number"
                      min="0"
                      step="1"
                      disabled={onVp}
                      value={onVp ? 0 : distanceVp}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (Number(val) === 0 && val !== '') {
                          setOnVp(true);
                          setDistanceVp('0');
                        } else {
                          setOnVp(false);
                          setDistanceVp(val);
                        }
                        setVpError(null);
                      }}
                      className={`w-full h-9 pl-2.5 pr-8 rounded-lg border bg-white dark:bg-slate-900 text-xs font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        vpError
                          ? 'border-red-500 focus:ring-red-500/20'
                          : 'border-[#E8E2F5] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/15'
                      }`}
                      title="Distance perpendicular to VP in mm"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F] dark:text-slate-400 pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
              </div>

              {vpError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{vpError}</span>
                </p>
              )}
            </div>

            {/* 5. Additional Drafting Options (Quadrant Preset, Lateral X, Hidden, Examples) */}
            <div className="rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/70 dark:bg-slate-950/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdditionalOpen((v) => !v)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold text-[#202044] dark:text-slate-200 hover:bg-[#F1EBFF]/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-[#7138E8] dark:text-purple-400" />
                  <span>Additional Options (X Offset, Quadrant, Examples)</span>
                  {activeSpecialCount > 0 && (
                    <span className="text-[10px] font-mono font-bold text-[#7138E8] dark:text-purple-300">
                      ({activeSpecialCount})
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
                <div className="px-3 pb-3 pt-2 space-y-3 border-t border-[#E8E2F5] dark:border-slate-800 text-xs">
                  {/* Quadrant Quick Selector */}
                  <div>
                    <label
                      htmlFor="quadrant-select"
                      className="block text-[11px] font-semibold text-[#77758F] dark:text-slate-400 mb-1"
                    >
                      Quick Quadrant Preset
                    </label>
                    <select
                      id="quadrant-select"
                      value={quadrantSelectValue}
                      onChange={(e) => handleQuadrantChange(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:outline-none cursor-pointer"
                    >
                      <option value="FIRST">1st Quadrant (Above HP, In Front of VP)</option>
                      <option value="SECOND">2nd Quadrant (Above HP, Behind VP)</option>
                      <option value="THIRD">3rd Quadrant (Below HP, Behind VP)</option>
                      <option value="FOURTH">4th Quadrant (Below HP, In Front of VP)</option>
                      <option value="ON_HP_IN_FRONT">On HP · In Front of VP (Q1 &amp; Q4)</option>
                      <option value="ON_HP_BEHIND">On HP · Behind VP (Q2 &amp; Q3)</option>
                      <option value="ON_VP_ABOVE">On VP · Above HP (Q1 &amp; Q2)</option>
                      <option value="ON_VP_BELOW">On VP · Below HP (Q3 &amp; Q4)</option>
                      <option value="ON_BOTH_XY">On XY Line (On Both HP &amp; VP)</option>
                    </select>
                  </div>

                  {/* Lateral X Coordinate along XY */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-[#202044] dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={showOptionalX}
                        onChange={(e) => {
                          setShowOptionalX(e.target.checked);
                          if (!e.target.checked) setCoordX('0');
                        }}
                        className="rounded-xs accent-[#7138E8] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Lateral X Offset along XY (mm)</span>
                    </label>

                    {showOptionalX && (
                      <div className="relative">
                        <input
                          id="coord-x-input"
                          type="number"
                          step="5"
                          value={coordX}
                          onChange={(e) => setCoordX(e.target.value)}
                          className="w-full h-8 pl-2.5 pr-8 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-100 focus:border-[#7138E8] focus:outline-none"
                          title="Lateral offset along XY reference line (mm)"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#77758F]">
                          mm
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Hidden / Obstructed Bracket Notation */}
                  <label className="flex items-start gap-2 cursor-pointer text-[11px] font-medium text-[#202044] dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={isHidden}
                      onChange={(e) => setIsHidden(e.target.checked)}
                      className="mt-0.5 rounded-xs accent-[#7138E8] w-3.5 h-3.5 cursor-pointer shrink-0"
                    />
                    <span>
                      Hidden / Obstructed{' '}
                      <span className="font-mono text-[#77758F]">
                        ({(name || 'a').toLowerCase()}), ({(name || 'a').toLowerCase()}′)
                      </span>
                    </span>
                  </label>

                  {/* Standard Textbook Preset Loader */}
                  <div className="pt-1.5 border-t border-[#E8E2F5] dark:border-slate-800">
                    <label
                      htmlFor="preset-problem-select"
                      className="block text-[11px] font-semibold text-[#77758F] dark:text-slate-400 mb-1"
                    >
                      Load Standard Example
                    </label>
                    <select
                      id="preset-problem-select"
                      defaultValue=""
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        if (!isNaN(idx) && SAMPLE_PROBLEMS[idx]) {
                          onLoadPreset(SAMPLE_PROBLEMS[idx]);
                        }
                        e.target.value = '';
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-[#202044] dark:text-slate-200 cursor-pointer focus:outline-none focus:border-[#7138E8]"
                    >
                      <option value="" disabled>
                        Choose textbook preset...
                      </option>
                      {SAMPLE_PROBLEMS.map((p, idx) => (
                        <option key={p.title} value={idx}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Primary & Reset Action Buttons */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-0.5">
              <button
                type="submit"
                className="h-10 px-4 rounded-xl text-white font-semibold text-xs shadow-[0_8px_20px_-6px_rgba(113,56,232,0.55)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(90deg, #7138E8 0%, #9565F5 100%)',
                }}
              >
                {editingId ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>Update Point {name.toUpperCase() || 'A'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Add Point {name.toUpperCase() || 'A'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onResetAll}
                className="h-10 px-3 rounded-xl border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-800 hover:bg-[#F1EBFF] dark:hover:bg-slate-700 text-[#202044] dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Reset all points to default"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#7138E8] dark:text-purple-300 shrink-0" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Configured Points List Card */}
      {points.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_8px_24px_-12px_rgba(113,56,232,0.08)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#F0ECF9] dark:border-slate-800 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#202044] dark:text-slate-200">
              Configured Points ({points.length})
            </h3>
            <button
              type="button"
              onClick={handleResetForm}
              className="text-[11px] font-semibold text-[#7138E8] dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Point</span>
            </button>
          </div>

          <div className="divide-y divide-[#F0ECF9] dark:divide-slate-800 max-h-48 overflow-y-auto">
            {points.map((pt) => {
              const isSelected = pt.id === selectedPointId;
              return (
                <div
                  key={pt.id}
                  onClick={() => onSelectPoint(pt.id)}
                  className={`px-3.5 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#F1EBFF]/75 dark:bg-purple-950/35'
                      : 'hover:bg-[#F8F7FC] dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: pt.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-[#202044] dark:text-slate-100">
                          Point {pt.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-[#7138E8] dark:text-purple-300">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono tabular-nums text-[#77758F] dark:text-slate-400 truncate">
                        {pt.hpRelation === 'ON'
                          ? 'On HP'
                          : `${pt.distanceHp}mm ${pt.hpRelation.toLowerCase()}`}
                        {' · '}
                        {pt.vpRelation === 'ON'
                          ? 'On VP'
                          : `${pt.distanceVp}mm ${
                              pt.vpRelation === 'IN_FRONT' ? 'front' : 'behind'
                            }`}
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
                      className="p-1 rounded-md text-[#77758F] hover:text-[#7138E8] hover:bg-[#F1EBFF] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit point"
                      aria-label={`Edit Point ${pt.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {points.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeletePoint(pt.id)}
                        className="p-1 rounded-md text-[#77758F] hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
