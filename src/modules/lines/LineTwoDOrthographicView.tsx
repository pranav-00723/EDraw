/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { ComputedLine } from '../../types/lines';
import { ZoomIn, ZoomOut, RotateCcw, Eye, Layers, Compass, Check, Download } from 'lucide-react';

interface LineTwoDOrthographicViewProps {
  line: ComputedLine;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
}

export const LineTwoDOrthographicView: React.FC<LineTwoDOrthographicViewProps> = ({
  line,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  isDark = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // View Options
  const [showLocus, setShowLocus] = useState(true);
  const [showRotationArcs, setShowRotationArcs] = useState(true);
  const [showTraces, setShowTraces] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);

  // SVG viewBox settings
  const baseWidth = 840;
  const baseHeight = 520;
  const originX = 240; // X origin for reference projector of End A
  const originY = 260; // Y origin representing the ground line XY

  // Scale: 1mm in engineering = 2.4px on drawing canvas
  const mmScale = 2.4;

  const toSvgX = (xMm: number) => originX + xMm * mmScale;
  // In SVG, positive Y is downwards.
  // In our orthographic coordinates:
  // Above XY (+y_ortho) -> SVG Y = originY - y_ortho * mmScale
  // Below XY (-y_ortho) -> SVG Y = originY - y_ortho * mmScale (since y_ortho is negative, it goes down)
  const toSvgY = (yMm: number) => originY - yMm * mmScale;

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

    const scaleFactor = 2; // High-res 2x
    canvas.width = baseWidth * scaleFactor;
    canvas.height = baseHeight * scaleFactor;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = isDark ? '#0b1329' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `orthographic-projection-line-${line.nameA}${line.nameB}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  // Coordinates on SVG
  const aFrontSvg = { x: toSvgX(line.aFront.x), y: toSvgY(line.aFront.y) };
  const bFrontSvg = { x: toSvgX(line.bFront.x), y: toSvgY(line.bFront.y) };
  const aTopSvg = { x: toSvgX(line.aTop.x), y: toSvgY(line.aTop.y) };
  const bTopSvg = { x: toSvgX(line.bTop.x), y: toSvgY(line.bTop.y) };

  // True Length construction points
  const b1FrontSvg = { x: toSvgX(line.b1Front.x), y: toSvgY(line.b1Front.y) };
  const b2TopSvg = { x: toSvgX(line.b2Top.x), y: toSvgY(line.b2Top.y) };

  return (
    <div className="flex flex-col gap-3">
      {/* Visualizer Container */}
      <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs select-none">
        {/* Drawing Canvas Header & Controls */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono shadow-xs">
          {/* Front View Badge */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: vpColor }} />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Front View: {line.nameA.toLowerCase()}′{line.nameB.toLowerCase()}′
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Top View Badge */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: hpColor }} />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Top View: {line.nameA.toLowerCase()}{line.nameB.toLowerCase()}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Thin Projector Line Badge */}
          <span className="text-[11px] text-slate-500 font-sans">
            End Projectors: 1.2px Solid
          </span>
        </div>

        {/* View Toggles & Zoom Controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
          {/* Locus Toggle */}
          <button
            onClick={() => setShowLocus(!showLocus)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] ${
              showLocus
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Toggle Locus lines"
          >
            Locus
          </button>

          {/* Rotation Method Toggle */}
          <button
            onClick={() => setShowRotationArcs(!showRotationArcs)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] ${
              showRotationArcs
                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Toggle Rotating Line Method True Length Arcs"
          >
            TL Arcs
          </button>

          {/* Traces Toggle */}
          <button
            onClick={() => setShowTraces(!showTraces)}
            className={`px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] ${
              showTraces
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Toggle HT and VT Traces"
          >
            Traces
          </button>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Zoom Buttons */}
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.15))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Save Generated Projection as PNG Button */}
          <button
            onClick={exportAsPng}
            className="px-2 py-1 rounded transition flex items-center gap-1 font-mono text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 font-semibold cursor-pointer shadow-xs"
            title="Save Generated Projection as PNG Image"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-sans font-medium text-xs">Save PNG</span>
          </button>
        </div>

        {/* SVG Drawing Canvas */}
        <div
          className="w-full h-[520px] overflow-hidden cursor-grab active:cursor-grabbing bg-slate-50/60 dark:bg-slate-950/80"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${baseWidth} ${baseHeight}`}
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Definitions */}
            <defs>
              {/* Outward pointing arrow markers for Dimension Lines */}
              <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 10 2 L 0 5 L 10 8 z" fill={isDark ? '#94a3b8' : '#64748b'} />
              </marker>
              <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 2 L 10 5 L 0 8 z" fill={isDark ? '#94a3b8' : '#64748b'} />
              </marker>
              {/* Specific outward markers for End A dimensions */}
              <marker id="dim-vp-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 10 2 L 0 5 L 10 8 z" fill={vpColor} />
              </marker>
              <marker id="dim-vp-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 2 L 10 5 L 0 8 z" fill={vpColor} />
              </marker>
              <marker id="dim-hp-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 10 2 L 0 5 L 10 8 z" fill={hpColor} />
              </marker>
              <marker id="dim-hp-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 2 L 10 5 L 0 8 z" fill={hpColor} />
              </marker>
              {/* Arrow Marker for Cutting/Rotating Arcs */}
              <marker id="arc-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#a855f7" />
              </marker>
            </defs>

            {/* 1. Locus Lines (Horizontal dashed reference lines - clearly visible) */}
            {showLocus && (
              <g className="locus-lines">
                {/* Locus of a' */}
                <line
                  x1={40}
                  y1={aFrontSvg.y}
                  x2={baseWidth - 40}
                  y2={aFrontSvg.y}
                  stroke={vpColor}
                  strokeWidth="1.2"
                  strokeDasharray="8,4"
                  opacity="0.65"
                />
                <text
                  x={baseWidth - 45}
                  y={aFrontSvg.y - 5}
                  fill={vpColor}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                  textAnchor="end"
                  opacity="0.9"
                >
                  Locus of {line.nameA.toLowerCase()}′
                </text>

                {/* Locus of b' */}
                <line
                  x1={40}
                  y1={bFrontSvg.y}
                  x2={baseWidth - 40}
                  y2={bFrontSvg.y}
                  stroke={vpColor}
                  strokeWidth="1.2"
                  strokeDasharray="8,4"
                  opacity="0.65"
                />
                <text
                  x={baseWidth - 45}
                  y={bFrontSvg.y - 5}
                  fill={vpColor}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                  textAnchor="end"
                  opacity="0.9"
                >
                  Locus of {line.nameB.toLowerCase()}′
                </text>

                {/* Locus of a */}
                <line
                  x1={40}
                  y1={aTopSvg.y}
                  x2={baseWidth - 40}
                  y2={aTopSvg.y}
                  stroke={hpColor}
                  strokeWidth="1.2"
                  strokeDasharray="8,4"
                  opacity="0.65"
                />
                <text
                  x={baseWidth - 45}
                  y={aTopSvg.y + 12}
                  fill={hpColor}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                  textAnchor="end"
                  opacity="0.9"
                >
                  Locus of {line.nameA.toLowerCase()}
                </text>

                {/* Locus of b */}
                <line
                  x1={40}
                  y1={bTopSvg.y}
                  x2={baseWidth - 40}
                  y2={bTopSvg.y}
                  stroke={hpColor}
                  strokeWidth="1.2"
                  strokeDasharray="8,4"
                  opacity="0.65"
                />
                <text
                  x={baseWidth - 45}
                  y={bTopSvg.y + 12}
                  fill={hpColor}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                  textAnchor="end"
                  opacity="0.9"
                >
                  Locus of {line.nameB.toLowerCase()}
                </text>
              </g>
            )}

            {/* 2. Ground Reference Line (XY Line) */}
            <g className="xy-ground-line">
              <line
                x1={30}
                y1={originY}
                x2={baseWidth - 30}
                y2={originY}
                stroke={isDark ? '#e2e8f0' : '#0f172a'}
                strokeWidth="1.5"
              />
              {/* X and Y Terminal Labels */}
              <text
                x={38}
                y={originY - 8}
                fill={isDark ? '#ffffff' : '#0f172a'}
                fontSize="16"
                fontWeight="bold"
                fontFamily="'Space Grotesk', sans-serif"
              >
                X
              </text>
              <text
                x={baseWidth - 50}
                y={originY - 8}
                fill={isDark ? '#ffffff' : '#0f172a'}
                fontSize="16"
                fontWeight="bold"
                fontFamily="'Space Grotesk', sans-serif"
              >
                Y
              </text>

              {/* Explicit Persistent Plane Labels */}
              <text
                x={70}
                y={originY - 14}
                fill={vpColor}
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
                opacity="0.75"
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
                opacity="0.75"
              >
                Top View (HP)
              </text>

              {/* Standard Textbook VP / HP notations next to reference projector */}
              <text
                x={aFrontSvg.x - 44}
                y={originY - 8}
                fill={isDark ? '#e2e8f0' : '#0f172a'}
                fontSize="13"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
              >
                VP
              </text>
              <text
                x={aFrontSvg.x - 44}
                y={originY + 18}
                fill={isDark ? '#e2e8f0' : '#0f172a'}
                fontSize="13"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="bold"
              >
                HP
              </text>
            </g>

            {/* 3. End Projectors - Continuous thin solid line */}
            <g className="end-projectors">
              {line.orientation === 'PERPENDICULAR_HP' ? (
                /* Single continuous vertical projector for perpendicular line */
                <line
                  x1={aFrontSvg.x}
                  y1={Math.min(aFrontSvg.y, bFrontSvg.y) - 20}
                  x2={aTopSvg.x}
                  y2={aTopSvg.y + 20}
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  strokeWidth="1.0"
                />
              ) : (
                <>
                  {/* Projector of End A: connects a' (front) to a (top) continuously */}
                  <line
                    x1={aFrontSvg.x}
                    y1={aFrontSvg.y}
                    x2={aTopSvg.x}
                    y2={aTopSvg.y}
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    strokeWidth="1.0"
                  />

                  {/* Projector of End B: connects b' (front) to b (top) continuously */}
                  <line
                    x1={bFrontSvg.x}
                    y1={bFrontSvg.y}
                    x2={bTopSvg.x}
                    y2={bTopSvg.y}
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    strokeWidth="1.0"
                  />
                </>
              )}
            </g>

            {/* Dynamic Perpendicular Distances / Dimensions */}
            {showDimensions && (
              <g className="end-a-xy-dimensions">
                {line.orientation === 'PERPENDICULAR_HP' ? (
                  /* Dedicated 3-Tier Dimensioning for Lines Perpendicular to HP (BIS SP 46 Standard) */
                  (() => {
                    const topFvY = Math.min(aFrontSvg.y, bFrontSvg.y);
                    const botFvY = Math.max(aFrontSvg.y, bFrontSvg.y);
                    const dimX = aFrontSvg.x - 22;
                    const extLeftX = aFrontSvg.x - 30;
                    const extRightX = aFrontSvg.x - 5;
                    const lowerHeight = Math.min(Math.abs(line.zA), Math.abs(line.zB));
                    const topDepth = Math.abs(line.yA);

                    return (
                      <g className="perp-hp-dimensions">
                        {/* 4 Horizontal Extension Lines out to the left */}
                        {/* Extension at top end of front view (e.g. a') */}
                        <line
                          x1={extLeftX}
                          y1={topFvY}
                          x2={extRightX}
                          y2={topFvY}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                          strokeWidth="0.75"
                          opacity="0.6"
                        />
                        {/* Extension at bottom end of front view (e.g. b') */}
                        <line
                          x1={extLeftX}
                          y1={botFvY}
                          x2={extRightX}
                          y2={botFvY}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                          strokeWidth="0.75"
                          opacity="0.6"
                        />
                        {/* Extension at XY ground line */}
                        <line
                          x1={extLeftX}
                          y1={originY}
                          x2={extRightX}
                          y2={originY}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                          strokeWidth="0.75"
                          opacity="0.6"
                        />
                        {/* Extension at top view point a(b) */}
                        <line
                          x1={extLeftX}
                          y1={aTopSvg.y}
                          x2={extRightX}
                          y2={aTopSvg.y}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                          strokeWidth="0.75"
                          opacity="0.6"
                        />

                        {/* Dimension 1: True Length along front view (e.g. 25 mm) */}
                        <line
                          x1={dimX}
                          y1={topFvY}
                          x2={dimX}
                          y2={botFvY}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                          strokeWidth="1.0"
                          markerStart="url(#dim-arrow-start)"
                          markerEnd="url(#dim-arrow-end)"
                        />
                        <text
                          x={dimX - 6}
                          y={(topFvY + botFvY) / 2 + 4}
                          fill={isDark ? '#e2e8f0' : '#0f172a'}
                          fontSize="11"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          {line.trueLength.toFixed(0)}
                        </text>

                        {/* Dimension 2: Height of lower end above HP (e.g. 10 mm) */}
                        {lowerHeight > 1 && (
                          <g>
                            <line
                              x1={dimX}
                              y1={botFvY}
                              x2={dimX}
                              y2={originY}
                              stroke={isDark ? '#94a3b8' : '#64748b'}
                              strokeWidth="1.0"
                              markerStart="url(#dim-arrow-start)"
                              markerEnd="url(#dim-arrow-end)"
                            />
                            <text
                              x={dimX - 6}
                              y={(botFvY + originY) / 2 + 4}
                              fill={isDark ? '#e2e8f0' : '#0f172a'}
                              fontSize="11"
                              fontFamily="'JetBrains Mono', monospace"
                              fontWeight="bold"
                              textAnchor="end"
                            >
                              {lowerHeight.toFixed(0)}
                            </text>
                          </g>
                        )}

                        {/* Dimension 3: Depth of Top View point in front of VP (e.g. 20 mm) */}
                        {topDepth > 1 && (
                          <g>
                            <line
                              x1={dimX}
                              y1={originY}
                              x2={dimX}
                              y2={aTopSvg.y}
                              stroke={isDark ? '#94a3b8' : '#64748b'}
                              strokeWidth="1.0"
                              markerStart="url(#dim-arrow-start)"
                              markerEnd="url(#dim-arrow-end)"
                            />
                            <text
                              x={dimX - 6}
                              y={(originY + aTopSvg.y) / 2 + 4}
                              fill={isDark ? '#e2e8f0' : '#0f172a'}
                              fontSize="11"
                              fontFamily="'JetBrains Mono', monospace"
                              fontWeight="bold"
                              textAnchor="end"
                            >
                              {topDepth.toFixed(0)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })()
                ) : (
                  <>
                    {/* Elevation distance of a' from XY (|zA|) */}
                    {Math.abs(line.aFront.y) > 2 && (
                      <g>
                        {/* Extension lines */}
                        <line
                          x1={aFrontSvg.x - 30}
                          y1={originY}
                          x2={aFrontSvg.x - 8}
                          y2={originY}
                          stroke={vpColor}
                          strokeWidth="0.7"
                          opacity="0.4"
                        />
                        <line
                          x1={aFrontSvg.x - 30}
                          y1={aFrontSvg.y}
                          x2={aFrontSvg.x - 8}
                          y2={aFrontSvg.y}
                          stroke={vpColor}
                          strokeWidth="0.7"
                          opacity="0.4"
                        />
                        {/* Dimension line with outward arrows */}
                        <line
                          x1={aFrontSvg.x - 22}
                          y1={originY}
                          x2={aFrontSvg.x - 22}
                          y2={aFrontSvg.y}
                          stroke={vpColor}
                          strokeWidth="0.9"
                          markerStart="url(#dim-vp-start)"
                          markerEnd="url(#dim-vp-end)"
                        />
                        <text
                          x={aFrontSvg.x - 26}
                          y={(originY + aFrontSvg.y) / 2 + 4}
                          fill={vpColor}
                          fontSize="9.5"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          {Math.abs(line.input.endA.distanceHp).toFixed(1)} mm
                        </text>
                      </g>
                    )}

                    {/* Plan distance of a from XY (|yA|) */}
                    {Math.abs(line.aTop.y) > 2 && (
                      <g>
                        {/* Extension lines */}
                        <line
                          x1={aTopSvg.x - 30}
                          y1={originY}
                          x2={aTopSvg.x - 8}
                          y2={originY}
                          stroke={hpColor}
                          strokeWidth="0.7"
                          opacity="0.4"
                        />
                        <line
                          x1={aTopSvg.x - 30}
                          y1={aTopSvg.y}
                          x2={aTopSvg.x - 8}
                          y2={aTopSvg.y}
                          stroke={hpColor}
                          strokeWidth="0.7"
                          opacity="0.4"
                        />
                        {/* Dimension line with outward arrows */}
                        <line
                          x1={aTopSvg.x - 22}
                          y1={originY}
                          x2={aTopSvg.x - 22}
                          y2={aTopSvg.y}
                          stroke={hpColor}
                          strokeWidth="0.9"
                          markerStart="url(#dim-hp-start)"
                          markerEnd="url(#dim-hp-end)"
                        />
                        <text
                          x={aTopSvg.x - 26}
                          y={(originY + aTopSvg.y) / 2 + 4}
                          fill={hpColor}
                          fontSize="9.5"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          {Math.abs(line.input.endA.distanceVp).toFixed(1)} mm
                        </text>
                      </g>
                    )}
                  </>
                )}
              </g>
            )}

            {/* 4. Rotating Line Method Constructions (True Length Lines & Arcs) */}
            {showRotationArcs &&
              line.orientation !== 'PERPENDICULAR_HP' &&
              line.orientation !== 'PERPENDICULAR_VP' &&
              line.orientation !== 'PARALLEL_BOTH' && (
              <g className="rotating-line-construction">
                {/* Elevation True Length line: a'b1' - always labeled as True Length (TL) */}
                <line
                  x1={aFrontSvg.x}
                  y1={aFrontSvg.y}
                  x2={b1FrontSvg.x}
                  y2={b1FrontSvg.y}
                  stroke="#8b5cf6"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <circle cx={b1FrontSvg.x} cy={b1FrontSvg.y} r="2.4" fill="#8b5cf6" />
                <text
                  x={b1FrontSvg.x + 5}
                  y={b1FrontSvg.y - 4}
                  fill="#8b5cf6"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="'Space Grotesk', sans-serif"
                >
                  {line.b1Front.label} (True Length TL={line.trueLength.toFixed(1)}mm{Math.abs(line.thetaDeg) >= 0.5 ? `, θ=${line.thetaDeg.toFixed(1)}°` : ''})
                </text>

                {/* Conditional Angle Arc θ at a' (only if inclined to HP) */}
                {Math.abs(line.thetaDeg) >= 0.5 && (
                  <g>
                    <path
                      d={`M ${aFrontSvg.x + 28} ${aFrontSvg.y} A 28 28 0 0 ${
                        b1FrontSvg.y < aFrontSvg.y ? 0 : 1
                      } ${aFrontSvg.x + 28 * Math.cos((line.thetaDeg * Math.PI) / 180)} ${
                        aFrontSvg.y - 28 * Math.sin((line.thetaDeg * Math.PI) / 180)
                      }`}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="1.2"
                    />
                    <text
                      x={aFrontSvg.x + 34}
                      y={aFrontSvg.y - 8}
                      fill="#8b5cf6"
                      fontSize="9.5"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="bold"
                    >
                      θ={line.thetaDeg.toFixed(1)}°
                    </text>
                  </g>
                )}

                {/* Plan True Length line: ab2 - always labeled as True Length (TL) */}
                <line
                  x1={aTopSvg.x}
                  y1={aTopSvg.y}
                  x2={b2TopSvg.x}
                  y2={b2TopSvg.y}
                  stroke="#8b5cf6"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <circle cx={b2TopSvg.x} cy={b2TopSvg.y} r="2.4" fill="#8b5cf6" />
                <text
                  x={b2TopSvg.x + 5}
                  y={b2TopSvg.y + 12}
                  fill="#8b5cf6"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="'Space Grotesk', sans-serif"
                >
                  {line.b2Top.label} (True Length TL={line.trueLength.toFixed(1)}mm{Math.abs(line.phiDeg) >= 0.5 ? `, φ=${line.phiDeg.toFixed(1)}°` : ''})
                </text>

                {/* Conditional Angle Arc φ at a (only if inclined to VP) */}
                {Math.abs(line.phiDeg) >= 0.5 && (
                  <g>
                    <path
                      d={`M ${aTopSvg.x + 28} ${aTopSvg.y} A 28 28 0 0 ${
                        b2TopSvg.y > aTopSvg.y ? 1 : 0
                      } ${aTopSvg.x + 28 * Math.cos((line.phiDeg * Math.PI) / 180)} ${
                        aTopSvg.y + 28 * Math.sin((line.phiDeg * Math.PI) / 180)
                      }`}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="1.2"
                    />
                    <text
                      x={aTopSvg.x + 34}
                      y={aTopSvg.y + 16}
                      fill="#8b5cf6"
                      fontSize="9.5"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="bold"
                    >
                      φ={line.phiDeg.toFixed(1)}°
                    </text>
                  </g>
                )}

                {/* Projector from b1 in plan up to b1' on locus of b' */}
                <line
                  x1={toSvgX(line.xA + line.topViewLength)}
                  y1={aTopSvg.y}
                  x2={b1FrontSvg.x}
                  y2={b1FrontSvg.y}
                  stroke="#c084fc"
                  strokeWidth="0.9"
                  strokeDasharray="2,2"
                />
                <circle cx={toSvgX(line.xA + line.topViewLength)} cy={aTopSvg.y} r="2" fill="#c084fc" />

                {/* Projector from b2' in elevation down to b2 on locus of b */}
                <line
                  x1={toSvgX(line.xA + line.frontViewLength)}
                  y1={aFrontSvg.y}
                  x2={b2TopSvg.x}
                  y2={b2TopSvg.y}
                  stroke="#c084fc"
                  strokeWidth="0.9"
                  strokeDasharray="2,2"
                />
                <circle cx={toSvgX(line.xA + line.frontViewLength)} cy={aFrontSvg.y} r="2" fill="#c084fc" />

                {/* Rotating Arc in Elevation: Center a', radius EL, from b' to b2' */}
                {line.frontViewLength > 1 && (
                  <g>
                    <path
                      d={`M ${bFrontSvg.x} ${bFrontSvg.y} A ${line.frontViewLength * mmScale} ${line.frontViewLength * mmScale} 0 0 ${bFrontSvg.y < aFrontSvg.y ? 1 : 0} ${toSvgX(line.xA + line.frontViewLength)} ${aFrontSvg.y}`}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="1.3"
                      strokeDasharray="4,2.5"
                      markerEnd="url(#arc-arrow)"
                    />
                    <text
                      x={(bFrontSvg.x + toSvgX(line.xA + line.frontViewLength)) / 2}
                      y={(bFrontSvg.y + aFrontSvg.y) / 2 - 6}
                      fill="#a855f7"
                      fontSize="9"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="bold"
                    >
                      Arc (EL) ➔
                    </text>
                  </g>
                )}

                {/* Rotating Arc in Plan: Center a, radius PL, from b to b1 */}
                {line.topViewLength > 1 && (
                  <g>
                    <path
                      d={`M ${bTopSvg.x} ${bTopSvg.y} A ${line.topViewLength * mmScale} ${line.topViewLength * mmScale} 0 0 ${bTopSvg.y < aTopSvg.y ? 1 : 0} ${toSvgX(line.xA + line.topViewLength)} ${aTopSvg.y}`}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="1.3"
                      strokeDasharray="4,2.5"
                      markerEnd="url(#arc-arrow)"
                    />
                    <text
                      x={(bTopSvg.x + toSvgX(line.xA + line.topViewLength)) / 2}
                      y={(bTopSvg.y + aTopSvg.y) / 2 + 14}
                      fill="#a855f7"
                      fontSize="9"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="bold"
                    >
                      Arc (PL) ➔
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* 5. Front View (Elevation) Line: a'b' */}
            <g className="front-view">
              {line.orientation === 'PERPENDICULAR_VP' ? (
                /* Front view collapses to a single point for line perpendicular to VP */
                <g className="front-view-point">
                  <circle cx={aFrontSvg.x} cy={aFrontSvg.y} r="2.2" fill={vpColor} />
                  <text
                    x={aFrontSvg.x + 8}
                    y={aFrontSvg.y + 4}
                    fill={vpColor}
                    fontSize="13"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.aFront.label}
                  </text>
                </g>
              ) : line.orientation === 'PERPENDICULAR_HP' ? (
                /* Front view is a vertical line of True Length with clear a' and b' markers */
                <g className="front-view-perp-hp">
                  <line
                    x1={aFrontSvg.x}
                    y1={aFrontSvg.y}
                    x2={bFrontSvg.x}
                    y2={bFrontSvg.y}
                    stroke={vpColor}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <circle cx={aFrontSvg.x} cy={aFrontSvg.y} r="2.2" fill={vpColor} />
                  <circle cx={bFrontSvg.x} cy={bFrontSvg.y} r="2.2" fill={vpColor} />

                  {/* Upper end label (a' if zA >= zB, otherwise b') positioned to the right */}
                  <text
                    x={aFrontSvg.x + 8}
                    y={aFrontSvg.y + (line.zA >= line.zB ? -2 : 4)}
                    fill={vpColor}
                    fontSize="13"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.aFront.label}
                  </text>

                  {/* Lower end label (b' if zA >= zB, otherwise a') positioned to the right */}
                  <text
                    x={bFrontSvg.x + 8}
                    y={bFrontSvg.y + (line.zA >= line.zB ? 4 : -2)}
                    fill={vpColor}
                    fontSize="13"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.bFront.label}
                  </text>
                </g>
              ) : (
                /* Standard general line front view */
                <>
                  <line
                    x1={aFrontSvg.x}
                    y1={aFrontSvg.y}
                    x2={bFrontSvg.x}
                    y2={bFrontSvg.y}
                    stroke={vpColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx={aFrontSvg.x} cy={aFrontSvg.y} r="2.2" fill={vpColor} />
                  <circle cx={bFrontSvg.x} cy={bFrontSvg.y} r="2.2" fill={vpColor} />
                  <text
                    x={aFrontSvg.x - 12}
                    y={aFrontSvg.y - 8}
                    fill={vpColor}
                    fontSize="12.5"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.aFront.label}
                  </text>
                  <text
                    x={bFrontSvg.x + 8}
                    y={bFrontSvg.y - 8}
                    fill={vpColor}
                    fontSize="12.5"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.bFront.label}
                  </text>
                </>
              )}
            </g>

            {/* 6. Top View (Plan) Line: ab */}
            <g className="top-view">
              {line.orientation === 'PERPENDICULAR_HP' ? (
                /* Top view collapses to a single point with bracket notation a(b) */
                <g className="top-view-point">
                  <circle cx={aTopSvg.x} cy={aTopSvg.y} r="2.4" fill={hpColor} />
                  <text
                    x={aTopSvg.x + 8}
                    y={aTopSvg.y + 4}
                    fill={hpColor}
                    fontSize="13"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.aTop.label}
                  </text>
                </g>
              ) : (
                /* Standard general line top view */
                <>
                  <line
                    x1={aTopSvg.x}
                    y1={aTopSvg.y}
                    x2={bTopSvg.x}
                    y2={bTopSvg.y}
                    stroke={hpColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx={aTopSvg.x} cy={aTopSvg.y} r="2.2" fill={hpColor} />
                  <circle cx={bTopSvg.x} cy={bTopSvg.y} r="2.2" fill={hpColor} />
                  <text
                    x={aTopSvg.x - 12}
                    y={aTopSvg.y + 16}
                    fill={hpColor}
                    fontSize="12.5"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.aTop.label}
                  </text>
                  <text
                    x={bTopSvg.x + 8}
                    y={bTopSvg.y + 16}
                    fill={hpColor}
                    fontSize="12.5"
                    fontWeight="bold"
                    fontFamily="'Space Grotesk', sans-serif"
                  >
                    {line.bTop.label}
                  </text>
                </>
              )}
            </g>

            {/* 7. Traces (HT & VT) */}
            {showTraces && (
              <g className="traces-representation">
                {/* Horizontal Trace (HT) */}
                {line.ht.exists && (
                  <>
                    {/* h' on XY */}
                    <circle cx={toSvgX(line.ht.groundProj.x)} cy={originY} r="3.5" fill="#f59e0b" />
                    <text
                      x={toSvgX(line.ht.groundProj.x) - 4}
                      y={originY - 8}
                      fill="#f59e0b"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {line.ht.groundProj.label}
                    </text>

                    {/* Projector to h (HT) */}
                    <line
                      x1={toSvgX(line.ht.groundProj.x)}
                      y1={originY}
                      x2={toSvgX(line.ht.traceProj.x)}
                      y2={toSvgY(line.ht.traceProj.y)}
                      stroke="#f59e0b"
                      strokeWidth="1.0"
                      strokeDasharray="3,3"
                    />

                    {/* h (HT) point */}
                    <circle cx={toSvgX(line.ht.traceProj.x)} cy={toSvgY(line.ht.traceProj.y)} r="4" fill="#f59e0b" />
                    <text
                      x={toSvgX(line.ht.traceProj.x) + 7}
                      y={toSvgY(line.ht.traceProj.y) + 4}
                      fill="#f59e0b"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {line.ht.traceProj.label}
                    </text>
                  </>
                )}

                {/* Vertical Trace (VT) */}
                {line.vt.exists && (
                  <>
                    {/* v on XY */}
                    <circle cx={toSvgX(line.vt.groundProj.x)} cy={originY} r="3.5" fill="#ea580c" />
                    <text
                      x={toSvgX(line.vt.groundProj.x) - 4}
                      y={originY + 16}
                      fill="#ea580c"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {line.vt.groundProj.label}
                    </text>

                    {/* Projector to v' (VT) */}
                    <line
                      x1={toSvgX(line.vt.groundProj.x)}
                      y1={originY}
                      x2={toSvgX(line.vt.traceProj.x)}
                      y2={toSvgY(line.vt.traceProj.y)}
                      stroke="#ea580c"
                      strokeWidth="1.0"
                      strokeDasharray="3,3"
                    />

                    {/* v' (VT) point */}
                    <circle cx={toSvgX(line.vt.traceProj.x)} cy={toSvgY(line.vt.traceProj.y)} r="4" fill="#ea580c" />
                    <text
                      x={toSvgX(line.vt.traceProj.x) + 7}
                      y={toSvgY(line.vt.traceProj.y) + 4}
                      fill="#ea580c"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {line.vt.traceProj.label}
                    </text>
                  </>
                )}
              </g>
            )}

            {/* 8. Dimension Lines: DEP (distance between end projectors) */}
            <g className="dimensions">
              {line.dep > 5 && (
                <>
                  <line
                    x1={aFrontSvg.x}
                    y1={originY + 6}
                    x2={bFrontSvg.x}
                    y2={originY + 6}
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    strokeWidth="0.9"
                    markerStart="url(#dim-arrow-start)"
                    markerEnd="url(#dim-arrow-end)"
                  />
                  <text
                    x={(aFrontSvg.x + bFrontSvg.x) / 2}
                    y={originY + 18}
                    fill={isDark ? '#94a3b8' : '#64748b'}
                    fontSize="10"
                    fontFamily="'JetBrains Mono', monospace"
                    textAnchor="middle"
                  >
                    DEP = {line.dep.toFixed(1)} mm
                  </text>
                </>
              )}
            </g>
          </svg>
        </div>

        {/* Bottom Legend & Status Bar */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: vpColor }} />
              <span className="text-slate-600 dark:text-slate-400">Front View (a′b′) = {line.frontViewLength.toFixed(1)} mm</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: hpColor }} />
              <span className="text-slate-600 dark:text-slate-400">Top View (ab) = {line.topViewLength.toFixed(1)} mm</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-purple-500" />
              <span className="text-purple-600 dark:text-purple-400">True Length = {line.trueLength.toFixed(1)} mm</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            Scale: 1 mm = {mmScale} px • Drag to Pan • Scroll to Zoom
          </div>
        </div>
      </div>
    </div>
  );
};
