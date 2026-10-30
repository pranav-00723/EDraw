import React, { useState, useRef, useMemo } from 'react';
import { ComputedPoint } from '../types/projection';
import {
  Download,
  FileCode,
  Printer,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  // Compute bounding box for automatic scale & centering
  const viewWidth = 800;
  const viewHeight = 460;
  const originX = viewWidth / 2;
  const originY = viewHeight / 2;

  // Drawing scale: 1 mm = S pixels
  // Determine scale factor so all points fit comfortably
  const scale = useMemo(() => {
    if (points.length === 0) return 2.5;

    let maxX = 40;
    let maxY = 40;

    points.forEach((p) => {
      maxX = Math.max(maxX, Math.abs(p.x) + 30);
      maxY = Math.max(
        maxY,
        Math.abs(p.frontViewY) + 35,
        Math.abs(p.topViewY) + 35
      );
    });

    const scaleX = (viewWidth / 2 - 80) / maxX;
    const scaleY = (viewHeight / 2 - 60) / maxY;
    return Math.min(Math.max(Math.min(scaleX, scaleY), 1.2), 3.5);
  }, [points]);

  // Coordinate conversion:
  // mm coordinate (x_mm, y_mm relative to XY line) -> SVG pixel coordinate
  // SVG Y goes downward, so:
  // Above XY (+y_mm): originY - y_mm * scale
  // Below XY (-y_mm): originY + |y_mm| * scale
  const toSvgX = (xMm: number) => originX + xMm * scale + pan.x;
  const toSvgY = (yMm: number) => originY - yMm * scale + pan.y;

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 4));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Export Drawing as PNG
  const exportAsPng = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleFactor = 2; // High resolution 2x
    canvas.width = viewWidth * scaleFactor;
    canvas.height = viewHeight * scaleFactor;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Draw background
      ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `orthographic-projection-points-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  // Export Drawing as SVG
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

  // Print Drawing
  const handlePrint = () => {
    window.print();
  };

  // Visual Theme Variables
  const colors = {
    bg: isDark ? '#090d16' : '#ffffff',
    grid: isDark ? '#1e293b' : '#f1f5f9',
    gridMinor: isDark ? '#141e30' : '#f8fafc',
    xyLine: isDark ? '#f8fafc' : '#0f172a',
    projector: isDark ? '#475569' : '#94a3b8',
    dimension: isDark ? '#38bdf8' : '#0284c7',
    dimensionText: isDark ? '#bae6fd' : '#0369a1',
    textMain: isDark ? '#f1f5f9' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    titleBlockBorder: isDark ? '#334155' : '#cbd5e1',
  };

  return (
    <div className="flex flex-col w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden print:border-none print:shadow-none">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
            2D Orthographic Sheet
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            (Front View &amp; Top View • Scale {scale.toFixed(1)}:1)
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition ${
              showGrid
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Toggle Engineering Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 4))}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          <button
            onClick={exportAsPng}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium transition"
            title="Download crisp PNG drawing"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>

          <button
            onClick={exportAsSvg}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium transition"
            title="Download vector SVG drawing"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium transition"
            title="Print Drawing Sheet"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div
        className="relative w-full h-[460px] cursor-grab active:cursor-grabbing select-none overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="w-full h-full"
          style={{
            backgroundColor: colors.bg,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Engineering Dimension Arrowheads */}
            <marker
              id="dim-arrow-start"
              viewBox="0 0 10 10"
              refX="1"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 10 2 L 0 5 L 10 8 z" fill={colors.dimension} />
            </marker>
            <marker
              id="dim-arrow-end"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 10 5 L 0 8 z" fill={colors.dimension} />
            </marker>
            {/* Fine Grid Pattern */}
            <pattern
              id="eng-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke={colors.grid}
                strokeWidth="0.75"
              />
            </pattern>
          </defs>

          {/* Grid Background */}
          {showGrid && (
            <rect width={viewWidth} height={viewHeight} fill="url(#eng-grid)" />
          )}

          {/* Outer Border / Sheet Frame */}
          <rect
            x="15"
            y="15"
            width={viewWidth - 30}
            height={viewHeight - 30}
            fill="none"
            stroke={colors.titleBlockBorder}
            strokeWidth="1.5"
          />

          {/* Upper Sheet Label: Above XY Line */}
          <text
            x="28"
            y="35"
            fill={colors.textMuted}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="1"
          >
            ZONE 1: ABOVE REFERENCE LINE (XY)
          </text>
          <text
            x="28"
            y="48"
            fill={colors.textMuted}
            fontSize="9"
            fontFamily="sans-serif"
          >
            [Front View if Above HP | Top View if Behind VP]
          </text>

          {/* Lower Sheet Label: Below XY Line */}
          <text
            x="28"
            y={viewHeight - 55}
            fill={colors.textMuted}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="1"
          >
            ZONE 2: BELOW REFERENCE LINE (XY)
          </text>
          <text
            x="28"
            y={viewHeight - 42}
            fill={colors.textMuted}
            fontSize="9"
            fontFamily="sans-serif"
          >
            [Front View if Below HP | Top View if In Front of VP]
          </text>

          {/* REFERENCE GROUND LINE (X - Y) */}
          {/* Thin but distinctively visible reference line */}
          <g>
            <line
              x1="30"
              y1={originY + pan.y}
              x2={viewWidth - 30}
              y2={originY + pan.y}
              stroke={colors.xyLine}
              strokeWidth="1.2"
            />
            {/* End Point Markers and Labels 'X' and 'Y' */}
            <circle
              cx="30"
              cy={originY + pan.y}
              r="2"
              fill={colors.xyLine}
            />
            <circle
              cx={viewWidth - 30}
              cy={originY + pan.y}
              r="2"
              fill={colors.xyLine}
            />

            <text
              x="22"
              y={originY + pan.y + 5}
              fill={colors.xyLine}
              fontSize="18"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="end"
            >
              X
            </text>
            <text
              x={viewWidth - 20}
              y={originY + pan.y + 5}
              fill={colors.xyLine}
              fontSize="18"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="start"
            >
              Y
            </text>
          </g>

          {/* POINTS, PROJECTORS & DIMENSION LINES */}
          {points.map((pt, idx) => {
            const isSelected = pt.id === selectedPointId;
            const svgX = toSvgX(pt.x);
            const svgFvY = toSvgY(pt.frontViewY);
            const svgTvY = toSvgY(pt.topViewY);
            const svgGroundY = originY + pan.y;

            // Offset for dimension line (lateral spacing to prevent overlap)
            const dimOffset = 18 + idx * 8;
            const dimX = svgX + dimOffset;

            // Check if Front View and Top View coincide
            const viewsCoincide = Math.abs(svgFvY - svgTvY) < 1.5;

            return (
              <g
                key={pt.id}
                className="cursor-pointer"
                onClick={() => onSelectPoint && onSelectPoint(pt.id)}
              >
                {/* 1. The aa' Projector Line: Solid line connecting a' and a, sized to match dimension line thickness */}
                <line
                  x1={svgX}
                  y1={Math.min(svgFvY, svgTvY, svgGroundY)}
                  x2={svgX}
                  y2={Math.max(svgFvY, svgTvY, svgGroundY)}
                  stroke={isSelected ? pt.color : (isDark ? '#cbd5e1' : '#334155')}
                  strokeWidth="1.2"
                />

                {/* Ground Line Intersection marker */}
                <circle
                  cx={svgX}
                  cy={svgGroundY}
                  r="2"
                  fill={colors.xyLine}
                />

                {/* 2. FRONT VIEW POINT (a' or A') */}
                <g>
                  {/* Subtle target crosshair */}
                  <line
                    x1={svgX - 5}
                    y1={svgFvY}
                    x2={svgX + 5}
                    y2={svgFvY}
                    stroke={vpColor}
                    strokeWidth="1"
                  />
                  <line
                    x1={svgX}
                    y1={svgFvY - 5}
                    x2={svgX}
                    y2={svgFvY + 5}
                    stroke={vpColor}
                    strokeWidth="1"
                  />
                  {/* Main Point Marker */}
                  <circle
                    cx={svgX}
                    cy={svgFvY}
                    r={isSelected ? '4.5' : '3.5'}
                    fill={vpColor}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {/* Label: a' with prime symbol */}
                  <text
                    x={svgX - 8}
                    y={svgFvY + (pt.frontViewY >= 0 ? -6 : 14)}
                    fill={vpColor}
                    fontSize="13"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="end"
                  >
                    {viewsCoincide
                      ? `${pt.frontViewLabel} (${pt.topViewLabel})`
                      : pt.frontViewLabel}
                  </text>
                  <text
                    x={svgX - 8}
                    y={svgFvY + (pt.frontViewY >= 0 ? -18 : 25)}
                    fill={colors.textMuted}
                    fontSize="8.5"
                    fontFamily="sans-serif"
                    textAnchor="end"
                  >
                    (Elevation)
                  </text>
                </g>

                {/* 3. TOP VIEW POINT (a or A) if not coinciding */}
                {!viewsCoincide && (
                  <g>
                    <line
                      x1={svgX - 5}
                      y1={svgTvY}
                      x2={svgX + 5}
                      y2={svgTvY}
                      stroke={hpColor}
                      strokeWidth="1"
                    />
                    <line
                      x1={svgX}
                      y1={svgTvY - 5}
                      x2={svgX}
                      y2={svgTvY + 5}
                      stroke={hpColor}
                      strokeWidth="1"
                    />
                    <circle
                      cx={svgX}
                      cy={svgTvY}
                      r={isSelected ? '4.5' : '3.5'}
                      fill={hpColor}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    {/* Label: a */}
                    <text
                      x={svgX - 8}
                      y={svgTvY + (pt.topViewY >= 0 ? -6 : 14)}
                      fill={hpColor}
                      fontSize="13"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {pt.topViewLabel}
                    </text>
                    <text
                      x={svgX - 8}
                      y={svgTvY + (pt.topViewY >= 0 ? -18 : 25)}
                      fill={colors.textMuted}
                      fontSize="8.5"
                      fontFamily="sans-serif"
                      textAnchor="end"
                    >
                      (Plan)
                    </text>
                  </g>
                )}

                {/* 4. DIMENSION ANNOTATIONS */}
                {/* Distance for Front View (Height relative to HP) */}
                {pt.distHp > 0 && (
                  <g>
                    {/* Extension lines */}
                    <line
                      x1={svgX + 4}
                      y1={svgFvY}
                      x2={dimX + 8}
                      y2={svgFvY}
                      stroke={colors.projector}
                      strokeWidth="0.8"
                    />
                    <line
                      x1={svgX + 4}
                      y1={svgGroundY}
                      x2={dimX + 8}
                      y2={svgGroundY}
                      stroke={colors.projector}
                      strokeWidth="0.8"
                    />
                    {/* Dimension Line with Double Arrows */}
                    <line
                      x1={dimX}
                      y1={svgGroundY}
                      x2={dimX}
                      y2={svgFvY}
                      stroke={colors.dimension}
                      strokeWidth="1.2"
                      markerStart="url(#dim-arrow-start)"
                      markerEnd="url(#dim-arrow-end)"
                    />
                    {/* Measurement Text */}
                    <text
                      x={dimX + 4}
                      y={(svgGroundY + svgFvY) / 2 + 4}
                      fill={colors.dimensionText}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      {pt.distHp}
                    </text>
                  </g>
                )}

                {/* Distance for Top View (Depth relative to VP) */}
                {pt.distVp > 0 && !viewsCoincide && (
                  <g>
                    {/* Extension lines */}
                    <line
                      x1={svgX + 4}
                      y1={svgTvY}
                      x2={dimX + 8}
                      y2={svgTvY}
                      stroke={colors.projector}
                      strokeWidth="0.8"
                    />
                    {/* Dimension Line */}
                    <line
                      x1={dimX}
                      y1={svgGroundY}
                      x2={dimX}
                      y2={svgTvY}
                      stroke={colors.dimension}
                      strokeWidth="1.2"
                      markerStart="url(#dim-arrow-start)"
                      markerEnd="url(#dim-arrow-end)"
                    />
                    {/* Measurement Text */}
                    <text
                      x={dimX + 4}
                      y={(svgGroundY + svgTvY) / 2 + 4}
                      fill={colors.dimensionText}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      {pt.distVp}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Standard Engineering Drawing Title Block (Bottom-Right) */}
          <g transform={`translate(${viewWidth - 250}, ${viewHeight - 75})`}>
            <rect
              width="235"
              height="60"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={colors.titleBlockBorder}
              strokeWidth="1.2"
            />
            <line
              x1="0"
              y1="22"
              x2="235"
              y2="22"
              stroke={colors.titleBlockBorder}
              strokeWidth="0.8"
            />
            <text
              x="8"
              y="15"
              fill={colors.textMain}
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="bold"
            >
              ED2 — PROJECTION OF POINTS
            </text>
            <text
              x="8"
              y="37"
              fill={colors.textMuted}
              fontSize="8.5"
              fontFamily="monospace"
            >
              SCALE: 1:1 (All Dim. in mm)
            </text>
            <text
              x="8"
              y="50"
              fill={colors.textMuted}
              fontSize="8.5"
              fontFamily="monospace"
            >
              PROJECTION: ORTHOGRAPHIC
            </text>
          </g>
        </svg>

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 p-2 rounded bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[10px] font-mono shadow-sm pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: vpColor }}>
            <span className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: vpColor }} />
            <span>Front View a′ (Elevation on VP)</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: hpColor }}>
            <span className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: hpColor }} />
            <span>Top View a (Plan on HP)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
