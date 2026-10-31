/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ComputedLine } from '../../types/lines';

interface PictorialTracesDiagramProps {
  line: ComputedLine;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
}

export const PictorialTracesDiagram: React.FC<PictorialTracesDiagramProps> = ({
  line,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  isDark = true,
}) => {
  const width = 760;
  const height = 340;
  const groundY = 170;
  const originX = 240;

  // Scale computation to fit HT and VT
  const metrics = useMemo(() => {
    let minX = Math.min(0, line.aFront.x, line.bFront.x);
    let maxX = Math.max(line.dep, line.bFront.x);
    let minY = Math.min(0, line.aFront.y, line.bFront.y, line.aTop.y, line.bTop.y);
    let maxY = Math.max(0, line.aFront.y, line.bFront.y, line.aTop.y, line.bTop.y);

    if (line.ht.exists) {
      minX = Math.min(minX, line.ht.groundProj.x, line.ht.traceProj.x);
      maxX = Math.max(maxX, line.ht.groundProj.x, line.ht.traceProj.x);
      minY = Math.min(minY, line.ht.traceProj.y);
      maxY = Math.max(maxY, line.ht.traceProj.y);
    }
    if (line.vt.exists) {
      minX = Math.min(minX, line.vt.groundProj.x, line.vt.traceProj.x);
      maxX = Math.max(maxX, line.vt.groundProj.x, line.vt.traceProj.x);
      minY = Math.min(minY, line.vt.traceProj.y);
      maxY = Math.max(maxY, line.vt.traceProj.y);
    }

    const spanX = Math.max(maxX - minX, 80);
    const spanY = Math.max(maxY - minY, 60);

    const scaleX = 480 / spanX;
    const scaleY = 120 / spanY;
    const scale = Math.min(scaleX, scaleY, 2.2);

    const toX = (xMm: number) => originX + xMm * scale;
    const toY = (yMm: number) => groundY - yMm * scale;

    return {
      toX,
      toY,
      scale,
      ptAFront: { x: toX(line.aFront.x), y: toY(line.aFront.y) },
      ptATop: { x: toX(line.aTop.x), y: toY(line.aTop.y) },
      ptBFront: { x: toX(line.bFront.x), y: toY(line.bFront.y) },
      ptBTop: { x: toX(line.bTop.x), y: toY(line.bTop.y) },
      htGround: line.ht.exists ? { x: toX(line.ht.groundProj.x), y: toY(line.ht.groundProj.y) } : null,
      htTrace: line.ht.exists ? { x: toX(line.ht.traceProj.x), y: toY(line.ht.traceProj.y) } : null,
      vtGround: line.vt.exists ? { x: toX(line.vt.groundProj.x), y: toY(line.vt.groundProj.y) } : null,
      vtTrace: line.vt.exists ? { x: toX(line.vt.traceProj.x), y: toY(line.vt.traceProj.y) } : null,
    };
  }, [line]);

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-slate-700 bg-[#0b1329] shadow-inner">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        <defs>
          <pattern id="traces-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#16274a" strokeWidth="0.8" opacity="0.6" />
          </pattern>
        </defs>

        <rect width={width} height={height} fill="url(#traces-grid)" />

        {/* Reference Line XY */}
        <line x1={30} y1={groundY} x2={width - 30} y2={groundY} stroke="#cbd5e1" strokeWidth="1.6" />
        <text x={20} y={groundY + 5} fill="#f1f5f9" fontSize="14" fontWeight="bold" fontFamily="monospace">
          X
        </text>
        <text x={width - 20} y={groundY + 5} fill="#f1f5f9" fontSize="14" fontWeight="bold" fontFamily="monospace">
          Y
        </text>

        {/* Front View a'b' */}
        <line
          x1={metrics.ptAFront.x}
          y1={metrics.ptAFront.y}
          x2={metrics.ptBFront.x}
          y2={metrics.ptBFront.y}
          stroke="#ef4444"
          strokeWidth="3"
        />
        {/* Top View ab */}
        <line
          x1={metrics.ptATop.x}
          y1={metrics.ptATop.y}
          x2={metrics.ptBTop.x}
          y2={metrics.ptBTop.y}
          stroke="#3b82f6"
          strokeWidth="3"
        />

        {/* Points a', b', a, b */}
        <circle cx={metrics.ptAFront.x} cy={metrics.ptAFront.y} r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
        <text x={metrics.ptAFront.x - 14} y={metrics.ptAFront.y - 6} fill="#fca5a5" fontSize="12" fontWeight="bold" fontFamily="monospace">
          {line.nameA.toLowerCase()}′
        </text>

        <circle cx={metrics.ptBFront.x} cy={metrics.ptBFront.y} r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
        <text x={metrics.ptBFront.x + 8} y={metrics.ptBFront.y - 6} fill="#fca5a5" fontSize="12" fontWeight="bold" fontFamily="monospace">
          {line.nameB.toLowerCase()}′
        </text>

        <circle cx={metrics.ptATop.x} cy={metrics.ptATop.y} r="4.5" fill="#3b82f6" stroke="#fff" strokeWidth="1" />
        <text x={metrics.ptATop.x - 14} y={metrics.ptATop.y + 14} fill="#93c5fd" fontSize="12" fontWeight="bold" fontFamily="monospace">
          {line.nameA.toLowerCase()}
        </text>

        <circle cx={metrics.ptBTop.x} cy={metrics.ptBTop.y} r="4.5" fill="#3b82f6" stroke="#fff" strokeWidth="1" />
        <text x={metrics.ptBTop.x + 8} y={metrics.ptBTop.y + 14} fill="#93c5fd" fontSize="12" fontWeight="bold" fontFamily="monospace">
          {line.nameB.toLowerCase()}
        </text>

        {/* Horizontal Trace (HT) Construction */}
        {line.ht.exists && metrics.htGround && metrics.htTrace && (
          <g>
            {/* Extended elevation to XY at h' */}
            <line
              x1={metrics.ptAFront.x}
              y1={metrics.ptAFront.y}
              x2={metrics.htGround.x}
              y2={metrics.htGround.y}
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="4,3"
              opacity="0.8"
            />
            {/* Ground point h' */}
            <circle cx={metrics.htGround.x} cy={metrics.htGround.y} r="3.5" fill="#ef4444" />
            <text x={metrics.htGround.x - 10} y={groundY - 8} fill="#fca5a5" fontSize="11" fontWeight="bold" fontFamily="monospace">
              h′
            </text>

            {/* Perpendicular projector from h' to h (HT) */}
            <line
              x1={metrics.htGround.x}
              y1={metrics.htGround.y}
              x2={metrics.htTrace.x}
              y2={metrics.htTrace.y}
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />

            {/* Extended plan to h */}
            <line
              x1={metrics.ptATop.x}
              y1={metrics.ptATop.y}
              x2={metrics.htTrace.x}
              y2={metrics.htTrace.y}
              stroke="#3b82f6"
              strokeWidth="1.2"
              strokeDasharray="4,3"
              opacity="0.8"
            />

            {/* Trace Point h (HT) */}
            <circle cx={metrics.htTrace.x} cy={metrics.htTrace.y} r="5.5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
            <text x={metrics.htTrace.x + 8} y={metrics.htTrace.y + 14} fill="#34d399" fontSize="12" fontWeight="bold" fontFamily="monospace">
              HT (h)
            </text>
          </g>
        )}

        {/* Vertical Trace (VT) Construction */}
        {line.vt.exists && metrics.vtGround && metrics.vtTrace && (
          <g>
            {/* Extended plan to XY at v */}
            <line
              x1={metrics.ptATop.x}
              y1={metrics.ptATop.y}
              x2={metrics.vtGround.x}
              y2={metrics.vtGround.y}
              stroke="#3b82f6"
              strokeWidth="1.2"
              strokeDasharray="4,3"
              opacity="0.8"
            />
            {/* Ground point v */}
            <circle cx={metrics.vtGround.x} cy={metrics.vtGround.y} r="3.5" fill="#3b82f6" />
            <text x={metrics.vtGround.x + 6} y={groundY + 14} fill="#93c5fd" fontSize="11" fontWeight="bold" fontFamily="monospace">
              v
            </text>

            {/* Perpendicular projector from v to v' (VT) */}
            <line
              x1={metrics.vtGround.x}
              y1={metrics.vtGround.y}
              x2={metrics.vtTrace.x}
              y2={metrics.vtTrace.y}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />

            {/* Extended elevation to v' */}
            <line
              x1={metrics.ptAFront.x}
              y1={metrics.ptAFront.y}
              x2={metrics.vtTrace.x}
              y2={metrics.vtTrace.y}
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="4,3"
              opacity="0.8"
            />

            {/* Trace Point v' (VT) */}
            <circle cx={metrics.vtTrace.x} cy={metrics.vtTrace.y} r="5.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            <text x={metrics.vtTrace.x + 8} y={metrics.vtTrace.y - 8} fill="#fbbf24" fontSize="12" fontWeight="bold" fontFamily="monospace">
              VT (v′)
            </text>
          </g>
        )}
      </svg>

      {/* Legend Badge in Top-Right Corner */}
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[10.5px] font-mono text-slate-300 flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>HT = {line.ht.exists ? `${line.ht.y.toFixed(1)} mm` : 'None (|| HP)'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>VT = {line.vt.exists ? `${line.vt.z.toFixed(1)} mm` : 'None (|| VP)'}</span>
        </span>
      </div>
    </div>
  );
};
