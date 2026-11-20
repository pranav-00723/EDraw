import React from 'react';
import { ComputedPoint } from '../types/projection';
import { Check, BarChart2, Lightbulb } from 'lucide-react';

interface QuadrantCardProps {
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
  hpColor?: string;
  vpColor?: string;
}

const getShortQuadrantLabels = (point: ComputedPoint) => {
  const validQuads = point.validQuadrants || [1];

  if (validQuads.length === 4) {
    return {
      bannerTitle: 'Point on XY Line (Both Planes)',
      shortBadge: 'On XY (Q1–Q4)',
    };
  }
  if (validQuads.includes(1) && validQuads.includes(4)) {
    return {
      bannerTitle: 'Point on HP & In Front of VP',
      shortBadge: 'Q1 & Q4 (On HP)',
    };
  }
  if (validQuads.includes(2) && validQuads.includes(3)) {
    return {
      bannerTitle: 'Point on HP & Behind VP',
      shortBadge: 'Q2 & Q3 (On HP)',
    };
  }
  if (validQuads.includes(1) && validQuads.includes(2)) {
    return {
      bannerTitle: 'Point on VP & Above HP',
      shortBadge: 'Q1 & Q2 (On VP)',
    };
  }
  if (validQuads.includes(3) && validQuads.includes(4)) {
    return {
      bannerTitle: 'Point on VP & Below HP',
      shortBadge: 'Q3 & Q4 (On VP)',
    };
  }
  if (validQuads.includes(1)) {
    return {
      bannerTitle: 'Point in First Quadrant',
      shortBadge: 'I Quadrant',
    };
  }
  if (validQuads.includes(2)) {
    return {
      bannerTitle: 'Point in Second Quadrant',
      shortBadge: 'II Quadrant',
    };
  }
  if (validQuads.includes(3)) {
    return {
      bannerTitle: 'Point in Third Quadrant',
      shortBadge: 'III Quadrant',
    };
  }
  return {
    bannerTitle: 'Point in Fourth Quadrant',
    shortBadge: 'IV Quadrant',
  };
};

const getPositionPhrases = (point: ComputedPoint) => {
  const vpPhrase =
    point.vpRelation === 'ON'
      ? 'On VP'
      : point.vpRelation === 'IN_FRONT'
      ? 'In Front of VP'
      : 'Behind VP';
  const hpPhrase =
    point.hpRelation === 'ON'
      ? 'On HP'
      : point.hpRelation === 'ABOVE'
      ? 'Above HP'
      : 'Below HP';
  return { vpPhrase, hpPhrase };
};

/**
 * 1st Answer Output: Purple Gradient Quadrant Status Card
 */
