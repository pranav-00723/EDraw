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
  SlidersHorizontal,
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
  Palette,
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

const FEATURED_SWATCHES = [
  { hex: '#7138E8', name: 'EDRAW Purple' },
  { hex: '#dc2626', name: 'Crimson Red' },
  { hex: '#2563eb', name: 'Royal Blue' },
  { hex: '#16a34a', name: 'Emerald Green' },
  { hex: '#f59e0b', name: 'Amber Gold' },
  { hex: '#ec4899', name: 'Rose Pink' },
  { hex: '#1e1b4b', name: 'Deep Indigo' },
];

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
  const [showAllColors, setShowAllColors] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('A');
  const [color, setColor] = useState(POINT_COLORS[0]);

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
        setHpError('Enter a positive Z distance (> 0 mm) or enable "Lies On HP".');
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
        setVpError('Enter a positive Y distance (> 0 mm) or enable "Lies On VP".');
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

  // Live preview position for mini coordinate axes widget
  const miniDotPos = useMemo(() => {
    const zVal = onHp ? 0 : hpChoice === 'ABOVE' ? 1 : -1;
    const yVal = onVp ? 0 : vpChoice === 'IN_FRONT' ? 1 : -1;
    // Center of mini axes is (44, 52)
    const cx = 44 + (Number(coordX) || 0) * 0.12 - yVal * 10;
    const cy = 52 - zVal * 16 + yVal * 6;
    return {
      cx: Math.max(14, Math.min(78, cx)),
      cy: Math.max(14, Math.min(82, cy)),
    };
  }, [onHp, onVp, hpChoice, vpChoice, coordX]);

  const activeSpecialCount =
    (onHp ? 1 : 0) +
    (onVp ? 1 : 0) +
    (showOptionalX && Number(coordX) !== 0 ? 1 : 0) +
    (isHidden ? 1 : 0);

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Main Input Parameters Card */}
      <form
        onSubmit={handleFormSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] overflow-hidden"
      >
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
                {editingId
                  ? `Editing Point ${name.toUpperCase() || 'A'}`
                  : `New Point ${name.toUpperCase() || ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {editingId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-2 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 hover:bg-[#E6DAFF] text-[#7138E8] dark:text-purple-300 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                title="Create a new point"
              >
                + New
              </button>
            )}
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
            {/* 1. Point Coordinates (X, Y, Z) + Mini 3D Coordinate Axes Diagram */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                  Point Coordinates
                </span>
                <span className="text-[11px] font-mono text-[#77758F] dark:text-slate-400">
                  in mm
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2.5 items-center">
                {/* X, Y, Z Input Stack */}
                <div className="col-span-7 space-y-2">
                  {/* X Input */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="coord-x-input"
                      className="w-5 text-xs font-bold text-[#202044] dark:text-slate-200 shrink-0"
                    >
                      X :
                    </label>
                    <input
                      id="coord-x-input"
                      type="number"
                      step="5"
                      value={coordX}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCoordX(val);
                        setShowOptionalX(Number(val) !== 0);
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-950/60 text-xs font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none transition-all"
                      title="Lateral offset along XY reference line (mm)"
                    />
                  </div>

                  {/* Y Input (Distance from VP) */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="distance-vp-input"
                      className="w-5 text-xs font-bold text-[#202044] dark:text-slate-200 shrink-0"
                    >
                      Y :
                    </label>
                    <input
                      id="distance-vp-input"
                      type="number"
                      min="0"
                      step="1"
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
                      className={`w-full h-8 px-2.5 rounded-lg border bg-[#F8F7FC] dark:bg-slate-950/60 text-xs font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:outline-none transition-all ${
                        vpError
                          ? 'border-red-500 focus:ring-red-500/20'
                          : 'border-[#E8E2F5] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/15'
                      }`}
                      title="Distance perpendicular to VP (mm)"
                    />
                  </div>

                  {/* Z Input (Distance from HP) */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="distance-hp-input"
                      className="w-5 text-xs font-bold text-[#202044] dark:text-slate-200 shrink-0"
                    >
                      Z :
                    </label>
                    <input
                      id="distance-hp-input"
                      type="number"
                      min="0"
                      step="1"
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
                      className={`w-full h-8 px-2.5 rounded-lg border bg-[#F8F7FC] dark:bg-slate-950/60 text-xs font-mono font-semibold tabular-nums text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:outline-none transition-all ${
                        hpError
                          ? 'border-red-500 focus:ring-red-500/20'
                          : 'border-[#E8E2F5] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/15'
                      }`}
                      title="Height relative to HP (mm)"
                    />
                  </div>
                </div>

                {/* Mini 3D Coordinate Axes Graphic */}
                <div className="col-span-5 flex items-center justify-center rounded-xl bg-[#F8F7FC] dark:bg-slate-950/50 border border-[#E8E2F5] dark:border-slate-800 p-1.5">
                  <svg
                    viewBox="0 0 92 92"
                    className="w-full h-[86px] select-none"
                    aria-label="3D coordinate axes preview"
                  >
                    <defs>
                      <marker
                        id="mini-arrow-z"
                        viewBox="0 0 8 8"
                        refX="6"
                        refY="4"
                        markerWidth="4.5"
                        markerHeight="4.5"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#2563eb" />
                      </marker>
                      <marker
                        id="mini-arrow-x"
                        viewBox="0 0 8 8"
                        refX="6"
                        refY="4"
                        markerWidth="4.5"
                        markerHeight="4.5"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#dc2626" />
                      </marker>
                      <marker
                        id="mini-arrow-y"
                        viewBox="0 0 8 8"
                        refX="6"
                        refY="4"
                        markerWidth="4.5"
                        markerHeight="4.5"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#059669" />
                      </marker>
                    </defs>

                    {/* Subtle HP plane diamond */}
                    <polygon
                      points="44,44 76,54 44,68 12,56"
                      fill="#7138E8"
                      fillOpacity="0.09"
                      stroke="#7138E8"
                      strokeOpacity="0.25"
                      strokeWidth="0.8"
                    />

                    {/* Z Axis (Vertical) */}
                    <line
                      x1="44"
                      y1="72"
                      x2="44"
                      y2="14"
                      stroke="#2563eb"
                      strokeWidth="1.4"
                      markerEnd="url(#mini-arrow-z)"
                    />
                    <text x="48" y="16" fontSize="8" fontWeight="bold" fill="#2563eb" fontFamily="monospace">
                      Z
                    </text>

                    {/* X Axis (Lateral) */}
                    <line
                      x1="18"
                      y1="52"
                      x2="78"
                      y2="52"
                      stroke="#dc2626"
                      strokeWidth="1.4"
                      markerEnd="url(#mini-arrow-x)"
                    />
                    <text x="80" y="55" fontSize="8" fontWeight="bold" fill="#dc2626" fontFamily="monospace">
                      X
                    </text>

                    {/* Y Axis (Depth) */}
                    <line
                      x1="56"
                      y1="44"
                      x2="20"
                      y2="68"
                      stroke="#059669"
                      strokeWidth="1.4"
                      markerEnd="url(#mini-arrow-y)"
                    />
                    <text x="11" y="72" fontSize="8" fontWeight="bold" fill="#059669" fontFamily="monospace">
                      Y
                    </text>

                    {/* Origin */}
                    <circle cx="44" cy="52" r="2" fill="#202044" />

                    {/* Dynamic Point Marker */}
                    <line
                      x1="44"
                      y1="52"
                      x2={miniDotPos.cx}
                      y2={miniDotPos.cy}
                      stroke={color}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.7"
                    />
                    <circle
                      cx={miniDotPos.cx}
                      cy={miniDotPos.cy}
                      r="5.5"
                      fill={color}
                      fillOpacity="0.2"
                    />
                    <circle
                      cx={miniDotPos.cx}
                      cy={miniDotPos.cy}
                      r="3.2"
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  </svg>
                </div>
              </div>

              {(hpError || vpError) && (
                <div className="mt-2 space-y-1">
                  {hpError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{hpError}</span>
                    </p>
                  )}
                  {vpError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{vpError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 2. Position w.r.t HP & VP */}
            <div className="pt-1 border-t border-[#F0ECF9] dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                  Position w.r.t HP &amp; VP
                </span>
                {(onHp || onVp) && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F1EBFF] text-[#7138E8] dark:bg-purple-950/60 dark:text-purple-300">
                    {onHp && onVp ? 'On XY' : onHp ? 'On HP' : 'On VP'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* In Front of VP */}
                <button
                  type="button"
                  onClick={() => {
                    setOnVp(false);
                    setVpChoice('IN_FRONT');
                    if (Number(distanceVp) <= 0) setDistanceVp('40');
                    setVpError(null);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    !onVp && vpChoice === 'IN_FRONT'
                      ? 'border-[#7138E8] bg-[#F1EBFF]/70 dark:bg-purple-950/40 text-[#202044] dark:text-slate-100 font-semibold'
                      : 'border-[#E8E2F5] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#77758F] dark:text-slate-400 hover:border-[#9565F5]/50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                      !onVp && vpChoice === 'IN_FRONT'
                        ? 'border-[#7138E8] bg-[#7138E8]'
                        : 'border-[#D5CCE8] dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {!onVp && vpChoice === 'IN_FRONT' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="truncate">In Front of VP</span>
                </button>

                {/* Behind VP */}
                <button
                  type="button"
                  onClick={() => {
                    setOnVp(false);
                    setVpChoice('BEHIND');
                    if (Number(distanceVp) <= 0) setDistanceVp('40');
                    setVpError(null);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    !onVp && vpChoice === 'BEHIND'
                      ? 'border-[#7138E8] bg-[#F1EBFF]/70 dark:bg-purple-950/40 text-[#202044] dark:text-slate-100 font-semibold'
                      : 'border-[#E8E2F5] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#77758F] dark:text-slate-400 hover:border-[#9565F5]/50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                      !onVp && vpChoice === 'BEHIND'
                        ? 'border-[#7138E8] bg-[#7138E8]'
                        : 'border-[#D5CCE8] dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {!onVp && vpChoice === 'BEHIND' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="truncate">Behind VP</span>
                </button>

                {/* Above HP */}
                <button
                  type="button"
                  onClick={() => {
                    setOnHp(false);
                    setHpChoice('ABOVE');
                    if (Number(distanceHp) <= 0) setDistanceHp('30');
                    setHpError(null);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    !onHp && hpChoice === 'ABOVE'
                      ? 'border-[#7138E8] bg-[#F1EBFF]/70 dark:bg-purple-950/40 text-[#202044] dark:text-slate-100 font-semibold'
                      : 'border-[#E8E2F5] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#77758F] dark:text-slate-400 hover:border-[#9565F5]/50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                      !onHp && hpChoice === 'ABOVE'
                        ? 'border-[#7138E8] bg-[#7138E8]'
                        : 'border-[#D5CCE8] dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {!onHp && hpChoice === 'ABOVE' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="truncate">Above HP</span>
                </button>

                {/* Below HP */}
                <button
                  type="button"
                  onClick={() => {
                    setOnHp(false);
                    setHpChoice('BELOW');
                    if (Number(distanceHp) <= 0) setDistanceHp('30');
                    setHpError(null);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    !onHp && hpChoice === 'BELOW'
                      ? 'border-[#7138E8] bg-[#F1EBFF]/70 dark:bg-purple-950/40 text-[#202044] dark:text-slate-100 font-semibold'
                      : 'border-[#E8E2F5] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#77758F] dark:text-slate-400 hover:border-[#9565F5]/50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                      !onHp && hpChoice === 'BELOW'
                        ? 'border-[#7138E8] bg-[#7138E8]'
                        : 'border-[#D5CCE8] dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {!onHp && hpChoice === 'BELOW' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="truncate">Below HP</span>
                </button>
              </div>
            </div>

            {/* 3. Quadrant Dropdown */}
            <div>
              <label
                htmlFor="quadrant-select"
                className="block text-xs font-bold text-[#202044] dark:text-slate-100 mb-1.5"
              >
                Quadrant
              </label>
              <select
                id="quadrant-select"
                value={quadrantSelectValue}
                onChange={(e) => handleQuadrantChange(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-950/60 text-xs font-semibold text-[#202044] dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 focus:outline-none cursor-pointer transition-all"
              >
                <option value="FIRST">First Quadrant ( + + + )</option>
                <option value="SECOND">Second Quadrant ( + - + )</option>
                <option value="THIRD">Third Quadrant ( - - + )</option>
                <option value="FOURTH">Fourth Quadrant ( - + + )</option>
                <option value="ON_HP_IN_FRONT">On HP · In Front of VP (Q1 &amp; Q4)</option>
                <option value="ON_HP_BEHIND">On HP · Behind VP (Q2 &amp; Q3)</option>
                <option value="ON_VP_ABOVE">On VP · Above HP (Q1 &amp; Q2)</option>
                <option value="ON_VP_BELOW">On VP · Below HP (Q3 &amp; Q4)</option>
                <option value="ON_BOTH_XY">On XY Line (On Both HP &amp; VP)</option>
              </select>
            </div>

            {/* 4. Marker Colour Swatches */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#202044] dark:text-slate-100">
                  Marker Colour
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllColors((v) => !v)}
                  className="text-[11px] font-semibold text-[#7138E8] dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Palette className="w-3 h-3" />
                  <span>{showAllColors ? 'Compact' : '16 Swatches'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {FEATURED_SWATCHES.map((swatch) => {
                  const isSelected =
                    color.toLowerCase() === swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setColor(swatch.hex)}
                      title={`${swatch.name} (${swatch.hex})`}
                      aria-label={`Select color ${swatch.name}`}
                      aria-pressed={isSelected}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-[#7138E8] ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105'
                          : 'hover:scale-105 opacity-90 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      )}
                    </button>
                  );
                })}

                {/* Custom Color Picker Circle */}
                <label
                  className="w-6 h-6 rounded-full border border-dashed border-[#9565F5] bg-[#F1EBFF] dark:bg-slate-800 flex items-center justify-center text-[#7138E8] dark:text-purple-300 cursor-pointer hover:bg-[#E6DAFF] transition-colors"
                  title={`Custom marker color (${color.toUpperCase()})`}
                >
                  <Plus className="w-3 h-3" />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>

              {showAllColors && (
                <div className="mt-2.5 grid grid-cols-8 gap-1.5 p-2 rounded-xl bg-[#F8F7FC] dark:bg-slate-950/60 border border-[#E8E2F5] dark:border-slate-800">
                  {MARKER_COLOR_GRID.map((swatch) => {
                    const isSelected =
                      color.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => setColor(swatch.hex)}
                        title={`${swatch.name} (${swatch.hex})`}
                        aria-label={`Select color ${swatch.name}`}
                        className={`h-6 rounded-md border border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-[#7138E8] ring-offset-1'
                            : 'hover:opacity-85'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Additional Options (Collapsible) */}
            <div className="rounded-xl border border-[#E8E2F5] dark:border-slate-800 bg-[#F8F7FC]/70 dark:bg-slate-950/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdditionalOpen((v) => !v)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold text-[#202044] dark:text-slate-200 hover:bg-[#F1EBFF]/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-[#7138E8] dark:text-purple-400" />
                  <span>Additional Options</span>
                  {activeSpecialCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-[#7138E8] text-white">
                      {activeSpecialCount}
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
                <div className="px-3 pb-3 pt-1.5 space-y-3 border-t border-[#E8E2F5] dark:border-slate-800 text-xs">
                  {/* Point Name */}
                  <div>
                    <label
                      htmlFor="point-name-input"
                      className="block text-[11px] font-semibold text-[#77758F] dark:text-slate-400 mb-1"
                    >
                      Point Name
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
                      className={`w-full h-8 px-2.5 text-xs font-mono font-bold uppercase rounded-lg border bg-white dark:bg-slate-900 text-[#202044] dark:text-slate-100 focus:outline-none focus:ring-2 ${
                        nameError
                          ? 'border-red-500 focus:ring-red-500/20'
                          : 'border-[#E8E2F5] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/15'
                      }`}
                    />
                    {nameError && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{nameError}</span>
                      </p>
                    )}
                  </div>

                  {/* Boundary Plane Toggles */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-[#202044] dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={onHp}
                        onChange={(e) => {
                          setOnHp(e.target.checked);
                          if (!e.target.checked && Number(distanceHp) <= 0) {
                            setDistanceHp('30');
                          }
                          setHpError(null);
                        }}
                        className="rounded-xs accent-[#7138E8] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Lies On HP (Z=0)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-[#202044] dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={onVp}
                        onChange={(e) => {
                          setOnVp(e.target.checked);
                          if (!e.target.checked && Number(distanceVp) <= 0) {
                            setDistanceVp('40');
                          }
                          setVpError(null);
                        }}
                        className="rounded-xs accent-[#7138E8] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Lies On VP (Y=0)</span>
                    </label>
                  </div>

                  {/* Lateral X & Hidden Toggle */}
                  <div className="space-y-2">
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
                      <span>Enable Lateral X Offset along XY</span>
                    </label>

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
                  </div>

                  {/* HP & VP Plane Colours */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E8E2F5] dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-[#77758F] dark:text-slate-400">
                      Plane Colours
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-mono cursor-pointer">
                        <span
                          className="w-2.5 h-2.5 rounded-xs"
                          style={{ backgroundColor: hpColor }}
                        />
                        <span>HP</span>
                        <input
                          type="color"
                          value={hpColor}
                          onChange={(e) => onChangeHpColor?.(e.target.value)}
                          className="sr-only"
                        />
                      </label>
                      <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#E8E2F5] dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-mono cursor-pointer">
                        <span
                          className="w-2.5 h-2.5 rounded-xs"
                          style={{ backgroundColor: vpColor }}
                        />
                        <span>VP</span>
                        <input
                          type="color"
                          value={vpColor}
                          onChange={(e) => onChangeVpColor?.(e.target.value)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Quick Textbook Preset Loader */}
                  <div className="pt-1 border-t border-[#E8E2F5] dark:border-slate-800">
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
            <div className="space-y-2 pt-1">
              <button
                type="submit"
                className="w-full h-10 px-4 rounded-xl text-white font-semibold text-xs shadow-[0_8px_20px_-6px_rgba(113,56,232,0.55)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                style={{
                  background: 'linear-gradient(90deg, #7138E8 0%, #9565F5 100%)',
                }}
              >
                {editingId ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>Update View</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Add Point {name.toUpperCase()} &amp; View</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onResetAll}
                className="w-full h-9 px-4 rounded-xl border border-[#E8E2F5] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-800 hover:bg-[#F1EBFF] dark:hover:bg-slate-700 text-[#202044] dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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
