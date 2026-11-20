/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { ComputedPoint } from '../types/projection';
import {
  Download,
  FileCode,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface TwoDOrthographicViewProps {
  points: ComputedPoint[];
  selectedPointId: string | null;
  onSelectPoint?: (id: string) => void;
  isDark?: boolean;
  hpColor?: string;
  vpColor?: string;
}

export const TwoDOrthographicView: React.FC<TwoDOrthographicViewProps> = ({
  points,
  selectedPointId,
  onSelectPoint,
  isDark = false,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // View Options (matching LineTwoDOrthographicView)
  const [showLocus, setShowLocus] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [pencilMode, setPencilMode] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const sheetDark = isDark && !pencilMode;

  // SVG viewBox settings
  const baseWidth = 840;
  const baseHeight = 560;
  const originX = baseWidth / 2;
  const originY = 260;

  // Compute automatic scale and horizontal centering so all points fit cleanly
  const { mmScale, midX } = useMemo(() => {
    if (points.length === 0) return { mmScale: 2.4, midX: 0 };

    let minX = 0;
    let maxX = 0;
    let maxY = 45;

    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(
        maxY,
        Math.abs(p.frontViewY) + 30,
        Math.abs(p.topViewY) + 30
      );
    });

    const center = (minX + maxX) / 2;
    const spanX = Math.max(maxX - minX + 80, 100);
    const scaleX = (baseWidth - 220) / spanX;
    const scaleY = 195 / Math.max(maxY, 55);
    const s = Math.min(Math.max(Math.min(scaleX, scaleY), 0.8), 2.8);
    return { mmScale: s, midX: center };
  }, [points]);

  const toSvgX = (xMm: number) => originX + (xMm - midX) * mmScale;
  // In SVG, positive Y is downwards.
  // Above XY (+y_ortho) -> originY - y_ortho * mmScale
  // Below XY (-y_ortho) -> originY + |y_ortho| * mmScale
  const toSvgY = (yMm: number) => originY - yMm * mmScale;

  const selectedPoint =
    points.find((p) => p.id === selectedPointId) || points[0] || null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.5), 2.8));
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // High-Resolution 2x PNG Export
  const exportAsPng = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleFactor = 2;
    canvas.width = baseWidth * scaleFactor;
    canvas.height = baseHeight * scaleFactor;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = sheetDark ? '#0b1329' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (pencilMode) {
        ctx.filter = 'grayscale(100%) contrast(125%)';
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `orthographic-projection-points-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  // Export Vector SVG
  const exportAsSvg = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `orthographic-projection-points-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const leftmostSvgX =
    points.length > 0
      ? Math.min(...points.map((p) => toSvgX(p.x)))
      : originX;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs select-none">
        {/* Top-Left Floating Legend Pill */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: vpColor }} />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Front View: {selectedPoint ? selectedPoint.frontViewLabel : 'a′'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: hpColor }} />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Top View: {selectedPoint ? selectedPoint.topViewLabel : 'a'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

          <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">
            Projectors: 1.0px Solid
          </span>
        </div>

        {/* Top-Right Floating Controls Toolbar */}
        <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
          {/* Locus Toggle */}
          <button
            type="button"
            onClick={() => setShowLocus(!showLocus)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] cursor-pointer ${
              showLocus
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Toggle Horizontal Locus Lines"
          >
            Locus
          </button>

          {/* Dimensions Toggle */}
          <button
            type="button"
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] cursor-pointer ${
              showDimensions
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Toggle Distance Dimensions"
          >
            Dims
          </button>

          {/* Pencil Sketch Mode Toggle */}
          <button
            type="button"
            onClick={() => setPencilMode(!pencilMode)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] cursor-pointer ${
              pencilMode
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Toggle Monochrome Pencil Drawing Sketch (No Colors)"
          >
            Pencil Sketch
          </button>

          <div className="hidden md:flex items-center gap-1 ml-1">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Name"
              className="w-24 px-1.5 py-0.5 text-[10px] font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
            <input
              type="text"
              value={registerNo}
              onChange={(e) => setRegisterNo(e.target.value)}
              placeholder="Reg. No"
              className="w-20 px-1.5 py-0.5 text-[10px] font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Zoom Controls */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.8, z * 1.15))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.15))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Save PNG */}
          <button
            type="button"
            onClick={exportAsPng}
            className="px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 font-semibold cursor-pointer shadow-xs"
            title="Save Generated Projection as PNG Image"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-sans font-medium text-xs">Save PNG</span>
          </button>

          {/* Export SVG */}
          <button
            type="button"
            onClick={exportAsSvg}
            className="px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
            title="Download Vector SVG Drawing"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-sans font-medium text-xs">SVG</span>
          </button>
        </div>

        {/* SVG Drawing Canvas */}
        <div
          className="w-full h-[500px] overflow-hidden cursor-grab active:cursor-grabbing bg-slate-50/60 dark:bg-slate-950/80"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${baseWidth} ${baseHeight}`}
            className={`w-full h-full select-none ${pencilMode ? 'grayscale contrast-125 bg-white' : ''}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.12s ease-out',
            }}
          >
            <defs>
              {/* Outward pointing arrow markers for Dimension Lines */}
              <marker id="pt-dim-arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 10 2 L 0 5 L 10 8 z" fill={sheetDark ? '#94a3b8' : '#64748b'} />
              </marker>
              <marker id="pt-dim-arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 2 L 10 5 L 0 8 z" fill={sheetDark ? '#94a3b8' : '#64748b'} />
              </marker>
            </defs>

            {/* 1. Optional Horizontal Locus Lines */}
            {showLocus &&
              points.map((pt) => {
                const svgFvY = toSvgY(pt.frontViewY);
                const svgTvY = toSvgY(pt.topViewY);
                const lowerName = pt.name.toLowerCase();
                return (
                  <g key={`locus-${pt.id}`} className="locus-lines">
                    {Math.abs(pt.frontViewY) > 0.5 && (
                      <>
                        <line
                          x1={40}
                          y1={svgFvY}
                          x2={baseWidth - 40}
                          y2={svgFvY}
                          stroke={vpColor}
                          strokeWidth="0.9"
                          opacity="0.6"
                        />
                        <text
                          x={baseWidth - 45}
                          y={svgFvY - 5}
                          fill={vpColor}
                          fontSize="10"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="600"
                          textAnchor="end"
                          opacity="0.9"
                        >
                          Locus of {lowerName}′
                        </text>
                      </>
                    )}
                    {Math.abs(pt.topViewY) > 0.5 && (
                      <>
                        <line
                          x1={40}
                          y1={svgTvY}
                          x2={baseWidth - 40}
                          y2={svgTvY}
                          stroke={hpColor}
                          strokeWidth="0.9"
                          opacity="0.6"
                        />
                        <text
                          x={baseWidth - 45}
                          y={svgTvY + 12}
                          fill={hpColor}
                          fontSize="10"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="600"
                          textAnchor="end"
                          opacity="0.9"
                        >
                          Locus of {lowerName}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

            {/* 2. Ground Reference Line (XY Line) */}
            <g className="xy-ground-line">
              <line
                x1={30}
                y1={originY}
                x2={baseWidth - 30}
                y2={originY}
                stroke={sheetDark ? '#e2e8f0' : '#0f172a'}
                strokeWidth="1.5"
              />
              {/* X and Y Terminal Labels */}
              <text
                x={38}
                y={originY - 8}
                fill={sheetDark ? '#ffffff' : '#0f172a'}
                fontSize="16"
                fontWeight="bold"
                fontFamily="'Space Grotesk', sans-serif"
              >
                X
              </text>
              <text
                x={baseWidth - 50}
                y={originY - 8}
                fill={sheetDark ? '#ffffff' : '#0f172a'}
                fontSize="16"
                fontWeight="bold"
                fontFamily="'Space Grotesk', sans-serif"
              >
                Y
              </text>

              {/* Clean Plane Labels */}
              <text
                x={70}
                y={originY - 14}
                fill={vpColor}
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
                opacity="0.8"
              >
                Front View (VP)
              </text>
              <text
                x={70}
                y={originY + 22}
                fill={hpColor}
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
                opacity="0.8"
              >
                Top View (HP)
              </text>

              {/* Standard Textbook VP / HP notations next to leftmost projector */}
              <text
                x={Math.max(175, leftmostSvgX - 62)}
                y={originY - 8}
                fill={sheetDark ? '#e2e8f0' : '#0f172a'}
                fontSize="13"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
              >
                VP
              </text>
              <text
                x={Math.max(175, leftmostSvgX - 62)}
                y={originY + 18}
                fill={sheetDark ? '#e2e8f0' : '#0f172a'}
                fontSize="13"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
              >
                HP
              </text>
            </g>

            {/* 3. Points, Continuous Solid Projectors & Dimension Annotations */}
            {points.map((pt) => {
              const isSelected = pt.id === selectedPoint?.id;
              const svgX = toSvgX(pt.x);
              const svgFvY = toSvgY(pt.frontViewY);
              const svgTvY = toSvgY(pt.topViewY);

              const viewsCoincide = Math.abs(svgFvY - svgTvY) < 1.5;
              const isSameSide =
                (pt.frontViewY > 0 && pt.topViewY > 0) ||
                (pt.frontViewY < 0 && pt.topViewY < 0);

              let dimFvX = svgX - 18;
              let dimTvX = svgX - 18;
              if (isSameSide && !viewsCoincide) {
                if (pt.distHp <= pt.distVp) {
                  dimFvX = svgX - 18;
                  dimTvX = svgX - 38;
                } else {
                  dimTvX = svgX - 18;
                  dimFvX = svgX - 38;
                }
              }

              return (
                <g
                  key={pt.id}
                  className="cursor-pointer"
                  onClick={() => onSelectPoint && onSelectPoint(pt.id)}
                >
                  {/* Continuous Thin Solid Projector Line */}
                  <line
                    x1={svgX}
                    y1={Math.min(svgFvY, svgTvY, originY)}
                    x2={svgX}
                    y2={Math.max(svgFvY, svgTvY, originY)}
                    stroke={sheetDark ? '#94a3b8' : '#64748b'}
                    strokeWidth="1.0"
                  />

                  {/* Ground Line Intersection Marker */}
                  <circle
                    cx={svgX}
                    cy={originY}
                    r="2"
                    fill={sheetDark ? '#e2e8f0' : '#0f172a'}
                  />

                  {/* Dimension Annotations */}
                  {showDimensions && pt.distHp > 0 && (
                    <g>
                      <line
                        x1={svgX - 2}
                        y1={svgFvY}
                        x2={dimFvX - 5}
                        y2={svgFvY}
                        stroke={sheetDark ? '#94a3b8' : '#64748b'}
                        strokeWidth="0.75"
                        opacity="0.65"
                      />
                      <line
                        x1={svgX - 2}
                        y1={originY}
                        x2={dimFvX - 5}
                        y2={originY}
                        stroke={sheetDark ? '#94a3b8' : '#64748b'}
                        strokeWidth="0.75"
                        opacity="0.65"
                      />
                      <line
                        x1={dimFvX}
                        y1={originY}
                        x2={dimFvX}
                        y2={svgFvY}
                        stroke={sheetDark ? '#94a3b8' : '#64748b'}
                        strokeWidth="1.0"
                        markerStart="url(#pt-dim-arrow-start)"
                        markerEnd="url(#pt-dim-arrow-end)"
                      />
                      <text
                        x={dimFvX - 4}
                        y={(originY + svgFvY) / 2 + 3.5}
                        fill={sheetDark ? '#cbd5e1' : '#334155'}
                        fontSize="9.5"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        {pt.distHp}
                      </text>
                    </g>
                  )}

                  {showDimensions && pt.distVp > 0 && !viewsCoincide && (
                    <g>
                      <line
                        x1={svgX - 2}
                        y1={svgTvY}
                        x2={dimTvX - 5}
                        y2={svgTvY}
                        stroke={sheetDark ? '#94a3b8' : '#64748b'}
                        strokeWidth="0.75"
                        opacity="0.65"
                      />
                      <line
                        x1={svgX - 2}
                        y1={originY}
                        x2={dimTvX - 5}
                        y2={originY}
                        stroke={sheetDark ? '#94a3b8' : '#64748b'}
                        strokeWidth="0.75"
                        opacity="0.65"
                      />
                      <line
                        x1={dimTvX}
                        y1={originY}
                        x2={dimTvX}
                        y2={svgTvY}
                        stroke={sheetDark ? '#94a3b8' : '#64748b'}
                        strokeWidth="1.0"
                        markerStart="url(#pt-dim-arrow-start)"
                        markerEnd="url(#pt-dim-arrow-end)"
                      />
                      <text
                        x={dimTvX - 4}
                        y={(originY + svgTvY) / 2 + 3.5}
                        fill={sheetDark ? '#cbd5e1' : '#334155'}
                        fontSize="9.5"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        {pt.distVp}
                      </text>
                    </g>
                  )}

                  {/* Front View Point (a′) */}
                  <g>
                    {isSelected && (
                      <circle
                        cx={svgX}
                        cy={svgFvY}
                        r="5.5"
                        fill="none"
                        stroke={vpColor}
                        strokeWidth="1.1"
                        opacity="0.45"
                      />
                    )}
                    <circle
                      cx={svgX}
                      cy={svgFvY}
                      r={isSelected ? '3.0' : '2.4'}
                      fill={vpColor}
                      stroke="#ffffff"
                      strokeWidth="0.9"
                    />
                    <text
                      x={svgX + 8}
                      y={svgFvY + (pt.frontViewY >= 0 ? -4 : 13)}
                      fill={vpColor}
                      fontSize="12.5"
                      fontWeight="bold"
                      fontFamily="'Space Grotesk', sans-serif"
                    >
                      {viewsCoincide
                        ? `${pt.frontViewLabel} (${pt.topViewLabel})`
                        : pt.frontViewLabel}
                    </text>
                  </g>

                  {/* Top View Point (a) */}
                  {!viewsCoincide && (
                    <g>
                      {isSelected && (
                        <circle
                          cx={svgX}
                          cy={svgTvY}
                          r="5.5"
                          fill="none"
                          stroke={hpColor}
                          strokeWidth="1.1"
                          opacity="0.45"
                        />
                      )}
                      <circle
                        cx={svgX}
                        cy={svgTvY}
                        r={isSelected ? '3.0' : '2.4'}
                        fill={hpColor}
                        stroke="#ffffff"
                        strokeWidth="0.9"
                      />
                      <text
                        x={svgX + 8}
                        y={svgTvY + (pt.topViewY >= 0 ? -4 : 14)}
                        fill={hpColor}
                        fontSize="12.5"
                        fontWeight="bold"
                        fontFamily="'Space Grotesk', sans-serif"
                      >
                        {pt.topViewLabel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Drawing Sheet Title Block (Lower Right — Matches Straight Lines) */}
            <g transform={`translate(${baseWidth - 260}, ${baseHeight - 72})`}>
              <rect
                x="0"
                y="0"
                width="250"
                height="64"
                fill={sheetDark ? '#0f172a' : '#ffffff'}
                stroke={sheetDark ? '#94a3b8' : '#0f172a'}
                strokeWidth="1.2"
              />
              {/* EDraw Watermark */}
              <text
                x="242"
                y="58"
                fill={sheetDark ? '#334155' : '#e2e8f0'}
                fontSize="16"
                fontFamily="sans-serif"
                fontWeight="900"
                textAnchor="end"
              >
                EDraw
              </text>
              <line
                x1="0"
                y1="18"
                x2="250"
                y2="18"
                stroke={sheetDark ? '#334155' : '#0f172a'}
                strokeWidth="0.8"
              />
              <line
                x1="0"
                y1="34"
                x2="250"
                y2="34"
                stroke={sheetDark ? '#334155' : '#0f172a'}
                strokeWidth="0.8"
              />
              <line
                x1="130"
                y1="34"
                x2="130"
                y2="64"
                stroke={sheetDark ? '#334155' : '#0f172a'}
                strokeWidth="0.8"
              />
              <text
                x="8"
                y="13"
                fill={sheetDark ? '#f1f5f9' : '#0f172a'}
                fontSize="9"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                PROJECTION OF POINTS (1ST ANGLE)
              </text>
              <text
                x="8"
                y="29"
                fill={sheetDark ? '#f1f5f9' : '#0f172a'}
                fontSize="8"
                fontFamily="monospace"
              >
                Scale: 1:1 • All Dimensions in mm
              </text>
              <text
                x="8"
                y="47"
                fill={sheetDark ? '#f1f5f9' : '#0f172a'}
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                NAME: {studentName || '________________'}
              </text>
              <text
                x="136"
                y="47"
                fill={sheetDark ? '#f1f5f9' : '#0f172a'}
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                REG: {registerNo || '__________'}
              </text>
              <text
                x="8"
                y="59"
                fill={sheetDark ? '#94a3b8' : '#475569'}
                fontSize="7"
                fontFamily="monospace"
              >
                POINT {selectedPoint ? selectedPoint.name : 'A'} • BIS SP 46
              </text>
            </g>
          </svg>
        </div>

        {/* Bottom Legend & Status Bar (Matches Straight Lines) */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          {selectedPoint ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
                <span className="text-slate-600 dark:text-slate-400">
                  Front View ({selectedPoint.frontViewLabel}): {selectedPoint.frontViewDesc}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
                <span className="text-slate-600 dark:text-slate-400">
                  Top View ({selectedPoint.topViewLabel}): {selectedPoint.topViewDesc}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs bg-purple-500" />
                <span className="text-purple-600 dark:text-purple-400">
                  {selectedPoint.quadrantTitle}
                </span>
              </span>
            </div>
          ) : (
            <span className="text-slate-500">No point active</span>
          )}

          <div className="text-[11px] text-slate-400">
            Scale: 1 mm = {mmScale.toFixed(1)} px • Drag to Pan • Scroll to Zoom
          </div>
        </div>
      </div>
    </div>
  );
};
