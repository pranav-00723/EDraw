/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ComputedLine } from '../../types/lines';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Sparkles,
  Compass,
  CheckCircle2,
  Maximize2,
  Layers,
  Ruler,
  RotateCcw,
} from 'lucide-react';

interface PictorialDraftingStagesProps {
  line: ComputedLine;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
}

export type DraftingStageNumber = 1 | 2 | 3 | 4;

export const PictorialDraftingStages: React.FC<PictorialDraftingStagesProps> = ({
  line,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  isDark = true,
}) => {
  const [activeStage, setActiveStage] = useState<DraftingStageNumber>(1);
  const [isAllStagesView, setIsAllStagesView] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  // Compass drawing animation progress (0 to 1) for Stage 3 rotating arcs
  const [arcProgress, setArcProgress] = useState<number>(1);
  const [isAnimatingCompass, setIsAnimatingCompass] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  const startCompassAnimation = () => {
    setIsAnimatingCompass(true);
    setArcProgress(0);
    const startTime = performance.now();
    const duration = 2800; // 2.8s for smooth compass sweep of elevation and plan arcs

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      setArcProgress(p);
      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimatingCompass(false);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);
  };

  // Trigger compass animation when entering Stage 3
  useEffect(() => {
    if (activeStage === 3 && !isAllStagesView) {
      startCompassAnimation();
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setArcProgress(1);
      setIsAnimatingCompass(false);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeStage, isAllStagesView]);

  // Auto-play sequence through stages 1 -> 2 -> 3 -> 4
  // Allows extra time on Stage 3 for the compass animation to finish!
  useEffect(() => {
    if (isPlaying) {
      const delay = activeStage === 3 ? 3600 : 2500;
      playTimerRef.current = window.setTimeout(() => {
        setActiveStage((prev) => {
          if (prev >= 4) {
            setIsPlaying(false);
            return 4;
          }
          return (prev + 1) as DraftingStageNumber;
        });
      }, delay);
    } else {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
    }
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, activeStage]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (activeStage === 4) setActiveStage(1);
      setIsAllStagesView(false);
      setIsPlaying(true);
    }
  };

  const handlePrevStage = () => {
    setIsPlaying(false);
    setIsAllStagesView(false);
    setActiveStage((prev) => (Math.max(1, prev - 1) as DraftingStageNumber));
  };

  const handleNextStage = () => {
    setIsPlaying(false);
    setIsAllStagesView(false);
    setActiveStage((prev) => (Math.min(4, prev + 1) as DraftingStageNumber));
  };

  const handleSelectStage = (stage: DraftingStageNumber) => {
    setIsPlaying(false);
    setIsAllStagesView(false);
    setActiveStage(stage);
  };

  // SVG Dimension Math & Dynamic Responsive Coordinate Mapper
  const svgMetrics = useMemo(() => {
    const width = 800;
    const height = 440;
    const groundY = 220; // XY reference line Y
    const originX = 220; // Reference end projector X

    // Calculate maximum displacement along X and Y to pick an optimal scale
    const maxX = Math.max(
      line.dep,
      Math.abs(line.b1Front.x),
      Math.abs(line.b2Top.x),
      Math.abs(line.bFront.x),
      40
    );
    const maxY = Math.max(
      Math.abs(line.aFront.y),
      Math.abs(line.aTop.y),
      Math.abs(line.bFront.y),
      Math.abs(line.bTop.y),
      35
    );

    const scaleX = 360 / Math.max(maxX, 60);
    const scaleY = 160 / Math.max(maxY, 50);
    const scale = Math.min(scaleX, scaleY, 2.5);

    const toX = (xMm: number) => originX + xMm * scale;
    // In SVG, positive Y is downwards.
    // In 2D orthographic projection: +y is above XY (elevation), -y is below XY (plan)
    const toY = (yMm: number) => groundY - yMm * scale;

    const ptAFront = { x: toX(line.aFront.x), y: toY(line.aFront.y) };
    const ptATop = { x: toX(line.aTop.x), y: toY(line.aTop.y) };
    const ptBFront = { x: toX(line.bFront.x), y: toY(line.bFront.y) };
    const ptBTop = { x: toX(line.bTop.x), y: toY(line.bTop.y) };
    const ptB1Front = { x: toX(line.b1Front.x), y: toY(line.b1Front.y) };
    const ptB2Top = { x: toX(line.b2Top.x), y: toY(line.b2Top.y) };

    const endProjectorX = toX(line.dep);

    return {
      width,
      height,
      groundY,
      originX,
      scale,
      toX,
      toY,
      ptAFront,
      ptATop,
      ptBFront,
      ptBTop,
      ptB1Front,
      ptB2Top,
      endProjectorX,
    };
  }, [line]);

  const isPerpHP = line.orientation === 'PERPENDICULAR_HP';
  const isPerpVP = line.orientation === 'PERPENDICULAR_VP';

  // Dynamic educational explanations adapted to line orientation
  const stageExplanations = isPerpHP
    ? [
        {
          num: 1,
          name: 'Ground Line & Projector',
          instrument: 'T-Square & Set Square (2H Pencil for projector)',
          title: 'Step 1: Draw XY Reference Line & Vertical Projector',
          description: `Draw horizontal ground line XY. Erect a single continuous vertical projector line extending across both VP (above XY) and HP (below XY).`,
          keyTakeaway: 'Because the line is perpendicular to HP, both of its views lie along one single vertical projector.',
        },
        {
          num: 2,
          name: 'Plan View Point',
          instrument: 'HB Pencil for point, 2H for extension lines',
          title: `Step 2: Locate Plan (Top View) Coincident Point ${line.aTop.label} in HP`,
          description: `Looking from above (Top View), the line collapses into a single point. Mark ${line.aTop.label} at distance ${Math.abs(line.yA).toFixed(0)} mm in front of VP (below XY). Upper end ${line.nameA.toLowerCase()} is visible, lower end (${line.nameB.toLowerCase()}) is hidden beneath.`,
          keyTakeaway: `Top view collapses to a single point: ${line.aTop.label} at ${Math.abs(line.yA).toFixed(0)} mm below XY.`,
        },
        {
          num: 3,
          name: 'Elevation End Points',
          instrument: 'HB Pencil for points, Scale for vertical heights',
          title: `Step 3: Mark Elevation (Front View) End Points ${line.bFront.label} and ${line.aFront.label} in VP`,
          description: `Along the vertical projector above XY: Mark lower end ${line.bFront.label} at distance ${Math.min(Math.abs(line.zA), Math.abs(line.zB)).toFixed(0)} mm above HP. Mark upper end ${line.aFront.label} at distance ${Math.max(Math.abs(line.zA), Math.abs(line.zB)).toFixed(0)} mm above HP (${Math.min(Math.abs(line.zA), Math.abs(line.zB)).toFixed(0)} + ${line.trueLength.toFixed(0)} = ${Math.max(Math.abs(line.zA), Math.abs(line.zB)).toFixed(0)} mm).`,
          keyTakeaway: `Both end points lie on the same vertical line at their respective heights above HP.`,
        },
        {
          num: 4,
          name: 'True Length Front View',
          instrument: 'HB Pencil for thick object line, Dimensioning Tools',
          title: `Step 4: Draw Front View ${line.aFront.label}${line.bFront.label} (True Length = ${line.trueLength.toFixed(0)} mm) & Dimensions`,
          description: `Join ${line.aFront.label} and ${line.bFront.label} with a thick continuous object line. In Front View, the line shows its True Length (${line.trueLength.toFixed(0)} mm) perpendicular to XY. Complete the drawing with standard 3-tier dimensioning.`,
          keyTakeaway: 'When a line is perpendicular to HP, its Front View is a vertical line equal to True Length, and its Top View is a point.',
        },
      ]
    : [
        {
          num: 1,
          name: 'Reference Projector',
          instrument: 'T-Square & Set Square (2H Pencil for projector, HB Pencil for points)',
          title: 'Step 1: Draw XY Ground Line & Reference End A Projector',
          description: `Draw the horizontal reference line XY. Erect a thin continuous vertical projector at End A (${line.nameA}). Mark the Front View (Elevation) ${line.aFront.label} at distance |zA| = ${Math.abs(line.input.endA.distanceHp).toFixed(1)} mm ${line.input.endA.hpRelation}. Mark the Top View (Plan) ${line.aTop.label} at distance |yA| = ${Math.abs(line.input.endA.distanceVp).toFixed(1)} mm ${line.input.endA.vpRelation}.`,
          keyTakeaway: 'The Front View (a′) and Top View (a) strictly lie on the exact same continuous vertical projector perpendicular to XY.',
        },
        {
          num: 2,
          name: 'TL & Locus Cutting',
          instrument: 'Drafting Compass & Protractor (Radius = True Length TL)',
          title: 'Step 2: Apply True Inclinations (θ, φ) & Cut TL Arcs to Establish Loci',
          description: `From Front View base point ${line.aFront.label}, draw the horizontal reference line, apply True Inclination with HP (${Math.abs(line.thetaDeg) >= 0.5 ? `θ = ${line.thetaDeg.toFixed(1)}°` : 'parallel to HP'}), and cut the arc using True Length (TL = ${line.trueLength.toFixed(1)} mm) to locate ${line.b1Front.label} and establish the Locus of ${line.nameB.toLowerCase()}′. Similarly, from Top View base point ${line.aTop.label}, apply True Inclination with VP (${Math.abs(line.phiDeg) >= 0.5 ? `φ = ${line.phiDeg.toFixed(1)}°` : 'parallel to VP'}) using True Length (TL) to locate ${line.b2Top.label} and establish the Locus of ${line.nameB.toLowerCase()}.`,
          keyTakeaway: 'Establishing loci using True Length and true inclination angles (a′ ➔ HL and a ➔ TL/Locus) fixes the horizontal boundaries for End B.',
        },
        {
          num: 3,
          name: 'Rotating Views',
          instrument: 'Drafting Compass (Radius = Apparent Lengths)',
          title: 'Step 3: Project & Rotate Construction Lines to Cut Loci',
          description: `Project ${line.b1Front.label} down to the horizontal reference through a to obtain the plan length ab₁, and project ${line.b2Top.label} up to the reference through a′ to obtain the elevation length a′b₂′. With centers a and a′, swing rotating arcs to intersect the respective locus lines, locating the final projections ${line.bTop.label} and ${line.bFront.label}.`,
          keyTakeaway: 'True Length is only visible when the line is made parallel to a reference plane. The rotating line method swings the line parallel to find true length and true angles.',
        },
        {
          num: 4,
          name: 'Final Views & Projector',
          instrument: 'HB Pencil & Straightedge (Thick Continuous Line for Views)',
          title: 'Step 4: Draw Final Elevation, Plan, and End Projector Alignment',
          description: `Join ${line.aFront.label}${line.bFront.label} with a thick continuous line to obtain the final Elevation (Front View = ${line.frontViewLength.toFixed(1)} mm at apparent angle α = ${line.alphaDeg.toFixed(1)}°). Join ${line.aTop.label}${line.bTop.label} with a thick continuous line to obtain the final Plan (Top View = ${line.topViewLength.toFixed(1)} mm at apparent angle β = ${line.betaDeg.toFixed(1)}°). Draw the continuous thin vertical projector between ${line.bFront.label} and ${line.bTop.label} to verify they strictly align on one projector!`,
          keyTakeaway: 'Orthographic Invariant: The end projections b′ (elevation) and b (plan) must strictly align on one common continuous vertical projector line perpendicular to XY.',
        },
      ];

  // Helper renderer for a single SVG viewport representing a specific stage
  const renderStageSvg = (stageNum: DraftingStageNumber, isCompact = false) => {
    const {
      width,
      height,
      groundY,
      originX,
      ptAFront,
      ptATop,
      ptBFront,
      ptBTop,
      ptB1Front,
      ptB2Top,
      endProjectorX,
    } = svgMetrics;

    const locusStartX = originX - 45;
    const locusEndX = Math.max(endProjectorX, ptB1Front.x, ptB2Top.x) + 75;

    // Radius for True Length arcs
    const radiusTL = Math.hypot(ptB1Front.x - ptAFront.x, ptB1Front.y - ptAFront.y);
    const radiusTLPlan = Math.hypot(ptB2Top.x - ptATop.x, ptB2Top.y - ptATop.y);

    // Dedicated clean drafting procedure for Line Perpendicular to HP
    if (isPerpHP) {
      const topFvY = Math.min(ptAFront.y, ptBFront.y);
      const botFvY = Math.max(ptAFront.y, ptBFront.y);
      const lowerHeight = Math.min(Math.abs(line.zA), Math.abs(line.zB));
      const topDepth = Math.abs(line.yA);
      const dimX = originX - 35;
      const extLeftX = originX - 45;
      const extRightX = originX - 8;

      return (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none"
          style={{ background: '#0b1329' }}
        >
          <defs>
            <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 10 2 L 0 5 L 10 8 z" fill="#60a5fa" />
            </marker>
            <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#60a5fa" />
            </marker>
          </defs>

          {/* Clean Drafting Workspace (No grid) */}
          {/* XY Ground Line */}
          <line x1={30} y1={groundY} x2={width - 30} y2={groundY} stroke="#e2e8f0" strokeWidth="1.8" />
          <circle cx={40} cy={groundY} r="3" fill="#e2e8f0" />
          <circle cx={width - 40} cy={groundY} r="3" fill="#e2e8f0" />
          <text x={24} y={groundY + 5} fill="#f8fafc" fontSize={isCompact ? '12' : '15'} fontWeight="bold" fontFamily="monospace">X</text>
          <text x={width - 24} y={groundY + 5} fill="#f8fafc" fontSize={isCompact ? '12' : '15'} fontWeight="bold" fontFamily="monospace">Y</text>

          {/* Clean Standard Plane Labels */}
          {!isCompact && (
            <>
              <text x={55} y={groundY - 10} fill="#f87171" fontSize="13" fontWeight="bold" fontFamily="monospace">VP</text>
              <text x={55} y={groundY + 20} fill="#60a5fa" fontSize="13" fontWeight="bold" fontFamily="monospace">HP</text>
            </>
          )}

          {/* Continuous vertical projector (All stages) */}
          <line
            x1={originX}
            y1={topFvY - 40}
            x2={originX}
            y2={ptATop.y + 40}
            stroke="#94a3b8"
            strokeWidth="1.0"
          />

          {/* Stage 2, 3, 4: Top View Point a(b) in HP */}
          {stageNum >= 2 && (
            <g>
              <circle cx={originX} cy={ptATop.y} r={isCompact ? 2.5 : 3.2} fill="#3b82f6" stroke="#ffffff" strokeWidth="1.2" />
              <text x={originX + 10} y={ptATop.y + 4} fill="#93c5fd" fontSize={isCompact ? '11' : '13'} fontWeight="bold" fontFamily="monospace">
                {line.aTop.label}
              </text>
              {/* Dimension for top depth */}
              {!isCompact && topDepth > 1 && (
                <g>
                  <line x1={extLeftX} y1={groundY} x2={extRightX} y2={groundY} stroke="#60a5fa" strokeWidth="0.8" opacity="0.5" />
                  <line x1={extLeftX} y1={ptATop.y} x2={extRightX} y2={ptATop.y} stroke="#60a5fa" strokeWidth="0.8" opacity="0.5" />
                  <line x1={dimX} y1={groundY} x2={dimX} y2={ptATop.y} stroke="#60a5fa" strokeWidth="1" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
                  <text x={dimX - 6} y={(groundY + ptATop.y) / 2 + 3} fill="#93c5fd" fontSize="10" fontFamily="monospace" textAnchor="end">
                    {topDepth.toFixed(0)}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Stage 3, 4: Front View End Points b' and a' */}
          {stageNum >= 3 && (
            <g>
              <circle cx={originX} cy={botFvY} r={isCompact ? 2.5 : 3.2} fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
              <text x={originX + 10} y={botFvY + 4} fill="#fca5a5" fontSize={isCompact ? '11' : '13'} fontWeight="bold" fontFamily="monospace">
                {line.bFront.label}
              </text>
              <circle cx={originX} cy={topFvY} r={isCompact ? 2.5 : 3.2} fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
              <text x={originX + 10} y={topFvY - 4} fill="#fca5a5" fontSize={isCompact ? '11' : '13'} fontWeight="bold" fontFamily="monospace">
                {line.aFront.label}
              </text>

              {/* Dimension for lower height */}
              {!isCompact && lowerHeight > 1 && (
                <g>
                  <line x1={extLeftX} y1={botFvY} x2={extRightX} y2={botFvY} stroke="#f87171" strokeWidth="0.8" opacity="0.5" />
                  <line x1={dimX} y1={groundY} x2={dimX} y2={botFvY} stroke="#f87171" strokeWidth="1" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
                  <text x={dimX - 6} y={(groundY + botFvY) / 2 + 3} fill="#fca5a5" fontSize="10" fontFamily="monospace" textAnchor="end">
                    {lowerHeight.toFixed(0)}
                  </text>
                </g>
              )}

              {/* Dimension for True Length */}
              {!isCompact && (
                <g>
                  <line x1={extLeftX} y1={topFvY} x2={extRightX} y2={topFvY} stroke="#f87171" strokeWidth="0.8" opacity="0.5" />
                  <line x1={dimX} y1={topFvY} x2={dimX} y2={botFvY} stroke="#f87171" strokeWidth="1" markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
                  <text x={dimX - 6} y={(topFvY + botFvY) / 2 + 3} fill="#fca5a5" fontSize="10" fontFamily="monospace" textAnchor="end">
                    {line.trueLength.toFixed(0)}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Stage 4: Thick dark object line for Front View */}
          {stageNum === 4 && (
            <line
              x1={originX}
              y1={topFvY}
              x2={originX}
              y2={botFvY}
              stroke="#ef4444"
              strokeWidth={isCompact ? '2.8' : '3.4'}
              strokeLinecap="round"
            />
          )}
        </svg>
      );
    }

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full select-none"
        style={{ background: '#0b1329' }}
      >
        <defs>
          {/* Glowing Filters */}
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Outward Pointing Dimension Line Arrow Markers */}
          <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 10 2 L 0 5 L 10 8 z" fill="#60a5fa" />
          </marker>
          <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 2 L 10 5 L 0 8 z" fill="#60a5fa" />
          </marker>
          <marker id="dim-amber-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 10 2 L 0 5 L 10 8 z" fill="#f59e0b" />
          </marker>
          <marker id="dim-amber-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 2 L 10 5 L 0 8 z" fill="#f59e0b" />
          </marker>

          {/* Cutting Arc Direction Arrow Markers */}
          <marker id="arrow-arc-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#c084fc" />
          </marker>
          <marker id="arrow-arc-emerald" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#34d399" />
          </marker>
        </defs>

        {/* Clean Drafting Workspace (Grid removed as requested) */}

        {/* ============================================================== */}
        {/* BASE GROUND LINE XY (Present in all stages) */}
        {/* ============================================================== */}
        <line
          x1={30}
          y1={groundY}
          x2={width - 30}
          y2={groundY}
          stroke="#e2e8f0"
          strokeWidth="1.8"
        />

        {/* End markers X and Y */}
        <circle cx={40} cy={groundY} r="3" fill="#e2e8f0" />
        <circle cx={width - 40} cy={groundY} r="3" fill="#e2e8f0" />
        <text
          x={24}
          y={groundY + 5}
          fill="#f8fafc"
          fontSize={isCompact ? '12' : '15'}
          fontWeight="bold"
          fontFamily="monospace"
        >
          X
        </text>
        <text
          x={width - 24}
          y={groundY + 5}
          fill="#f8fafc"
          fontSize={isCompact ? '12' : '15'}
          fontWeight="bold"
          fontFamily="monospace"
        >
          Y
        </text>

        {/* Clean Standard Plane Labels (VP above XY, HP below XY in First Angle) */}
        {!isCompact && (
          <>
            <text x={55} y={groundY - 10} fill="#f87171" fontSize="13" fontWeight="bold" fontFamily="monospace">
              VP
            </text>
            <text x={55} y={groundY + 20} fill="#60a5fa" fontSize="13" fontWeight="bold" fontFamily="monospace">
              HP
            </text>
          </>
        )}

        {/* ============================================================== */}
        {/* STAGE 1 ELEMENTS: Reference End Projector and Points a' and a */}
        {/* ============================================================== */}
        {/* Reference End Projector Line (Continuous thin vertical line passing through XY) */}
        <line
          x1={originX}
          y1={Math.min(ptAFront.y, groundY) - 35}
          x2={originX}
          y2={Math.max(ptATop.y, groundY) + 35}
          stroke="#94a3b8"
          strokeWidth="1.0"
        />

        {/* Dimension Lines for a' (Elevation distance from XY) */}
        {!isCompact && (
          <g>
            <line
              x1={originX - 25}
              y1={groundY}
              x2={originX - 25}
              y2={ptAFront.y}
              stroke="#f87171"
              strokeWidth="1"
              markerStart="url(#dim-arrow-start)"
              markerEnd="url(#dim-arrow-end)"
            />
            <line x1={originX - 30} y1={groundY} x2={originX - 10} y2={groundY} stroke="#f87171" strokeWidth="0.8" opacity="0.5" />
            <line x1={originX - 30} y1={ptAFront.y} x2={originX - 10} y2={ptAFront.y} stroke="#f87171" strokeWidth="0.8" opacity="0.5" />
            <text
              x={originX - 32}
              y={(groundY + ptAFront.y) / 2 + 3}
              fill="#fca5a5"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {Math.abs(line.input.endA.distanceHp).toFixed(1)} mm
            </text>
          </g>
        )}

        {/* Dimension Lines for a (Plan distance from XY) */}
        {!isCompact && (
          <g>
            <line
              x1={originX - 25}
              y1={groundY}
              x2={originX - 25}
              y2={ptATop.y}
              stroke="#60a5fa"
              strokeWidth="1"
              markerStart="url(#dim-arrow-start)"
              markerEnd="url(#dim-arrow-end)"
            />
            <line x1={originX - 30} y1={ptATop.y} x2={originX - 10} y2={ptATop.y} stroke="#60a5fa" strokeWidth="0.8" opacity="0.5" />
            <text
              x={originX - 32}
              y={(groundY + ptATop.y) / 2 + 3}
              fill="#93c5fd"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {Math.abs(line.input.endA.distanceVp).toFixed(1)} mm
            </text>
          </g>
        )}

        {/* Point a' (Elevation Point) */}
        <circle
          cx={ptAFront.x}
          cy={ptAFront.y}
          r={isCompact ? 2.5 : 3.2}
          fill="#ef4444"
          stroke="#ffffff"
          strokeWidth="1.2"
        />
        <text
          x={ptAFront.x - 12}
          y={ptAFront.y - 8}
          fill="#fca5a5"
          fontSize={isCompact ? '11' : '13'}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {line.aFront.label}
        </text>

        {/* Point a (Plan Point) */}
        <circle
          cx={ptATop.x}
          cy={ptATop.y}
          r={isCompact ? 2.5 : 3.2}
          fill="#3b82f6"
          stroke="#ffffff"
          strokeWidth="1.2"
        />
        <text
          x={ptATop.x - 12}
          y={ptATop.y + 16}
          fill="#93c5fd"
          fontSize={isCompact ? '11' : '13'}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {line.aTop.label}
        </text>

        {/* ============================================================== */}
        {/* STAGE 2 ELEMENTS: True Length & Locus Cutting Construction (Step 2) */}
        {/* ============================================================== */}
        {stageNum >= 2 && (
          <g>
            {/* Horizontal Reference Line from a' — continuous thin line */}
            <line
              x1={ptAFront.x}
              y1={ptAFront.y}
              x2={ptB1Front.x + 30}
              y2={ptAFront.y}
              stroke="#94a3b8"
              strokeWidth="0.9"
              opacity="0.6"
            />

            {/* Horizontal Reference Line from a — continuous thin line */}
            <line
              x1={ptATop.x}
              y1={ptATop.y}
              x2={ptB2Top.x + 30}
              y2={ptATop.y}
              stroke="#94a3b8"
              strokeWidth="0.9"
              opacity="0.6"
            />

            {/* Step 2 Construction: True Length line a'b1' at True Angle θ cutting Locus of b' (solid continuous line) */}
            <line
              x1={ptAFront.x}
              y1={ptAFront.y}
              x2={ptB1Front.x}
              y2={ptB1Front.y}
              stroke="#c084fc"
              strokeWidth="1.8"
            />
            <circle cx={ptB1Front.x} cy={ptB1Front.y} r={isCompact ? 2.5 : 3.2} fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
            <text
              x={ptB1Front.x + 8}
              y={ptB1Front.y - 6}
              fill="#e9d5ff"
              fontSize={isCompact ? '10' : '11.5'}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {line.b1Front.label} (True Length TL = {line.trueLength.toFixed(1)} mm)
            </text>

            {/* Cutting Arc from a' to Locus of b' (continuous thin arc) */}
            <path
              d={`M ${ptAFront.x + radiusTL} ${ptAFront.y} A ${radiusTL} ${radiusTL} 0 0 ${
                ptB1Front.y < ptAFront.y ? 0 : 1
              } ${ptB1Front.x} ${ptB1Front.y}`}
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.4"
              markerEnd="url(#arrow-arc-purple)"
              opacity="0.8"
            />

            {/* Conditional True Inclination Arc θ at a' */}
            {Math.abs(line.thetaDeg) >= 0.5 && !isCompact && (
              <g>
                <path
                  d={`M ${ptAFront.x + 32} ${ptAFront.y} A 32 32 0 0 ${
                    ptB1Front.y < ptAFront.y ? '0' : '1'
                  } ${ptAFront.x + 32 * Math.cos((line.thetaDeg * Math.PI) / 180)} ${
                    ptAFront.y - 32 * Math.sin((line.thetaDeg * Math.PI) / 180)
                  }`}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.2"
                />
                <text
                  x={ptAFront.x + 38}
                  y={ptAFront.y - 8}
                  fill="#e9d5ff"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  θ = {line.thetaDeg.toFixed(1)}°
                </text>
              </g>
            )}

            {/* Locus Line of b' established by a' -> TL/Arc cutting */}
            <line
              x1={locusStartX}
              y1={ptB1Front.y}
              x2={locusEndX}
              y2={ptB1Front.y}
              stroke="#f59e0b"
              strokeWidth="1.4"
              strokeDasharray="8,4"
              opacity={stageNum === 2 ? 0.95 : 0.75}
            />
            {/* Locus b' label badge */}
            <g transform={`translate(${locusEndX + 6}, ${ptB1Front.y - 8})`}>
              <rect x="0" y="0" width={isCompact ? 68 : 88} height="16" rx="3" fill="#451a03" stroke="#b45309" strokeWidth="0.8" opacity="0.9" />
              <text
                x="4"
                y="11"
                fill="#fde68a"
                fontSize={isCompact ? '9' : '10'}
                fontWeight="600"
                fontFamily="monospace"
              >
                Locus of {line.nameB.toLowerCase()}′
              </text>
            </g>

            {/* Step 2 Construction: True Length line ab2 at True Angle φ cutting Locus of b (solid continuous line) */}
            <line
              x1={ptATop.x}
              y1={ptATop.y}
              x2={ptB2Top.x}
              y2={ptB2Top.y}
              stroke="#34d399"
              strokeWidth="1.8"
            />
            <circle cx={ptB2Top.x} cy={ptB2Top.y} r={isCompact ? 2.5 : 3.2} fill="#34d399" stroke="#ffffff" strokeWidth="1" />
            <text
              x={ptB2Top.x + 8}
              y={ptB2Top.y + 14}
              fill="#a7f3d0"
              fontSize={isCompact ? '10' : '11.5'}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {line.b2Top.label} (True Length TL = {line.trueLength.toFixed(1)} mm)
            </text>

            {/* Cutting Arc from a to Locus of b (continuous thin arc) */}
            <path
              d={`M ${ptATop.x + radiusTLPlan} ${ptATop.y} A ${radiusTLPlan} ${radiusTLPlan} 0 0 ${
                ptB2Top.y > ptATop.y ? 1 : 0
              } ${ptB2Top.x} ${ptB2Top.y}`}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.4"
              markerEnd="url(#arrow-arc-emerald)"
              opacity="0.8"
            />

            {/* Conditional True Inclination Arc φ at a */}
            {Math.abs(line.phiDeg) >= 0.5 && !isCompact && (
              <g>
                <path
                  d={`M ${ptATop.x + 32} ${ptATop.y} A 32 32 0 0 ${
                    ptB2Top.y > ptATop.y ? '1' : '0'
                  } ${ptATop.x + 32 * Math.cos((line.phiDeg * Math.PI) / 180)} ${
                    ptATop.y + 32 * Math.sin((line.phiDeg * Math.PI) / 180)
                  }`}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="1.2"
                />
                <text
                  x={ptATop.x + 38}
                  y={ptATop.y + 16}
                  fill="#a7f3d0"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  φ = {line.phiDeg.toFixed(1)}°
                </text>
              </g>
            )}

            {/* Locus Line of b established by a -> TL/Arc cutting */}
            <line
              x1={locusStartX}
              y1={ptB2Top.y}
              x2={locusEndX}
              y2={ptB2Top.y}
              stroke="#06b6d4"
              strokeWidth="1.4"
              strokeDasharray="8,4"
              opacity={stageNum === 2 ? 0.95 : 0.75}
            />
            {/* Locus b label badge */}
            <g transform={`translate(${locusEndX + 6}, ${ptB2Top.y - 8})`}>
              <rect x="0" y="0" width={isCompact ? 68 : 88} height="16" rx="3" fill="#083344" stroke="#0e7490" strokeWidth="0.8" opacity="0.9" />
              <text
                x="4"
                y="11"
                fill="#a5f3fc"
                fontSize={isCompact ? '9' : '10'}
                fontWeight="600"
                fontFamily="monospace"
              >
                Locus of {line.nameB.toLowerCase()}
              </text>
            </g>

            {/* Distance Between Projectors (DEP) Indicator along XY */}
            {!isCompact && (
              <g>
                <line
                  x1={originX}
                  y1={groundY}
                  x2={endProjectorX}
                  y2={groundY}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  opacity="0.85"
                />
                <circle cx={originX} cy={groundY} r="2.5" fill="#38bdf8" />
                <circle cx={endProjectorX} cy={groundY} r="2.5" fill="#38bdf8" />
                <text
                  x={(originX + endProjectorX) / 2}
                  y={groundY - 7}
                  fill="#7dd3fc"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  DEP = {line.dep.toFixed(0)} mm
                </text>
              </g>
            )}
          </g>
        )}

        {/* ============================================================== */}
        {/* STAGE 3 ELEMENTS: Rotating Compass Arcs for True Length (TL) */}
        {/* ============================================================== */}
        {stageNum >= 3 && (() => {
          // Angle calculations for accurate parametric arc drawing
          const angTargetElev = Math.atan2(ptB1Front.y - ptAFront.y, ptB1Front.x - ptAFront.x);
          const angTargetPlan = Math.atan2(ptB2Top.y - ptATop.y, ptB2Top.x - ptATop.x);

          // Arc path generator
          const getArcD = (cx: number, cy: number, r: number, startA: number, endA: number) => {
            const steps = 24;
            const delta = (endA - startA) / steps;
            const pts: string[] = [];
            for (let i = 0; i <= steps; i++) {
              const a = startA + i * delta;
              const x = cx + r * Math.cos(a);
              const y = cy + r * Math.sin(a);
              pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
            }
            return pts.join(' ');
          };

          // Compass SVG renderer
          const renderDraftingCompass = (
            cx: number,
            cy: number,
            px: number,
            py: number,
            label: string,
            legColor: string
          ) => {
            const dx = px - cx;
            const dy = py - cy;
            const dist = Math.hypot(dx, dy) || 1;
            const midX = (cx + px) / 2;
            const midY = (cy + py) / 2;

            const legLen = Math.max(dist * 0.9, 65);
            const halfDist = dist / 2;
            const h = Math.sqrt(Math.max(20 * 20, legLen * legLen - halfDist * halfDist));

            let nx = -dy / dist;
            let ny = dx / dist;
            if (ny > 0) {
              nx = -nx;
              ny = -ny;
            }

            const apexX = midX + nx * h;
            const apexY = midY + ny * h;
            const handleX = apexX + nx * 18;
            const handleY = apexY + ny * 18;

            return (
              <g className="pointer-events-none" style={{ filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.75))' }}>
                {/* Steel Needle Leg to Pivot */}
                <line x1={apexX} y1={apexY} x2={cx} y2={cy} stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
                <line x1={apexX} y1={apexY} x2={cx} y2={cy} stroke="#f1f5f9" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="3" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />

                {/* Pencil Leg to Arc Tip */}
                <line x1={apexX} y1={apexY} x2={px} y2={py} stroke={legColor} strokeWidth="3.5" strokeLinecap="round" />
                <line x1={apexX} y1={apexY} x2={px} y2={py} stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
                <circle cx={px} cy={py} r="3.2" fill={legColor} stroke="#ffffff" strokeWidth="1.5" />

                {/* Compass Joint & Knurled Handle */}
                <line x1={apexX} y1={apexY} x2={handleX} y2={handleY} stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx={apexX} cy={apexY} r="5.5" fill="#334155" stroke="#e2e8f0" strokeWidth="1.8" />
                <circle cx={apexX} cy={apexY} r="2" fill="#ffffff" />
                <circle cx={handleX} cy={handleY} r="3" fill="#94a3b8" stroke="#ffffff" strokeWidth="1" />

                {/* Compass HUD Label */}
                <g transform={`translate(${apexX + 10}, ${apexY - 14})`}>
                  <rect x="-4" y="-11" width={label.length * 6.5 + 14} height="18" rx="4" fill="#020617" stroke="#475569" strokeWidth="1" opacity="0.95" />
                  <text x="3" y="1" fill="#f8fafc" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                    {label}
                  </text>
                </g>
              </g>
            );
          };

          // Determine current animation state (active only when stage 3 is single view)
          const isAnimatingThisStage = stageNum === 3 && !isCompact && arcProgress < 1;
          
          // Phase 1 (0 to 0.48): Elevation arc is sweeping
          const elevProgress = isAnimatingThisStage
            ? Math.min(1, arcProgress / 0.48)
            : 1;
          const currElevAngle = elevProgress * angTargetElev;
          const currElevTipX = ptAFront.x + radiusTL * Math.cos(currElevAngle);
          const currElevTipY = ptAFront.y + radiusTL * Math.sin(currElevAngle);

          // Phase 2 (0.52 to 1.0): Plan arc is sweeping
          const planProgress = isAnimatingThisStage
            ? arcProgress < 0.52
              ? 0
              : Math.min(1, (arcProgress - 0.52) / 0.48)
            : 1;
          const currPlanAngle = planProgress * angTargetPlan;
          const currPlanTipX = ptATop.x + radiusTLPlan * Math.cos(currPlanAngle);
          const currPlanTipY = ptATop.y + radiusTLPlan * Math.sin(currPlanAngle);

          return (
            <g>
              {/* Elevation True Length Rotating Arc with Cutting Direction Arrow */}
              {elevProgress > 0.02 && (
                <path
                  d={getArcD(ptAFront.x, ptAFront.y, radiusTL, 0, currElevAngle)}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.8"
                  markerEnd="url(#arrow-arc-purple)"
                  opacity={stageNum === 3 ? 1 : 0.65}
                />
              )}

              {/* Cutting Direction indicator label on Elevation arc */}
              {elevProgress >= 0.95 && !isCompact && (
                <text
                  x={(ptAFront.x + radiusTL + ptB1Front.x) / 2 + 10}
                  y={(ptAFront.y + ptB1Front.y) / 2 - 8}
                  fill="#c084fc"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  Arc to Locus ➔
                </text>
              )}

              {/* True Length Line a'b1' (Elevation) - visible once arc reaches locus */}
              {elevProgress >= 0.85 && (
                <g>
                  <line
                    x1={ptAFront.x}
                    y1={ptAFront.y}
                    x2={ptB1Front.x}
                    y2={ptB1Front.y}
                    stroke="#c084fc"
                    strokeWidth={stageNum === 3 ? '2.4' : '1.5'}
                  />
                  <circle
                    cx={ptB1Front.x}
                    cy={ptB1Front.y}
                    r={isCompact ? 3.5 : 4.5}
                    fill="#c084fc"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <text
                    x={ptB1Front.x + 8}
                    y={ptB1Front.y - 6}
                    fill="#e9d5ff"
                    fontSize={isCompact ? '10' : '12'}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {line.nameB.toLowerCase()}₁′ (TL = {line.trueLength.toFixed(0)}mm)
                  </text>
                </g>
              )}

              {/* True Angle θ Arc at a' */}
              {!isCompact && elevProgress >= 0.95 && (
                <g>
                  <path
                    d={`M ${ptAFront.x + 36} ${ptAFront.y} A 36 36 0 0 ${
                      ptB1Front.y < ptAFront.y ? '0' : '1'
                    } ${ptAFront.x + 36 * Math.cos((line.thetaDeg * Math.PI) / 180)} ${
                      ptAFront.y - 36 * Math.sin((line.thetaDeg * Math.PI) / 180)
                    }`}
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth="1.4"
                  />
                  <text
                    x={ptAFront.x + 48}
                    y={ptAFront.y - 12}
                    fill="#e9d5ff"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    θ = {line.thetaDeg.toFixed(1)}°
                  </text>
                </g>
              )}

              {/* Animated Compass drawing Elevation Arc */}
              {isAnimatingThisStage && arcProgress <= 0.48 && (
                renderDraftingCompass(
                  ptAFront.x,
                  ptAFront.y,
                  currElevTipX,
                  currElevTipY,
                  `Compass (Center a′, R=TL=${line.trueLength.toFixed(0)}mm)`,
                  '#c084fc'
                )
              )}

              {/* Plan True Length Rotating Arc with Cutting Direction Arrow */}
              {planProgress > 0.02 && (
                <path
                  d={getArcD(ptATop.x, ptATop.y, radiusTLPlan, 0, currPlanAngle)}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.8"
                  markerEnd="url(#arrow-arc-emerald)"
                  opacity={stageNum === 3 ? 1 : 0.65}
                />
              )}

              {/* Cutting Direction indicator label on Plan arc */}
              {planProgress >= 0.95 && !isCompact && (
                <text
                  x={(ptATop.x + radiusTLPlan + ptB2Top.x) / 2 + 10}
                  y={(ptATop.y + ptB2Top.y) / 2 + 14}
                  fill="#34d399"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  Arc to Locus ➔
                </text>
              )}

              {/* True Length Line ab2 (Plan) - visible once plan arc reaches locus */}
              {planProgress >= 0.85 && (
                <g>
                  <line
                    x1={ptATop.x}
                    y1={ptATop.y}
                    x2={ptB2Top.x}
                    y2={ptB2Top.y}
                    stroke="#34d399"
                    strokeWidth={stageNum === 3 ? '2.4' : '1.5'}
                  />
                  <circle
                    cx={ptB2Top.x}
                    cy={ptB2Top.y}
                    r={isCompact ? 3.5 : 4.5}
                    fill="#34d399"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <text
                    x={ptB2Top.x + 8}
                    y={ptB2Top.y + 14}
                    fill="#a7f3d0"
                    fontSize={isCompact ? '10' : '12'}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {line.nameB.toLowerCase()}₂ (TL = {line.trueLength.toFixed(0)}mm)
                  </text>
                </g>
              )}

              {/* True Angle φ Arc at a */}
              {!isCompact && planProgress >= 0.95 && (
                <g>
                  <path
                    d={`M ${ptATop.x + 36} ${ptATop.y} A 36 36 0 0 ${
                      ptB2Top.y > ptATop.y ? '1' : '0'
                    } ${ptATop.x + 36 * Math.cos((line.phiDeg * Math.PI) / 180)} ${
                      ptATop.y + 36 * Math.sin((line.phiDeg * Math.PI) / 180)
                    }`}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.4"
                  />
                  <text
                    x={ptATop.x + 48}
                    y={ptATop.y + 18}
                    fill="#a7f3d0"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    φ = {line.phiDeg.toFixed(1)}°
                  </text>
                </g>
              )}

              {/* Animated Compass drawing Plan Arc */}
              {isAnimatingThisStage && arcProgress >= 0.52 && (
                renderDraftingCompass(
                  ptATop.x,
                  ptATop.y,
                  currPlanTipX,
                  currPlanTipY,
                  `Compass (Center a, R=TL=${line.trueLength.toFixed(0)}mm)`,
                  '#34d399'
                )
              )}
            </g>
          );
        })()}

        {/* ============================================================== */}
        {/* STAGE 4 ELEMENTS: Final Apparent Views & End Projector Collinearity */}
        {/* ============================================================== */}
        {stageNum === 4 && (
          <g>
            {/* Common End Projector Line Connecting b' and b - Continuous thin solid line */}
            <line
              x1={endProjectorX}
              y1={Math.min(ptBFront.y, groundY) - 30}
              x2={endProjectorX}
              y2={Math.max(ptBTop.y, groundY) + 30}
              stroke="#e2e8f0"
              strokeWidth="1.0"
            />

            {/* Collinearity Alignment Badge on End Projector */}
            {!isCompact && (
              <g>
                <circle cx={endProjectorX} cy={groundY} r="2.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <text
                  x={endProjectorX + 8}
                  y={groundY - 10}
                  fill="#f1f5f9"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  End Projector of {line.nameB}
                </text>
              </g>
            )}

            {/* FINAL FRONT VIEW (ELEVATION): a'b' in Thick Red Stroke */}
            <line
              x1={ptAFront.x}
              y1={ptAFront.y}
              x2={ptBFront.x}
              y2={ptBFront.y}
              stroke="#ef4444"
              strokeWidth={isCompact ? '2.5' : '3.0'}
              filter="url(#glow-red)"
            />
            {/* Point b' */}
            <circle
              cx={ptBFront.x}
              cy={ptBFront.y}
              r={isCompact ? 2.5 : 3.2}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <text
              x={ptBFront.x + 8}
              y={ptBFront.y - 8}
              fill="#f87171"
              fontSize={isCompact ? '11' : '13'}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {line.bFront.label}
            </text>

            {/* Apparent Angle α Arc */}
            {!isCompact && (
              <g>
                <text
                  x={(ptAFront.x + ptBFront.x) / 2 - 10}
                  y={(ptAFront.y + ptBFront.y) / 2 - 12}
                  fill="#fca5a5"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  Elevation = {line.frontViewLength.toFixed(1)} mm (α = {line.alphaDeg.toFixed(1)}°)
                </text>
              </g>
            )}

            {/* FINAL TOP VIEW (PLAN): ab in Thick Blue Stroke */}
            <line
              x1={ptATop.x}
              y1={ptATop.y}
              x2={ptBTop.x}
              y2={ptBTop.y}
              stroke="#3b82f6"
              strokeWidth={isCompact ? '2.5' : '3.0'}
              filter="url(#glow-blue)"
            />
            {/* Point b */}
            <circle
              cx={ptBTop.x}
              cy={ptBTop.y}
              r={isCompact ? 2.5 : 3.2}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <text
              x={ptBTop.x + 8}
              y={ptBTop.y + 16}
              fill="#60a5fa"
              fontSize={isCompact ? '11' : '13'}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {line.bTop.label}
            </text>

            {/* Apparent Angle β Arc */}
            {!isCompact && (
              <g>
                <text
                  x={(ptATop.x + ptBTop.x) / 2 - 10}
                  y={(ptATop.y + ptBTop.y) / 2 + 20}
                  fill="#93c5fd"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  Plan = {line.topViewLength.toFixed(1)} mm (β = {line.betaDeg.toFixed(1)}°)
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
    );
  };

  const currentStageInfo = stageExplanations[activeStage - 1];

  return (
    <div className="flex flex-col gap-4">
      {/* ============================================================== */}
      {/* STAGE SELECTION CONTROLS BAR (Matches User's UI Screenshot) */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-2.5">
        {/* Row 1: The 4 Sequenced Stage Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stageExplanations.map((stg) => {
            const isSelected = activeStage === stg.num && !isAllStagesView;
            return (
              <button
                key={stg.num}
                type="button"
                onClick={() => handleSelectStage(stg.num as DraftingStageNumber)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400 font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-850 text-slate-300 border border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0 font-bold ${
                    isSelected
                      ? 'bg-white text-blue-700'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {stg.num}
                </span>
                <span className="truncate">{stg.name}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: All 4 Stages + Play Sequence + Navigation Chevrons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {/* All 4 Stages Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setIsAllStagesView(!isAllStagesView);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                isAllStagesView
                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs font-bold'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All 4 Stages</span>
            </button>

            {/* Play Sequence Button */}
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                isPlaying
                  ? 'bg-amber-600 text-white border-amber-500 shadow-xs font-bold'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
              }`}
              title="Auto-play all 4 drafting stages in sequence"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause Sequence' : 'Play Sequence'}</span>
            </button>

            {/* Replay Compass Animation button (Stage 3) */}
            {activeStage === 3 && !isAllStagesView && (
              <button
                type="button"
                onClick={startCompassAnimation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 border-purple-600/70 shadow-xs"
                title="Replay drafting compass arc sweep"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isAnimatingCompass ? 'animate-spin' : ''}`} />
                <span>{isAnimatingCompass ? 'Tracing Arcs...' : 'Replay Compass'}</span>
              </button>
            )}

            {/* Prev / Next Chevrons */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={handlePrevStage}
                disabled={activeStage <= 1 && !isAllStagesView}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 cursor-pointer transition"
                title="Previous Drafting Step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextStage}
                disabled={activeStage >= 4 && !isAllStagesView}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 cursor-pointer transition"
                title="Next Drafting Step"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Stage Indicator */}
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span>
              {isAllStagesView ? 'Showing All 4 Stages' : `Stage ${activeStage} of 4: ${currentStageInfo.name}`}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MAIN VIEWPORT: SINGLE STAGE CANVAS OR ALL 4 STAGES STORYBOARD */}
      {/* ============================================================== */}
      {!isAllStagesView ? (
        <div className="flex flex-col gap-3">
          {/* Main Interactive Stage SVG Canvas */}
          <div className="relative w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-slate-700 shadow-inner">
            {renderStageSvg(activeStage, false)}

            {/* Corner Badge Indicator */}
            <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700/80 text-[11px] font-mono text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Step {activeStage}: {currentStageInfo.name}</span>
            </div>

            {/* Quick Legend in Corner */}
            <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-[10.5px] font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-500" />
                <span>Elevation</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
                <span>Plan</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-purple-400" />
                <span>True Length</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
                <span>Locus Line</span>
              </span>
            </div>
          </div>

          {/* Accompanying Theory & Drafting Procedure Note */}
          <div className="p-4 rounded-xl bg-slate-800/60 dark:bg-slate-900/80 border border-slate-700/80 text-xs text-slate-200 flex flex-col gap-2 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2 font-sans">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center font-bold">
                  {currentStageInfo.num}
                </span>
                <span>{currentStageInfo.title}</span>
              </h4>
              <span className="text-[11px] font-mono text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded">
                {currentStageInfo.instrument}
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed text-[12px] font-sans">
              {currentStageInfo.description}
            </p>

            <div className="flex items-start gap-2 pt-1 text-[11.5px] text-emerald-300 font-sans">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Drafting Principle:</strong> {currentStageInfo.keyTakeaway}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* ALL 4 STAGES PROGRESSIVE STORYBOARD GRID VIEW */
        /* ============================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stageExplanations.map((stg) => (
            <div
              key={stg.num}
              onClick={() => handleSelectStage(stg.num as DraftingStageNumber)}
              className="group cursor-pointer rounded-xl border border-slate-700 bg-slate-900 overflow-hidden hover:border-blue-500 transition shadow-sm flex flex-col"
            >
              <div className="p-2.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 font-sans">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-mono flex items-center justify-center font-bold">
                    {stg.num}
                  </span>
                  <span>{stg.name}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-400 transition">
                  Click to Expand
                </span>
              </div>

              {/* Compact SVG Viewport */}
              <div className="w-full h-[180px] bg-[#0b1329] overflow-hidden">
                {renderStageSvg(stg.num as DraftingStageNumber, true)}
              </div>

              <div className="p-3 bg-slate-850/60 border-t border-slate-800/80 text-[11px] text-slate-300 leading-relaxed font-sans">
                {stg.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