export const PointQuadrantCard: React.FC<QuadrantCardProps> = ({
  point,
  allPoints,
  onSelectPoint,
}) => {
  if (!point) return null;

  const { bannerTitle } = getShortQuadrantLabels(point);
  const { vpPhrase, hpPhrase } = getPositionPhrases(point);

  return (
    <div
      className="relative rounded-2xl p-4 text-white shadow-[0_12px_28px_-10px_rgba(113,56,232,0.55)] overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #7138E8 0%, #9565F5 100%)',
      }}
    >
      {/* Subtle 3D Cube Wireframe Watermark */}
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-3 -bottom-3 w-24 h-24 text-white/[0.15]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M50 10L85 30V70L50 90L15 70V30L50 10Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M50 10V50M50 50L85 70M50 50L15 70M15 30L50 50L85 30"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white/25">
          <Check className="w-5 h-5 stroke-[2.75]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] sm:text-[15px] font-bold leading-snug text-white">
            {bannerTitle}
          </h3>
          <p className="text-xs text-white/85 mt-0.5 truncate">
            {vpPhrase}, {hpPhrase}
          </p>
        </div>
      </div>

      {allPoints.length > 1 && (
        <div className="relative z-10 mt-3 pt-2.5 border-t border-white/20 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-white/75 font-medium">Point:</span>
          {allPoints.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPoint && onSelectPoint(p.id)}
              className={`px-2 py-0.5 rounded-lg font-mono font-bold transition cursor-pointer ${
                p.id === point.id
                  ? 'bg-white text-[#7138E8] shadow-xs'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 2nd Answer Output: Key Details & Quick Insights Cards
 */
export const PointParametersCard: React.FC<QuadrantCardProps> = ({
  point,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
}) => {
  if (!point) return null;

  const { bannerTitle, shortBadge } = getShortQuadrantLabels(point);
  const { vpPhrase, hpPhrase } = getPositionPhrases(point);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
      {/* Key Details Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] p-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F0ECF9] dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
            <h3 className="text-[14px] font-bold text-[#202044] dark:text-slate-100">
              Key Details
            </h3>
          </div>
          <span className="text-[11px] font-mono font-semibold text-[#77758F] dark:text-slate-400">
            Point {point.name}
          </span>
        </div>

        <div className="mt-3 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#77758F] dark:text-slate-400 font-medium">
              Distance from HP
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-mono font-bold tabular-nums">
              {point.distHp} mm
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[#77758F] dark:text-slate-400 font-medium">
              Distance from VP
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-mono font-bold tabular-nums">
              {point.distVp} mm
            </span>
          </div>

          {point.x !== 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#77758F] dark:text-slate-400 font-medium">
                Lateral Offset (X)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-mono font-bold tabular-nums">
                {point.x} mm
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[#77758F] dark:text-slate-400 font-medium">
              Quadrant
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 font-semibold">
              {shortBadge}
            </span>
          </div>

          <div className="pt-2 border-t border-[#F0ECF9] dark:border-slate-800 grid grid-cols-2 gap-2">
            <div className="p-2 rounded-xl bg-[#F8F7FC] dark:bg-slate-800/60 border border-[#E8E2F5] dark:border-slate-800">
              <div className="text-[10px] font-semibold text-[#77758F] dark:text-slate-400">
                Front View (VP)
              </div>
              <div
                className="text-sm font-mono font-bold mt-0.5"
                style={{ color: vpColor }}
              >
                {point.frontViewLabel}
              </div>
              <div className="text-[10px] text-[#77758F] dark:text-slate-400 truncate">
                {point.frontViewDesc}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#F8F7FC] dark:bg-slate-800/60 border border-[#E8E2F5] dark:border-slate-800">
              <div className="text-[10px] font-semibold text-[#77758F] dark:text-slate-400">
                Top View (HP)
              </div>
              <div
                className="text-sm font-mono font-bold mt-0.5"
                style={{ color: hpColor }}
              >
                {point.topViewLabel}
              </div>
              <div className="text-[10px] text-[#77758F] dark:text-slate-400 truncate">
                {point.topViewDesc}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Insights Card */}
      <div className="relative rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-[0_10px_30px_-12px_rgba(113,56,232,0.08)] p-4 overflow-hidden">
        {/* Drafting Compass Watermark */}
        <svg
          viewBox="0 0 64 64"
          className="pointer-events-none absolute -right-2 -bottom-2 w-20 h-20 text-[#7138E8]/15"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="32" cy="14" r="5" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M30 19L16 56M34 19L48 56M20 42H44"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative z-10 flex items-center gap-2 pb-2.5 border-b border-[#F0ECF9] dark:border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-[#F1EBFF] dark:bg-purple-950/60 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h3 className="text-[14px] font-bold text-[#202044] dark:text-slate-100">
            Quick Insights
          </h3>
        </div>

        <ul className="relative z-10 mt-3 space-y-2 text-xs text-[#202044] dark:text-slate-200">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span>{bannerTitle}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span>
              {vpPhrase}, {hpPhrase}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-[#F1EBFF] dark:bg-purple-950/70 text-[#7138E8] dark:text-purple-300 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span>
              Projectors aligned vertically ({point.frontViewLabel} &amp; {point.topViewLabel})
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export const QuadrantResultCard = PointQuadrantCard;
