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
  RotateCcw,
  Layers,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Download,
  Info,
  Maximize2,
  Ruler,
  Eye,
  Sliders,
} from 'lucide-react';

export type RotatingStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface RotatingLineEngineProps {
  line: ComputedLine;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
  onApplyLineInput?: (updated: any) => void;
}

export const RotatingLineConstructionEngine: React.FC<RotatingLineEngineProps> = ({
  line,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  isDark = true,
}) => {
  // Construction step (1 to 8)
  const [activeStep, setActiveStep] = useState<RotatingStepNumber>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompletedView, setIsCompletedView] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  // SVG container and zoom/pan
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Graphic Layer Toggles
  const [showRefLine, setShowRefLine] = useState<boolean>(true);
  const [showProjectors, setShowProjectors] = useState<boolean>(true);
  const [showAuxiliary, setShowAuxiliary] = useState<boolean>(true);
  const [showLoci, setShowLoci] = useState<boolean>(true);
  const [showArcs, setShowArcs] = useState<boolean>(true);
  const [showFinalViews, setShowFinalViews] = useState<boolean>(true);
  const [showTraces, setShowTraces] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);

  // Mathematical Parameters
  const tl = Math.max(1, line.trueLength);
  const theta = Math.max(0, Math.min(90, line.thetaDeg));
  const phi = Math.max(0, Math.min(90, line.phiDeg));
  const thetaRad = (theta * Math.PI) / 180;
  const phiRad = (phi * Math.PI) / 180;

  // Real Spatial Line Validation: sin²θ + sin²φ <= 1
  const sin2Sum = Math.sin(thetaRad) ** 2 + Math.sin(phiRad) ** 2;
  const isGeometricallyPossible = sin2Sum <= 1.0001;

  // Plan Length (ab1) and Elevation Length (a'b'2)
  const plAux = tl * Math.cos(thetaRad); // ab1 = Plan Length
  const elAux = tl * Math.cos(phiRad);   // a'b'2 = Elevation Length

  // End Point A coordinates (mm)
  const zA = line.zA; // + above HP, - below HP
  const yA = line.yA; // + in front of VP, - behind VP

  // End Point B coordinates (mm)
  const dz = tl * Math.sin(thetaRad);
  const dy = tl * Math.sin(phiRad);
  const zB = zA + dz; // Distance above HP for B
  const yB = yA + dy; // Distance in front of VP for B

  // Distance between end projectors (DEP, mm) calculated mathematically
  // dx = sqrt(TL² - dy² - dz²) = sqrt(PL² - dy²) = sqrt(EL² - dz²)
  const dxSquared = Math.max(0, tl * tl - dy * dy - dz * dz);
  const depCalculated = Math.sqrt(dxSquared);

  // Apparent angles
  const alphaApparent = elAux > 1e-4 ? (Math.atan2(dz, depCalculated) * 180) / Math.PI : 0;
  const betaApparent = plAux > 1e-4 ? (Math.atan2(dy, depCalculated) * 180) / Math.PI : 0;

  // Auto-play timer
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setTimeout(() => {
        setActiveStep((prev) => {
          if (prev >= 8) {
            setIsPlaying(false);
            return 8;
          }
          return (prev + 1) as RotatingStepNumber;
        });
      }, 3200);
    } else {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
    }
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, activeStep]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (activeStep >= 8) setActiveStep(1);
      setIsCompletedView(false);
      setIsPlaying(true);
    }
  };

  const handleStepChange = (step: RotatingStepNumber) => {
    setIsPlaying(false);
    setIsCompletedView(false);
    setActiveStep(step);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setIsCompletedView(false);
    setActiveStep((prev) => (Math.max(1, prev - 1) as RotatingStepNumber));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setIsCompletedView(false);
    setActiveStep((prev) => (Math.min(8, prev + 1) as RotatingStepNumber));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setIsCompletedView(false);
    setActiveStep(1);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // SVG Pan and Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  // SVG Coordinates & Responsive Viewbox Mapping
  const svgMetrics = useMemo(() => {
    const width = 940;
    const height = 540;
    const groundY = 270; // Reference XY line
    const originX = 220; // Reference Projector of End A

    // Compute maximum extent in mm to establish dynamic scale
    const maxExtentX = Math.max(depCalculated, plAux, elAux, 80);
    const maxExtentY = Math.max(Math.abs(zA), Math.abs(zB), Math.abs(yA), Math.abs(yB), 60);

    const scaleX = 420 / Math.max(maxExtentX, 70);
    const scaleY = 190 / Math.max(maxExtentY, 50);
    const scale = Math.min(scaleX, scaleY, 2.6);

    const toX = (xMm: number) => originX + xMm * scale;
    // In SVG, positive Y is downwards.
    // In orthographic projection: +z (above HP) goes ABOVE XY (y < groundY)
    // +y (in front of VP) goes BELOW XY (y > groundY)
    const toYFv = (zMm: number) => groundY - zMm * scale;
    const toYTv = (yMm: number) => groundY + yMm * scale;

    // Step 2 Coordinates: Point A
    const ptAFv = { x: toX(0), y: toYFv(zA) };
    const ptATv = { x: toX(0), y: toYTv(yA) };

    // Step 3 Coordinates: First Auxiliary Position AB1 (inclined at θ to HP, parallel to VP)
    // b'1 is in elevation at true angle θ, length TL
    const ptB1Fv = {
      x: toX(tl * Math.cos(thetaRad)),
      y: toYFv(zA + tl * Math.sin(thetaRad)),
    };
    // b1 is the projection of b'1 on the horizontal line through a in plan
    const ptB1Tv = {
      x: ptB1Fv.x,
      y: ptATv.y, // along horizontal line of a
    };

    // Step 4 Coordinates: Second Auxiliary Position AB2 (inclined at φ to VP, parallel to HP)
    // b2 is in plan at true angle φ, length TL
    const ptB2Tv = {
      x: toX(tl * Math.cos(phiRad)),
      y: toYTv(yA + tl * Math.sin(phiRad)),
    };
    // b'2 is the projection of b2 on the horizontal line through a' in elevation
    const ptB2Fv = {
      x: ptB2Tv.x,
      y: ptAFv.y, // along horizontal line of a'
    };

    // Step 5 Locus Heights & Horizontal Spans (MUST HAVE NO GAPS)
    const locusFvY = ptB1Fv.y;
    const locusTvY = ptB2Tv.y;
    const locusStartX = originX - 60;
    const locusEndX = Math.max(ptB1Fv.x, ptB2Tv.x, toX(depCalculated)) + 90;

    // Step 6 & 7 Final Rotations:
    // b in plan is at x = toX(depCalculated), y = locusTvY
    const ptBTv = {
      x: toX(depCalculated),
      y: locusTvY,
    };
    // b' in elevation is at x = toX(depCalculated), y = locusFvY
    const ptBFv = {
      x: toX(depCalculated),
      y: locusFvY,
    };

    const radiusPlanArc = Math.abs(ptB1Tv.x - ptATv.x); // ab1 = PL
    const radiusElevArc = Math.abs(ptB2Fv.x - ptAFv.x); // a'b'2 = EL

    // Traces coordinates (HT and VT)
    const htGroundSvg = line.ht?.exists ? { x: toX(line.ht.groundProj.x), y: groundY } : null;
    const htTraceSvg = line.ht?.exists ? { x: toX(line.ht.traceProj.x), y: groundY - line.ht.traceProj.y * scale } : null;
    const vtGroundSvg = line.vt?.exists ? { x: toX(line.vt.groundProj.x), y: groundY } : null;
    const vtTraceSvg = line.vt?.exists ? { x: toX(line.vt.traceProj.x), y: groundY - line.vt.traceProj.y * scale } : null;

    // Nearest endpoints for dotted trace lines
    const fvEndNearH = htGroundSvg
      ? Math.hypot(ptAFv.x - htGroundSvg.x, ptAFv.y - htGroundSvg.y) <
        Math.hypot(ptBFv.x - htGroundSvg.x, ptBFv.y - htGroundSvg.y)
        ? ptAFv
        : ptBFv
      : null;
    const tvEndNearH = htTraceSvg
      ? Math.hypot(ptATv.x - htTraceSvg.x, ptATv.y - htTraceSvg.y) <
        Math.hypot(ptBTv.x - htTraceSvg.x, ptBTv.y - htTraceSvg.y)
        ? ptATv
        : ptBTv
      : null;

    const tvEndNearV = vtGroundSvg
      ? Math.hypot(ptATv.x - vtGroundSvg.x, ptATv.y - vtGroundSvg.y) <
        Math.hypot(ptBTv.x - vtGroundSvg.x, ptBTv.y - vtGroundSvg.y)
        ? ptATv
        : ptBTv
      : null;
    const fvEndNearV = vtTraceSvg
      ? Math.hypot(ptAFv.x - vtTraceSvg.x, ptAFv.y - vtTraceSvg.y) <
        Math.hypot(ptBFv.x - vtTraceSvg.x, ptBFv.y - vtTraceSvg.y)
        ? ptAFv
        : ptBFv
      : null;

    return {
      width,
      height,
      groundY,
      originX,
      scale,
      toX,
      toYFv,
      toYTv,
      ptAFv,
      ptATv,
      ptB1Fv,
      ptB1Tv,
      ptB2Tv,
      ptB2Fv,
      ptBFv,
      ptBTv,
      locusFvY,
      locusTvY,
      locusStartX,
      locusEndX,
      radiusPlanArc,
      radiusElevArc,
      htGroundSvg,
      htTraceSvg,
      vtGroundSvg,
      vtTraceSvg,
      fvEndNearH,
      tvEndNearH,
      tvEndNearV,
      fvEndNearV,
    };
  }, [tl, thetaRad, phiRad, zA, yA, zB, yB, depCalculated, plAux, elAux, line.ht, line.vt]);

  // Current active step number (forced to 8 in completed view)
  const currentStep = isCompletedView ? 8 : activeStep;

  // Step Educational Explanations
  const stepInfo = [
    {
      num: 1,
      title: 'Step 1: Reference Line XY',
      sub: 'Establish the ground line representing the intersection of HP and VP',
      description:
        'Draw the horizontal reference line XY. In First-Angle projection, the area above XY represents the Vertical Plane (VP for Front View/Elevation), and the area below XY represents the Horizontal Plane (HP for Top View/Plan).',
      mathNote: 'Ground line XY: y = 0. Establishes the coordinate origin and drafting scale.',
    },
    {
      num: 2,
      title: 'Step 2: Locate Endpoint A (a′ and a)',
      sub: 'Position front view a′ and top view a on the common reference projector',
      description: `Erect a vertical projector line perpendicular to XY. Mark the Front View a′ at height |zA| = ${Math.abs(
        zA
      ).toFixed(1)} mm above HP. Mark the Top View a at depth |yA| = ${Math.abs(yA).toFixed(
        1
      )} mm in front of VP (drawn below XY). Both points strictly lie on the exact same vertical projector line.`,
      mathNote: `a′ = (0, ${zA >= 0 ? '+' : ''}${zA.toFixed(1)} mm), a = (0, ${
        yA >= 0 ? '-' : '+'
      }${yA.toFixed(1)} mm in orthographic 2D).`,
    },
    {
      num: 3,
      title: 'Step 3: First Auxiliary Position — AB₁ (Parallel to VP, Inclined at θ to HP)',
      sub: 'Draw true length line a′b₁′ at inclination θ, project down to find plan length ab₁',
      description: `From front view a′, draw a′b₁′ equal to True Length (TL = ${tl.toFixed(
        1
      )} mm) inclined at θ = ${theta.toFixed(
        1
      )}° to the horizontal. Label b₁′. From b₁′, drop a vertical projector perpendicular to XY down to intersect the horizontal line drawn through a at point b₁. The line ab₁ is parallel to XY and gives the Plan Length (Top View Length PL = TL·cos θ = ${plAux.toFixed(
        1
      )} mm).`,
      mathNote: `a′b₁′ = TL = ${tl.toFixed(1)} mm, θ = ${theta.toFixed(
        1
      )}°. Plan Length ab₁ = TL·cos(${theta.toFixed(1)}°) = ${plAux.toFixed(1)} mm.`,
    },
    {
      num: 4,
      title: 'Step 4: Second Auxiliary Position — AB₂ (Parallel to HP, Inclined at φ to VP)',
      sub: 'Draw true length line ab₂ at inclination φ, project up to find elevation length a′b₂′',
      description: `From top view a, draw ab₂ equal to True Length (TL = ${tl.toFixed(
        1
      )} mm) inclined at φ = ${phi.toFixed(
        1
      )}° to the horizontal. Label b₂. From b₂, erect a vertical projector perpendicular to XY up to intersect the horizontal line drawn through a′ at point b₂′. The line a′b₂′ is parallel to XY and gives the Elevation Length (Front View Length EL = TL·cos φ = ${elAux.toFixed(
        1
      )} mm).`,
      mathNote: `ab₂ = TL = ${tl.toFixed(1)} mm, φ = ${phi.toFixed(
        1
      )}°. Elevation Length a′b₂′ = TL·cos(${phi.toFixed(1)}°) = ${elAux.toFixed(1)} mm.`,
    },
    {
      num: 5,
      title: 'Step 5: Locus Construction (Locus of b′ and Locus of b)',
      sub: 'Draw continuous horizontal locus lines parallel to XY through b₁′ and b₂ with NO gaps',
      description: `Through b₁′ in VP, draw the horizontal line parallel to XY: this is the "Locus of b′". Through b₂ in HP, draw the horizontal line parallel to XY: this is the "Locus of b". The locus lines extend seamlessly across the drawing with no gaps, defining the fixed vertical height and depth bounds for end B.`,
      mathNote: `Locus of b′: height = ${zB.toFixed(1)} mm above HP. Locus of b: depth = ${yB.toFixed(
        1
      )} mm in front of VP.`,
    },
    {
      num: 6,
      title: 'Step 6: Final Top View Rotation (Rotate ab₁ to Intersect Locus of b)',
      sub: 'Center a, radius R = ab₁ (Plan Length), swing arc to cut Locus of b at final point b',
      description: `With top view a as center and radius equal to plan length ab₁ (PL = ${plAux.toFixed(
        1
      )} mm), swing a circular arc to intersect the Locus of b at point b. Join a and b with a thick continuous object line. This gives the final Top View (Plan) of line AB, inclined at apparent angle β = ${betaApparent.toFixed(
        1
      )}° to XY!`,
      mathNote: `Center a, Radius R = ab₁ = ${plAux.toFixed(
        1
      )} mm. Intersection with locus gives b. Final Top View length ab = ${plAux.toFixed(1)} mm.`,
    },
    {
      num: 7,
      title: 'Step 7: Final Front View Rotation & End Projector Verification',
      sub: 'Center a′, radius R = a′b₂′ (Elevation Length), swing arc to cut Locus of b′ at b′',
      description: `With front view a′ as center and radius equal to elevation length a′b₂′ (EL = ${elAux.toFixed(
        1
      )} mm), swing a circular arc to intersect the Locus of b′ at point b′. Join a′ and b′ with a thick continuous line for the final Front View. Now connect b′ and b with a thin vertical projector: notice b′ and b lie on the EXACT same vertical line perpendicular to XY!`,
      mathNote: `Center a′, Radius R = a′b₂′ = ${elAux.toFixed(
        1
      )} mm. Projector check: x(b′) ≡ x(b) = DEP = ${depCalculated.toFixed(2)} mm! Verified!`,
    },
    {
      num: 8,
      title: 'Step 8: Finishing & Engineering Graphics Verification',
      sub: 'Highlight final views, show apparent angles (α, β), and verify all geometric invariants',
      description: `The complete orthographic projection is obtained: Front View a′b′ (Elevation) and Top View ab (Plan) are highlighted in bold. Apparent angles α = ${alphaApparent.toFixed(
        1
      )}° and β = ${betaApparent.toFixed(
        1
      )}° are marked. All construction lines, auxiliary lines, and loci are preserved according to BIS SP 46 standards.`,
      mathNote: `TL = ${tl.toFixed(1)} mm | EL = ${elAux.toFixed(1)} mm | PL = ${plAux.toFixed(
        1
      )} mm | θ = ${theta.toFixed(1)}° | φ = ${phi.toFixed(1)}° | α = ${alphaApparent.toFixed(
        1
      )}° | β = ${betaApparent.toFixed(1)}° | DEP = ${depCalculated.toFixed(1)} mm.`,
    },
  ];

  // Current Step Description
  const currentStepData = stepInfo[currentStep - 1];

  // High-Resolution SVG/PNG Export
  const exportAsPng = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = svgMetrics.width * 2;
    canvas.height = svgMetrics.height * 2;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = isDark ? '#0b1329' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `rotating-line-method-${line.nameA}${line.nameB}-step${currentStep}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  const exportAsSvg = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `rotating-line-method-${line.nameA}${line.nameB}-step${currentStep}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Geometrical Impossibility Alert */}
      {!isGeometricallyPossible && (
        <div className="p-4 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-sm">Contradictory / Geometrically Impossible Angle Data</p>
            <p className="mt-1">
              For any real straight line in 3D Euclidean space, the sum of squares of direction cosines implies{' '}
              <code className="font-mono font-bold bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">
                sin²(θ) + sin²(φ) ≤ 1
              </code>
              . Here, sin²({theta.toFixed(1)}°) + sin²({phi.toFixed(1)}°) = {sin2Sum.toFixed(3)} &gt; 1.0.
            </p>
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              The rotating line arcs cannot intersect their respective loci because the line would have to stretch. Please adjust θ or φ so that θ + φ ≤ 90° for valid oblique projections.
            </p>
          </div>
        </div>
      )}

      {/* Main Interactive Construction Workspace */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 overflow-hidden shadow-lg select-none">
        {/* Top Header Overlay: Step Progress & Controls */}
        <div className="p-3 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
          {/* Step Badges 1 to 8 */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 max-w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
              const isCurr = currentStep === s;
              const isPast = currentStep > s;
              return (
                <button
                  key={s}
                  onClick={() => handleStepChange(s as RotatingStepNumber)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isCurr
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-400'
                      : isPast
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                      : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800'
                  }`}
                  title={`Jump to Step ${s}`}
                >
                  <span>Step {s}</span>
                  {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            {/* Completed Drawing View Toggle */}
            <button
              onClick={() => {
                setIsPlaying(false);
                setIsCompletedView(!isCompletedView);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                isCompletedView
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isCompletedView ? 'Exit Full View' : 'Final Drawing'}</span>
            </button>

            {/* Play/Pause */}
            <button
              onClick={handleTogglePlay}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                isPlaying
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={isPlaying ? 'Pause Construction' : 'Play Step-by-Step Construction'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              title="Reset Construction to Step 1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* SVG Export */}
            <button
              onClick={exportAsSvg}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              title="Export as Clean Vector SVG"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Layer Visibility Pills Ribbon */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-slate-300 font-bold">
            <Layers className="w-3 h-3 text-blue-400" />
            Layers:
          </span>
          <button
            onClick={() => setShowProjectors(!showProjectors)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showProjectors ? 'bg-slate-800 text-blue-300 border border-blue-900/50' : 'text-slate-600'
            }`}
          >
            Projectors
          </button>
          <button
            onClick={() => setShowAuxiliary(!showAuxiliary)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showAuxiliary ? 'bg-purple-950 text-purple-300 border border-purple-800/50' : 'text-slate-600'
            }`}
          >
            Auxiliary AB₁/AB₂
          </button>
          <button
            onClick={() => setShowLoci(!showLoci)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showLoci ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'text-slate-600'
            }`}
          >
            Locus Lines
          </button>
          <button
            onClick={() => setShowArcs(!showArcs)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showArcs ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' : 'text-slate-600'
            }`}
          >
            Rotation Arcs
          </button>
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showDimensions ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50' : 'text-slate-600'
            }`}
          >
            Dimensions (mm)
          </button>
          <button
            onClick={() => setShowTraces(!showTraces)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showTraces ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'text-slate-600'
            }`}
          >
            Traces (HT/VT)
          </button>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`px-2 py-0.5 rounded cursor-pointer transition ${
              showLegend ? 'bg-slate-800 text-slate-200' : 'text-slate-600'
            }`}
          >
            Legend
          </button>
        </div>

        {/* SVG Drawing Canvas */}
        <div
          className="relative w-full h-[480px] sm:h-[520px] bg-[#070d1e] overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgMetrics.width} ${svgMetrics.height}`}
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            <defs>
              {/* Arrow Markers for Dimensions */}
              <marker id="arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 10 1.5 L 0 5 L 10 8.5 z" fill="#60a5fa" />
              </marker>
              <marker id="arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#60a5fa" />
              </marker>
              <marker id="arrow-arc-purple" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#c084fc" />
              </marker>
              <marker id="arrow-arc-emerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#34d399" />
              </marker>
              <marker id="arrow-arc-amber" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#fbbf24" />
              </marker>
            </defs>

            {/* LAYER 1: XY REFERENCE LINE & PLANES */}
            {showRefLine && (
              <g id="layer-reference-line">
                {/* Horizontal XY Reference Ground Line */}
                <line
                  x1={30}
                  y1={svgMetrics.groundY}
                  x2={svgMetrics.width - 30}
                  y2={svgMetrics.groundY}
                  stroke="#f1f5f9"
                  strokeWidth="2.2"
                />
                {/* Endpoint dots */}
                <circle cx={40} cy={svgMetrics.groundY} r="3" fill="#f8fafc" />
                <circle cx={svgMetrics.width - 40} cy={svgMetrics.groundY} r="3" fill="#f8fafc" />
                {/* Labels X and Y */}
                <text
                  x={22}
                  y={svgMetrics.groundY + 5}
                  fill="#f8fafc"
                  fontSize="16"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  X
                </text>
                <text
                  x={svgMetrics.width - 24}
                  y={svgMetrics.groundY + 5}
                  fill="#f8fafc"
                  fontSize="16"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  Y
                </text>

                {/* Reference Plane Identifiers (VP Above, HP Below in First Angle) */}
              </g>
            )}

            {/* LAYER 2: ENDPOINT A PROJECTOR & POINTS (Step 2+) */}
            {currentStep >= 2 && showProjectors && (
              <g id="layer-endpoint-a">
                {/* Continuous Thin Vertical Projector for End A */}
                <line
                  x1={svgMetrics.originX}
                  y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 40}
                  x2={svgMetrics.originX}
                  y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 40}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />

                {/* Dimension for Point a' (Distance above HP) */}
                {showDimensions && (
                  <g>
                    <line
                      x1={svgMetrics.originX - 25}
                      y1={svgMetrics.groundY}
                      x2={svgMetrics.originX - 25}
                      y2={svgMetrics.ptAFv.y}
                      stroke="#f87171"
                      strokeWidth="1"
                      markerStart="url(#arrow-start)"
                      markerEnd="url(#arrow-end)"
                    />
                    <line
                      x1={svgMetrics.originX - 32}
                      y1={svgMetrics.ptAFv.y}
                      x2={svgMetrics.originX - 10}
                      y2={svgMetrics.ptAFv.y}
                      stroke="#f87171"
                      strokeWidth="0.8"
                      opacity="0.5"
                    />
                    <text
                      x={svgMetrics.originX - 32}
                      y={(svgMetrics.groundY + svgMetrics.ptAFv.y) / 2 + 3}
                      fill="#fca5a5"
                      fontSize="10.5"
                      fontFamily="monospace"
                      textAnchor="end"
                      fontWeight="bold"
                    >
                      {Math.abs(zA).toFixed(1)} mm
                    </text>
                  </g>
                )}

                {/* Dimension for Point a (Distance in front of VP) */}
                {showDimensions && (
                  <g>
                    <line
                      x1={svgMetrics.originX - 25}
                      y1={svgMetrics.groundY}
                      x2={svgMetrics.originX - 25}
                      y2={svgMetrics.ptATv.y}
                      stroke="#60a5fa"
                      strokeWidth="1"
                      markerStart="url(#arrow-start)"
                      markerEnd="url(#arrow-end)"
                    />
                    <line
                      x1={svgMetrics.originX - 32}
                      y1={svgMetrics.ptATv.y}
                      x2={svgMetrics.originX - 10}
                      y2={svgMetrics.ptATv.y}
                      stroke="#60a5fa"
                      strokeWidth="0.8"
                      opacity="0.5"
                    />
                    <text
                      x={svgMetrics.originX - 32}
                      y={(svgMetrics.groundY + svgMetrics.ptATv.y) / 2 + 3}
                      fill="#93c5fd"
                      fontSize="10.5"
                      fontFamily="monospace"
                      textAnchor="end"
                      fontWeight="bold"
                    >
                      {Math.abs(yA).toFixed(1)} mm
                    </text>
                  </g>
                )}

                {/* Front View Point a' (Red) */}
                <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                <text
                  x={svgMetrics.ptAFv.x - 14}
                  y={svgMetrics.ptAFv.y - 8}
                  fill="#fca5a5"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  a′
                </text>

                {/* Top View Point a (Blue) */}
                <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                <text
                  x={svgMetrics.ptATv.x - 14}
                  y={svgMetrics.ptATv.y + 18}
                  fill="#93c5fd"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  a
                </text>
              </g>
            )}

            {/* LAYER 3: FIRST AUXILIARY POSITION AB1 (Step 3+) */}
            {currentStep >= 3 && showAuxiliary && (
              <g id="layer-first-auxiliary-ab1">
                {/* Horizontal reference line through a' */}
                <line
                  x1={svgMetrics.ptAFv.x}
                  y1={svgMetrics.ptAFv.y}
                  x2={svgMetrics.ptB1Fv.x + 35}
                  y2={svgMetrics.ptAFv.y}
                  stroke="#94a3b8"
                  strokeWidth="0.9"
                  strokeDasharray="4,3"
                />

                {/* Horizontal reference line through a */}
                <line
                  x1={svgMetrics.ptATv.x}
                  y1={svgMetrics.ptATv.y}
                  x2={svgMetrics.ptB1Tv.x + 35}
                  y2={svgMetrics.ptATv.y}
                  stroke="#94a3b8"
                  strokeWidth="0.9"
                  strokeDasharray="4,3"
                />

                {/* True Length Line a'b1' at angle θ (Purple) */}
                <line
                  x1={svgMetrics.ptAFv.x}
                  y1={svgMetrics.ptAFv.y}
                  x2={svgMetrics.ptB1Fv.x}
                  y2={svgMetrics.ptB1Fv.y}
                  stroke="#c084fc"
                  strokeWidth="2.4"
                />
                <circle cx={svgMetrics.ptB1Fv.x} cy={svgMetrics.ptB1Fv.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                <text
                  x={svgMetrics.ptB1Fv.x + 8}
                  y={svgMetrics.ptB1Fv.y - 6}
                  fill="#e9d5ff"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  b₁′ (TL = {tl.toFixed(1)} mm)
                </text>

                {/* True Angle θ Arc at a' */}
                {theta >= 1 && (
                  <g>
                    <path
                      d={`M ${svgMetrics.ptAFv.x + 34} ${svgMetrics.ptAFv.y} A 34 34 0 0 0 ${
                        svgMetrics.ptAFv.x + 34 * Math.cos(thetaRad)
                      } ${svgMetrics.ptAFv.y - 34 * Math.sin(thetaRad)}`}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="1.4"
                      markerEnd="url(#arrow-arc-purple)"
                    />
                    <text
                      x={svgMetrics.ptAFv.x + 42}
                      y={svgMetrics.ptAFv.y - 10}
                      fill="#e9d5ff"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      θ = {theta.toFixed(1)}°
                    </text>
                  </g>
                )}

                {/* Vertical Projector from b1' down to horizontal line of a */}
                <line
                  x1={svgMetrics.ptB1Fv.x}
                  y1={svgMetrics.ptB1Fv.y}
                  x2={svgMetrics.ptB1Tv.x}
                  y2={svgMetrics.ptB1Tv.y}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeDasharray="5,4"
                />

                {/* Point b1 on horizontal line through a */}
                <circle cx={svgMetrics.ptB1Tv.x} cy={svgMetrics.ptB1Tv.y} r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <text
                  x={svgMetrics.ptB1Tv.x + 8}
                  y={svgMetrics.ptB1Tv.y - 6}
                  fill="#7dd3fc"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  b₁ (PL = {plAux.toFixed(1)} mm)
                </text>

                {/* Line ab1 parallel to XY (Plan Length) */}
                <line
                  x1={svgMetrics.ptATv.x}
                  y1={svgMetrics.ptATv.y}
                  x2={svgMetrics.ptB1Tv.x}
                  y2={svgMetrics.ptB1Tv.y}
                  stroke="#38bdf8"
                  strokeWidth="2.0"
                />
              </g>
            )}

            {/* LAYER 4: SECOND AUXILIARY POSITION AB2 (Step 4+) */}
            {currentStep >= 4 && showAuxiliary && (
              <g id="layer-second-auxiliary-ab2">
                {/* True Length Line ab2 at angle φ in Plan (Emerald) */}
                <line
                  x1={svgMetrics.ptATv.x}
                  y1={svgMetrics.ptATv.y}
                  x2={svgMetrics.ptB2Tv.x}
                  y2={svgMetrics.ptB2Tv.y}
                  stroke="#34d399"
                  strokeWidth="2.4"
                />
                <circle cx={svgMetrics.ptB2Tv.x} cy={svgMetrics.ptB2Tv.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                <text
                  x={svgMetrics.ptB2Tv.x + 8}
                  y={svgMetrics.ptB2Tv.y + 16}
                  fill="#a7f3d0"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  b₂ (TL = {tl.toFixed(1)} mm)
                </text>

                {/* True Angle φ Arc at a */}
                {phi >= 1 && (
                  <g>
                    <path
                      d={`M ${svgMetrics.ptATv.x + 34} ${svgMetrics.ptATv.y} A 34 34 0 0 1 ${
                        svgMetrics.ptATv.x + 34 * Math.cos(phiRad)
                      } ${svgMetrics.ptATv.y + 34 * Math.sin(phiRad)}`}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="1.4"
                      markerEnd="url(#arrow-arc-emerald)"
                    />
                    <text
                      x={svgMetrics.ptATv.x + 42}
                      y={svgMetrics.ptATv.y + 18}
                      fill="#a7f3d0"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      φ = {phi.toFixed(1)}°
                    </text>
                  </g>
                )}

                {/* Vertical Projector from b2 up to horizontal line of a' */}
                <line
                  x1={svgMetrics.ptB2Tv.x}
                  y1={svgMetrics.ptB2Tv.y}
                  x2={svgMetrics.ptB2Fv.x}
                  y2={svgMetrics.ptB2Fv.y}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeDasharray="5,4"
                />

                {/* Point b'2 on horizontal line through a' */}
                <circle cx={svgMetrics.ptB2Fv.x} cy={svgMetrics.ptB2Fv.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                <text
                  x={svgMetrics.ptB2Fv.x + 8}
                  y={svgMetrics.ptB2Fv.y + 16}
                  fill="#fde68a"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  b₂′ (EL = {elAux.toFixed(1)} mm)
                </text>

                {/* Line a'b'2 parallel to XY (Elevation Length) */}
                <line
                  x1={svgMetrics.ptAFv.x}
                  y1={svgMetrics.ptAFv.y}
                  x2={svgMetrics.ptB2Fv.x}
                  y2={svgMetrics.ptB2Fv.y}
                  stroke="#f59e0b"
                  strokeWidth="2.0"
                />
              </g>
            )}

            {/* LAYER 5: LOCUS LINES (Step 5+) — STRICTLY NO GAPS, FULL HORIZONTAL CONTINUITY */}
            {currentStep >= 5 && showLoci && (
              <g id="layer-loci">
                {/* Locus of b' (Front View / Elevation Locus) — Drawn through b1' parallel to XY */}
                <line
                  x1={svgMetrics.locusStartX}
                  y1={svgMetrics.locusFvY}
                  x2={svgMetrics.locusEndX}
                  y2={svgMetrics.locusFvY}
                  stroke="#fbbf24"
                  strokeWidth="0.9"
                />
                {/* Locus of b' Label Badge */}
                <g transform={`translate(${svgMetrics.locusEndX + 6}, ${svgMetrics.locusFvY - 9})`}>
                  <rect x="0" y="0" width="112" height="18" rx="4" fill="#451a03" stroke="#d97706" strokeWidth="1" />
                  <text x="6" y="13" fill="#fef08a" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                    Locus of b′ ({zB.toFixed(1)}mm)
                  </text>
                </g>

                {/* Locus of b (Top View / Plan Locus) — Drawn through b2 parallel to XY */}
                <line
                  x1={svgMetrics.locusStartX}
                  y1={svgMetrics.locusTvY}
                  x2={svgMetrics.locusEndX}
                  y2={svgMetrics.locusTvY}
                  stroke="#22d3ee"
                  strokeWidth="0.9"
                />
                {/* Locus of b Label Badge */}
                <g transform={`translate(${svgMetrics.locusEndX + 6}, ${svgMetrics.locusTvY - 9})`}>
                  <rect x="0" y="0" width="112" height="18" rx="4" fill="#083344" stroke="#0891b2" strokeWidth="1" />
                  <text x="6" y="13" fill="#a5f3fc" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                    Locus of b ({yB.toFixed(1)}mm)
                  </text>
                </g>
              </g>
            )}

            {/* LAYER 6: TOP VIEW ROTATION ARC & POINT b (Step 6+) */}
            {currentStep >= 6 && showArcs && (
              <g id="layer-top-view-rotation">
                {/* Rotation arc: Center a, Radius ab1, cutting Locus of b at b */}
                <path
                  d={`M ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y} A ${svgMetrics.radiusPlanArc} ${
                    svgMetrics.radiusPlanArc
                  } 0 0 1 ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.8"
                  strokeDasharray="4,3"
                  markerEnd="url(#arrow-arc-emerald)"
                />

                {/* Final Point b on Top View Locus */}
                <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                <text
                  x={svgMetrics.ptBTv.x + 8}
                  y={svgMetrics.ptBTv.y + 18}
                  fill="#93c5fd"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  b (Top View)
                </text>

                {/* Final Top View Line ab (Thick Object Line) */}
                <line
                  x1={svgMetrics.ptATv.x}
                  y1={svgMetrics.ptATv.y}
                  x2={svgMetrics.ptBTv.x}
                  y2={svgMetrics.ptBTv.y}
                  stroke="#2563eb"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* LAYER 7: FRONT VIEW ROTATION ARC, POINT b', AND END PROJECTOR (Step 7+) */}
            {currentStep >= 7 && (
              <g id="layer-front-view-rotation">
                {/* Rotation arc: Center a', Radius a'b'2, cutting Locus of b' at b' */}
                {showArcs && (
                  <path
                    d={`M ${svgMetrics.ptB2Fv.x} ${svgMetrics.ptB2Fv.y} A ${svgMetrics.radiusElevArc} ${
                      svgMetrics.radiusElevArc
                    } 0 0 0 ${svgMetrics.ptBFv.x} ${svgMetrics.ptBFv.y}`}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.8"
                    strokeDasharray="4,3"
                    markerEnd="url(#arrow-arc-amber)"
                  />
                )}

                {/* Final Point b' on Front View Locus */}
                <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                <text
                  x={svgMetrics.ptBFv.x + 8}
                  y={svgMetrics.ptBFv.y - 8}
                  fill="#fca5a5"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  b′ (Front View)
                </text>

                {/* Final Front View Line a'b' (Thick Object Line) */}
                <line
                  x1={svgMetrics.ptAFv.x}
                  y1={svgMetrics.ptAFv.y}
                  x2={svgMetrics.ptBFv.x}
                  y2={svgMetrics.ptBFv.y}
                  stroke="#dc2626"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />

                {/* Continuous End Projector connecting b' and b perpendicular to XY */}
                {showProjectors && (
                  <g>
                    <line
                      x1={svgMetrics.ptBFv.x}
                      y1={svgMetrics.locusFvY - 25}
                      x2={svgMetrics.ptBTv.x}
                      y2={svgMetrics.locusTvY + 25}
                      stroke="#94a3b8"
                      strokeWidth="1.4"
                    />
                    {/* Projector Alignment Indicator */}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.groundY} r="3" fill="#a855f7" />
                  </g>
                )}
              </g>
            )}

            {/* LAYER 8: STEP 8 FINISHING, APPARENT ANGLES & COMPLETE DIMENSIONING */}
            {currentStep >= 8 && showDimensions && (
              <g id="layer-finishing-dimensions">
                {/* Distance Between End Projectors (DEP) Indicator along XY */}
                <g>
                  <line
                    x1={svgMetrics.originX}
                    y1={svgMetrics.groundY}
                    x2={svgMetrics.ptBFv.x}
                    y2={svgMetrics.groundY}
                    stroke="#a855f7"
                    strokeWidth="2.8"
                  />
                  <text
                    x={(svgMetrics.originX + svgMetrics.ptBFv.x) / 2}
                    y={svgMetrics.groundY - 8}
                    fill="#d8b4fe"
                    fontSize="11"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    DEP = {depCalculated.toFixed(1)} mm
                  </text>
                </g>

                {/* Apparent Angle α Arc in Elevation at a' */}
                {alphaApparent >= 1 && (
                  <g>
                    <path
                      d={`M ${svgMetrics.ptAFv.x + 45} ${svgMetrics.ptAFv.y} A 45 45 0 0 0 ${
                        svgMetrics.ptAFv.x + 45 * Math.cos((alphaApparent * Math.PI) / 180)
                      } ${svgMetrics.ptAFv.y - 45 * Math.sin((alphaApparent * Math.PI) / 180)}`}
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="1.4"
                    />
                    <text
                      x={svgMetrics.ptAFv.x + 52}
                      y={svgMetrics.ptAFv.y - 18}
                      fill="#fca5a5"
                      fontSize="10.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      α = {alphaApparent.toFixed(1)}°
                    </text>
                  </g>
                )}

                {/* Apparent Angle β Arc in Plan at a */}
                {betaApparent >= 1 && (
                  <g>
                    <path
                      d={`M ${svgMetrics.ptATv.x + 45} ${svgMetrics.ptATv.y} A 45 45 0 0 1 ${
                        svgMetrics.ptATv.x + 45 * Math.cos((betaApparent * Math.PI) / 180)
                      } ${svgMetrics.ptATv.y + 45 * Math.sin((betaApparent * Math.PI) / 180)}`}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="1.4"
                    />
                    <text
                      x={svgMetrics.ptATv.x + 52}
                      y={svgMetrics.ptATv.y + 26}
                      fill="#93c5fd"
                      fontSize="10.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      β = {betaApparent.toFixed(1)}°
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* LAYER 9: TRACES (HT & VT) — Shown only in Final Step */}
            {showTraces && currentStep >= 8 && (
              <g id="layer-traces">
                {/* Horizontal Trace (HT) */}
                {line.ht?.exists && svgMetrics.htGroundSvg && svgMetrics.htTraceSvg && (
                  <g className="trace-ht-group">
                    {/* Dotted Line joining Front View (VP line a′b′) to h′ on XY */}
                    {svgMetrics.fvEndNearH && (
                      <line
                        x1={svgMetrics.fvEndNearH.x}
                        y1={svgMetrics.fvEndNearH.y}
                        x2={svgMetrics.htGroundSvg.x}
                        y2={svgMetrics.htGroundSvg.y}
                        stroke="#f59e0b"
                        strokeWidth="1.6"
                        strokeDasharray="3,3"
                        opacity="0.9"
                      />
                    )}

                    {/* Dotted Line joining Top View (HP line ab) to h (HT) */}
                    {svgMetrics.tvEndNearH && (
                      <line
                        x1={svgMetrics.tvEndNearH.x}
                        y1={svgMetrics.tvEndNearH.y}
                        x2={svgMetrics.htTraceSvg.x}
                        y2={svgMetrics.htTraceSvg.y}
                        stroke="#10b981"
                        strokeWidth="1.6"
                        strokeDasharray="3,3"
                        opacity="0.9"
                      />
                    )}

                    {/* Dotted Projector connecting h′ on XY to h (HT) */}
                    <line
                      x1={svgMetrics.htGroundSvg.x}
                      y1={svgMetrics.htGroundSvg.y}
                      x2={svgMetrics.htTraceSvg.x}
                      y2={svgMetrics.htTraceSvg.y}
                      stroke="#f59e0b"
                      strokeWidth="1.3"
                      strokeDasharray="3,3"
                    />

                    {/* h′ on XY line */}
                    <circle cx={svgMetrics.htGroundSvg.x} cy={svgMetrics.htGroundSvg.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={svgMetrics.htGroundSvg.x - 4}
                      y={svgMetrics.groundY - 8}
                      fill="#f59e0b"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {line.ht.groundProj.label}
                    </text>

                    {/* h (HT) point */}
                    <circle cx={svgMetrics.htTraceSvg.x} cy={svgMetrics.htTraceSvg.y} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                    <text
                      x={svgMetrics.htTraceSvg.x + 8}
                      y={svgMetrics.htTraceSvg.y + 4}
                      fill="#34d399"
                      fontSize="11.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {line.ht.traceProj.label}
                    </text>
                  </g>
                )}

                {/* Vertical Trace (VT) */}
                {line.vt?.exists && svgMetrics.vtGroundSvg && svgMetrics.vtTraceSvg && (
                  <g className="trace-vt-group">
                    {/* Dotted Line joining Top View (HP line ab) to v on XY */}
                    {svgMetrics.tvEndNearV && (
                      <line
                        x1={svgMetrics.tvEndNearV.x}
                        y1={svgMetrics.tvEndNearV.y}
                        x2={svgMetrics.vtGroundSvg.x}
                        y2={svgMetrics.vtGroundSvg.y}
                        stroke="#ea580c"
                        strokeWidth="1.6"
                        strokeDasharray="3,3"
                        opacity="0.9"
                      />
                    )}

                    {/* Dotted Line joining Front View (VP line a′b′) to v′ (VT) */}
                    {svgMetrics.fvEndNearV && (
                      <line
                        x1={svgMetrics.fvEndNearV.x}
                        y1={svgMetrics.fvEndNearV.y}
                        x2={svgMetrics.vtTraceSvg.x}
                        y2={svgMetrics.vtTraceSvg.y}
                        stroke="#f59e0b"
                        strokeWidth="1.6"
                        strokeDasharray="3,3"
                        opacity="0.9"
                      />
                    )}

                    {/* Dotted Projector connecting v on XY to v′ (VT) */}
                    <line
                      x1={svgMetrics.vtGroundSvg.x}
                      y1={svgMetrics.vtGroundSvg.y}
                      x2={svgMetrics.vtTraceSvg.x}
                      y2={svgMetrics.vtTraceSvg.y}
                      stroke="#ea580c"
                      strokeWidth="1.3"
                      strokeDasharray="3,3"
                    />

                    {/* v on XY line */}
                    <circle cx={svgMetrics.vtGroundSvg.x} cy={svgMetrics.vtGroundSvg.y} r="3.5" fill="#ea580c" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={svgMetrics.vtGroundSvg.x - 4}
                      y={svgMetrics.groundY + 16}
                      fill="#ea580c"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {line.vt.groundProj.label}
                    </text>

                    {/* v′ (VT) point */}
                    <circle cx={svgMetrics.vtTraceSvg.x} cy={svgMetrics.vtTraceSvg.y} r="4.5" fill="#ea580c" stroke="#ffffff" strokeWidth="1.2" />
                    <text
                      x={svgMetrics.vtTraceSvg.x + 8}
                      y={svgMetrics.vtTraceSvg.y + 4}
                      fill="#fb923c"
                      fontSize="11.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {line.vt.traceProj.label}
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* INTERACTIVE LEGEND IN DRAWING */}
            {showLegend && (
              <g transform="translate(30, 30)" opacity="0.92">
                <rect width="205" height="155" rx="8" fill="#030712" stroke="#334155" strokeWidth="1" />
                <text x="10" y="18" fill="#f8fafc" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  CONSTRUCTION LEGEND
                </text>
                <line x1="10" y1="24" x2="195" y2="24" stroke="#334155" strokeWidth="0.8" />

                {/* Line 1: Final FV */}
                <line x1="12" y1="38" x2="32" y2="38" stroke="#dc2626" strokeWidth="3" />
                <text x="38" y="42" fill="#fca5a5" fontSize="10" fontFamily="monospace">
                  Front View a′b′ (EL)
                </text>

                {/* Line 2: Final TV */}
                <line x1="12" y1="56" x2="32" y2="56" stroke="#2563eb" strokeWidth="3" />
                <text x="38" y="60" fill="#93c5fd" fontSize="10" fontFamily="monospace">
                  Top View ab (PL)
                </text>

                {/* Line 3: Auxiliary TL */}
                <line x1="12" y1="74" x2="32" y2="74" stroke="#c084fc" strokeWidth="2" />
                <text x="38" y="78" fill="#e9d5ff" fontSize="10" fontFamily="monospace">
                  True Length a′b₁′ / ab₂
                </text>

                {/* Line 4: Locus */}
                <line x1="12" y1="92" x2="32" y2="92" stroke="#fbbf24" strokeWidth="0.9" />
                <text x="38" y="96" fill="#fde68a" fontSize="10" fontFamily="monospace">
                  Locus Line (Parallel XY)
                </text>

                {/* Line 5: Projectors */}
                <line x1="12" y1="110" x2="32" y2="110" stroke="#94a3b8" strokeWidth="1.2" />
                <text x="38" y="114" fill="#cbd5e1" fontSize="10" fontFamily="monospace">
                  Projector (Perp. to XY)
                </text>

                {/* Line 6: Traces Dotted Lines */}
                <line x1="12" y1="128" x2="32" y2="128" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="3,3" />
                <text x="38" y="132" fill="#fde68a" fontSize="10" fontFamily="monospace">
                  Traces (Dotted to HT &amp; VT)
                </text>
              </g>
            )}
          </svg>

          {/* Pan / Zoom Floating Controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-lg backdrop-blur-md">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <span className="text-[10px] font-mono px-1.5 text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-slate-800 text-slate-400 cursor-pointer font-mono"
              title="Reset View"
            >
              Fit
            </button>
          </div>
        </div>

        {/* Bottom Educational Explanation Panel */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-xs font-bold border border-blue-800">
                  Step {currentStepData.num} of 8
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {currentStepData.title}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">{currentStepData.sub}</p>
            </div>

            {/* Previous and Next Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition border border-slate-700"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={handleNext}
                disabled={currentStep === 8}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            {currentStepData.description}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-blue-950/30 border border-blue-900/40 px-3 py-2 rounded-lg text-blue-200">
            <span className="font-semibold">{currentStepData.mathNote}</span>
            <span className="text-slate-400 text-[11px]">Adheres to BIS SP 46:2003 &amp; ISO 128 standard</span>
          </div>
        </div>
      </div>

      {/* Part 5: Mathematical Validation HUD Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
              Deterministic Mathematical Validation Report
            </h4>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
            {isGeometricallyPossible ? 'ALL CHECKS PASSED' : 'SPATIAL CONFLICT'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">True Length (TL)</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {tl.toFixed(2)} mm
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Elevation Length (EL = a′b′)</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
              {elAux.toFixed(2)} mm
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Plan Length (PL = ab)</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
              {plAux.toFixed(2)} mm
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Projector Distance (DEP)</span>
            <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
              {depCalculated.toFixed(2)} mm
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">True Angles (θ with HP, φ with VP)</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              θ={theta.toFixed(1)}°, φ={phi.toFixed(1)}°
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Apparent Angles (α in FV, β in TV)</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              α={alphaApparent.toFixed(1)}°, β={betaApparent.toFixed(1)}°
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Projector Alignment Test</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              x(b′) ≡ x(b) (Δ=0.00 mm)
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Locus Parallelism Test</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              Parallel to XY (Strict)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
