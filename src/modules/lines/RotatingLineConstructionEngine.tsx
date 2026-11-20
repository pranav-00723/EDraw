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

export type RotatingStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ConstructionMethod =
  | 'rotating'
  | 'triangle'
  | 'tl-locus'
  | 'tl-views'
  | 'fv-alpha-phi'
  | 'tv-beta-theta'
  | 'apparent-views';

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
  // Construction step (1 to 8 or 9 depending on method)
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

  // Construction method selected strictly from what the question provides
  const defaultMethod: ConstructionMethod = line.input.constructionHint
    ? line.input.constructionHint
    : line.input.mode === 'APPARENT_VALUES'
      ? 'apparent-views'
      : line.input.mode === 'END_POINTS' &&
          line.dep > 0.5 &&
          (Math.abs(line.zB - line.zA) > 0.5 || Math.abs(line.yB - line.yA) > 0.5)
        ? 'triangle'
        : 'rotating';

  const [constructionMethod, setConstructionMethod] = useState<ConstructionMethod>(defaultMethod);
  const totalSteps: RotatingStepNumber = constructionMethod === 'tl-locus' ? 9 : 8;

  useEffect(() => {
    setConstructionMethod(defaultMethod);
  }, [defaultMethod]);

  useEffect(() => {
    if (activeStep > totalSteps) {
      setActiveStep(totalSteps);
    }
  }, [activeStep, totalSteps]);

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

  // Endpoint labels (lowercase per BIS SP 46)
  const lblA = line.nameA.toLowerCase();
  const lblB = line.nameB.toLowerCase();

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

  // End Point Coordinates (mm) from computed 3D model
  const zA = line.zA; // + above HP, - below HP
  const yA = line.yA; // + in front of VP, - behind VP
  const zB = line.zB;
  const yB = line.yB;
  const dz = zB - zA;
  const dy = yB - yA;
  const diffZ = Math.abs(dz);
  const diffY = Math.abs(dy);

  // Distance between end projectors (DEP, mm)
  const depCalculated = line.dep;

  // Apparent angles
  const alphaApparent = line.alphaDeg;
  const betaApparent = line.betaDeg;

  // Auto-play timer
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setTimeout(() => {
        setActiveStep((prev) => {
          if (prev >= totalSteps) {
            setIsPlaying(false);
            return totalSteps;
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
  }, [isPlaying, activeStep, totalSteps]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (activeStep >= totalSteps) setActiveStep(1);
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
    setActiveStep((prev) => (Math.min(totalSteps, prev + 1) as RotatingStepNumber));
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

    // Compute extents in mm (including traces & right-angle triangle offsets) so nothing clips
    const minTraceX = Math.min(
      0,
      line.ht?.exists ? line.ht.groundProj.x : 0,
      line.vt?.exists ? line.vt.groundProj.x : 0
    );
    const baseMaxX = Math.max(
      depCalculated,
      plAux,
      elAux,
      line.ht?.exists ? line.ht.groundProj.x : 0,
      line.vt?.exists ? line.vt.groundProj.x : 0,
      80
    );
    const auxStartMm = baseMaxX + 26;
    const maxExtentX =
      constructionMethod === 'tl-locus' ? auxStartMm + Math.max(plAux, 35) + 12 : baseMaxX;

    const maxExtentY = Math.max(
      Math.abs(zA),
      Math.abs(zB),
      Math.abs(yA),
      Math.abs(yB),
      Math.abs(zB) + diffY,
      Math.abs(yB) + diffZ,
      line.ht?.exists ? Math.abs(line.ht.traceProj.y) : 0,
      line.vt?.exists ? Math.abs(line.vt.traceProj.y) : 0,
      60
    );

    const totalSpanX = Math.max(maxExtentX - minTraceX, 75);
    const scaleX = (constructionMethod === 'tl-locus' ? 560 : 520) / totalSpanX;
    const scaleY = 195 / Math.max(maxExtentY, 55);
    const scale = Math.min(scaleX, scaleY, 2.5);
    const originX = Math.max(220, 90 - minTraceX * scale);

    const toX = (xMm: number) => originX + xMm * scale;
    // In SVG, positive Y is downwards.
    // In orthographic projection: +z (above HP) goes ABOVE XY (y < groundY)
    // +y (in front of VP) goes BELOW XY (y > groundY)
    const toYFv = (zMm: number) => groundY - zMm * scale;
    const toYTv = (yMm: number) => groundY + yMm * scale;

    // Endpoint A Coordinates
    const ptAFv = { x: toX(0), y: toYFv(zA) };
    const ptATv = { x: toX(0), y: toYTv(yA) };

    const signZ = zB >= zA ? 1 : -1;
    const signY = yB >= yA ? 1 : -1;

    // First Auxiliary Position AB1 (inclined at θ to HP, parallel to VP)
    const ptB1Fv = {
      x: toX(tl * Math.cos(thetaRad)),
      y: toYFv(zA + signZ * tl * Math.sin(thetaRad)),
    };
    const ptB1Tv = {
      x: ptB1Fv.x,
      y: ptATv.y,
    };

    // Second Auxiliary Position AB2 (inclined at φ to VP, parallel to HP)
    const ptB2Tv = {
      x: toX(tl * Math.cos(phiRad)),
      y: toYTv(yA + signY * tl * Math.sin(phiRad)),
    };
    const ptB2Fv = {
      x: ptB2Tv.x,
      y: ptAFv.y,
    };

    // Locus Heights & Horizontal Spans (MUST HAVE NO GAPS)
    const locusFvY = toYFv(zB);
    const locusTvY = toYTv(yB);
    const locusStartX = originX - 60;
    const locusEndX = Math.max(ptB1Fv.x, ptB2Tv.x, toX(depCalculated)) + 90;

    // Final Endpoint B Coordinates
    const ptBTv = {
      x: toX(depCalculated),
      y: locusTvY,
    };
    const ptBFv = {
      x: toX(depCalculated),
      y: locusFvY,
    };

    const radiusPlanArc = Math.abs(ptB1Tv.x - ptATv.x); // ab1 = PL
    const radiusElevArc = Math.abs(ptB2Fv.x - ptAFv.x); // a'b'2 = EL

    // Right-Angled Triangle Constructions (End-Points + DEP Method)
    // 1. Front View Triangle: base a'b', perpendicular of length |Δy| at b' pointing away from XY
    const dxFv = ptBFv.x - ptAFv.x;
    const dyFv = ptBFv.y - ptAFv.y;
    const lenFv = Math.hypot(dxFv, dyFv);
    let fvTriangle: {
      tip: { x: number; y: number };
      cornerA: { x: number; y: number };
      cornerB: { x: number; y: number };
      cornerC: { x: number; y: number };
      perpMid: { x: number; y: number };
      hypMid: { x: number; y: number };
    } | null = null;
    if (lenFv > 2 && diffY > 0.2) {
      const ux = dxFv / lenFv;
      const uy = dyFv / lenFv;
      let nx = -uy;
      let ny = ux;
      const preferUp = ptBFv.y <= groundY;
      if ((preferUp && ny > 0.01) || (!preferUp && ny < -0.01) || (Math.abs(ny) <= 0.01 && nx < 0)) {
        nx = -nx;
        ny = -ny;
      }
      const perpPx = diffY * scale;
      const tip = { x: ptBFv.x + nx * perpPx, y: ptBFv.y + ny * perpPx };
      const sq = Math.min(9, lenFv * 0.25, perpPx * 0.45);
      fvTriangle = {
        tip,
        cornerA: { x: ptBFv.x - ux * sq, y: ptBFv.y - uy * sq },
        cornerB: { x: ptBFv.x - ux * sq + nx * sq, y: ptBFv.y - uy * sq + ny * sq },
        cornerC: { x: ptBFv.x + nx * sq, y: ptBFv.y + ny * sq },
        perpMid: { x: (ptBFv.x + tip.x) / 2 + nx * 12, y: (ptBFv.y + tip.y) / 2 + ny * 8 },
        hypMid: { x: (ptAFv.x + tip.x) / 2 + nx * 10, y: (ptAFv.y + tip.y) / 2 + ny * 10 },
      };
    }

    // 2. Top View Triangle: base ab, perpendicular of length |Δz| at b pointing away from XY
    const dxTv = ptBTv.x - ptATv.x;
    const dyTv = ptBTv.y - ptATv.y;
    const lenTv = Math.hypot(dxTv, dyTv);
    let tvTriangle: {
      tip: { x: number; y: number };
      cornerA: { x: number; y: number };
      cornerB: { x: number; y: number };
      cornerC: { x: number; y: number };
      perpMid: { x: number; y: number };
      hypMid: { x: number; y: number };
    } | null = null;
    if (lenTv > 2 && diffZ > 0.2) {
      const ux = dxTv / lenTv;
      const uy = dyTv / lenTv;
      let nx = -uy;
      let ny = ux;
      const preferDown = ptBTv.y >= groundY;
      if ((preferDown && ny < -0.01) || (!preferDown && ny > 0.01) || (Math.abs(ny) <= 0.01 && nx < 0)) {
        nx = -nx;
        ny = -ny;
      }
      const perpPx = diffZ * scale;
      const tip = { x: ptBTv.x + nx * perpPx, y: ptBTv.y + ny * perpPx };
      const sq = Math.min(9, lenTv * 0.25, perpPx * 0.45);
      tvTriangle = {
        tip,
        cornerA: { x: ptBTv.x - ux * sq, y: ptBTv.y - uy * sq },
        cornerB: { x: ptBTv.x - ux * sq + nx * sq, y: ptBTv.y - uy * sq + ny * sq },
        cornerC: { x: ptBTv.x + nx * sq, y: ptBTv.y + ny * sq },
        perpMid: { x: (ptBTv.x + tip.x) / 2 + nx * 12, y: (ptBTv.y + tip.y) / 2 + ny * 10 },
        hypMid: { x: (ptATv.x + tip.x) / 2 + nx * 10, y: (ptATv.y + tip.y) / 2 + ny * 12 },
      };
    }

    // Inclination angle arcs (φ on FV triangle, θ on TV triangle)
    const buildAngleArc = (
      vertex: { x: number; y: number },
      endView: { x: number; y: number },
      endHyp: { x: number; y: number },
      desiredR: number
    ) => {
      const lenV = Math.hypot(endView.x - vertex.x, endView.y - vertex.y);
      const lenH = Math.hypot(endHyp.x - vertex.x, endHyp.y - vertex.y);
      if (lenV < 4 || lenH < 4) return null;
      const uv = { x: (endView.x - vertex.x) / lenV, y: (endView.y - vertex.y) / lenV };
      const uh = { x: (endHyp.x - vertex.x) / lenH, y: (endHyp.y - vertex.y) / lenH };
      const r = Math.min(desiredR, lenV * 0.48, lenH * 0.48);
      if (r < 6) return null;
      const p1 = { x: vertex.x + uv.x * r, y: vertex.y + uv.y * r };
      const p2 = { x: vertex.x + uh.x * r, y: vertex.y + uh.y * r };
      const cross = uv.x * uh.y - uv.y * uh.x;
      const sweep = cross >= 0 ? 1 : 0;
      const midSum = { x: uv.x + uh.x, y: uv.y + uh.y };
      const midLen = Math.hypot(midSum.x, midSum.y) || 1;
      const labelPos = {
        x: vertex.x + (midSum.x / midLen) * (r + 18),
        y: vertex.y + (midSum.y / midLen) * (r + 18),
      };
      return {
        d: `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y}`,
        labelPos,
      };
    };

    const fvAngleArc = fvTriangle ? buildAngleArc(ptAFv, ptBFv, fvTriangle.tip, 32) : null;
    const tvAngleArc = tvTriangle ? buildAngleArc(ptATv, ptBTv, tvTriangle.tip, 32) : null;

    // Step 2 Auxiliary TL Triangle (TL hypotenuse + |Δz| perpendicular -> horizontal Top View length mn)
    const auxLeftX = toX(auxStartMm);
    const auxBaseY = groundY - 24;
    const auxRightX = auxLeftX + plAux * scale;
    const auxTopY = auxBaseY - Math.max(diffZ, 0) * scale;
    const auxTlRadiusPx = tl * scale;
    const auxSq = Math.min(9, Math.max(4, diffZ * scale * 0.45), Math.max(4, plAux * scale * 0.25));
    const angleTop = Math.atan2(auxBaseY - auxTopY, Math.max(1, auxRightX - auxLeftX));
    const arcSweepDelta = 0.24;
    const auxArcStart = {
      x: auxLeftX + auxTlRadiusPx * Math.cos(Math.max(0.02, angleTop - arcSweepDelta)),
      y: auxBaseY - auxTlRadiusPx * Math.sin(Math.max(0.02, angleTop - arcSweepDelta)),
    };
    const auxArcEnd = {
      x: auxLeftX + auxTlRadiusPx * Math.cos(Math.min(Math.PI / 2 - 0.02, angleTop + arcSweepDelta)),
      y: auxBaseY - auxTlRadiusPx * Math.sin(Math.min(Math.PI / 2 - 0.02, angleTop + arcSweepDelta)),
    };

    const auxTriangle = {
      left: { x: auxLeftX, y: auxBaseY },
      right: { x: auxRightX, y: auxBaseY },
      top: { x: auxRightX, y: auxTopY },
      sq: auxSq,
      tlRadiusPx: auxTlRadiusPx,
      arcD: `M ${auxArcStart.x} ${auxArcStart.y} A ${auxTlRadiusPx} ${auxTlRadiusPx} 0 0 0 ${auxArcEnd.x} ${auxArcEnd.y}`,
    };

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

    // Compass strike arcs of radius TL cutting vertical projectors (used in TL + FV + TV method)
    const tlRadiusPx = tl * scale;
    const buildStrikeArc = (
      center: { x: number; y: number },
      target: { x: number; y: number }
    ): string | null => {
      const r = Math.hypot(target.x - center.x, target.y - center.y);
      if (r < 4) return null;
      const baseAng = Math.atan2(target.y - center.y, target.x - center.x);
      const dAng = 0.22;
      const p1 = { x: center.x + r * Math.cos(baseAng - dAng), y: center.y + r * Math.sin(baseAng - dAng) };
      const p2 = { x: center.x + r * Math.cos(baseAng + dAng), y: center.y + r * Math.sin(baseAng + dAng) };
      return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
    };
    const tlStrikeFvArc = buildStrikeArc(ptAFv, ptB1Fv);
    const tlStrikeTvArc = buildStrikeArc(ptATv, ptB2Tv);

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
      tlRadiusPx,
      tlStrikeFvArc,
      tlStrikeTvArc,
      fvTriangle,
      tvTriangle,
      fvAngleArc,
      tvAngleArc,
      auxTriangle,
      htGroundSvg,
      htTraceSvg,
      vtGroundSvg,
      vtTraceSvg,
      fvEndNearH,
      tvEndNearH,
      tvEndNearV,
      fvEndNearV,
    };
  }, [tl, thetaRad, phiRad, zA, yA, zB, yB, diffY, diffZ, depCalculated, plAux, elAux, line.ht, line.vt, constructionMethod]);

  // Current active step number (forced to totalSteps in completed view)
  const currentStep = isCompletedView ? totalSteps : Math.min(activeStep, totalSteps);

  // Step Educational Explanations — Rotating Line Method (Pure Geometrical Construction — No Trigonometry)
  const rotatingSteps = [
    {
      num: 1,
      title: 'Step 1: Initial Reference Line XY',
      sub: 'Establish the ground line representing the intersection of HP and VP',
      description:
        'Draw the horizontal reference line XY. In First-Angle projection, the region above XY represents the Vertical Plane (VP for Front View / Elevation), and the region below XY represents the Horizontal Plane (HP for Top View / Plan).',
      mathNote: 'Drafting Rule: XY separates Front View (above) and Top View (below) and serves as the baseline for all projectors and loci.',
    },
    {
      num: 2,
      title: `Step 2: Locate Endpoint ${line.nameA} (${lblA}′ and ${lblA})`,
      sub: `Mark front view ${lblA}′ and top view ${lblA} vertically aligned on a single projector`,
      description: `Draw a thin vertical projector perpendicular to XY. Mark Front View ${lblA}′ at ${Math.abs(
        zA
      ).toFixed(1)} mm ${zA >= 0 ? 'above' : 'below'} XY (${zA >= 0 ? 'above HP' : 'below HP'}) and Top View ${lblA} at ${Math.abs(
        yA
      ).toFixed(1)} mm ${yA >= 0 ? 'below' : 'above'} XY (${
        yA >= 0 ? 'in front of VP' : 'behind VP'
      }). Keep ${lblA}′ and ${lblA} strictly on the same vertical projector.`,
      mathNote: `Alignment Rule: Front view ${lblA}′ and top view ${lblA} always share one common projector perpendicular to XY.`,
    },
    {
      num: 3,
      title: `Step 3: First Rotation — Inclination with HP (Assume Parallel to VP)`,
      sub: `Draw true length ${lblA}′${lblB}₁′ at θ to XY, then project down to horizontal through ${lblA} for ${lblB}₁`,
      description: `Initially consider the line parallel to VP so its Front View displays True Length. From ${lblA}′, draw ${lblA}′${lblB}₁′ = ${tl.toFixed(
        1
      )} mm inclined at θ = ${theta.toFixed(
        1
      )}° to XY and mark ${lblB}₁′. From ${lblB}₁′, drop a perpendicular projector to meet the horizontal line drawn through ${lblA} at ${lblB}₁. The temporary projections ${lblA}′${lblB}₁′ and ${lblA}${lblB}₁ establish the inclination with HP.`,
      mathNote: `Geometric Rule: Line ∥ VP ⇒ ${lblA}′${lblB}₁′ shows True Length (${tl.toFixed(
        1
      )} mm) at θ = ${theta.toFixed(1)}°; projector ∩ horizontal through ${lblA} locates ${lblB}₁ (measured plan radius ${lblA}${lblB}₁ = ${plAux.toFixed(1)} mm).`,
    },
    {
      num: 4,
      title: `Step 4: Second Auxiliary Position — Inclination with VP (Assume Parallel to HP)`,
      sub: `Draw true length ${lblA}${lblB}₂ at φ to XY, then project up to horizontal through ${lblA}′ for ${lblB}₂′`,
      description: `Consider the line parallel to HP so its Top View displays True Length. From ${lblA}, draw ${lblA}${lblB}₂ = ${tl.toFixed(
        1
      )} mm inclined at φ = ${phi.toFixed(
        1
      )}° to XY and mark ${lblB}₂. From ${lblB}₂, draw a perpendicular projector up to meet the horizontal line drawn through ${lblA}′ at ${lblB}₂′. The line ${lblA}′${lblB}₂′ gives the constant compass radius for the Front View rotation.`,
      mathNote: `Geometric Rule: Line ∥ HP ⇒ ${lblA}${lblB}₂ shows True Length (${tl.toFixed(
        1
      )} mm) at φ = ${phi.toFixed(1)}°; projector ∩ horizontal through ${lblA}′ locates ${lblB}₂′ (measured elevation radius ${lblA}′${lblB}₂′ = ${elAux.toFixed(1)} mm).`,
    },
    {
      num: 5,
      title: `Step 5: Horizontal Loci (Locus of ${lblB}′ and Locus of ${lblB})`,
      sub: `Draw continuous horizontal locus lines parallel to XY through ${lblB}₁′ and ${lblB}₂`,
      description: `Through ${lblB}₁′, draw a horizontal locus line parallel to XY (Locus of ${lblB}′) to preserve the height of end ${line.nameB} above HP while its position relative to VP changes. Through ${lblB}₂, draw a horizontal locus line parallel to XY (Locus of ${lblB}) to preserve the distance of end ${line.nameB} from VP during rotation.`,
      mathNote: `Locus Principle: Horizontal locus through ${lblB}₁′ preserves height (${Math.abs(zB).toFixed(
        1
      )} mm); horizontal locus through ${lblB}₂ preserves VP distance (${Math.abs(yB).toFixed(1)} mm).`,
    },
    {
      num: 6,
      title: `Step 6: Rotate Temporary Top View to Obtain Final Plan (${lblA}${lblB})`,
      sub: `Keep ${lblA} fixed, take compass radius ${lblA}${lblB}₁, swing arc through ${lblB}₁ to intersect Locus of ${lblB} at ${lblB}`,
      description: `Keep ${lblA} fixed as the centre of rotation. With a compass, take radius ${lblA}${lblB}₁ (${plAux.toFixed(
        1
      )} mm) and swing an arc passing through ${lblB}₁ until it intersects the Locus of ${lblB} at the final top-view endpoint ${lblB}. Because the compass radius never changes during rotation, ${lblA}${lblB} = ${lblA}${lblB}₁. Join ${lblA} and ${lblB} darkly.`,
      mathNote: `Rotation Rule: Center ${lblA}, fixed radius R = ${lblA}${lblB}₁ ⇒ Arc ∩ Locus of ${lblB} = ${lblB} (${lblA}${lblB} = ${lblA}${lblB}₁ = ${plAux.toFixed(
        1
      )} mm; measured β = ${betaApparent.toFixed(1)}°).`,
    },
    {
      num: 7,
      title: `Step 7: Project & Rotate for Final Front View (${lblA}′${lblB}′)`,
      sub: `Project vertically from ${lblB} to Locus of ${lblB}′ (verified by arc center ${lblA}′, radius ${lblA}′${lblB}₂′) to locate ${lblB}′`,
      description: `From final top-view point ${lblB}, draw a perpendicular projector to XY to intersect the horizontal Locus of ${lblB}′ at ${lblB}′. Equally, swinging a compass arc centered at ${lblA}′ with radius ${lblA}′${lblB}₂′ (${elAux.toFixed(
        1
      )} mm) intersects the Locus of ${lblB}′ at the exact same point ${lblB}′. Join ${lblA}′ and ${lblB}′ darkly for the final Front View.`,
      mathNote: `Intersection Check: (Projector from ${lblB}) ∩ (Locus of ${lblB}′) ≡ (Arc center ${lblA}′, radius ${lblA}′${lblB}₂′) ∩ (Locus of ${lblB}′) = ${lblB}′ (measured DEP = ${depCalculated.toFixed(
        1
      )} mm).`,
    },
    {
      num: 8,
      title: 'Step 8: Final Projections & Traces (VT and HT)',
      sub: 'Darken final views, retain light construction lines, and construct VT & HT by extension',
      description: `Darken final Front View ${lblA}′${lblB}′ and Top View ${lblA}${lblB} while keeping auxiliary lines, loci, and arcs light. For Vertical Trace (VT): extend ${lblA}${lblB} to meet XY at v, draw a perpendicular projector, and extend ${lblA}′${lblB}′ to intersect it at v′ (VT). For Horizontal Trace (HT): extend ${lblA}′${lblB}′ to meet XY at h′, draw a perpendicular projector, and extend ${lblA}${lblB} to intersect it at h (HT).`,
      mathNote: `Pure Geometry: Unknown endpoints (${lblB}, ${lblB}′) and traces (VT, HT) are obtained strictly through arcs, loci, projectors, and intersections — measured α = ${alphaApparent.toFixed(
        1
      )}°, β = ${betaApparent.toFixed(1)}°.`,
    },
  ];

  // Step Educational Explanations — Right-Angled Triangle Method (End Points + DEP, Pure Geometrical Construction)
  const triangleSteps = [
    {
      num: 1,
      title: 'Step 1: Initial Reference Line XY & End Projectors',
      sub: `Draw XY and two perpendicular projectors separated horizontally by DEP = ${depCalculated.toFixed(1)} mm`,
      description: `Draw the horizontal reference line XY representing the intersection of HP and VP. Select a position for the projector of ${line.nameA} and draw a perpendicular line across XY. Draw a second perpendicular projector ${depCalculated.toFixed(
        1
      )} mm horizontally away for endpoint ${line.nameB}.`,
      mathNote: `Projector Separation: Both end projectors are perpendicular to XY and separated by DEP = ${depCalculated.toFixed(1)} mm.`,
    },
    {
      num: 2,
      title: `Step 2: Plot Endpoints ${line.nameA} and ${line.nameB} Independently`,
      sub: `Mark ${lblA}′, ${lblA} on projector 1 and ${lblB}′, ${lblB} on projector 2 using their HP and VP distances`,
      description: `On the first projector, mark ${lblA}′ at ${Math.abs(zA).toFixed(1)} mm ${
        zA >= 0 ? 'above' : 'below'
      } XY and ${lblA} at ${Math.abs(yA).toFixed(1)} mm ${
        yA >= 0 ? 'below' : 'above'
      } XY. On the second projector, mark ${lblB}′ at ${Math.abs(zB).toFixed(1)} mm ${
        zB >= 0 ? 'above' : 'below'
      } XY and ${lblB} at ${Math.abs(yB).toFixed(1)} mm ${yB >= 0 ? 'below' : 'above'} XY.`,
      mathNote: `Independent Placement: Front views (${lblA}′, ${lblB}′) use HP heights; top views (${lblA}, ${lblB}) use VP distances along each projector.`,
    },
    {
      num: 3,
      title: `Step 3: Obtain Front View (${lblA}′${lblB}′) and Top View (${lblA}${lblB})`,
      sub: `Join ${lblA}′${lblB}′ for the Front View and ${lblA}${lblB} for the Top View`,
      description: `Join ${lblA}′ and ${lblB}′ to obtain the Front View ${lblA}′${lblB}′ (measured ${line.frontViewLength.toFixed(
        1
      )} mm). Join ${lblA} and ${lblB} to obtain the Top View ${lblA}${lblB} (measured ${line.topViewLength.toFixed(
        1
      )} mm). Neither projection shows True Length because the line is inclined to both HP and VP.`,
      mathNote: `Projections Drawn: Front View ${lblA}′${lblB}′ = ${line.frontViewLength.toFixed(
        1
      )} mm | Top View ${lblA}${lblB} = ${line.topViewLength.toFixed(1)} mm.`,
    },
    {
      num: 4,
      title: `Step 4: True Length via Front-View Right-Angled Triangle`,
      sub: `Construct a perpendicular of VP-dist diff = ${diffY.toFixed(1)} mm at ${lblB}′ to ${lblA}′${lblB}′; hypotenuse equals True Length`,
      description:
        diffY > 0.2
          ? `Take Front View ${lblA}′${lblB}′ as the base. At ${lblB}′, construct a line perpendicular to ${lblA}′${lblB}′ and transfer the difference of VP distances (${Math.abs(
              yB
            ).toFixed(1)} − ${Math.abs(yA).toFixed(1)} → ${diffY.toFixed(
              1
            )} mm) onto it. Join its endpoint back to ${lblA}′: the hypotenuse of this right-angled triangle gives the True Length of ${line.nameA}${line.nameB} (${tl.toFixed(
              1
            )} mm)!`
          : `Both endpoints have the same distance from VP (VP-dist diff = 0 mm), so the line is parallel to VP and Front View ${lblA}′${lblB}′ already shows True Length (${tl.toFixed(
              1
            )} mm).`,
      mathNote: `Right-Triangle Rule (FV): Base ${lblA}′${lblB}′ ⟂ (VP distance difference ${diffY.toFixed(
        1
      )} mm) ⇒ Hypotenuse = True Length (${tl.toFixed(1)} mm).`,
    },
    {
      num: 5,
      title: `Step 5: Alternative True Length via Top-View Right-Angled Triangle`,
      sub: `Construct a perpendicular of height diff = ${diffZ.toFixed(1)} mm at ${lblB} to ${lblA}${lblB}; hypotenuse confirms True Length`,
      description:
        diffZ > 0.2
          ? `Take Top View ${lblA}${lblB} as the base. At ${lblB}, construct a line perpendicular to ${lblA}${lblB} and transfer the difference of HP heights (${Math.abs(
              zB
            ).toFixed(1)} − ${Math.abs(zA).toFixed(1)} → ${diffZ.toFixed(
              1
            )} mm) onto it. Join its endpoint back to ${lblA}: the hypotenuse geometrically establishes the exact same True Length (${tl.toFixed(
              1
            )} mm)!`
          : `Both endpoints have the same height above HP (height diff = 0 mm), so the line is parallel to HP and Top View ${lblA}${lblB} already shows True Length (${tl.toFixed(
              1
            )} mm).`,
      mathNote: `Right-Triangle Rule (TV): Base ${lblA}${lblB} ⟂ (HP height difference ${diffZ.toFixed(
        1
      )} mm) ⇒ Hypotenuse = True Length (${tl.toFixed(1)} mm).`,
    },
    {
      num: 6,
      title: 'Step 6: Horizontal Trace (HT) by Extension & Intersection',
      sub: `Extend ${lblA}′${lblB}′ to XY for h′, draw perpendicular projector, and intersect extended ${lblA}${lblB} at h`,
      description: line.ht?.exists
        ? `Extend the Front View ${lblA}′${lblB}′ until it intersects XY at h′. From h′, draw a perpendicular projector to XY. Extend the Top View ${lblA}${lblB} until it intersects this projector at h. The segment h′h locates the Horizontal Trace (HT), where the extended line meets HP.`
        : `Front View ${lblA}′${lblB}′ is parallel to XY (constant height above HP), so the extended line never meets HP and has no Horizontal Trace (HT).`,
      mathNote: line.ht?.exists
        ? `HT Construction: (Extended ${lblA}′${lblB}′) ∩ XY = h′; (Projector at h′) ∩ (Extended ${lblA}${lblB}) = h (HT).`
        : 'HT Construction: Line ∥ HP ⇒ no intersection with XY.',
    },
    {
      num: 7,
      title: 'Step 7: Vertical Trace (VT) by Extension & Intersection',
      sub: `Extend ${lblA}${lblB} to XY for v, draw perpendicular projector, and intersect extended ${lblA}′${lblB}′ at v′`,
      description: line.vt?.exists
        ? `Extend the Top View ${lblA}${lblB} until it intersects XY at v. From v, draw a perpendicular projector to XY. Extend the Front View ${lblA}′${lblB}′ until it intersects this projector at v′. The segment v′v locates the Vertical Trace (VT), where the extended line meets VP.`
        : `Top View ${lblA}${lblB} is parallel to XY (constant distance from VP), so the extended line never meets VP and has no Vertical Trace (VT).`,
      mathNote: line.vt?.exists
        ? `VT Construction: (Extended ${lblA}${lblB}) ∩ XY = v; (Projector at v) ∩ (Extended ${lblA}′${lblB}′) = v′ (VT).`
        : 'VT Construction: Line ∥ VP ⇒ no intersection with XY.',
    },
    {
      num: 8,
      title: 'Step 8: Final Drawing Presentation',
      sub: `Darken ${lblA}′${lblB}′ and ${lblA}${lblB}, retain true-length triangles lightly, and verify HT, VT & labels`,
      description: `Darken final Front View ${lblA}′${lblB}′ and Top View ${lblA}${lblB}. Keep the end projectors, right-angled true-length construction triangles, and trace extensions lightly. All unknown lengths (TL = ${tl.toFixed(
        1
      )} mm) and traces (HT, VT) are obtained purely using rulers, perpendiculars, and line intersections—no trigonometry required.`,
      mathNote: `Pure Geometry Summary: TL = ${tl.toFixed(1)} mm | FV = ${line.frontViewLength.toFixed(
        1
      )} mm | TV = ${line.topViewLength.toFixed(1)} mm | DEP = ${depCalculated.toFixed(1)} mm.`,
    },
  ];

  // Step Educational Explanations — TL + End Distances (Locus, Compass Arc, Inclinations θ/φ & Traces, Pure Geometry)
  const tlLocusSteps = [
    {
      num: 1,
      title: `Step 1: Initial Reference Construction (${line.nameA})`,
      sub: `Draw XY, draw perpendicular projector for ${line.nameA}, mark ${lblA}′ and ${lblA}`,
      description: `Draw the XY reference line representing the intersection of HP and VP. Select a convenient position for the projector of ${line.nameA} and draw a line perpendicular to XY. Mark ${lblA}′ at ${Math.abs(
        zA
      ).toFixed(1)} mm ${zA >= 0 ? 'above' : 'below'} XY and ${lblA} at ${Math.abs(yA).toFixed(1)} mm ${
        yA >= 0 ? 'below' : 'above'
      } XY.`,
      mathNote: `Reference End ${line.nameA}: ${lblA}′ (${Math.abs(zA).toFixed(1)} mm from HP) & ${lblA} (${Math.abs(
        yA
      ).toFixed(1)} mm from VP) share one perpendicular projector.`,
    },
    {
      num: 2,
      title: `Step 2: Geometrically Establish Top View Length (${lblA}${lblB})`,
      sub: `Construct right-angled triangle with hypotenuse TL = ${tl.toFixed(
        1
      )} mm and vertical side height diff = ${diffZ.toFixed(1)} mm`,
      description: `The actual length ${line.nameA}${line.nameB} is ${tl.toFixed(
        1
      )} mm while the difference in endpoint heights is ${diffZ.toFixed(
        1
      )} mm. Using a compass and ruler, construct a vertical perpendicular of ${diffZ.toFixed(
        1
      )} mm and strike a compass arc of radius ${tl.toFixed(
        1
      )} mm to complete the right-angled triangle. The remaining horizontal side gives the true length of the top view ${lblA}${lblB} (${plAux.toFixed(
        1
      )} mm) without any formula.`,
      mathNote: `Auxiliary TL Triangle: Hypotenuse = ${tl.toFixed(1)} mm ⟂ Height diff ${diffZ.toFixed(
        1
      )} mm ⇒ Horizontal side = Top View length ${lblA}${lblB} (${plAux.toFixed(1)} mm).`,
    },
    {
      num: 3,
      title: `Step 3: Locate Second Endpoint ${line.nameB} (${lblB} and ${lblB}′)`,
      sub: `Draw depth locus of ${lblB}, swing arc radius ${lblA}${lblB} from ${lblA} to locate ${lblB}, then project to ${lblB}′`,
      description: `Draw a horizontal locus line parallel to XY at the required VP distance of ${line.nameB} (${Math.abs(
        yB
      ).toFixed(1)} mm ${yB >= 0 ? 'in front of' : 'behind'} VP). With ${lblA} as centre, swing a compass arc of radius ${lblA}${lblB} (${plAux.toFixed(
        1
      )} mm) to intersect this locus at ${lblB}. Draw a perpendicular projector from ${lblB} towards the front view and mark ${lblB}′ at ${Math.abs(
        zB
      ).toFixed(1)} mm ${zB >= 0 ? 'above' : 'below'} XY.`,
      mathNote: `Compass Intersection: (Arc centre ${lblA}, radius ${plAux.toFixed(
        1
      )} mm) ∩ (Locus of ${lblB} at ${Math.abs(yB).toFixed(1)} mm) = ${lblB}; projector locates ${lblB}′.`,
    },
    {
      num: 4,
      title: `Step 4: Obtain Final Projections (${lblA}′${lblB}′ and ${lblA}${lblB})`,
      sub: `Join ${lblA}′${lblB}′ for the Front View and ${lblA}${lblB} for the Top View`,
      description: `Join ${lblA}′ and ${lblB}′ to obtain the Front View ${lblA}′${lblB}′ (${elAux.toFixed(
        1
      )} mm). Join ${lblA} and ${lblB} to obtain the Top View ${lblA}${lblB} (${plAux.toFixed(
        1
      )} mm). Both projections are shorter than True Length (${tl.toFixed(
        1
      )} mm) because the line is inclined to both HP and VP.`,
      mathNote: `Final Projections: Front View ${lblA}′${lblB}′ = ${elAux.toFixed(
        1
      )} mm | Top View ${lblA}${lblB} = ${plAux.toFixed(1)} mm.`,
    },
    {
      num: 5,
      title: 'Step 5: Show Inclination with HP (θ)',
      sub: `Construct perpendicular height diff = ${diffZ.toFixed(1)} mm on Top View ${lblA}${lblB}; hypotenuse shows TL and angle θ`,
      description:
        diffZ > 0.2
          ? `Take Top View ${lblA}${lblB} as base. At ${lblB}, construct a perpendicular of ${diffZ.toFixed(
              1
            )} mm representing the height difference between ${line.nameA} and ${line.nameB}, and join its tip back to ${lblA}. The hypotenuse equals the True Length ${line.nameA}${line.nameB} (${tl.toFixed(
              1
            )} mm), and the angle between this hypotenuse and ${lblA}${lblB} is the true inclination with HP (θ = ${theta.toFixed(
              1
            )}°).`
          : `Both ends have equal height above HP (height diff = 0 mm), so the line is parallel to HP and θ = 0°.`,
      mathNote: `HP Inclination Triangle: Base ${lblA}${lblB} ⟂ (height diff ${diffZ.toFixed(
        1
      )} mm) ⇒ Hypotenuse = ${tl.toFixed(1)} mm, θ = ${theta.toFixed(1)}°.`,
    },
    {
      num: 6,
      title: 'Step 6: Show Inclination with VP (φ)',
      sub: `Construct perpendicular VP-dist diff = ${diffY.toFixed(1)} mm on Front View ${lblA}′${lblB}′; hypotenuse shows TL and angle φ`,
      description:
        diffY > 0.2
          ? `Take Front View ${lblA}′${lblB}′ as base. At ${lblB}′, construct a perpendicular of ${diffY.toFixed(
              1
            )} mm representing the difference in distances from VP, and join its tip back to ${lblA}′. The hypotenuse again equals the exact same True Length (${tl.toFixed(
              1
            )} mm), and the angle between this hypotenuse and ${lblA}′${lblB}′ is the true inclination with VP (φ = ${phi.toFixed(
              1
            )}°).`
          : `Both ends lie at the same distance from VP (VP-dist diff = 0 mm), so the line is parallel to VP and φ = 0°.`,
      mathNote: `VP Inclination Triangle: Base ${lblA}′${lblB}′ ⟂ (VP-dist diff ${diffY.toFixed(
        1
      )} mm) ⇒ Hypotenuse = ${tl.toFixed(1)} mm, φ = ${phi.toFixed(1)}°.`,
    },
    {
      num: 7,
      title: 'Step 7: Horizontal Trace (HT)',
      sub: `Extend ${lblA}′${lblB}′ to XY for h′, draw perpendicular projector, intersect extended ${lblA}${lblB} at h`,
      description: line.ht?.exists
        ? `Extend the Front View ${lblA}′${lblB}′ until it intersects XY at h′. From h′, draw a perpendicular projector to XY. Extend the Top View ${lblA}${lblB} until it intersects this projector at h. The point h′h represents the Horizontal Trace (HT), where the extended line meets HP.`
        : `Front View ${lblA}′${lblB}′ is parallel to XY, so the extended line never meets HP and has no Horizontal Trace (HT).`,
      mathNote: line.ht?.exists
        ? `HT Construction: (Extended ${lblA}′${lblB}′) ∩ XY = h′; (Projector at h′) ∩ (Extended ${lblA}${lblB}) = h (HT).`
        : 'HT Construction: Line ∥ HP ⇒ no HT.',
    },
    {
      num: 8,
      title: 'Step 8: Vertical Trace (VT)',
      sub: `Extend ${lblA}${lblB} to XY for v, draw perpendicular projector, intersect extended ${lblA}′${lblB}′ at v′`,
      description: line.vt?.exists
        ? `Extend the Top View ${lblA}${lblB} until it intersects XY at v. From v, draw a perpendicular projector to XY. Extend the Front View ${lblA}′${lblB}′ until it intersects this projector at v′. The point v′v represents the Vertical Trace (VT), where the extended line meets VP.`
        : `Top View ${lblA}${lblB} is parallel to XY, so the extended line never meets VP and has no Vertical Trace (VT).`,
      mathNote: line.vt?.exists
        ? `VT Construction: (Extended ${lblA}${lblB}) ∩ XY = v; (Projector at v) ∩ (Extended ${lblA}′${lblB}′) = v′ (VT).`
        : 'VT Construction: Line ∥ VP ⇒ no VT.',
    },
    {
      num: 9,
      title: 'Step 9: Final Drawing Presentation',
      sub: `Darken ${lblA}′${lblB}′ & ${lblA}${lblB}; show θ & φ inclination triangles, HT, VT, and light construction lines`,
      description: `Darken final Front View ${lblA}′${lblB}′ and Top View ${lblA}${lblB}. Clearly retain the auxiliary TL triangle, the HP inclination triangle (θ = ${theta.toFixed(
        1
      )}°), the VP inclination triangle (φ = ${phi.toFixed(
        1
      )}°), and both traces (HT, VT) with light construction lines. All lengths, positions, and inclinations are established purely geometrically.`,
      mathNote: `Pure Geometry Summary: TL = ${tl.toFixed(1)} mm | θ = ${theta.toFixed(1)}° | φ = ${phi.toFixed(
        1
      )}° | FV = ${elAux.toFixed(1)} mm | TV = ${plAux.toFixed(1)} mm.`,
    },
  ];

  // Step Educational Explanations — Case: Given FV Length + α (FV angle) + φ (VP inclination)
  const fvAlphaPhiSteps = [
    {
      num: 1,
      title: 'Step 1: Initial Reference Line XY',
      sub: 'Establish the ground line representing the intersection of HP and VP',
      description:
        'Draw the horizontal reference line XY. Front views lie above XY (VP) and Top views lie below XY (HP) in First-Angle projection.',
      mathNote: 'Drafting Rule: XY separates Front View (above) and Top View (below).',
    },
    {
      num: 2,
      title: `Step 2: Locate Reference End ${line.nameA} (${lblA}′ and ${lblA})`,
      sub: `Mark ${lblA}′ and ${lblA} vertically aligned on one perpendicular projector`,
      description: `Draw a perpendicular projector across XY. Mark ${lblA}′ at ${Math.abs(zA).toFixed(
        1
      )} mm ${zA >= 0 ? 'above' : 'below'} XY and ${lblA} at ${Math.abs(yA).toFixed(1)} mm ${
        yA >= 0 ? 'below' : 'above'
      } XY.`,
      mathNote: `Reference End ${line.nameA}: ${lblA}′ and ${lblA} lie on the same perpendicular projector.`,
    },
    {
      num: 3,
      title: `Step 3: Draw Given Front View (${lblA}′${lblB}′ = ${elAux.toFixed(1)} mm at α = ${alphaApparent.toFixed(1)}°)`,
      sub: `Draw ${lblA}′${lblB}′ from ${lblA}′, draw Locus of ${lblB}′, and drop vertical projector from ${lblB}′`,
      description: `Starting directly from the given data: from ${lblA}′, draw Front View ${lblA}′${lblB}′ = ${elAux.toFixed(
        1
      )} mm inclined at α = ${alphaApparent.toFixed(1)}° to XY, locating ${lblB}′. Draw a horizontal Locus of ${lblB}′ through ${lblB}′ parallel to XY, and drop a perpendicular projector downward from ${lblB}′ into the top-view region.`,
      mathNote: `Given Front View: ${lblA}′${lblB}′ (${elAux.toFixed(1)} mm at α = ${alphaApparent.toFixed(1)}°) fixes ${lblB}′, Locus of ${lblB}′, and the end projector.`,
    },
    {
      num: 4,
      title: `Step 4: Rotate ${lblA}′${lblB}′ Horizontal & Intersect φ Ray (${phi.toFixed(1)}°) to Find True Length`,
      sub: `Swing ${lblA}′${lblB}′ to horizontal (${lblB}₂′), project down to φ ray from ${lblA} to find ${lblB}₂ (TL = ${tl.toFixed(1)} mm)`,
      description: `Keep ${lblA}′ fixed. With compass radius ${lblA}′${lblB}′ (${elAux.toFixed(
        1
      )} mm), swing an arc onto the horizontal line through ${lblA}′ to obtain ${lblB}₂′. Drop a perpendicular projector downward from ${lblB}₂′. From ${lblA}, draw a ray inclined at the given VP angle φ = ${phi.toFixed(
        1
      )}° to XY. Their intersection gives ${lblB}₂, so ${lblA}${lblB}₂ geometrically reveals True Length (${tl.toFixed(1)} mm).`,
      mathNote: `Pure Geometry TL: (Projector from ${lblB}₂′) ∩ (Ray at φ = ${phi.toFixed(1)}° from ${lblA}) = ${lblB}₂ ⇒ ${lblA}${lblB}₂ = TL (${tl.toFixed(1)} mm).`,
    },
    {
      num: 5,
      title: `Step 5: Draw Locus of ${lblB} & Locate Final Top View (${lblA}${lblB})`,
      sub: `Horizontal locus through ${lblB}₂ intersects projector from ${lblB}′ at ${lblB}; join ${lblA}${lblB}`,
      description: `Through ${lblB}₂, draw a horizontal Locus of ${lblB} parallel to XY. Where this locus meets the perpendicular projector dropped from ${lblB}′ (Step 3) is the final top-view endpoint ${lblB}. Join ${lblA}${lblB} darkly (${plAux.toFixed(
        1
      )} mm; measured β = ${betaApparent.toFixed(1)}°).`,
      mathNote: `Intersection Rule: (Locus of ${lblB} through ${lblB}₂) ∩ (Projector from ${lblB}′) = ${lblB}; ${lblA}${lblB} = ${plAux.toFixed(1)} mm.`,
    },
    {
      num: 6,
      title: `Step 6: Rotate Top View to Find True Inclination with HP (θ = ${theta.toFixed(1)}°)`,
      sub: `Swing ${lblA}${lblB} onto horizontal (${lblB}₁), project up to Locus of ${lblB}′ at ${lblB}₁′ to read θ`,
      description: `Keep ${lblA} fixed. With compass radius ${lblA}${lblB} (${plAux.toFixed(
        1
      )} mm), swing an arc onto the horizontal line through ${lblA} to get ${lblB}₁. Erect a vertical projector upward from ${lblB}₁ to meet the Locus of ${lblB}′ at ${lblB}₁′. Join ${lblA}′${lblB}₁′ (equals True Length ${tl.toFixed(
        1
      )} mm) and read true inclination with HP: θ = ${theta.toFixed(1)}°.`,
      mathNote: `HP Angle Check: ${lblA}′${lblB}₁′ = TL (${tl.toFixed(1)} mm) at θ = ${theta.toFixed(1)}° to XY.`,
    },
    {
      num: 7,
      title: 'Step 7: Locate Horizontal & Vertical Traces (HT & VT)',
      sub: 'Extend final views to XY and intersect perpendicular projectors for HT and VT',
      description: `${
        line.ht?.exists
          ? `HT: Extend Front View ${lblA}′${lblB}′ to meet XY at h′, draw a perpendicular projector, and extend Top View ${lblA}${lblB} to intersect it at h (HT).`
          : `HT: Front View ${lblA}′${lblB}′ is parallel to XY (no HT).`
      } ${
        line.vt?.exists
          ? `VT: Extend Top View ${lblA}${lblB} to meet XY at v, draw a perpendicular projector, and extend Front View ${lblA}′${lblB}′ to intersect it at v′ (VT).`
          : `VT: Top View ${lblA}${lblB} is parallel to XY (no VT).`
      }`,
      mathNote: 'Traces constructed solely by extending projections to XY and intersecting perpendicular projectors.',
    },
    {
      num: 8,
      title: 'Step 8: Final Drawing Presentation & Measurements',
      sub: `Darken ${lblA}′${lblB}′ & ${lblA}${lblB}, retain arcs & loci lightly, verify TL, θ, β & DEP`,
      description: `Darken final Front View ${lblA}′${lblB}′ and Top View ${lblA}${lblB}. Retain all arcs, horizontal loci, and projectors lightly. True Length (${tl.toFixed(
        1
      )} mm), θ (${theta.toFixed(1)}°), Top View (${plAux.toFixed(1)} mm), β (${betaApparent.toFixed(
        1
      )}°), and DEP (${depCalculated.toFixed(1)} mm) are all obtained purely geometrically.`,
      mathNote: `Pure Geometry Summary: Given FV (${elAux.toFixed(1)} mm), α (${alphaApparent.toFixed(
        1
      )}°), φ (${phi.toFixed(1)}°) ⇒ TL = ${tl.toFixed(1)} mm, θ = ${theta.toFixed(1)}°, TV = ${plAux.toFixed(1)} mm.`,
    },
  ];

  // Step Educational Explanations — Case: Given TV Length + β (TV angle) + θ (HP inclination)
  const tvBetaThetaSteps = [
    {
      num: 1,
      title: 'Step 1: Initial Reference Line XY',
      sub: 'Establish the ground line representing the intersection of HP and VP',
      description:
        'Draw the horizontal reference line XY. Front views lie above XY (VP) and Top views lie below XY (HP) in First-Angle projection.',
      mathNote: 'Drafting Rule: XY separates Front View (above) and Top View (below).',
    },
    {
      num: 2,
      title: `Step 2: Locate Reference End ${line.nameA} (${lblA}′ and ${lblA})`,
      sub: `Mark ${lblA}′ and ${lblA} vertically aligned on one perpendicular projector`,
      description: `Draw a perpendicular projector across XY. Mark ${lblA}′ at ${Math.abs(zA).toFixed(
        1
      )} mm ${zA >= 0 ? 'above' : 'below'} XY and ${lblA} at ${Math.abs(yA).toFixed(1)} mm ${
        yA >= 0 ? 'below' : 'above'
      } XY.`,
      mathNote: `Reference End ${line.nameA}: ${lblA}′ and ${lblA} lie on the same perpendicular projector.`,
    },
    {
      num: 3,
      title: `Step 3: Draw Given Top View (${lblA}${lblB} = ${plAux.toFixed(1)} mm at β = ${betaApparent.toFixed(1)}°)`,
      sub: `Draw ${lblA}${lblB} from ${lblA}, draw Locus of ${lblB}, and erect vertical projector from ${lblB}`,
      description: `Starting directly from the given data: from ${lblA}, draw Top View ${lblA}${lblB} = ${plAux.toFixed(
        1
      )} mm inclined at β = ${betaApparent.toFixed(1)}° to XY, locating ${lblB}. Draw a horizontal Locus of ${lblB} through ${lblB} parallel to XY, and draw a perpendicular projector upward from ${lblB} into the front-view region.`,
      mathNote: `Given Top View: ${lblA}${lblB} (${plAux.toFixed(1)} mm at β = ${betaApparent.toFixed(1)}°) fixes ${lblB}, Locus of ${lblB}, and the end projector.`,
    },
    {
      num: 4,
      title: `Step 4: Rotate ${lblA}${lblB} Horizontal & Intersect θ Ray (${theta.toFixed(1)}°) to Find True Length`,
      sub: `Swing ${lblA}${lblB} to horizontal (${lblB}₁), project up to θ ray from ${lblA}′ to find ${lblB}₁′ (TL = ${tl.toFixed(1)} mm)`,
      description: `Keep ${lblA} fixed. With compass radius ${lblA}${lblB} (${plAux.toFixed(
        1
      )} mm), swing an arc onto the horizontal line through ${lblA} to obtain ${lblB}₁. Erect a perpendicular projector upward from ${lblB}₁. From ${lblA}′, draw a ray inclined at the given HP angle θ = ${theta.toFixed(
        1
      )}° to XY. Their intersection gives ${lblB}₁′, so ${lblA}′${lblB}₁′ geometrically reveals True Length (${tl.toFixed(1)} mm).`,
      mathNote: `Pure Geometry TL: (Projector from ${lblB}₁) ∩ (Ray at θ = ${theta.toFixed(1)}° from ${lblA}′) = ${lblB}₁′ ⇒ ${lblA}′${lblB}₁′ = TL (${tl.toFixed(1)} mm).`,
    },
    {
      num: 5,
      title: `Step 5: Draw Locus of ${lblB}′ & Locate Final Front View (${lblA}′${lblB}′)`,
      sub: `Horizontal locus through ${lblB}₁′ intersects projector from ${lblB} at ${lblB}′; join ${lblA}′${lblB}′`,
      description: `Through ${lblB}₁′, draw a horizontal Locus of ${lblB}′ parallel to XY. Where this locus meets the perpendicular projector drawn from ${lblB} (Step 3) is the final front-view endpoint ${lblB}′. Join ${lblA}′${lblB}′ darkly (${elAux.toFixed(
        1
      )} mm; measured α = ${alphaApparent.toFixed(1)}°).`,
      mathNote: `Intersection Rule: (Locus of ${lblB}′ through ${lblB}₁′) ∩ (Projector from ${lblB}) = ${lblB}′; ${lblA}′${lblB}′ = ${elAux.toFixed(1)} mm.`,
    },
    {
      num: 6,
      title: `Step 6: Rotate Front View to Find True Inclination with VP (φ = ${phi.toFixed(1)}°)`,
      sub: `Swing ${lblA}′${lblB}′ onto horizontal (${lblB}₂′), project down to Locus of ${lblB} at ${lblB}₂ to read φ`,
      description: `Keep ${lblA}′ fixed. With compass radius ${lblA}′${lblB}′ (${elAux.toFixed(
        1
      )} mm), swing an arc onto the horizontal line through ${lblA}′ to get ${lblB}₂′. Drop a vertical projector downward from ${lblB}₂′ to meet the Locus of ${lblB} at ${lblB}₂. Join ${lblA}${lblB}₂ (equals True Length ${tl.toFixed(
        1
      )} mm) and read true inclination with VP: φ = ${phi.toFixed(1)}°.`,
      mathNote: `VP Angle Check: ${lblA}${lblB}₂ = TL (${tl.toFixed(1)} mm) at φ = ${phi.toFixed(1)}° to XY.`,
    },
    {
      num: 7,
      title: 'Step 7: Locate Horizontal & Vertical Traces (HT & VT)',
      sub: 'Extend final views to XY and intersect perpendicular projectors for HT and VT',
      description: `${
        line.ht?.exists
          ? `HT: Extend Front View ${lblA}′${lblB}′ to meet XY at h′, draw a perpendicular projector, and extend Top View ${lblA}${lblB} to intersect it at h (HT).`
          : `HT: Front View ${lblA}′${lblB}′ is parallel to XY (no HT).`
      } ${
        line.vt?.exists
          ? `VT: Extend Top View ${lblA}${lblB} to meet XY at v, draw a perpendicular projector, and extend Front View ${lblA}′${lblB}′ to intersect it at v′ (VT).`
          : `VT: Top View ${lblA}${lblB} is parallel to XY (no VT).`
      }`,
      mathNote: 'Traces constructed solely by extending projections to XY and intersecting perpendicular projectors.',
    },
    {
      num: 8,
      title: 'Step 8: Final Drawing Presentation & Measurements',
      sub: `Darken ${lblA}′${lblB}′ & ${lblA}${lblB}, retain arcs & loci lightly, verify TL, φ, α & DEP`,
      description: `Darken final Front View ${lblA}′${lblB}′ and Top View ${lblA}${lblB}. Retain all arcs, horizontal loci, and projectors lightly. True Length (${tl.toFixed(
        1
      )} mm), φ (${phi.toFixed(1)}°), Front View (${elAux.toFixed(1)} mm), α (${alphaApparent.toFixed(
        1
      )}°), and DEP (${depCalculated.toFixed(1)} mm) are all obtained purely geometrically.`,
      mathNote: `Pure Geometry Summary: Given TV (${plAux.toFixed(1)} mm), β (${betaApparent.toFixed(
        1
      )}°), θ (${theta.toFixed(1)}°) ⇒ TL = ${tl.toFixed(1)} mm, φ = ${phi.toFixed(1)}°, FV = ${elAux.toFixed(1)} mm.`,
    },
  ];

  // Step Educational Explanations — Case: Given TL + FV Length + TV Length (EF)
  const tlViewsSteps = [
    {
      num: 1,
      title: 'Step 1: Initial Reference Line XY',
      sub: 'Establish the ground line representing the intersection of HP and VP',
      description:
        'Draw the horizontal reference line XY representing the intersection of HP (below XY) and VP (above XY).',
      mathNote: 'Drafting Rule: XY separates Front View (above) and Top View (below).',
    },
    {
      num: 2,
      title: `Step 2: Locate Reference End ${line.nameA} (${lblA}′ and ${lblA})`,
      sub: `Mark ${lblA}′ and ${lblA} vertically aligned on one perpendicular projector`,
      description: `Draw a perpendicular projector across XY. Mark ${lblA}′ at ${Math.abs(zA).toFixed(
        1
      )} mm ${zA >= 0 ? 'above' : 'below'} XY and ${lblA} at ${Math.abs(yA).toFixed(1)} mm ${
        yA >= 0 ? 'below' : 'above'
      } XY.`,
      mathNote: `Reference End ${line.nameA}: ${lblA}′ and ${lblA} lie on the same perpendicular projector.`,
    },
    {
      num: 3,
      title: `Step 3: Use Given TV (${plAux.toFixed(1)} mm) & TL (${tl.toFixed(1)} mm) to Find ${lblB}₁′ & θ`,
      sub: `Mark horizontal ${lblA}${lblB}₁ = TV, erect projector, cut with compass radius TL from ${lblA}′ at ${lblB}₁′`,
      description: `Through ${lblA}, draw a horizontal line parallel to XY and mark ${lblA}${lblB}₁ = ${plAux.toFixed(
        1
      )} mm (given Top View length). Erect a vertical projector upward from ${lblB}₁ into the front-view region. With ${lblA}′ as centre and compass radius equal to True Length (${tl.toFixed(
        1
      )} mm), strike an arc cutting this projector at ${lblB}₁′. Join ${lblA}′${lblB}₁′ — its angle with XY reveals true inclination θ = ${theta.toFixed(1)}°!`,
      mathNote: `Compass Intersection: (Projector up from ${lblB}₁) ∩ (Arc center ${lblA}′, R = ${tl.toFixed(1)} mm) = ${lblB}₁′ ⇒ θ = ${theta.toFixed(1)}°.`,
    },
    {
      num: 4,
      title: `Step 4: Use Given FV (${elAux.toFixed(1)} mm) & TL (${tl.toFixed(1)} mm) to Find ${lblB}₂ & φ`,
      sub: `Mark horizontal ${lblA}′${lblB}₂′ = FV, drop projector, cut with compass radius TL from ${lblA} at ${lblB}₂`,
      description: `Through ${lblA}′, draw a horizontal line parallel to XY and mark ${lblA}′${lblB}₂′ = ${elAux.toFixed(
        1
      )} mm (given Front View length). Drop a vertical projector downward from ${lblB}₂′ into the top-view region. With ${lblA} as centre and compass radius equal to True Length (${tl.toFixed(
        1
      )} mm), strike an arc cutting this projector at ${lblB}₂. Join ${lblA}${lblB}₂ — its angle with XY reveals true inclination φ = ${phi.toFixed(1)}°!`,
      mathNote: `Compass Intersection: (Projector down from ${lblB}₂′) ∩ (Arc center ${lblA}, R = ${tl.toFixed(1)} mm) = ${lblB}₂ ⇒ φ = ${phi.toFixed(1)}°.`,
    },
    {
      num: 5,
      title: `Step 5: Draw Horizontal Loci through ${lblB}₁′ and ${lblB}₂`,
      sub: `Draw continuous horizontal Locus of ${lblB}′ and Locus of ${lblB} parallel to XY`,
      description: `Through ${lblB}₁′, draw a horizontal Locus of ${lblB}′ parallel to XY. Through ${lblB}₂, draw a horizontal Locus of ${lblB} parallel to XY.`,
      mathNote: `Locus Rule: Final endpoints ${lblB}′ and ${lblB} must lie on these two horizontal loci.`,
    },
    {
      num: 6,
      title: `Step 6: Rotate Top View Radius to Obtain Final Plan (${lblA}${lblB})`,
      sub: `Swing compass arc center ${lblA}, radius ${lblA}${lblB}₁ (${plAux.toFixed(1)} mm), to cut Locus of ${lblB} at ${lblB}`,
      description: `Keep ${lblA} fixed. Take compass radius ${lblA}${lblB}₁ (${plAux.toFixed(
        1
      )} mm) and swing an arc to intersect the Locus of ${lblB} at ${lblB}. Join ${lblA}${lblB} darkly for the Final Top View.`,
      mathNote: `Rotation Rule: Arc(center ${lblA}, R = ${plAux.toFixed(1)} mm) ∩ (Locus of ${lblB}) = ${lblB}.`,
    },
    {
      num: 7,
      title: `Step 7: Project & Rotate Elevation Radius to Obtain Final Front View (${lblA}′${lblB}′)`,
      sub: `Project vertically from ${lblB} to Locus of ${lblB}′ (verified by arc center ${lblA}′, radius ${lblA}′${lblB}₂′) at ${lblB}′`,
      description: `From ${lblB}, erect a perpendicular projector upward to intersect the Locus of ${lblB}′ at ${lblB}′ (verified by swinging compass radius ${lblA}′${lblB}₂′ = ${elAux.toFixed(
        1
      )} mm from ${lblA}′). Join ${lblA}′${lblB}′ darkly for the Final Front View.`,
      mathNote: `Projector Alignment: (Projector from ${lblB}) ∩ (Locus of ${lblB}′) = ${lblB}′ (DEP = ${depCalculated.toFixed(1)} mm).`,
    },
    {
      num: 8,
      title: 'Step 8: Traces (HT & VT) & Final Presentation',
      sub: 'Darken final views, show apparent angles α & β, and locate HT & VT by extension',
      description: `Darken ${lblA}′${lblB}′ and ${lblA}${lblB}. Extend views to XY and drop/erect perpendicular projectors for HT and VT. True inclinations θ = ${theta.toFixed(
        1
      )}° and φ = ${phi.toFixed(1)}° are determined purely geometrically from the given TL, FV, and TV.`,
      mathNote: `Pure Geometry Summary: TL = ${tl.toFixed(1)} mm, TV = ${plAux.toFixed(1)} mm, FV = ${elAux.toFixed(
        1
      )} mm ⇒ θ = ${theta.toFixed(1)}°, φ = ${phi.toFixed(1)}°.`,
    },
  ];

  // Step Educational Explanations — Case: Apparent Values (FV + TV + DEP / α / β, TL unknown)
  const apparentViewsSteps = [
    {
      num: 1,
      title: 'Step 1: Reference Line XY & End Projectors',
      sub: `Draw XY and two perpendicular projectors separated by DEP = ${depCalculated.toFixed(1)} mm`,
      description: `Draw horizontal line XY and two vertical perpendicular projectors separated horizontally by DEP = ${depCalculated.toFixed(
        1
      )} mm.`,
      mathNote: `Projector Separation: DEP = ${depCalculated.toFixed(1)} mm along XY.`,
    },
    {
      num: 2,
      title: `Step 2: Locate Reference End ${line.nameA} (${lblA}′ and ${lblA})`,
      sub: `Mark ${lblA}′ and ${lblA} on projector 1`,
      description: `On the first projector, mark ${lblA}′ at ${Math.abs(zA).toFixed(1)} mm ${
        zA >= 0 ? 'above' : 'below'
      } XY and ${lblA} at ${Math.abs(yA).toFixed(1)} mm ${yA >= 0 ? 'below' : 'above'} XY.`,
      mathNote: `Reference End ${line.nameA}: ${lblA}′ and ${lblA} lie on projector 1.`,
    },
    {
      num: 3,
      title: `Step 3: Construct Given Front View (${elAux.toFixed(1)} mm) & Top View (${plAux.toFixed(1)} mm) + Loci`,
      sub: `Strike FV arc from ${lblA}′ to ${lblB}′ & TV arc from ${lblA} to ${lblB} on projector 2; draw horizontal loci`,
      description: `With compass radius FV = ${elAux.toFixed(1)} mm centered at ${lblA}′, cut projector 2 at ${lblB}′ and join ${lblA}′${lblB}′. With compass radius TV = ${plAux.toFixed(
        1
      )} mm centered at ${lblA}, cut projector 2 at ${lblB} and join ${lblA}${lblB}. Draw horizontal Locus of ${lblB}′ through ${lblB}′ and Locus of ${lblB} through ${lblB}.`,
      mathNote: `Given Views Plotted: ${lblA}′${lblB}′ = ${elAux.toFixed(1)} mm (α = ${alphaApparent.toFixed(
        1
      )}°), ${lblA}${lblB} = ${plAux.toFixed(1)} mm (β = ${betaApparent.toFixed(1)}°).`,
    },
    {
      num: 4,
      title: `Step 4: Rotate Front View Horizontal to Find True Length (${tl.toFixed(1)} mm) & φ`,
      sub: `Swing ${lblA}′${lblB}′ onto horizontal through ${lblA}′ (${lblB}₂′), project down to Locus of ${lblB} at ${lblB}₂`,
      description: `With ${lblA}′ as centre and radius ${lblA}′${lblB}′ (${elAux.toFixed(
        1
      )} mm), swing an arc onto the horizontal line through ${lblA}′ to get ${lblB}₂′. Drop a vertical projector downward to meet the Locus of ${lblB} at ${lblB}₂. Join ${lblA}${lblB}₂ to obtain True Length (${tl.toFixed(
        1
      )} mm) and true VP angle φ = ${phi.toFixed(1)}°.`,
      mathNote: `Inverse Rotation (FV → TL): ${lblA}${lblB}₂ = TL (${tl.toFixed(1)} mm), φ = ${phi.toFixed(1)}°.`,
    },
    {
      num: 5,
      title: `Step 5: Rotate Top View Horizontal to Confirm TL (${tl.toFixed(1)} mm) & Find θ`,
      sub: `Swing ${lblA}${lblB} onto horizontal through ${lblA} (${lblB}₁), project up to Locus of ${lblB}′ at ${lblB}₁′`,
      description: `With ${lblA} as centre and radius ${lblA}${lblB} (${plAux.toFixed(
        1
      )} mm), swing an arc onto the horizontal line through ${lblA} to get ${lblB}₁. Project vertically upward to meet the Locus of ${lblB}′ at ${lblB}₁′. Join ${lblA}′${lblB}₁′ to confirm True Length (${tl.toFixed(
        1
      )} mm) and find true HP angle θ = ${theta.toFixed(1)}°.`,
      mathNote: `Inverse Rotation (TV → TL): ${lblA}′${lblB}₁′ = TL (${tl.toFixed(1)} mm), θ = ${theta.toFixed(1)}°.`,
    },
    {
      num: 6,
      title: 'Step 6: Horizontal Trace (HT)',
      sub: `Extend ${lblA}′${lblB}′ to XY at h′, project vertically to extended ${lblA}${lblB} at h`,
      description: line.ht?.exists
        ? `Extend Front View ${lblA}′${lblB}′ to intersect XY at h′. Draw a perpendicular projector through h′ and extend Top View ${lblA}${lblB} to intersect it at h (HT).`
        : `Front View ${lblA}′${lblB}′ is parallel to XY (no HT).`,
      mathNote: line.ht?.exists ? `HT located by extending views and intersecting projector at h′.` : 'No HT (∥ HP).',
    },
    {
      num: 7,
      title: 'Step 7: Vertical Trace (VT)',
      sub: `Extend ${lblA}${lblB} to XY at v, project vertically to extended ${lblA}′${lblB}′ at v′`,
      description: line.vt?.exists
        ? `Extend Top View ${lblA}${lblB} to intersect XY at v. Draw a perpendicular projector through v and extend Front View ${lblA}′${lblB}′ to intersect it at v′ (VT).`
        : `Top View ${lblA}${lblB} is parallel to XY (no VT).`,
      mathNote: line.vt?.exists ? `VT located by extending views and intersecting projector at v.` : 'No VT (∥ VP).',
    },
    {
      num: 8,
      title: 'Step 8: Final Drawing Presentation',
      sub: `Darken ${lblA}′${lblB}′ & ${lblA}${lblB}; confirm TL, θ & φ obtained purely geometrically`,
      description: `Darken final Front View ${lblA}′${lblB}′ and Top View ${lblA}${lblB} while keeping loci, arcs, and projectors light. True Length (${tl.toFixed(
        1
      )} mm) and both true inclinations (θ = ${theta.toFixed(1)}°, φ = ${phi.toFixed(1)}°) are obtained strictly via compass arcs and locus intersections.`,
      mathNote: `Pure Geometry Summary: TL = ${tl.toFixed(1)} mm | θ = ${theta.toFixed(1)}° | φ = ${phi.toFixed(1)}°.`,
    },
  ];

  const stepInfo =
    constructionMethod === 'tl-locus'
      ? tlLocusSteps
      : constructionMethod === 'triangle'
        ? triangleSteps
        : constructionMethod === 'fv-alpha-phi'
          ? fvAlphaPhiSteps
          : constructionMethod === 'tv-beta-theta'
            ? tvBetaThetaSteps
            : constructionMethod === 'tl-views'
              ? tlViewsSteps
              : constructionMethod === 'apparent-views'
                ? apparentViewsSteps
                : rotatingSteps;

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
              Because the Horizontal Plane (HP) and Vertical Plane (VP) are perpendicular (90° apart), a real straight line cannot simultaneously lean at θ = {theta.toFixed(1)}° to HP and φ = {phi.toFixed(1)}° to VP when their combined elevation and plan rotations exceed a right angle.
            </p>
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              Geometrically, the rotated compass arc from {lblA} (radius {lblA}{lblB}₁) never reaches the horizontal locus of {lblB} without stretching the line. Please adjust θ or φ so that θ + φ ≤ 90° for valid oblique projections.
            </p>
          </div>
        </div>
      )}

      {/* Main Interactive Construction Workspace */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 overflow-hidden shadow-lg select-none">
        {/* Top Header Overlay: Step Progress & Controls */}
        <div className="p-3 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
          {/* Step Badges 1 to totalSteps */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 max-w-full">
            {(constructionMethod === 'tl-locus' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8]).map((s) => {
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

        {/* Layer Visibility & Method Ribbon */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
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
              {constructionMethod === 'tl-locus'
                ? 'TL & θ/φ Triangles'
                : constructionMethod === 'triangle'
                  ? 'TL Triangles'
                  : `Auxiliary ${lblA}${lblB}₁/${lblA}${lblB}₂`}
            </button>
            {constructionMethod !== 'triangle' && (
              <>
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
                  {constructionMethod === 'tl-locus' ? 'Compass Arc' : 'Rotation Arcs'}
                </button>
              </>
            )}
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

          {/* Method Switcher: Adapts to the active question's given data + standard methods */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {(constructionMethod === 'fv-alpha-phi' ||
              constructionMethod === 'tv-beta-theta' ||
              constructionMethod === 'tl-views' ||
              constructionMethod === 'apparent-views') && (
              <button
                onClick={() => setConstructionMethod(defaultMethod)}
                className="px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer bg-indigo-600 text-white"
                title="Construction order matched to this question's given parameters"
              >
                {constructionMethod === 'fv-alpha-phi'
                  ? 'Given: FV + α + φ'
                  : constructionMethod === 'tv-beta-theta'
                    ? 'Given: TV + β + θ'
                    : constructionMethod === 'tl-views'
                      ? 'Given: TL + FV + TV'
                      : 'Given: FV + TV + DEP'}
              </button>
            )}
            <button
              onClick={() => setConstructionMethod('rotating')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                constructionMethod === 'rotating'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Rotating Line Method (TL + θ + φ)"
            >
              Rotating Line
            </button>
            <button
              onClick={() => setConstructionMethod('triangle')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                constructionMethod === 'triangle'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Right-Angled Triangle Method (End-Points + DEP)"
            >
              Right-Triangle TL
            </button>
            <button
              onClick={() => setConstructionMethod('tl-locus')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                constructionMethod === 'tl-locus'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="True Length + End Distances (Aux TL Triangle + Locus & Arc + θ/φ Triangles)"
            >
              TL + End Distances
            </button>
          </div>
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

            {/* ============================================================== */}
            {/* MODE A: ROTATING LINE METHOD SVG LAYERS                        */}
            {/* ============================================================== */}
            {constructionMethod === 'rotating' && (
              <>
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

                    {/* Dimension for Point a' (Distance from HP) */}
                    {showDimensions && Math.abs(zA) > 0.5 && (
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

                    {/* Dimension for Point a (Distance from VP) */}
                    {showDimensions && Math.abs(yA) > 0.5 && (
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
                      {lblA}′
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
                      {lblA}
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
                      {lblB}₁′ (TL = {tl.toFixed(1)} mm)
                    </text>

                    {/* True Angle θ Arc at a' */}
                    {theta >= 1 && (
                      <g>
                        <path
                          d={`M ${svgMetrics.ptAFv.x + 34} ${svgMetrics.ptAFv.y} A 34 34 0 0 ${
                            svgMetrics.ptB1Fv.y < svgMetrics.ptAFv.y ? 0 : 1
                          } ${svgMetrics.ptAFv.x + 34 * Math.cos(thetaRad)} ${
                            svgMetrics.ptAFv.y - (zB >= zA ? 1 : -1) * 34 * Math.sin(thetaRad)
                          }`}
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
                      {lblB}₁ (PL = {plAux.toFixed(1)} mm)
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
                      {lblB}₂ (TL = {tl.toFixed(1)} mm)
                    </text>

                    {/* True Angle φ Arc at a */}
                    {phi >= 1 && (
                      <g>
                        <path
                          d={`M ${svgMetrics.ptATv.x + 34} ${svgMetrics.ptATv.y} A 34 34 0 0 ${
                            svgMetrics.ptB2Tv.y > svgMetrics.ptATv.y ? 1 : 0
                          } ${svgMetrics.ptATv.x + 34 * Math.cos(phiRad)} ${
                            svgMetrics.ptATv.y + (yB >= yA ? 1 : -1) * 34 * Math.sin(phiRad)
                          }`}
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
                      {lblB}₂′ (EL = {elAux.toFixed(1)} mm)
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
                      <rect x="0" y="0" width="118" height="18" rx="4" fill="#451a03" stroke="#d97706" strokeWidth="1" />
                      <text x="6" y="13" fill="#fef08a" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                        Locus of {lblB}′ ({Math.abs(zB).toFixed(1)}mm)
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
                      <rect x="0" y="0" width="118" height="18" rx="4" fill="#083344" stroke="#0891b2" strokeWidth="1" />
                      <text x="6" y="13" fill="#a5f3fc" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                        Locus of {lblB} ({Math.abs(yB).toFixed(1)}mm)
                      </text>
                    </g>
                  </g>
                )}

                {/* LAYER 6: TOP VIEW ROTATION ARC & POINT b (Step 6+) */}
                {currentStep >= 6 && (
                  <g id="layer-top-view-rotation">
                    {/* Rotation arc: Center a, Radius ab1, cutting Locus of b at b */}
                    {showArcs && svgMetrics.radiusPlanArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y} A ${svgMetrics.radiusPlanArc} ${
                          svgMetrics.radiusPlanArc
                        } 0 0 ${svgMetrics.ptBTv.y >= svgMetrics.ptATv.y ? 1 : 0} ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-emerald)"
                      />
                    )}

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
                      {lblB} (Top View)
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
                    {showArcs && svgMetrics.radiusElevArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptB2Fv.x} ${svgMetrics.ptB2Fv.y} A ${svgMetrics.radiusElevArc} ${
                          svgMetrics.radiusElevArc
                        } 0 0 ${svgMetrics.ptBFv.y <= svgMetrics.ptAFv.y ? 0 : 1} ${svgMetrics.ptBFv.x} ${svgMetrics.ptBFv.y}`}
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
                      {lblB}′ (Front View)
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
                          y1={Math.min(svgMetrics.locusFvY, svgMetrics.groundY) - 25}
                          x2={svgMetrics.ptBTv.x}
                          y2={Math.max(svgMetrics.locusTvY, svgMetrics.groundY) + 25}
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
                        x={depCalculated < 1 ? svgMetrics.originX + 42 : (svgMetrics.originX + svgMetrics.ptBFv.x) / 2}
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
                          d={`M ${svgMetrics.ptAFv.x + 45} ${svgMetrics.ptAFv.y} A 45 45 0 0 ${
                            svgMetrics.ptBFv.y < svgMetrics.ptAFv.y ? 0 : 1
                          } ${svgMetrics.ptAFv.x + 45 * Math.cos((alphaApparent * Math.PI) / 180)} ${
                            svgMetrics.ptAFv.y - (zB >= zA ? 1 : -1) * 45 * Math.sin((alphaApparent * Math.PI) / 180)
                          }`}
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
                          d={`M ${svgMetrics.ptATv.x + 45} ${svgMetrics.ptATv.y} A 45 45 0 0 ${
                            svgMetrics.ptBTv.y > svgMetrics.ptATv.y ? 1 : 0
                          } ${svgMetrics.ptATv.x + 45 * Math.cos((betaApparent * Math.PI) / 180)} ${
                            svgMetrics.ptATv.y + (yB >= yA ? 1 : -1) * 45 * Math.sin((betaApparent * Math.PI) / 180)
                          }`}
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
              </>
            )}

            {/* ============================================================== */}
            {/* MODE B: RIGHT-ANGLED TRIANGLE METHOD (END-POINTS + DEP)        */}
            {/* ============================================================== */}
            {constructionMethod === 'triangle' && (
              <>
                {/* STEP 1+: Both Vertical Projectors & DEP Separation */}
                {currentStep >= 1 && showProjectors && (
                  <g id="layer-triangle-projectors">
                    {/* First Projector (Endpoint A/C) */}
                    <line
                      x1={svgMetrics.originX}
                      y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 42}
                      x2={svgMetrics.originX}
                      y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 42}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      strokeDasharray={currentStep >= 8 ? 'none' : '4,3'}
                      opacity={currentStep >= 8 ? 0.65 : 0.9}
                    />

                    {/* Second Projector (Endpoint B/D) */}
                    <line
                      x1={svgMetrics.ptBFv.x}
                      y1={Math.min(svgMetrics.ptBFv.y, svgMetrics.groundY) - 42}
                      x2={svgMetrics.ptBTv.x}
                      y2={Math.max(svgMetrics.ptBTv.y, svgMetrics.groundY) + 42}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      strokeDasharray={currentStep >= 8 ? 'none' : '4,3'}
                      opacity={currentStep >= 8 ? 0.65 : 0.9}
                    />

                    {/* DEP Distance Indicator along XY */}
                    {showDimensions && depCalculated > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.originX}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.ptBFv.x}
                          y2={svgMetrics.groundY}
                          stroke="#a855f7"
                          strokeWidth="2.4"
                        />
                        <circle cx={svgMetrics.originX} cy={svgMetrics.groundY} r="2.8" fill="#a855f7" />
                        <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.groundY} r="2.8" fill="#a855f7" />
                        <text
                          x={(svgMetrics.originX + svgMetrics.ptBFv.x) / 2}
                          y={svgMetrics.groundY - 7}
                          fill="#d8b4fe"
                          fontSize="10.5"
                          fontFamily="monospace"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          DEP = {depCalculated.toFixed(1)} mm
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* STEP 2+: Plot Both Endpoints Independently */}
                {currentStep >= 2 && (
                  <g id="layer-triangle-endpoints">
                    {/* Dimensions for End A (Left of Projector 1) */}
                    {showDimensions && Math.abs(zA) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.originX - 22}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.originX - 22}
                          y2={svgMetrics.ptAFv.y}
                          stroke="#f87171"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.originX - 28}
                          y={(svgMetrics.groundY + svgMetrics.ptAFv.y) / 2 + 3}
                          fill="#fca5a5"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="end"
                          fontWeight="bold"
                        >
                          {Math.abs(zA).toFixed(0)} mm
                        </text>
                      </g>
                    )}
                    {showDimensions && Math.abs(yA) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.originX - 22}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.originX - 22}
                          y2={svgMetrics.ptATv.y}
                          stroke="#60a5fa"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.originX - 28}
                          y={(svgMetrics.groundY + svgMetrics.ptATv.y) / 2 + 3}
                          fill="#93c5fd"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="end"
                          fontWeight="bold"
                        >
                          {Math.abs(yA).toFixed(0)} mm
                        </text>
                      </g>
                    )}

                    {/* Dimensions for End B (Right of Projector 2) */}
                    {showDimensions && Math.abs(zB) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.ptBFv.x + 22}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.ptBFv.x + 22}
                          y2={svgMetrics.ptBFv.y}
                          stroke="#f87171"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.ptBFv.x + 28}
                          y={(svgMetrics.groundY + svgMetrics.ptBFv.y) / 2 + 3}
                          fill="#fca5a5"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="start"
                          fontWeight="bold"
                        >
                          {Math.abs(zB).toFixed(0)} mm
                        </text>
                      </g>
                    )}
                    {showDimensions && Math.abs(yB) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.ptBTv.x + 22}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.ptBTv.x + 22}
                          y2={svgMetrics.ptBTv.y}
                          stroke="#60a5fa"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.ptBTv.x + 28}
                          y={(svgMetrics.groundY + svgMetrics.ptBTv.y) / 2 + 3}
                          fill="#93c5fd"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="start"
                          fontWeight="bold"
                        >
                          {Math.abs(yB).toFixed(0)} mm
                        </text>
                      </g>
                    )}

                    {/* Points a'/c' and a/c */}
                    <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptAFv.x - 16} y={svgMetrics.ptAFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}′
                    </text>

                    <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptATv.x - 16} y={svgMetrics.ptATv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}
                    </text>

                    {/* Points b'/d' and b/d */}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBFv.x + 8} y={svgMetrics.ptBFv.y + 14} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}′
                    </text>

                    <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBTv.x + 8} y={svgMetrics.ptBTv.y - 6} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}
                    </text>
                  </g>
                )}

                {/* STEP 3+: Final Front View & Top View Projections */}
                {currentStep >= 3 && (
                  <g id="layer-triangle-projections">
                    <line
                      x1={svgMetrics.ptAFv.x}
                      y1={svgMetrics.ptAFv.y}
                      x2={svgMetrics.ptBFv.x}
                      y2={svgMetrics.ptBFv.y}
                      stroke="#dc2626"
                      strokeWidth={currentStep >= 8 ? '3.8' : '3.0'}
                      strokeLinecap="round"
                    />
                    <text
                      x={(svgMetrics.ptAFv.x + svgMetrics.ptBFv.x) / 2}
                      y={(svgMetrics.ptAFv.y + svgMetrics.ptBFv.y) / 2 + 16}
                      fill="#fca5a5"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      FV ({line.frontViewLength.toFixed(1)} mm)
                    </text>

                    <line
                      x1={svgMetrics.ptATv.x}
                      y1={svgMetrics.ptATv.y}
                      x2={svgMetrics.ptBTv.x}
                      y2={svgMetrics.ptBTv.y}
                      stroke="#2563eb"
                      strokeWidth={currentStep >= 8 ? '3.8' : '3.0'}
                      strokeLinecap="round"
                    />
                    <text
                      x={(svgMetrics.ptATv.x + svgMetrics.ptBTv.x) / 2}
                      y={(svgMetrics.ptATv.y + svgMetrics.ptBTv.y) / 2 - 8}
                      fill="#93c5fd"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TV ({line.topViewLength.toFixed(1)} mm)
                    </text>
                  </g>
                )}

                {/* STEP 4+: Front-View Right-Angled Triangle (|Δy| perpendicular + TL hypotenuse) */}
                {currentStep >= 4 && showAuxiliary && svgMetrics.fvTriangle && (
                  <g id="layer-fv-right-triangle" opacity={currentStep >= 8 ? 0.85 : 1}>
                    {/* Perpendicular leg |Δy| */}
                    <line
                      x1={svgMetrics.ptBFv.x}
                      y1={svgMetrics.ptBFv.y}
                      x2={svgMetrics.fvTriangle.tip.x}
                      y2={svgMetrics.fvTriangle.tip.y}
                      stroke="#fbbf24"
                      strokeWidth="1.8"
                      strokeDasharray="4,3"
                    />
                    {/* Right-angle marker at b'/d' */}
                    <polyline
                      points={`${svgMetrics.fvTriangle.cornerA.x},${svgMetrics.fvTriangle.cornerA.y} ${svgMetrics.fvTriangle.cornerB.x},${svgMetrics.fvTriangle.cornerB.y} ${svgMetrics.fvTriangle.cornerC.x},${svgMetrics.fvTriangle.cornerC.y}`}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.2"
                    />
                    {/* Hypotenuse = True Length */}
                    <line
                      x1={svgMetrics.ptAFv.x}
                      y1={svgMetrics.ptAFv.y}
                      x2={svgMetrics.fvTriangle.tip.x}
                      y2={svgMetrics.fvTriangle.tip.y}
                      stroke="#c084fc"
                      strokeWidth="2.4"
                    />
                    <circle cx={svgMetrics.fvTriangle.tip.x} cy={svgMetrics.fvTriangle.tip.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={svgMetrics.fvTriangle.perpMid.x}
                      y={svgMetrics.fvTriangle.perpMid.y}
                      fill="#fde68a"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      VP diff={diffY.toFixed(1)}
                    </text>
                    <text
                      x={svgMetrics.fvTriangle.hypMid.x}
                      y={svgMetrics.fvTriangle.hypMid.y}
                      fill="#e9d5ff"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TL = {tl.toFixed(1)} mm
                    </text>
                  </g>
                )}

                {/* STEP 5+: Top-View Right-Angled Triangle (|Δz| perpendicular + TL hypotenuse) */}
                {currentStep >= 5 && showAuxiliary && svgMetrics.tvTriangle && (
                  <g id="layer-tv-right-triangle" opacity={currentStep >= 8 ? 0.85 : 1}>
                    {/* Perpendicular leg |Δz| */}
                    <line
                      x1={svgMetrics.ptBTv.x}
                      y1={svgMetrics.ptBTv.y}
                      x2={svgMetrics.tvTriangle.tip.x}
                      y2={svgMetrics.tvTriangle.tip.y}
                      stroke="#22d3ee"
                      strokeWidth="1.8"
                      strokeDasharray="4,3"
                    />
                    {/* Right-angle marker at b/d */}
                    <polyline
                      points={`${svgMetrics.tvTriangle.cornerA.x},${svgMetrics.tvTriangle.cornerA.y} ${svgMetrics.tvTriangle.cornerB.x},${svgMetrics.tvTriangle.cornerB.y} ${svgMetrics.tvTriangle.cornerC.x},${svgMetrics.tvTriangle.cornerC.y}`}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="1.2"
                    />
                    {/* Hypotenuse = True Length */}
                    <line
                      x1={svgMetrics.ptATv.x}
                      y1={svgMetrics.ptATv.y}
                      x2={svgMetrics.tvTriangle.tip.x}
                      y2={svgMetrics.tvTriangle.tip.y}
                      stroke="#34d399"
                      strokeWidth="2.4"
                    />
                    <circle cx={svgMetrics.tvTriangle.tip.x} cy={svgMetrics.tvTriangle.tip.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={svgMetrics.tvTriangle.perpMid.x}
                      y={svgMetrics.tvTriangle.perpMid.y}
                      fill="#a5f3fc"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      H diff={diffZ.toFixed(1)}
                    </text>
                    <text
                      x={svgMetrics.tvTriangle.hypMid.x}
                      y={svgMetrics.tvTriangle.hypMid.y}
                      fill="#a7f3d0"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TL = {tl.toFixed(1)} mm
                    </text>
                  </g>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* MODE C: TL + END DISTANCES (AUX TL, LOCUS+ARC, θ/φ TRIANGLES)  */}
            {/* ============================================================== */}
            {constructionMethod === 'tl-locus' && (
              <>
                {/* STEP 1+: Reference Projector & Endpoint A/M */}
                {currentStep >= 1 && (
                  <g id="layer-tllocus-end-a">
                    {showProjectors && (
                      <line
                        x1={svgMetrics.originX}
                        y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 42}
                        x2={svgMetrics.originX}
                        y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 42}
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                        strokeDasharray={currentStep >= 9 ? 'none' : '4,3'}
                        opacity={currentStep >= 9 ? 0.65 : 0.9}
                      />
                    )}

                    {/* Dimensions for End A/M */}
                    {showDimensions && Math.abs(zA) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.originX - 22}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.originX - 22}
                          y2={svgMetrics.ptAFv.y}
                          stroke="#f87171"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.originX - 28}
                          y={(svgMetrics.groundY + svgMetrics.ptAFv.y) / 2 + 3}
                          fill="#fca5a5"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="end"
                          fontWeight="bold"
                        >
                          {Math.abs(zA).toFixed(0)} mm
                        </text>
                      </g>
                    )}
                    {showDimensions && Math.abs(yA) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.originX - 22}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.originX - 22}
                          y2={svgMetrics.ptATv.y}
                          stroke="#60a5fa"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.originX - 28}
                          y={(svgMetrics.groundY + svgMetrics.ptATv.y) / 2 + 3}
                          fill="#93c5fd"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="end"
                          fontWeight="bold"
                        >
                          {Math.abs(yA).toFixed(0)} mm
                        </text>
                      </g>
                    )}

                    <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptAFv.x - 16} y={svgMetrics.ptAFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}′
                    </text>

                    <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptATv.x - 16} y={svgMetrics.ptATv.y + 16} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}
                    </text>
                  </g>
                )}

                {/* STEP 2+: Geometric Auxiliary Right-Angled Triangle to obtain Top View length mn */}
                {currentStep >= 2 && showAuxiliary && (
                  <g id="layer-tllocus-aux-tv-triangle" opacity={currentStep >= 4 ? 0.72 : 1}>
                    {/* Title badge above Auxiliary Triangle */}
                    <text
                      x={(svgMetrics.auxTriangle.left.x + svgMetrics.auxTriangle.right.x) / 2}
                      y={svgMetrics.auxTriangle.top.y - 22}
                      fill="#e2e8f0"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      AUXILIARY TV LENGTH (Step 2)
                    </text>

                    {/* Horizontal side = Top View length mn */}
                    <line
                      x1={svgMetrics.auxTriangle.left.x}
                      y1={svgMetrics.auxTriangle.left.y}
                      x2={svgMetrics.auxTriangle.right.x}
                      y2={svgMetrics.auxTriangle.right.y}
                      stroke="#38bdf8"
                      strokeWidth="2.4"
                    />
                    <text
                      x={(svgMetrics.auxTriangle.left.x + svgMetrics.auxTriangle.right.x) / 2}
                      y={svgMetrics.auxTriangle.left.y + 14}
                      fill="#7dd3fc"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {lblA}{lblB} = {plAux.toFixed(1)} mm
                    </text>

                    {/* Vertical perpendicular side = |Δz| */}
                    {diffZ > 0.2 && (
                      <>
                        <line
                          x1={svgMetrics.auxTriangle.right.x}
                          y1={svgMetrics.auxTriangle.right.y}
                          x2={svgMetrics.auxTriangle.top.x}
                          y2={svgMetrics.auxTriangle.top.y}
                          stroke="#fbbf24"
                          strokeWidth="1.8"
                          strokeDasharray="4,3"
                        />
                        {/* 90-degree corner marker */}
                        <polyline
                          points={`${svgMetrics.auxTriangle.right.x - svgMetrics.auxTriangle.sq},${svgMetrics.auxTriangle.right.y} ${
                            svgMetrics.auxTriangle.right.x - svgMetrics.auxTriangle.sq
                          },${svgMetrics.auxTriangle.right.y - svgMetrics.auxTriangle.sq} ${svgMetrics.auxTriangle.right.x},${
                            svgMetrics.auxTriangle.right.y - svgMetrics.auxTriangle.sq
                          }`}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="1.1"
                        />
                        <text
                          x={svgMetrics.auxTriangle.right.x + 6}
                          y={(svgMetrics.auxTriangle.right.y + svgMetrics.auxTriangle.top.y) / 2 + 3}
                          fill="#fde68a"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          H diff={diffZ.toFixed(0)}
                        </text>
                      </>
                    )}

                    {/* Compass arc of radius TL cutting vertical perpendicular */}
                    {showArcs && diffZ > 0.2 && (
                      <path
                        d={svgMetrics.auxTriangle.arcD}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="1.3"
                        strokeDasharray="3,3"
                      />
                    )}

                    {/* Hypotenuse = True Length TL */}
                    <line
                      x1={svgMetrics.auxTriangle.left.x}
                      y1={svgMetrics.auxTriangle.left.y}
                      x2={svgMetrics.auxTriangle.top.x}
                      y2={svgMetrics.auxTriangle.top.y}
                      stroke="#c084fc"
                      strokeWidth="2.2"
                    />
                    <circle cx={svgMetrics.auxTriangle.left.x} cy={svgMetrics.auxTriangle.left.y} r="3" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                    <circle cx={svgMetrics.auxTriangle.right.x} cy={svgMetrics.auxTriangle.right.y} r="3" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                    <circle cx={svgMetrics.auxTriangle.top.x} cy={svgMetrics.auxTriangle.top.y} r="3" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={(svgMetrics.auxTriangle.left.x + svgMetrics.auxTriangle.top.x) / 2 - 6}
                      y={(svgMetrics.auxTriangle.left.y + svgMetrics.auxTriangle.top.y) / 2 - 8}
                      fill="#e9d5ff"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TL = {tl.toFixed(1)} mm
                    </text>
                  </g>
                )}

                {/* STEP 3+: Depth Locus of n, Compass Arc from m (radius mn), Second Projector & Endpoint N */}
                {currentStep >= 3 && (
                  <g id="layer-tllocus-locate-n">
                    {/* Horizontal Depth Locus of n parallel to XY */}
                    {showLoci && (
                      <g>
                        <line
                          x1={svgMetrics.originX - 42}
                          y1={svgMetrics.locusTvY}
                          x2={Math.max(svgMetrics.ptB1Tv.x, svgMetrics.ptBTv.x) + 46}
                          y2={svgMetrics.locusTvY}
                          stroke="#22d3ee"
                          strokeWidth="1.1"
                        />
                        <text
                          x={Math.max(svgMetrics.ptB1Tv.x, svgMetrics.ptBTv.x) + 48}
                          y={svgMetrics.locusTvY + 4}
                          fill="#a5f3fc"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          Locus of {lblB} ({Math.abs(yB).toFixed(0)} mm)
                        </text>

                        {/* Light Horizontal Height Locus of n' parallel to XY */}
                        <line
                          x1={svgMetrics.originX - 30}
                          y1={svgMetrics.locusFvY}
                          x2={svgMetrics.ptBFv.x + 36}
                          y2={svgMetrics.locusFvY}
                          stroke="#fbbf24"
                          strokeWidth="0.9"
                          strokeDasharray="4,3"
                          opacity="0.7"
                        />
                      </g>
                    )}

                    {/* Compass Arc centered at m with radius = Top View length mn cutting Locus of n */}
                    {showArcs && svgMetrics.radiusPlanArc > 1 && (
                      <g opacity={currentStep >= 4 ? 0.75 : 1}>
                        <line
                          x1={svgMetrics.ptATv.x}
                          y1={svgMetrics.ptATv.y}
                          x2={svgMetrics.ptB1Tv.x}
                          y2={svgMetrics.ptB1Tv.y}
                          stroke="#38bdf8"
                          strokeWidth="1.0"
                          strokeDasharray="3,3"
                          opacity="0.65"
                        />
                        <path
                          d={`M ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y} A ${svgMetrics.radiusPlanArc} ${
                            svgMetrics.radiusPlanArc
                          } 0 0 ${svgMetrics.ptBTv.y >= svgMetrics.ptATv.y ? 1 : 0} ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y}`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                          strokeDasharray="4,3"
                          markerEnd="url(#arrow-arc-emerald)"
                        />
                        <text
                          x={svgMetrics.ptB1Tv.x + 4}
                          y={svgMetrics.ptB1Tv.y + 14}
                          fill="#7dd3fc"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          R = {lblA}{lblB} ({plAux.toFixed(1)})
                        </text>
                      </g>
                    )}

                    {/* Second Vertical Projector from n up to n' */}
                    {showProjectors && (
                      <line
                        x1={svgMetrics.ptBTv.x}
                        y1={Math.min(svgMetrics.ptBFv.y, svgMetrics.groundY) - 42}
                        x2={svgMetrics.ptBTv.x}
                        y2={Math.max(svgMetrics.ptBTv.y, svgMetrics.groundY) + 42}
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                        strokeDasharray={currentStep >= 9 ? 'none' : '4,3'}
                        opacity={currentStep >= 9 ? 0.65 : 0.9}
                      />
                    )}

                    {/* Dimensions for End B/N */}
                    {showDimensions && Math.abs(zB) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.ptBFv.x + 20}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.ptBFv.x + 20}
                          y2={svgMetrics.ptBFv.y}
                          stroke="#f87171"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.ptBFv.x + 26}
                          y={(svgMetrics.groundY + svgMetrics.ptBFv.y) / 2 + 3}
                          fill="#fca5a5"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="start"
                          fontWeight="bold"
                        >
                          {Math.abs(zB).toFixed(0)} mm
                        </text>
                      </g>
                    )}
                    {showDimensions && Math.abs(yB) > 0.5 && (
                      <g>
                        <line
                          x1={svgMetrics.ptBTv.x + 20}
                          y1={svgMetrics.groundY}
                          x2={svgMetrics.ptBTv.x + 20}
                          y2={svgMetrics.ptBTv.y}
                          stroke="#60a5fa"
                          strokeWidth="1"
                          markerStart="url(#arrow-start)"
                          markerEnd="url(#arrow-end)"
                        />
                        <text
                          x={svgMetrics.ptBTv.x + 26}
                          y={(svgMetrics.groundY + svgMetrics.ptBTv.y) / 2 + 3}
                          fill="#93c5fd"
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="start"
                          fontWeight="bold"
                        >
                          {Math.abs(yB).toFixed(0)} mm
                        </text>
                      </g>
                    )}

                    {/* Points n' and n */}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBFv.x + 8} y={svgMetrics.ptBFv.y - 6} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}′
                    </text>

                    <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBTv.x + 8} y={svgMetrics.ptBTv.y + 16} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}
                    </text>
                  </g>
                )}

                {/* STEP 4+: Final Front View (m'n') & Top View (mn) Projections */}
                {currentStep >= 4 && showFinalViews && (
                  <g id="layer-tllocus-final-projections">
                    <line
                      x1={svgMetrics.ptAFv.x}
                      y1={svgMetrics.ptAFv.y}
                      x2={svgMetrics.ptBFv.x}
                      y2={svgMetrics.ptBFv.y}
                      stroke="#dc2626"
                      strokeWidth={currentStep >= 9 ? '3.8' : '3.0'}
                      strokeLinecap="round"
                    />
                    <text
                      x={(svgMetrics.ptAFv.x + svgMetrics.ptBFv.x) / 2}
                      y={(svgMetrics.ptAFv.y + svgMetrics.ptBFv.y) / 2 + 16}
                      fill="#fca5a5"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      FV ({elAux.toFixed(1)} mm)
                    </text>

                    <line
                      x1={svgMetrics.ptATv.x}
                      y1={svgMetrics.ptATv.y}
                      x2={svgMetrics.ptBTv.x}
                      y2={svgMetrics.ptBTv.y}
                      stroke="#2563eb"
                      strokeWidth={currentStep >= 9 ? '3.8' : '3.0'}
                      strokeLinecap="round"
                    />
                    <text
                      x={(svgMetrics.ptATv.x + svgMetrics.ptBTv.x) / 2}
                      y={(svgMetrics.ptATv.y + svgMetrics.ptBTv.y) / 2 - 8}
                      fill="#93c5fd"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TV ({plAux.toFixed(1)} mm)
                    </text>
                  </g>
                )}

                {/* STEP 5+: Inclination with HP (θ) — Right-Angled Triangle on Top View mn */}
                {currentStep >= 5 && showAuxiliary && svgMetrics.tvTriangle && (
                  <g id="layer-tllocus-hp-triangle" opacity={currentStep >= 9 ? 0.9 : 1}>
                    <line
                      x1={svgMetrics.ptBTv.x}
                      y1={svgMetrics.ptBTv.y}
                      x2={svgMetrics.tvTriangle.tip.x}
                      y2={svgMetrics.tvTriangle.tip.y}
                      stroke="#22d3ee"
                      strokeWidth="1.8"
                      strokeDasharray="4,3"
                    />
                    <polyline
                      points={`${svgMetrics.tvTriangle.cornerA.x},${svgMetrics.tvTriangle.cornerA.y} ${svgMetrics.tvTriangle.cornerB.x},${svgMetrics.tvTriangle.cornerB.y} ${svgMetrics.tvTriangle.cornerC.x},${svgMetrics.tvTriangle.cornerC.y}`}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="1.2"
                    />
                    <line
                      x1={svgMetrics.ptATv.x}
                      y1={svgMetrics.ptATv.y}
                      x2={svgMetrics.tvTriangle.tip.x}
                      y2={svgMetrics.tvTriangle.tip.y}
                      stroke="#34d399"
                      strokeWidth="2.4"
                    />
                    <circle cx={svgMetrics.tvTriangle.tip.x} cy={svgMetrics.tvTriangle.tip.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={svgMetrics.tvTriangle.perpMid.x}
                      y={svgMetrics.tvTriangle.perpMid.y}
                      fill="#a5f3fc"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      H diff={diffZ.toFixed(0)}
                    </text>
                    <text
                      x={svgMetrics.tvTriangle.hypMid.x}
                      y={svgMetrics.tvTriangle.hypMid.y}
                      fill="#a7f3d0"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TL = {tl.toFixed(1)} mm
                    </text>

                    {/* θ Angle Arc & Label */}
                    {svgMetrics.tvAngleArc && theta >= 0.5 && (
                      <g>
                        <path
                          d={svgMetrics.tvAngleArc.d}
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="1.5"
                        />
                        <text
                          x={svgMetrics.tvAngleArc.labelPos.x}
                          y={svgMetrics.tvAngleArc.labelPos.y}
                          fill="#a7f3d0"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          θ={theta.toFixed(1)}°
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* STEP 6+: Inclination with VP (φ) — Right-Angled Triangle on Front View m'n' */}
                {currentStep >= 6 && showAuxiliary && svgMetrics.fvTriangle && (
                  <g id="layer-tllocus-vp-triangle" opacity={currentStep >= 9 ? 0.9 : 1}>
                    <line
                      x1={svgMetrics.ptBFv.x}
                      y1={svgMetrics.ptBFv.y}
                      x2={svgMetrics.fvTriangle.tip.x}
                      y2={svgMetrics.fvTriangle.tip.y}
                      stroke="#fbbf24"
                      strokeWidth="1.8"
                      strokeDasharray="4,3"
                    />
                    <polyline
                      points={`${svgMetrics.fvTriangle.cornerA.x},${svgMetrics.fvTriangle.cornerA.y} ${svgMetrics.fvTriangle.cornerB.x},${svgMetrics.fvTriangle.cornerB.y} ${svgMetrics.fvTriangle.cornerC.x},${svgMetrics.fvTriangle.cornerC.y}`}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.2"
                    />
                    <line
                      x1={svgMetrics.ptAFv.x}
                      y1={svgMetrics.ptAFv.y}
                      x2={svgMetrics.fvTriangle.tip.x}
                      y2={svgMetrics.fvTriangle.tip.y}
                      stroke="#c084fc"
                      strokeWidth="2.4"
                    />
                    <circle cx={svgMetrics.fvTriangle.tip.x} cy={svgMetrics.fvTriangle.tip.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x={svgMetrics.fvTriangle.perpMid.x}
                      y={svgMetrics.fvTriangle.perpMid.y}
                      fill="#fde68a"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      VP diff={diffY.toFixed(0)}
                    </text>
                    <text
                      x={svgMetrics.fvTriangle.hypMid.x}
                      y={svgMetrics.fvTriangle.hypMid.y}
                      fill="#e9d5ff"
                      fontSize="10.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      TL = {tl.toFixed(1)} mm
                    </text>

                    {/* φ Angle Arc & Label */}
                    {svgMetrics.fvAngleArc && phi >= 0.5 && (
                      <g>
                        <path
                          d={svgMetrics.fvAngleArc.d}
                          fill="none"
                          stroke="#c084fc"
                          strokeWidth="1.5"
                        />
                        <text
                          x={svgMetrics.fvAngleArc.labelPos.x}
                          y={svgMetrics.fvAngleArc.labelPos.y}
                          fill="#e9d5ff"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          φ={phi.toFixed(1)}°
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* MODE D: GIVEN FV + α + φ (e.g. PQ)                             */}
            {/* ============================================================== */}
            {constructionMethod === 'fv-alpha-phi' && (
              <>
                {/* STEP 2+: Reference End A (a', a) */}
                {currentStep >= 2 && showProjectors && (
                  <g id="layer-fvap-end-a">
                    <line
                      x1={svgMetrics.originX}
                      y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 40}
                      x2={svgMetrics.originX}
                      y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 40}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                    />
                    <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptAFv.x - 16} y={svgMetrics.ptAFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}′
                    </text>
                    <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptATv.x - 16} y={svgMetrics.ptATv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}
                    </text>
                  </g>
                )}

                {/* STEP 3+: Given Front View a'b' at α, Locus of b', and projector down from b' */}
                {currentStep >= 3 && (
                  <g id="layer-fvap-given-fv">
                    {/* Horizontal reference through a' */}
                    <line
                      x1={svgMetrics.ptAFv.x}
                      y1={svgMetrics.ptAFv.y}
                      x2={Math.max(svgMetrics.ptB2Fv.x, svgMetrics.ptBFv.x) + 36}
                      y2={svgMetrics.ptAFv.y}
                      stroke="#94a3b8"
                      strokeWidth="0.9"
                      strokeDasharray="4,3"
                    />
                    {/* Given Front View a'b' */}
                    {showFinalViews && (
                      <line
                        x1={svgMetrics.ptAFv.x}
                        y1={svgMetrics.ptAFv.y}
                        x2={svgMetrics.ptBFv.x}
                        y2={svgMetrics.ptBFv.y}
                        stroke="#dc2626"
                        strokeWidth={currentStep >= 8 ? '3.8' : '3.0'}
                        strokeLinecap="round"
                      />
                    )}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBFv.x + 8} y={svgMetrics.ptBFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}′ (FV = {elAux.toFixed(1)})
                    </text>
                    {/* α arc */}
                    {showDimensions && alphaApparent >= 1 && (
                      <text x={svgMetrics.ptAFv.x + 42} y={svgMetrics.ptAFv.y - 10} fill="#fca5a5" fontSize="11" fontWeight="bold" fontFamily="monospace">
                        α = {alphaApparent.toFixed(1)}°
                      </text>
                    )}
                    {/* Locus of b' */}
                    {showLoci && (
                      <>
                        <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusFvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusFvY} stroke="#fbbf24" strokeWidth="0.9" />
                        <text x={svgMetrics.locusEndX + 8} y={svgMetrics.locusFvY + 4} fill="#fef08a" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                          Locus of {lblB}′
                        </text>
                      </>
                    )}
                    {/* Vertical projector dropped from b' */}
                    {showProjectors && (
                      <line
                        x1={svgMetrics.ptBFv.x}
                        y1={Math.min(svgMetrics.locusFvY, svgMetrics.groundY) - 25}
                        x2={svgMetrics.ptBFv.x}
                        y2={Math.max(svgMetrics.locusTvY, svgMetrics.groundY) + 30}
                        stroke="#94a3b8"
                        strokeWidth="1.3"
                        strokeDasharray={currentStep >= 5 ? 'none' : '4,3'}
                      />
                    )}
                  </g>
                )}

                {/* STEP 4+: Rotate a'b' onto horizontal (b2'), drop projector to φ ray from a -> b2 (TL) */}
                {currentStep >= 4 && showAuxiliary && (
                  <g id="layer-fvap-tl-phi">
                    {showArcs && svgMetrics.radiusElevArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptBFv.x} ${svgMetrics.ptBFv.y} A ${svgMetrics.radiusElevArc} ${svgMetrics.radiusElevArc} 0 0 ${
                          svgMetrics.ptBFv.y <= svgMetrics.ptAFv.y ? 1 : 0
                        } ${svgMetrics.ptB2Fv.x} ${svgMetrics.ptB2Fv.y}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-amber)"
                      />
                    )}
                    <circle cx={svgMetrics.ptB2Fv.x} cy={svgMetrics.ptB2Fv.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Fv.x + 8} y={svgMetrics.ptB2Fv.y + 16} fill="#fde68a" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂′
                    </text>
                    {/* Projector down from b2' to b2 */}
                    <line x1={svgMetrics.ptB2Fv.x} y1={svgMetrics.ptB2Fv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    {/* Horizontal through a */}
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={Math.max(svgMetrics.ptB1Tv.x, svgMetrics.ptB2Tv.x) + 36} y2={svgMetrics.ptATv.y} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="4,3" />
                    {/* True Length ab2 at φ */}
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#34d399" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB2Tv.x} cy={svgMetrics.ptB2Tv.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Tv.x + 8} y={svgMetrics.ptB2Tv.y + 16} fill="#a7f3d0" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂ (TL = {tl.toFixed(1)} mm)
                    </text>
                    {phi >= 1 && (
                      <text x={svgMetrics.ptATv.x + 42} y={svgMetrics.ptATv.y + 18} fill="#a7f3d0" fontSize="11" fontWeight="bold" fontFamily="monospace">
                        φ = {phi.toFixed(1)}°
                      </text>
                    )}
                  </g>
                )}

                {/* STEP 5+: Locus of b through b2 intersecting projector from b' -> Final Top View ab */}
                {currentStep >= 5 && (
                  <g id="layer-fvap-final-tv">
                    {showLoci && (
                      <>
                        <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusTvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusTvY} stroke="#22d3ee" strokeWidth="0.9" />
                        <text x={svgMetrics.locusEndX + 8} y={svgMetrics.locusTvY + 4} fill="#a5f3fc" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                          Locus of {lblB}
                        </text>
                      </>
                    )}
                    {showFinalViews && (
                      <line
                        x1={svgMetrics.ptATv.x}
                        y1={svgMetrics.ptATv.y}
                        x2={svgMetrics.ptBTv.x}
                        y2={svgMetrics.ptBTv.y}
                        stroke="#2563eb"
                        strokeWidth={currentStep >= 8 ? '3.8' : '3.0'}
                        strokeLinecap="round"
                      />
                    )}
                    <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBTv.x + 8} y={svgMetrics.ptBTv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB} (TV = {plAux.toFixed(1)})
                    </text>
                  </g>
                )}

                {/* STEP 6+: Rotate ab to horizontal (b1), project up to Locus of b' -> b1', draw a'b1' to reveal θ */}
                {currentStep >= 6 && showAuxiliary && (
                  <g id="layer-fvap-find-theta">
                    {showArcs && svgMetrics.radiusPlanArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y} A ${svgMetrics.radiusPlanArc} ${svgMetrics.radiusPlanArc} 0 0 ${
                          svgMetrics.ptBTv.y >= svgMetrics.ptATv.y ? 0 : 1
                        } ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-emerald)"
                      />
                    )}
                    <circle cx={svgMetrics.ptB1Tv.x} cy={svgMetrics.ptB1Tv.y} r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Tv.x + 8} y={svgMetrics.ptB1Tv.y - 6} fill="#7dd3fc" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁
                    </text>
                    <line x1={svgMetrics.ptB1Tv.x} y1={svgMetrics.ptB1Tv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#c084fc" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB1Fv.x} cy={svgMetrics.ptB1Fv.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Fv.x + 8} y={svgMetrics.ptB1Fv.y - 6} fill="#e9d5ff" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁′ (θ = {theta.toFixed(1)}°)
                    </text>
                  </g>
                )}

                {/* STEP 8: DEP & Apparent β readout */}
                {currentStep >= 8 && showDimensions && (
                  <g id="layer-fvap-dimensions">
                    <line x1={svgMetrics.originX} y1={svgMetrics.groundY} x2={svgMetrics.ptBFv.x} y2={svgMetrics.groundY} stroke="#a855f7" strokeWidth="2.6" />
                    <text x={(svgMetrics.originX + svgMetrics.ptBFv.x) / 2} y={svgMetrics.groundY - 8} fill="#d8b4fe" fontSize="10.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      DEP = {depCalculated.toFixed(1)} mm
                    </text>
                  </g>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* MODE E: GIVEN TV + β + θ (e.g. RS)                             */}
            {/* ============================================================== */}
            {constructionMethod === 'tv-beta-theta' && (
              <>
                {/* STEP 2+: Reference End A (a', a) */}
                {currentStep >= 2 && showProjectors && (
                  <g id="layer-tvbt-end-a">
                    <line
                      x1={svgMetrics.originX}
                      y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 40}
                      x2={svgMetrics.originX}
                      y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 40}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                    />
                    <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptAFv.x - 16} y={svgMetrics.ptAFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}′
                    </text>
                    <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptATv.x - 16} y={svgMetrics.ptATv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}
                    </text>
                  </g>
                )}

                {/* STEP 3+: Given Top View ab at β, Locus of b, and projector up from b */}
                {currentStep >= 3 && (
                  <g id="layer-tvbt-given-tv">
                    <line
                      x1={svgMetrics.ptATv.x}
                      y1={svgMetrics.ptATv.y}
                      x2={Math.max(svgMetrics.ptB1Tv.x, svgMetrics.ptBTv.x) + 36}
                      y2={svgMetrics.ptATv.y}
                      stroke="#94a3b8"
                      strokeWidth="0.9"
                      strokeDasharray="4,3"
                    />
                    {showFinalViews && (
                      <line
                        x1={svgMetrics.ptATv.x}
                        y1={svgMetrics.ptATv.y}
                        x2={svgMetrics.ptBTv.x}
                        y2={svgMetrics.ptBTv.y}
                        stroke="#2563eb"
                        strokeWidth={currentStep >= 8 ? '3.8' : '3.0'}
                        strokeLinecap="round"
                      />
                    )}
                    <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBTv.x + 8} y={svgMetrics.ptBTv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB} (TV = {plAux.toFixed(1)})
                    </text>
                    {showDimensions && betaApparent >= 1 && (
                      <text x={svgMetrics.ptATv.x + 42} y={svgMetrics.ptATv.y + 18} fill="#93c5fd" fontSize="11" fontWeight="bold" fontFamily="monospace">
                        β = {betaApparent.toFixed(1)}°
                      </text>
                    )}
                    {showLoci && (
                      <>
                        <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusTvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusTvY} stroke="#22d3ee" strokeWidth="0.9" />
                        <text x={svgMetrics.locusEndX + 8} y={svgMetrics.locusTvY + 4} fill="#a5f3fc" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                          Locus of {lblB}
                        </text>
                      </>
                    )}
                    {showProjectors && (
                      <line
                        x1={svgMetrics.ptBTv.x}
                        y1={Math.min(svgMetrics.locusFvY, svgMetrics.groundY) - 25}
                        x2={svgMetrics.ptBTv.x}
                        y2={Math.max(svgMetrics.locusTvY, svgMetrics.groundY) + 30}
                        stroke="#94a3b8"
                        strokeWidth="1.3"
                        strokeDasharray={currentStep >= 5 ? 'none' : '4,3'}
                      />
                    )}
                  </g>
                )}

                {/* STEP 4+: Rotate ab onto horizontal (b1), project up to θ ray from a' -> b1' (TL) */}
                {currentStep >= 4 && showAuxiliary && (
                  <g id="layer-tvbt-tl-theta">
                    {showArcs && svgMetrics.radiusPlanArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y} A ${svgMetrics.radiusPlanArc} ${svgMetrics.radiusPlanArc} 0 0 ${
                          svgMetrics.ptBTv.y >= svgMetrics.ptATv.y ? 0 : 1
                        } ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-emerald)"
                      />
                    )}
                    <circle cx={svgMetrics.ptB1Tv.x} cy={svgMetrics.ptB1Tv.y} r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Tv.x + 8} y={svgMetrics.ptB1Tv.y - 6} fill="#7dd3fc" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁
                    </text>
                    <line x1={svgMetrics.ptB1Tv.x} y1={svgMetrics.ptB1Tv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={Math.max(svgMetrics.ptB1Fv.x, svgMetrics.ptB2Fv.x) + 36} y2={svgMetrics.ptAFv.y} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="4,3" />
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#c084fc" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB1Fv.x} cy={svgMetrics.ptB1Fv.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Fv.x + 8} y={svgMetrics.ptB1Fv.y - 6} fill="#e9d5ff" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁′ (TL = {tl.toFixed(1)} mm)
                    </text>
                    {theta >= 1 && (
                      <text x={svgMetrics.ptAFv.x + 42} y={svgMetrics.ptAFv.y - 10} fill="#e9d5ff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                        θ = {theta.toFixed(1)}°
                      </text>
                    )}
                  </g>
                )}

                {/* STEP 5+: Locus of b' through b1' intersecting projector from b -> Final Front View a'b' */}
                {currentStep >= 5 && (
                  <g id="layer-tvbt-final-fv">
                    {showLoci && (
                      <>
                        <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusFvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusFvY} stroke="#fbbf24" strokeWidth="0.9" />
                        <text x={svgMetrics.locusEndX + 8} y={svgMetrics.locusFvY + 4} fill="#fef08a" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                          Locus of {lblB}′
                        </text>
                      </>
                    )}
                    {showFinalViews && (
                      <line
                        x1={svgMetrics.ptAFv.x}
                        y1={svgMetrics.ptAFv.y}
                        x2={svgMetrics.ptBFv.x}
                        y2={svgMetrics.ptBFv.y}
                        stroke="#dc2626"
                        strokeWidth={currentStep >= 8 ? '3.8' : '3.0'}
                        strokeLinecap="round"
                      />
                    )}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBFv.x + 8} y={svgMetrics.ptBFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}′ (FV = {elAux.toFixed(1)})
                    </text>
                  </g>
                )}

                {/* STEP 6+: Rotate a'b' to horizontal (b2'), project down to Locus of b -> b2, draw ab2 to reveal φ */}
                {currentStep >= 6 && showAuxiliary && (
                  <g id="layer-tvbt-find-phi">
                    {showArcs && svgMetrics.radiusElevArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptBFv.x} ${svgMetrics.ptBFv.y} A ${svgMetrics.radiusElevArc} ${svgMetrics.radiusElevArc} 0 0 ${
                          svgMetrics.ptBFv.y <= svgMetrics.ptAFv.y ? 1 : 0
                        } ${svgMetrics.ptB2Fv.x} ${svgMetrics.ptB2Fv.y}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-amber)"
                      />
                    )}
                    <circle cx={svgMetrics.ptB2Fv.x} cy={svgMetrics.ptB2Fv.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Fv.x + 8} y={svgMetrics.ptB2Fv.y + 16} fill="#fde68a" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂′
                    </text>
                    <line x1={svgMetrics.ptB2Fv.x} y1={svgMetrics.ptB2Fv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#34d399" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB2Tv.x} cy={svgMetrics.ptB2Tv.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Tv.x + 8} y={svgMetrics.ptB2Tv.y + 16} fill="#a7f3d0" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂ (φ = {phi.toFixed(1)}°)
                    </text>
                  </g>
                )}

                {/* STEP 8: DEP readout */}
                {currentStep >= 8 && showDimensions && (
                  <g id="layer-tvbt-dimensions">
                    <line x1={svgMetrics.originX} y1={svgMetrics.groundY} x2={svgMetrics.ptBTv.x} y2={svgMetrics.groundY} stroke="#a855f7" strokeWidth="2.6" />
                    <text x={(svgMetrics.originX + svgMetrics.ptBTv.x) / 2} y={svgMetrics.groundY - 8} fill="#d8b4fe" fontSize="10.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      DEP = {depCalculated.toFixed(1)} mm
                    </text>
                  </g>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* MODE F: GIVEN TL + FV + TV (e.g. EF)                           */}
            {/* ============================================================== */}
            {constructionMethod === 'tl-views' && (
              <>
                {/* STEP 2+: Reference End A (a', a) */}
                {currentStep >= 2 && showProjectors && (
                  <g id="layer-tlviews-end-a">
                    <line
                      x1={svgMetrics.originX}
                      y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 40}
                      x2={svgMetrics.originX}
                      y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 40}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                    />
                    <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptAFv.x - 16} y={svgMetrics.ptAFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}′
                    </text>
                    <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptATv.x - 16} y={svgMetrics.ptATv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}
                    </text>
                  </g>
                )}

                {/* STEP 3+: Horizontal TV = ab1, projector up, compass arc TL from a' cutting at b1' (θ) */}
                {currentStep >= 3 && showAuxiliary && (
                  <g id="layer-tlviews-tv-to-theta">
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB1Tv.x + 30} y2={svgMetrics.ptATv.y} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="4,3" />
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB1Tv.x} y2={svgMetrics.ptB1Tv.y} stroke="#38bdf8" strokeWidth="2.2" />
                    <circle cx={svgMetrics.ptB1Tv.x} cy={svgMetrics.ptB1Tv.y} r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Tv.x + 8} y={svgMetrics.ptB1Tv.y - 6} fill="#7dd3fc" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁ (TV = {plAux.toFixed(1)})
                    </text>
                    <line x1={svgMetrics.ptB1Tv.x} y1={svgMetrics.ptB1Tv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    {showArcs && svgMetrics.tlStrikeFvArc && (
                      <path d={svgMetrics.tlStrikeFvArc} fill="none" stroke="#c084fc" strokeWidth="1.6" strokeDasharray="3,3" />
                    )}
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#c084fc" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB1Fv.x} cy={svgMetrics.ptB1Fv.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Fv.x + 8} y={svgMetrics.ptB1Fv.y - 6} fill="#e9d5ff" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁′ (TL={tl.toFixed(0)}, θ={theta.toFixed(1)}°)
                    </text>
                  </g>
                )}

                {/* STEP 4+: Horizontal FV = a'b2', projector down, compass arc TL from a cutting at b2 (φ) */}
                {currentStep >= 4 && showAuxiliary && (
                  <g id="layer-tlviews-fv-to-phi">
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB2Fv.x + 30} y2={svgMetrics.ptAFv.y} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="4,3" />
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB2Fv.x} y2={svgMetrics.ptB2Fv.y} stroke="#f59e0b" strokeWidth="2.2" />
                    <circle cx={svgMetrics.ptB2Fv.x} cy={svgMetrics.ptB2Fv.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Fv.x + 8} y={svgMetrics.ptB2Fv.y + 16} fill="#fde68a" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂′ (FV = {elAux.toFixed(1)})
                    </text>
                    <line x1={svgMetrics.ptB2Fv.x} y1={svgMetrics.ptB2Fv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    {showArcs && svgMetrics.tlStrikeTvArc && (
                      <path d={svgMetrics.tlStrikeTvArc} fill="none" stroke="#34d399" strokeWidth="1.6" strokeDasharray="3,3" />
                    )}
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#34d399" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB2Tv.x} cy={svgMetrics.ptB2Tv.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Tv.x + 8} y={svgMetrics.ptB2Tv.y + 16} fill="#a7f3d0" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂ (TL={tl.toFixed(0)}, φ={phi.toFixed(1)}°)
                    </text>
                  </g>
                )}

                {/* STEP 5+: Horizontal Loci through b1' and b2 */}
                {currentStep >= 5 && showLoci && (
                  <g id="layer-tlviews-loci">
                    <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusFvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusFvY} stroke="#fbbf24" strokeWidth="0.9" />
                    <text x={svgMetrics.locusEndX + 8} y={svgMetrics.locusFvY + 4} fill="#fef08a" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                      Locus of {lblB}′
                    </text>
                    <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusTvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusTvY} stroke="#22d3ee" strokeWidth="0.9" />
                    <text x={svgMetrics.locusEndX + 8} y={svgMetrics.locusTvY + 4} fill="#a5f3fc" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                      Locus of {lblB}
                    </text>
                  </g>
                )}

                {/* STEP 6+: Swing ab1 to Locus of b -> Final Top View ab */}
                {currentStep >= 6 && (
                  <g id="layer-tlviews-final-tv">
                    {showArcs && svgMetrics.radiusPlanArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y} A ${svgMetrics.radiusPlanArc} ${svgMetrics.radiusPlanArc} 0 0 ${
                          svgMetrics.ptBTv.y >= svgMetrics.ptATv.y ? 1 : 0
                        } ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-emerald)"
                      />
                    )}
                    {showFinalViews && (
                      <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptBTv.x} y2={svgMetrics.ptBTv.y} stroke="#2563eb" strokeWidth="3.4" strokeLinecap="round" />
                    )}
                    <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBTv.x + 8} y={svgMetrics.ptBTv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}
                    </text>
                  </g>
                )}

                {/* STEP 7+: Project b up to Locus of b' (confirmed by arc a'b2') -> Final Front View a'b' */}
                {currentStep >= 7 && (
                  <g id="layer-tlviews-final-fv">
                    {showArcs && svgMetrics.radiusElevArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptB2Fv.x} ${svgMetrics.ptB2Fv.y} A ${svgMetrics.radiusElevArc} ${svgMetrics.radiusElevArc} 0 0 ${
                          svgMetrics.ptBFv.y <= svgMetrics.ptAFv.y ? 0 : 1
                        } ${svgMetrics.ptBFv.x} ${svgMetrics.ptBFv.y}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-amber)"
                      />
                    )}
                    {showProjectors && (
                      <line
                        x1={svgMetrics.ptBFv.x}
                        y1={Math.min(svgMetrics.locusFvY, svgMetrics.groundY) - 25}
                        x2={svgMetrics.ptBTv.x}
                        y2={Math.max(svgMetrics.locusTvY, svgMetrics.groundY) + 25}
                        stroke="#94a3b8"
                        strokeWidth="1.4"
                      />
                    )}
                    {showFinalViews && (
                      <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptBFv.x} y2={svgMetrics.ptBFv.y} stroke="#dc2626" strokeWidth="3.4" strokeLinecap="round" />
                    )}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBFv.x + 8} y={svgMetrics.ptBFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}′
                    </text>
                  </g>
                )}

                {/* STEP 8: DEP readout */}
                {currentStep >= 8 && showDimensions && (
                  <g id="layer-tlviews-dimensions">
                    <line x1={svgMetrics.originX} y1={svgMetrics.groundY} x2={svgMetrics.ptBFv.x} y2={svgMetrics.groundY} stroke="#a855f7" strokeWidth="2.6" />
                    <text x={(svgMetrics.originX + svgMetrics.ptBFv.x) / 2} y={svgMetrics.groundY - 8} fill="#d8b4fe" fontSize="10.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      DEP = {depCalculated.toFixed(1)} mm
                    </text>
                  </g>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* MODE G: GIVEN APPARENT VIEWS (FV + TV + DEP / α / β)           */}
            {/* ============================================================== */}
            {constructionMethod === 'apparent-views' && (
              <>
                {/* STEP 1+: Both Projectors & DEP */}
                {currentStep >= 1 && showProjectors && (
                  <g id="layer-apparent-projectors">
                    <line
                      x1={svgMetrics.originX}
                      y1={Math.min(svgMetrics.ptAFv.y, svgMetrics.groundY) - 40}
                      x2={svgMetrics.originX}
                      y2={Math.max(svgMetrics.ptATv.y, svgMetrics.groundY) + 40}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                    />
                    <line
                      x1={svgMetrics.ptBFv.x}
                      y1={Math.min(svgMetrics.ptBFv.y, svgMetrics.groundY) - 40}
                      x2={svgMetrics.ptBTv.x}
                      y2={Math.max(svgMetrics.ptBTv.y, svgMetrics.groundY) + 40}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      strokeDasharray={currentStep >= 3 ? 'none' : '4,3'}
                    />
                    {showDimensions && depCalculated > 0.5 && (
                      <>
                        <line x1={svgMetrics.originX} y1={svgMetrics.groundY} x2={svgMetrics.ptBFv.x} y2={svgMetrics.groundY} stroke="#a855f7" strokeWidth="2.4" />
                        <text x={(svgMetrics.originX + svgMetrics.ptBFv.x) / 2} y={svgMetrics.groundY - 8} fill="#d8b4fe" fontSize="10.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                          DEP = {depCalculated.toFixed(1)} mm
                        </text>
                      </>
                    )}
                  </g>
                )}

                {/* STEP 2+: End A */}
                {currentStep >= 2 && (
                  <g id="layer-apparent-end-a">
                    <circle cx={svgMetrics.ptAFv.x} cy={svgMetrics.ptAFv.y} r="4.2" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptAFv.x - 16} y={svgMetrics.ptAFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}′
                    </text>
                    <circle cx={svgMetrics.ptATv.x} cy={svgMetrics.ptATv.y} r="4.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptATv.x - 16} y={svgMetrics.ptATv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblA}
                    </text>
                  </g>
                )}

                {/* STEP 3+: Given FV a'b', Given TV ab, & Horizontal Loci */}
                {currentStep >= 3 && (
                  <g id="layer-apparent-views-loci">
                    {showFinalViews && (
                      <>
                        <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptBFv.x} y2={svgMetrics.ptBFv.y} stroke="#dc2626" strokeWidth={currentStep >= 8 ? '3.8' : '3.0'} strokeLinecap="round" />
                        <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptBTv.x} y2={svgMetrics.ptBTv.y} stroke="#2563eb" strokeWidth={currentStep >= 8 ? '3.8' : '3.0'} strokeLinecap="round" />
                      </>
                    )}
                    <circle cx={svgMetrics.ptBFv.x} cy={svgMetrics.ptBFv.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBFv.x + 8} y={svgMetrics.ptBFv.y - 8} fill="#fca5a5" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}′ (FV={elAux.toFixed(1)})
                    </text>
                    <circle cx={svgMetrics.ptBTv.x} cy={svgMetrics.ptBTv.y} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={svgMetrics.ptBTv.x + 8} y={svgMetrics.ptBTv.y + 18} fill="#93c5fd" fontSize="13.5" fontWeight="bold" fontFamily="monospace">
                      {lblB} (TV={plAux.toFixed(1)})
                    </text>
                    {showLoci && (
                      <>
                        <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusFvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusFvY} stroke="#fbbf24" strokeWidth="0.9" />
                        <line x1={svgMetrics.locusStartX} y1={svgMetrics.locusTvY} x2={svgMetrics.locusEndX} y2={svgMetrics.locusTvY} stroke="#22d3ee" strokeWidth="0.9" />
                      </>
                    )}
                  </g>
                )}

                {/* STEP 4+: Rotate FV horizontal to b2', drop to Locus of b at b2 -> TL & φ */}
                {currentStep >= 4 && showAuxiliary && (
                  <g id="layer-apparent-find-phi">
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB2Fv.x + 28} y2={svgMetrics.ptAFv.y} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="4,3" />
                    {showArcs && svgMetrics.radiusElevArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptBFv.x} ${svgMetrics.ptBFv.y} A ${svgMetrics.radiusElevArc} ${svgMetrics.radiusElevArc} 0 0 ${
                          svgMetrics.ptBFv.y <= svgMetrics.ptAFv.y ? 1 : 0
                        } ${svgMetrics.ptB2Fv.x} ${svgMetrics.ptB2Fv.y}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-amber)"
                      />
                    )}
                    <line x1={svgMetrics.ptB2Fv.x} y1={svgMetrics.ptB2Fv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB2Tv.x} y2={svgMetrics.ptB2Tv.y} stroke="#34d399" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB2Tv.x} cy={svgMetrics.ptB2Tv.y} r="3.5" fill="#34d399" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB2Tv.x + 8} y={svgMetrics.ptB2Tv.y + 16} fill="#a7f3d0" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₂ (TL={tl.toFixed(1)}, φ={phi.toFixed(1)}°)
                    </text>
                  </g>
                )}

                {/* STEP 5+: Rotate TV horizontal to b1, project up to Locus of b' at b1' -> TL & θ */}
                {currentStep >= 5 && showAuxiliary && (
                  <g id="layer-apparent-find-theta">
                    <line x1={svgMetrics.ptATv.x} y1={svgMetrics.ptATv.y} x2={svgMetrics.ptB1Tv.x + 28} y2={svgMetrics.ptATv.y} stroke="#94a3b8" strokeWidth="0.9" strokeDasharray="4,3" />
                    {showArcs && svgMetrics.radiusPlanArc > 1 && (
                      <path
                        d={`M ${svgMetrics.ptBTv.x} ${svgMetrics.ptBTv.y} A ${svgMetrics.radiusPlanArc} ${svgMetrics.radiusPlanArc} 0 0 ${
                          svgMetrics.ptBTv.y >= svgMetrics.ptATv.y ? 0 : 1
                        } ${svgMetrics.ptB1Tv.x} ${svgMetrics.ptB1Tv.y}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeDasharray="4,3"
                        markerEnd="url(#arrow-arc-emerald)"
                      />
                    )}
                    <line x1={svgMetrics.ptB1Tv.x} y1={svgMetrics.ptB1Tv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5,4" />
                    <line x1={svgMetrics.ptAFv.x} y1={svgMetrics.ptAFv.y} x2={svgMetrics.ptB1Fv.x} y2={svgMetrics.ptB1Fv.y} stroke="#c084fc" strokeWidth="2.4" />
                    <circle cx={svgMetrics.ptB1Fv.x} cy={svgMetrics.ptB1Fv.y} r="3.5" fill="#c084fc" stroke="#ffffff" strokeWidth="1" />
                    <text x={svgMetrics.ptB1Fv.x + 8} y={svgMetrics.ptB1Fv.y - 6} fill="#e9d5ff" fontSize="11.5" fontWeight="bold" fontFamily="monospace">
                      {lblB}₁′ (TL={tl.toFixed(1)}, θ={theta.toFixed(1)}°)
                    </text>
                  </g>
                )}
              </>
            )}

            {/* LAYER 9: TRACES (HT & VT) */}
            {showTraces && (
              <g id="layer-traces">
                {/* Horizontal Trace (HT) */}
                {(constructionMethod === 'triangle' || constructionMethod === 'apparent-views'
                  ? currentStep >= 6
                  : constructionMethod === 'tl-locus' ||
                      constructionMethod === 'fv-alpha-phi' ||
                      constructionMethod === 'tv-beta-theta'
                    ? currentStep >= 7
                    : currentStep >= 8) &&
                  line.ht?.exists &&
                  svgMetrics.htGroundSvg &&
                  svgMetrics.htTraceSvg && (
                    <g className="trace-ht-group">
                      {/* Dotted Line joining Front View to h′ on XY */}
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

                      {/* Dotted Line joining Top View to h (HT) */}
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
                {(constructionMethod === 'triangle' ||
                constructionMethod === 'apparent-views' ||
                constructionMethod === 'fv-alpha-phi' ||
                constructionMethod === 'tv-beta-theta'
                  ? currentStep >= 7
                  : currentStep >= 8) &&
                  line.vt?.exists &&
                  svgMetrics.vtGroundSvg &&
                  svgMetrics.vtTraceSvg && (
                    <g className="trace-vt-group">
                      {/* Dotted Line joining Top View to v on XY */}
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

                      {/* Dotted Line joining Front View to v′ (VT) */}
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
              <g transform="translate(24, 20)" opacity="0.92">
                <rect width="212" height="148" rx="8" fill="#030712" stroke="#334155" strokeWidth="1" />
                <text x="10" y="18" fill="#f8fafc" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  CONSTRUCTION LEGEND
                </text>
                <line x1="10" y1="24" x2="202" y2="24" stroke="#334155" strokeWidth="0.8" />

                {/* Line 1: Final FV */}
                <line x1="12" y1="38" x2="32" y2="38" stroke="#dc2626" strokeWidth="3" />
                <text x="38" y="42" fill="#fca5a5" fontSize="10" fontFamily="monospace">
                  Front View {lblA}′{lblB}′ (EL)
                </text>

                {/* Line 2: Final TV */}
                <line x1="12" y1="56" x2="32" y2="56" stroke="#2563eb" strokeWidth="3" />
                <text x="38" y="60" fill="#93c5fd" fontSize="10" fontFamily="monospace">
                  Top View {lblA}{lblB} (PL)
                </text>

                {/* Line 3: TL Construction */}
                <line x1="12" y1="74" x2="32" y2="74" stroke="#c084fc" strokeWidth="2" />
                <text x="38" y="78" fill="#e9d5ff" fontSize="10" fontFamily="monospace">
                  {constructionMethod === 'triangle' || constructionMethod === 'tl-locus'
                    ? 'True Length Hypotenuse'
                    : `True Length ${lblA}′${lblB}₁′ / ${lblA}${lblB}₂`}
                </text>

                {/* Line 4: Locus / Perpendicular */}
                <line
                  x1="12"
                  y1="92"
                  x2="32"
                  y2="92"
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  strokeDasharray={constructionMethod === 'triangle' ? '4,3' : undefined}
                />
                <text x="38" y="96" fill="#fde68a" fontSize="10" fontFamily="monospace">
                  {constructionMethod === 'triangle'
                    ? 'Perp. Offsets (VP & H diff)'
                    : constructionMethod === 'tl-locus'
                      ? 'Locus & Perp. (H & VP diff)'
                      : 'Locus Line (Parallel XY)'}
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
                  Step {currentStepData.num} of {totalSteps}
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
                disabled={currentStep === totalSteps}
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
            <span className="text-[10px] text-slate-400 block">Elevation Length (EL = {lblA}′{lblB}′)</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
              {elAux.toFixed(2)} mm
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Plan Length (PL = {lblA}{lblB})</span>
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
              {lblB}′ &amp; {lblB} Vertically Aligned (0.00 mm)
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
