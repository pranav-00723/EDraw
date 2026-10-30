import React, { useState } from 'react';
import { ComputedPoint } from '../types/projection';
import {
  Compass,
  CheckCircle2,
  BookOpen,
  Info,
  HelpCircle,
  ArrowRight,
  Maximize2,
  ChevronRight,
} from 'lucide-react';

interface ExplanationPanelProps {
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  point,
  allPoints,
  onSelectPoint,
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'rules' | 'quadrants'>('details');

  if (!point) {
    return (
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
        No point selected. Add or select a point to see its technical explanation.
      </div>
    );
  }

  // Get quadrant theme badge colors
  const getBadgeStyle = (q: string) => {
    switch (q) {
      case 'FIRST':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'SECOND':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
      case 'THIRD':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'FOURTH':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    }
  };

  return (
    <div className="flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header with Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-slate-50 dark:bg-slate-850">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Pedagogical Engineering Analysis
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              activeTab === 'details'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            Point {point.name} Result
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              activeTab === 'rules'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            Rules of Projection
          </button>
          <button
            onClick={() => setActiveTab('quadrants')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              activeTab === 'quadrants'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
            }`}
          >
            Quadrant Matrix
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* TAB 1: POINT SPECIFIC TECHNICAL BREAKDOWN */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Classification Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-800 shadow"
                  style={{ backgroundColor: point.color }}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Point {point.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeStyle(
                        point.quadrant
                      )}`}
                    >
                      {point.quadrantTitle}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    Position: {point.hpRelation === 'ON' ? 'On HP' : `${point.distHp} mm ${point.hpRelation === 'ABOVE' ? 'Above HP' : 'Below HP'}`}, {point.vpRelation === 'ON' ? 'On VP' : `${point.distVp} mm ${point.vpRelation === 'IN_FRONT' ? 'In Front of VP' : 'Behind VP'}`}
                  </div>
                </div>
              </div>

              {allPoints.length > 1 && (
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400">Switch:</span>
                  {allPoints.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectPoint && onSelectPoint(p.id)}
                      className={`px-2 py-0.5 rounded font-mono font-bold transition ${
                        p.id === point.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-100'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Explanation Prose */}
            <div className="p-3 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Geometrical Explanation</span>
              </div>
              <p>{point.explanation}</p>
            </div>

            {/* 2D Orthographic Mapping Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Front View Card */}
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>Front View (Elevation)</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                    {point.frontViewLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                  <div>Position: <strong className="text-slate-900 dark:text-slate-200">{point.frontViewDesc}</strong></div>
                  <div>Projected on: Vertical Plane (VP)</div>
                  <div>Distance from HP: {point.distHp} mm</div>
                </div>
              </div>

              {/* Top View Card */}
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>Top View (Plan)</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {point.topViewLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                  <div>Position: <strong className="text-slate-900 dark:text-slate-200">{point.topViewDesc}</strong></div>
                  <div>Projected on: Horizontal Plane (HP)</div>
                  <div>Distance from VP: {point.distVp} mm</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RULES OF PROJECTION OF POINTS */}
        {activeTab === 'rules' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Fundamental Conventions in Engineering Drawing</span>
              </h3>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300 text-[11.5px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">1.</span>
                  <span>
                    <strong>Reference Line (XY):</strong> Represents the line of intersection between HP and VP. It is drawn as a continuous horizontal reference line across the drawing sheet.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">2.</span>
                  <span>
                    <strong>Front View / Elevation (a′):</strong> Obtained by projecting the point onto the Vertical Plane (VP). Its distance from XY equals the distance of the point from HP. Labeled with small or capital letter with a <strong>prime (′)</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">3.</span>
                  <span>
                    <strong>Top View / Plan (a):</strong> Obtained by projecting the point onto the Horizontal Plane (HP). Its distance from XY equals the distance of the point from VP. Labeled <strong>without prime</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">4.</span>
                  <span>
                    <strong>90° Clockwise Rotation of HP:</strong> To draw both views on a flat 2D drawing sheet, the Horizontal Plane is always rotated <strong>90° clockwise</strong> about the XY axis.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">5.</span>
                  <span>
                    <strong>Common Projector:</strong> The Front View (a′) and Top View (a) of the same point always lie on the same straight perpendicular line to the XY reference line.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: COMPLETE QUADRANT MATRIX */}
        {activeTab === 'quadrants' && (
          <div className="overflow-x-auto text-xs">
            <table className="w-full border-collapse border border-slate-200 dark:border-slate-700 text-left">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Quadrant</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Position in Space</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Front View (a′)</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Top View (a)</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Drawing Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20">
                  <td className="p-2 font-bold text-blue-600">1st Quadrant</td>
                  <td className="p-2">Above HP, In Front of VP</td>
                  <td className="p-2 text-red-600 font-semibold">Above XY</td>
                  <td className="p-2 text-blue-600 font-semibold">Below XY</td>
                  <td className="p-2 font-sans">a′ above, a below XY</td>
                </tr>
                <tr className="hover:bg-red-50/30 dark:hover:bg-red-950/20">
                  <td className="p-2 font-bold text-red-600">2nd Quadrant</td>
                  <td className="p-2">Above HP, Behind VP</td>
                  <td className="p-2 text-red-600 font-semibold">Above XY</td>
                  <td className="p-2 text-blue-600 font-semibold">Above XY</td>
                  <td className="p-2 font-sans font-semibold text-amber-600">Both views ABOVE XY</td>
                </tr>
                <tr className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20">
                  <td className="p-2 font-bold text-emerald-600">3rd Quadrant</td>
                  <td className="p-2">Below HP, Behind VP</td>
                  <td className="p-2 text-red-600 font-semibold">Below XY</td>
                  <td className="p-2 text-blue-600 font-semibold">Above XY</td>
                  <td className="p-2 font-sans">a above, a′ below XY (3rd Angle)</td>
                </tr>
                <tr className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20">
                  <td className="p-2 font-bold text-purple-600">4th Quadrant</td>
                  <td className="p-2">Below HP, In Front of VP</td>
                  <td className="p-2 text-red-600 font-semibold">Below XY</td>
                  <td className="p-2 text-blue-600 font-semibold">Below XY</td>
                  <td className="p-2 font-sans font-semibold text-purple-600">Both views BELOW XY</td>
                </tr>
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-bold text-amber-600">On HP Boundary</td>
                  <td className="p-2">On HP, in front / behind VP</td>
                  <td className="p-2 text-red-600 font-semibold">On XY line</td>
                  <td className="p-2 text-blue-600 font-semibold">Below / Above XY</td>
                  <td className="p-2 font-sans">Elevation lies on XY</td>
                </tr>
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-bold text-amber-600">On VP Boundary</td>
                  <td className="p-2">Above / below HP, on VP</td>
                  <td className="p-2 text-red-600 font-semibold">Above / Below XY</td>
                  <td className="p-2 text-blue-600 font-semibold">On XY line</td>
                  <td className="p-2 font-sans">Plan lies on XY</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
