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
  // Determine scale factor and horizontal center so all points fit comfortably
  const { scale, midX } = useMemo(() => {
    if (points.length === 0) return { scale: 2.5, midX: 0 };

    let minX = 0;
    let maxX = 0;
    let maxY = 35;

    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(
        maxY,
        Math.abs(p.frontViewY) + 35,
        Math.abs(p.topViewY) + 35
      );
    });

    const midX = (minX + maxX) / 2;
    const spanX = Math.max(maxX - minX + 60, 80);

    const scaleX = (viewWidth - 160) / spanX;
    const scaleY = (viewHeight / 2 - 65) / maxY;
    const s = Math.min(Math.max(Math.min(scaleX, scaleY), 0.8), 3.2);
    return { scale: s, midX };
  }, [points]);

  // Coordinate conversion:
  // mm coordinate (x_mm, y_mm relative to XY line) -> SVG pixel coordinate
  // SVG Y goes downward, so:
  // Above XY (+y_mm): originY - y_mm * scale
  // Below XY (-y_mm): originY + |y_mm| * scale
  const toSvgX = (xMm: number) => originX + (xMm - midX) * scale + pan.x;
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
  const exportAsPng = (asDrawingSheet: boolean) => {
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
      ctx.fillStyle = asDrawingSheet ? '#ffffff' : (isDark ? '#090d16' : '#ffffff');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (asDrawingSheet) {
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
    xyLine: '#0f172a',
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
            (Elevation [a′] on VP &amp; Plan [a] on HP • Scale {scale.toFixed(1)}:1)
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 text-xs">

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

          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value === 'sheet') exportAsPng(true);
              if (e.target.value === 'projections') exportAsPng(false);
              e.target.value = '';
            }}
            className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium text-xs transition cursor-pointer"
            title="Download PNG as Drawing Sheet or Projections"
          >
            <option value="" disabled>
              Download PNG ▾
            </option>
            <option value="sheet">Download as Drawing Sheet (B&amp;W)</option>
            <option value="projections">Download as Projections (Colored)</option>
          </select>

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
          className="w-full h-full grayscale contrast-125"
          style={{
            backgroundColor: '#ffffff',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Engineering Dimension Arrowheads - Pointing outward towards extension lines */}
            <marker
              id="dim-arrow-start"
              viewBox="0 0 10 10"
              refX="0"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M 10 2 L 0 5 L 10 8 z" fill={colors.dimension} />
            </marker>
            <marker
              id="dim-arrow-end"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M 0 2 L 10 5 L 0 8 z" fill={colors.dimension} />
            </marker>
          </defs>

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

          {/* PERSISTENT PROJECTION PLANE BOUNDARIES & EXPLICIT LABELS */}
          {/* Upper Zone: Front View (VP) Plane Boundary Outline */}
          <rect
            x="24"
            y="24"
            width={viewWidth - 48}
            height={Math.max(10, originY + pan.y - 28)}
            fill={isDark ? 'rgba(220, 38, 38, 0.03)' : 'rgba(220, 38, 38, 0.02)'}
            stroke={vpColor}
            strokeWidth="1.2"
            strokeDasharray="6,4"
            opacity="0.5"
            rx="4"
          />
          <g transform="translate(32, 40)">
            <rect x="0" y="-12" width="105" height="18" rx="3" fill={isDark ? '#1e1b2e' : '#fee2e2'} stroke={vpColor} strokeWidth="0.8" opacity="0.9" />
            <text
              x="6"
              y="1"
              fill={vpColor}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              Front View (VP)
            </text>
          </g>

          {/* Lower Zone: Top View (HP) Plane Boundary Outline */}
          <rect
            x="24"
            y={originY + pan.y + 4}
            width={viewWidth - 48}
            height={Math.max(10, viewHeight - (originY + pan.y) - 28)}
            fill={isDark ? 'rgba(37, 99, 235, 0.03)' : 'rgba(37, 99, 235, 0.02)'}
            stroke={hpColor}
            strokeWidth="1.2"
            strokeDasharray="6,4"
            opacity="0.5"
            rx="4"
          />
          <g transform={`translate(32, ${originY + pan.y + 22})`}>
            <rect x="0" y="-12" width="105" height="18" rx="3" fill={isDark ? '#172554' : '#dbeafe'} stroke={hpColor} strokeWidth="0.8" opacity="0.9" />
            <text
              x="6"
              y="1"
              fill={hpColor}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              Top View (HP)
            </text>
          </g>

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

            // Check if Front View and Top View coincide
            const viewsCoincide = Math.abs(svgFvY - svgTvY) < 1.5;

            // Dimensions placed immediately adjacent to the points (clean, compact engineering offset)
            const isSameSide = (pt.frontViewY > 0 && pt.topViewY > 0) || (pt.frontViewY < 0 && pt.topViewY < 0);
            let dimFvX = svgX + 9;
            let dimTvX = svgX + 9;

            if (isSameSide && !viewsCoincide) {
              if (pt.distHp <= pt.distVp) {
                dimFvX = svgX + 8;
                dimTvX = svgX + 18;
              } else {
                dimTvX = svgX + 8;
                dimFvX = svgX + 18;
              }
            }

            return (
              <g
                key={pt.id}
                className="cursor-pointer"
                onClick={() => onSelectPoint && onSelectPoint(pt.id)}
              >
                {/* 1. The aa' Projector Line: Continuous thin solid line connecting a' and a */}
                <line
                  x1={svgX}
                  y1={Math.min(svgFvY, svgTvY, svgGroundY)}
                  x2={svgX}
                  y2={Math.max(svgFvY, svgTvY, svgGroundY)}
                  stroke={isSelected ? pt.color : (isDark ? '#94a3b8' : '#64748b')}
                  strokeWidth="1.0"
                />

                {/* Ground Line Intersection marker */}
                <circle
                  cx={svgX}
                  cy={svgGroundY}
                  r="1.5"
                  fill={colors.xyLine}
                />

                {/* 2. FRONT VIEW POINT (a' or A') — Unified point color pt.color, crisp reduced radius */}
                <g>
                  {/* Subtle target crosshair */}
                  <line
                    x1={svgX - 3.5}
                    y1={svgFvY}
                    x2={svgX + 3.5}
                    y2={svgFvY}
                    stroke={pt.color}
                    strokeWidth="0.8"
                  />
                  <line
                    x1={svgX}
                    y1={svgFvY - 3.5}
                    x2={svgX}
                    y2={svgFvY + 3.5}
                    stroke={pt.color}
                    strokeWidth="0.8"
                  />
                  {/* Main Point Marker Dot (Crisp, reduced size, identical color across views) */}
                  <circle
                    cx={svgX}
                    cy={svgFvY}
                    r={isSelected ? '2.8' : '2.0'}
                    fill={pt.color}
                    stroke="#ffffff"
                    strokeWidth="1.0"
                  />
                  {/* Label: a' (or bracketed (a') if hidden) */}
                  <text
                    x={svgX - 7}
                    y={svgFvY + (pt.frontViewY >= 0 ? -5 : 13)}
                    fill={vpColor}
                    fontSize="12"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="end"
                  >
                    {viewsCoincide
                      ? `${pt.frontViewLabel} (${pt.topViewLabel})`
                      : pt.frontViewLabel}
                  </text>
                </g>

                {/* 3. TOP VIEW POINT (a or A) if not coinciding — Unified point color pt.color, crisp reduced radius */}
                {!viewsCoincide && (
                  <g>
                    <line
                      x1={svgX - 3.5}
                      y1={svgTvY}
                      x2={svgX + 3.5}
                      y2={svgTvY}
                      stroke={pt.color}
                      strokeWidth="0.8"
                    />
                    <line
                      x1={svgX}
                      y1={svgTvY - 3.5}
                      x2={svgX}
                      y2={svgTvY + 3.5}
                      stroke={pt.color}
                      strokeWidth="0.8"
                    />
                    {/* Main Point Marker Dot (Identical unified color pt.color) */}
                    <circle
                      cx={svgX}
                      cy={svgTvY}
                      r={isSelected ? '2.8' : '2.0'}
                      fill={pt.color}
                      stroke="#ffffff"
                      strokeWidth="1.0"
                    />
                    {/* Label: a (or bracketed (a) if hidden) */}
                    <text
                      x={svgX - 7}
                      y={svgTvY + (pt.topViewY >= 0 ? -5 : 13)}
                      fill={hpColor}
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {pt.topViewLabel}
                    </text>
                  </g>
                )}

                {/* 4. DIMENSION ANNOTATIONS - Placed immediately next to the points */}
                {/* Distance for Front View (Height relative to HP) */}
                {pt.distHp > 0 && (
                  <g>
                    {/* Extension lines */}
                    <line
                      x1={svgX + 2}
                      y1={svgFvY}
                      x2={dimFvX + 4}
                      y2={svgFvY}
                      stroke={colors.projector}
                      strokeWidth="0.75"
                    />
                    <line
                      x1={svgX + 2}
                      y1={svgGroundY}
                      x2={dimFvX + 4}
                      y2={svgGroundY}
                      stroke={colors.projector}
                      strokeWidth="0.75"
                    />
                    {/* Dimension Line with Double Arrows */}
                    <line
                      x1={dimFvX}
                      y1={svgGroundY}
                      x2={dimFvX}
                      y2={svgFvY}
                      stroke={colors.dimension}
                      strokeWidth="1.1"
                      markerStart="url(#dim-arrow-start)"
                      markerEnd="url(#dim-arrow-end)"
                    />
                    {/* Measurement Text */}
                    <text
                      x={dimFvX + 3}
                      y={(svgGroundY + svgFvY) / 2 + 3.5}
                      fill={colors.dimensionText}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="start"
                      stroke={isDark ? '#090d16' : '#ffffff'}
                      strokeWidth="2.5"
                      paintOrder="stroke"
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
                      x1={svgX + 2}
                      y1={svgTvY}
                      x2={dimTvX + 4}
                      y2={svgTvY}
                      stroke={colors.projector}
                      strokeWidth="0.75"
                    />
                    <line
                      x1={svgX + 2}
                      y1={svgGroundY}
                      x2={dimTvX + 4}
                      y2={svgGroundY}
                      stroke={colors.projector}
                      strokeWidth="0.75"
                    />
                    {/* Dimension Line */}
                    <line
                      x1={dimTvX}
                      y1={svgGroundY}
                      x2={dimTvX}
                      y2={svgTvY}
                      stroke={colors.dimension}
                      strokeWidth="1.1"
                      markerStart="url(#dim-arrow-start)"
                      markerEnd="url(#dim-arrow-end)"
                    />
                    {/* Measurement Text */}
                    <text
                      x={dimTvX + 3}
                      y={(svgGroundY + svgTvY) / 2 + 3.5}
                      fill={colors.dimensionText}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="start"
                      stroke={isDark ? '#090d16' : '#ffffff'}
                      strokeWidth="2.5"
                      paintOrder="stroke"
                    >
                      {pt.distVp}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Standard Engineering Drawing Title Block & Scale (Bottom-Right) */}
          <g transform={`translate(${viewWidth - 265}, ${viewHeight - 78})`}>
            <rect
              width="250"
              height="63"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={colors.titleBlockBorder}
              strokeWidth="1.2"
            />
            <line
              x1="0"
              y1="20"
              x2="250"
              y2="20"
              stroke={colors.titleBlockBorder}
              strokeWidth="0.8"
            />
            <text
              x="8"
              y="14"
              fill={colors.textMain}
              fontSize="9.5"
              fontFamily="sans-serif"
              fontWeight="bold"
            >
              EDraw — PROJECTION OF POINTS
            </text>
            <text
              x="8"
              y="33"
              fill={colors.textMain}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              Scale: 1:1 • All Dimensions Are In mm
            </text>
            <text
              x="8"
              y="46"
              fill={vpColor}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              ELEVATION: Front View a′ (on VP)
            </text>
            <text
              x="8"
              y="57"
              fill={hpColor}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              PLAN: Top View a (on HP)
            </text>
          </g>
        </svg>

        {/* Lower right title block is retained, lower left overlay removed per user request */}
      </div>
    </div>
  );
};
