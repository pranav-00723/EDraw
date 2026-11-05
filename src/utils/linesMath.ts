/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LineProblemInput, ComputedLine, SampleLineProblem, LineOrientationType, TracePoint, QuadrantSolutionItem } from '../types/lines';
import { HpRelation, VpRelation } from '../types/projection';

export function computeLineProjection(input: LineProblemInput): ComputedLine {
  const { nameA, nameB, color, mode, endA } = input;

  // 1. Calculate End A Coordinates in 3D (mm)
  // X: along XY axis (A starts at reference 0)
  // Y: distance from VP (+ in front, - behind, 0 on)
  // Z: distance from HP (+ above, - below, 0 on)
  const xA = 0;
  let yA = 0;
  if (endA.vpRelation === 'IN_FRONT') yA = endA.distanceVp;
  else if (endA.vpRelation === 'BEHIND') yA = -endA.distanceVp;

  let zA = 0;
  if (endA.hpRelation === 'ABOVE') zA = endA.distanceHp;
  else if (endA.hpRelation === 'BELOW') zA = -endA.distanceHp;

  let xB = 0;
  let yB = 0;
  let zB = 0;
  let trueLength = 0;
  let thetaDeg = 0;
  let phiDeg = 0;
  let validAngleSum = true;
  let isSolvedFromApparent = false;
  let apparentSolutionData: ComputedLine['apparentSolution'] = undefined;

  if (mode === 'END_POINTS') {
    const { endB, dep } = input;
    xB = Math.max(0, dep);

    if (endB.vpRelation === 'IN_FRONT') yB = endB.distanceVp;
    else if (endB.vpRelation === 'BEHIND') yB = -endB.distanceVp;
    else yB = 0;

    if (endB.hpRelation === 'ABOVE') zB = endB.distanceHp;
    else if (endB.hpRelation === 'BELOW') zB = -endB.distanceHp;
    else zB = 0;

    const dx = xB - xA;
    const dy = yB - yA;
    const dz = zB - zA;

    trueLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (trueLength > 1e-4) {
      // True angle with HP: sin(theta) = |dz| / TL
      const sinTheta = Math.min(1, Math.abs(dz) / trueLength);
      thetaDeg = (Math.asin(sinTheta) * 180) / Math.PI;

      // True angle with VP: sin(phi) = |dy| / TL
      const sinPhi = Math.min(1, Math.abs(dy) / trueLength);
      phiDeg = (Math.asin(sinPhi) * 180) / Math.PI;
    }
  } else if (mode === 'APPARENT_VALUES') {
    // Mode where True Length is NOT given and is solved from Apparent Lengths & Projectors/Angles
    isSolvedFromApparent = true;
    const EL = Math.max(1, input.frontViewLength || 70);
    const PL = Math.max(1, input.topViewLength || 60);

    let dep = Math.max(0, input.dep !== undefined ? input.dep : 40);
    if (input.apparentInputType === 'LENGTHS_ANGLES') {
      if (input.alphaDeg !== undefined && input.alphaDeg > 0 && input.alphaDeg < 90) {
        dep = EL * Math.cos((input.alphaDeg * Math.PI) / 180);
      } else if (input.betaDeg !== undefined && input.betaDeg > 0 && input.betaDeg < 90) {
        dep = PL * Math.cos((input.betaDeg * Math.PI) / 180);
      }
    }

    // Geometry validation: in orthographic projection, DEP <= min(EL, PL)
    const maxPossibleDep = Math.min(EL, PL);
    const effectiveDep = Math.min(dep, maxPossibleDep);

    const deltaZSquared = Math.max(0, EL * EL - effectiveDep * effectiveDep);
    const deltaYSquared = Math.max(0, PL * PL - effectiveDep * effectiveDep);
    const absDz = Math.sqrt(deltaZSquared);
    const absDy = Math.sqrt(deltaYSquared);

    // True Length: TL^2 = DEP^2 + deltaY^2 + deltaZ^2 = EL^2 + deltaY^2 = PL^2 + deltaZ^2
    trueLength = Math.sqrt(effectiveDep * effectiveDep + deltaYSquared + deltaZSquared);

    if (trueLength > 1e-4) {
      thetaDeg = (Math.asin(Math.min(1, absDz / trueLength)) * 180) / Math.PI;
      phiDeg = (Math.asin(Math.min(1, absDy / trueLength)) * 180) / Math.PI;
    }

    const alphaCalc = EL > 1e-4 ? (Math.acos(Math.min(1, effectiveDep / EL)) * 180) / Math.PI : 0;
    const betaCalc = PL > 1e-4 ? (Math.acos(Math.min(1, effectiveDep / PL)) * 180) / Math.PI : 0;

    // Calculate solutions for ALL 4 quadrants (i, ii, iii, iv) for point B
    // i) 1st Quadrant: Above HP (z > 0), In Front of VP (y > 0)
    // ii) 2nd Quadrant: Above HP (z > 0), Behind VP (y < 0)
    // iii) 3rd Quadrant: Below HP (z < 0), Behind VP (y < 0)
    // iv) 4th Quadrant: Below HP (z < 0), In Front of VP (y > 0)
    const zB_above = zA + absDz;
    const zB_below = zA - absDz;
    const yB_front = yA + absDy;
    const yB_behind = yA - absDy;

    const quadSolutions: QuadrantSolutionItem[] = [
      {
        quadrantKey: 'FIRST',
        quadrantLabel: 'First Quadrant (i)',
        quadrantNum: 'i',
        hpRelation: 'ABOVE',
        distHp: Math.abs(zB_above),
        vpRelation: 'IN_FRONT',
        distVp: Math.abs(yB_front),
        summary: `${Math.abs(zB_above).toFixed(2)} mm Above HP & ${Math.abs(yB_front).toFixed(2)} mm In Front of VP`,
        zB: zB_above,
        yB: yB_front,
      },
      {
        quadrantKey: 'SECOND',
        quadrantLabel: 'Second Quadrant (ii)',
        quadrantNum: 'ii',
        hpRelation: 'ABOVE',
        distHp: Math.abs(zB_above),
        vpRelation: yB_behind >= 0 ? 'IN_FRONT' : 'BEHIND',
        distVp: Math.abs(yB_behind),
        summary: `${Math.abs(zB_above).toFixed(2)} mm Above HP & ${Math.abs(yB_behind).toFixed(2)} mm ${yB_behind >= 0 ? 'In Front of VP' : 'Behind VP'}`,
        zB: zB_above,
        yB: yB_behind,
      },
      {
        quadrantKey: 'THIRD',
        quadrantLabel: 'Third Quadrant (iii)',
        quadrantNum: 'iii',
        hpRelation: zB_below >= 0 ? 'ABOVE' : 'BELOW',
        distHp: Math.abs(zB_below),
        vpRelation: yB_behind >= 0 ? 'IN_FRONT' : 'BEHIND',
        distVp: Math.abs(yB_behind),
        summary: `${Math.abs(zB_below).toFixed(2)} mm ${zB_below >= 0 ? 'Above HP' : 'Below HP'} & ${Math.abs(yB_behind).toFixed(2)} mm ${yB_behind >= 0 ? 'In Front of VP' : 'Behind VP'}`,
        zB: zB_below,
        yB: yB_behind,
      },
      {
        quadrantKey: 'FOURTH',
        quadrantLabel: 'Fourth Quadrant (iv)',
        quadrantNum: 'iv',
        hpRelation: zB_below >= 0 ? 'ABOVE' : 'BELOW',
        distHp: Math.abs(zB_below),
        vpRelation: 'IN_FRONT',
        distVp: Math.abs(yB_front),
        summary: `${Math.abs(zB_below).toFixed(2)} mm ${zB_below >= 0 ? 'Above HP' : 'Below HP'} & ${Math.abs(yB_front).toFixed(2)} mm In Front of VP`,
        zB: zB_below,
        yB: yB_front,
      },
    ];

    // Pick for the user's actively selected quadrant
    const target = input.targetQuadrantB || 'FIRST';
    const activeSolution = quadSolutions.find((q) => q.quadrantKey === target) || quadSolutions[0];

    xB = xA + effectiveDep;
    yB = activeSolution.yB;
    zB = activeSolution.zB;

    apparentSolutionData = {
      el: EL,
      pl: PL,
      dep: effectiveDep,
      deltaZ: absDz,
      deltaY: absDy,
      calculatedTL: trueLength,
      thetaDeg,
      phiDeg,
      alphaDeg: alphaCalc,
      betaDeg: betaCalc,
      quadrantSolutions: quadSolutions,
    };
  } else {
    // TRUE_LENGTH_ANGLES mode
    trueLength = Math.max(1, input.trueLength);
    thetaDeg = Math.max(0, Math.min(90, input.thetaDeg));
    phiDeg = Math.max(0, Math.min(90, input.phiDeg));

    const thetaRad = (thetaDeg * Math.PI) / 180;
    const phiRad = (phiDeg * Math.PI) / 180;

    const sin2Theta = Math.sin(thetaRad) * Math.sin(thetaRad);
    const sin2Phi = Math.sin(phiRad) * Math.sin(phiRad);

    if (sin2Theta + sin2Phi > 1.0001) {
      validAngleSum = false;
    }

    const absDz = trueLength * Math.sin(thetaRad);
    const absDy = trueLength * Math.sin(phiRad);

    // dx^2 = TL^2 - dy^2 - dz^2
    const dxSquared = Math.max(0, trueLength * trueLength - absDy * absDy - absDz * absDz);
    const dx = Math.sqrt(dxSquared);

    const signZ = input.endBQuadrant.startsWith('BELOW') ? -1 : 1;
    const signY = input.endBQuadrant.endsWith('BEHIND') ? -1 : 1;

    zB = zA + signZ * absDz;
    yB = yA + signY * absDy;
    xB = xA + dx;
  }

  const deltaX = xB - xA;
  const deltaY = yB - yA;
  const deltaZ = zB - zA;

  // Front View Length (Elevation Length, EL) = sqrt(dx^2 + dz^2)
  const frontViewLength = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

  // Top View Length (Plan Length, PL) = sqrt(dx^2 + dy^2)
  const topViewLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Apparent angle with XY in Front View (alpha)
  let alphaDeg = 0;
  if (deltaX === 0 && Math.abs(deltaZ) > 1e-4) {
    alphaDeg = 90;
  } else if (frontViewLength > 1e-4) {
    alphaDeg = (Math.atan2(Math.abs(deltaZ), Math.abs(deltaX)) * 180) / Math.PI;
  }

  // Apparent angle with XY in Top View (beta)
  let betaDeg = 0;
  if (deltaX === 0 && Math.abs(deltaY) > 1e-4) {
    betaDeg = 90;
  } else if (topViewLength > 1e-4) {
    betaDeg = (Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180) / Math.PI;
  }

  // 2D Orthographic Coordinates relative to XY line (mm)
  // Convention:
  // Front View (a', b'):
  // Height = +zA, +zB (above XY for positive z, below XY for negative z)
  // Top View (a, b):
  // When HP rotates 90 deg clockwise around XY:
  // Points in front of VP (+y) fall BELOW XY (y_2D = -y)
  // Points behind VP (-y) fall ABOVE XY (y_2D = -(-y) = +|y|)
  const isHiddenA = !!input.hiddenA;
  const isHiddenB = !!input.hiddenB;

  const isPerpHP =
    Math.abs(thetaDeg - 90) < 0.5 ||
    (Math.abs(deltaX) < 1e-4 && Math.abs(deltaY) < 1e-4 && Math.abs(deltaZ) > 1e-4);
  const isPerpVP =
    Math.abs(phiDeg - 90) < 0.5 ||
    (Math.abs(deltaX) < 1e-4 && Math.abs(deltaZ) < 1e-4 && Math.abs(deltaY) > 1e-4);

  const rawAFv = `${nameA.toLowerCase()}′`;
  const rawATv = `${nameA.toLowerCase()}`;
  const rawBFv = `${nameB.toLowerCase()}′`;
  const rawBTv = `${nameB.toLowerCase()}`;
  const rawB1Fv = `${nameB.toLowerCase()}₁′`;
  const rawB2Tv = `${nameB.toLowerCase()}₂`;

  // For Line Perpendicular to HP:
  // Looking from above, the point with higher elevation (zA vs zB) is visible,
  // and the lower point is hidden underneath, rendered in standard bracket notation e.g. a(b)
  let topViewCombinedLabel = rawATv;
  if (isPerpHP) {
    topViewCombinedLabel =
      zA >= zB
        ? `${nameA.toLowerCase()}(${nameB.toLowerCase()})`
        : `${nameB.toLowerCase()}(${nameA.toLowerCase()})`;
  }

  // For Line Perpendicular to VP:
  // Looking from front, the point further in front of VP (yA vs yB) is visible,
  // and the point behind is hidden behind it, rendered as a′(b′)
  let frontViewCombinedLabel = rawAFv;
  if (isPerpVP) {
    frontViewCombinedLabel =
      yA >= yB
        ? `${nameA.toLowerCase()}′(${nameB.toLowerCase()}′)`
        : `${nameB.toLowerCase()}′(${nameA.toLowerCase()}′)`;
  }

  const aFront = {
    x: xA,
    y: zA,
    label: isPerpVP ? frontViewCombinedLabel : isHiddenA ? `(${rawAFv})` : rawAFv,
  };
  const bFront = {
    x: xB,
    y: zB,
    label: isPerpVP ? frontViewCombinedLabel : isHiddenB ? `(${rawBFv})` : rawBFv,
  };

  const aTop = {
    x: xA,
    y: -yA,
    label: isPerpHP ? topViewCombinedLabel : isHiddenA ? `(${rawATv})` : rawATv,
  };
  const bTop = {
    x: xB,
    y: -yB,
    label: isPerpHP ? topViewCombinedLabel : isHiddenB ? `(${rawBTv})` : rawBTv,
  };

  // Rotating Line Method Arc Destinations (True Length representations)
  // b1': In front view on locus of b' (y = zB) at distance PL along x from A
  // because TL^2 = PL^2 + deltaZ^2
  const b1Front = {
    x: xA + topViewLength,
    y: zB,
    label: isHiddenB ? `(${rawB1Fv})` : rawB1Fv,
  };

  // b2: In top view on locus of b (y = -yB) at distance EL along x from A
  // because TL^2 = EL^2 + deltaY^2
  const b2Top = {
    x: xA + frontViewLength,
    y: -yB,
    label: isHiddenB ? `(${rawB2Tv})` : rawB2Tv,
  };

  // Calculate Traces (HT and VT)
  // 1. Horizontal Trace (HT) - intersection with HP (z = 0)
  let ht: TracePoint;
  if (Math.abs(deltaZ) < 1e-5) {
    // Line parallel to HP
    ht = {
      exists: false,
      type: 'HT',
      x: 0,
      y: 0,
      z: 0,
      groundProj: { x: 0, y: 0, label: "h′" },
      traceProj: { x: 0, y: 0, label: 'h (HT)' },
      description: 'Line is parallel to HP, so there is no Horizontal Trace (HT).',
    };
  } else {
    // z(t) = zA + t * deltaZ = 0 => t = -zA / deltaZ
    const tHT = -zA / deltaZ;
    const xHT = xA + tHT * deltaX;
    const yHT = yA + tHT * deltaY;
    ht = {
      exists: true,
      type: 'HT',
      x: xHT,
      y: yHT,
      z: 0,
      groundProj: { x: xHT, y: 0, label: "h′" },
      traceProj: { x: xHT, y: -yHT, label: 'h (HT)' },
      description: `HT lies on HP at (${xHT.toFixed(1)}, ${yHT.toFixed(1)}, 0). In 2D, h′ is on XY, and h (HT) is ${Math.abs(yHT).toFixed(1)} mm ${yHT >= 0 ? 'below' : 'above'} XY.`,
    };
  }

  // 2. Vertical Trace (VT) - intersection with VP (y = 0)
  let vt: TracePoint;
  if (Math.abs(deltaY) < 1e-5) {
    // Line parallel to VP
    vt = {
      exists: false,
      type: 'VT',
      x: 0,
      y: 0,
      z: 0,
      groundProj: { x: 0, y: 0, label: 'v' },
      traceProj: { x: 0, y: 0, label: "v′ (VT)" },
      description: 'Line is parallel to VP, so there is no Vertical Trace (VT).',
    };
  } else {
    // y(t) = yA + t * deltaY = 0 => t = -yA / deltaY
    const tVT = -yA / deltaY;
    const xVT = xA + tVT * deltaX;
    const zVT = zA + tVT * deltaZ;
    vt = {
      exists: true,
      type: 'VT',
      x: xVT,
      y: 0,
      z: zVT,
      groundProj: { x: xVT, y: 0, label: 'v' },
      traceProj: { x: xVT, y: zVT, label: "v′ (VT)" },
      description: `VT lies on VP at (${xVT.toFixed(1)}, 0, ${zVT.toFixed(1)}). In 2D, v is on XY, and v′ (VT) is ${Math.abs(zVT).toFixed(1)} mm ${zVT >= 0 ? 'above' : 'below'} XY.`,
    };
  }

  // Orientation Classification
  const isThetaZero = thetaDeg < 0.5;
  const isPhiZero = phiDeg < 0.5;
  const isTheta90 = Math.abs(thetaDeg - 90) < 0.5;
  const isPhi90 = Math.abs(phiDeg - 90) < 0.5;

  let orientation: LineOrientationType = 'INCLINED_BOTH';
  let orientationTitle = 'Line Inclined to Both HP and VP';
  let orientationDesc =
    'General oblique line. Both front and top views are shorter than true length (EL < TL and PL < TL), and inclined to XY at apparent angles α and β.';

  if (isTheta90 || isPerpHP) {
    orientation = 'PERPENDICULAR_HP';
    orientationTitle = 'Line Perpendicular to HP & Parallel to VP';
    orientationDesc =
      'Front view (a′b′) shows True Length perpendicular to XY. Top view (a, b) reduces to a single coincident point with bracket notation a(b).';
  } else if (isPhi90 || isPerpVP) {
    orientation = 'PERPENDICULAR_VP';
    orientationTitle = 'Line Perpendicular to VP & Parallel to HP';
    orientationDesc =
      'Top view (ab) shows True Length perpendicular to XY. Front view (a′, b′) reduces to a single coincident point with bracket notation a′(b′).';
  } else if (isThetaZero && isPhiZero) {
    orientation = 'PARALLEL_BOTH';
    orientationTitle = 'Line Parallel to Both HP and VP';
    orientationDesc =
      'Both Front View (a′b′) and Top View (ab) are parallel to the XY line and show True Length (EL = PL = TL).';
  } else if (!isThetaZero && isPhiZero) {
    orientation = 'INCLINED_HP_PARALLEL_VP';
    orientationTitle = 'Line Inclined to HP & Parallel to VP';
    orientationDesc =
      'Front view (a′b′) shows True Length and true inclination θ. Top view (ab) is parallel to XY and shorter than True Length (PL = TL·cos θ).';
  } else if (isThetaZero && !isPhiZero) {
    orientation = 'INCLINED_VP_PARALLEL_HP';
    orientationTitle = 'Line Inclined to VP & Parallel to HP';
    orientationDesc =
      'Top view (ab) shows True Length and true inclination φ. Front view (a′b′) is parallel to XY and shorter than True Length (EL = TL·cos φ).';
  }

  return {
    id: `line-${Date.now()}`,
    nameA,
    nameB,
    color,
    input,
    hiddenA: isHiddenA,
    hiddenB: isHiddenB,
    xA,
    yA,
    zA,
    xB,
    yB,
    zB,
    trueLength,
    frontViewLength,
    topViewLength,
    dep: Math.abs(deltaX),
    thetaDeg,
    phiDeg,
    alphaDeg,
    betaDeg,
    aFront,
    bFront,
    aTop,
    bTop,
    b1Front,
    b2Top,
    ht,
    vt,
    orientation,
    orientationTitle,
    orientationDesc,
    calculations: {
      deltaX,
      deltaY,
      deltaZ,
      validAngleSum,
    },
    isSolvedFromApparent,
    apparentSolution: apparentSolutionData,
  };
}

export const SAMPLE_LINE_PROBLEMS: SampleLineProblem[] = [
  {
    id: 'sample-line-exam-apparent',
    title: 'Exam Standard: Line AB with Apparent Lengths (FV=70mm, TV=60mm, DEP=40mm)',
    difficulty: 'Exam Standard',
    badge: 'Classroom Exam Problem',
    description:
      'Point A is 30 mm above HP and 35 mm in front of VP. Length of Front View (a′b′) is 70 mm. Length of Top View (ab) is 60 mm. Distance between end projectors (DEP) is 40 mm. Find True Length (TL ≈ 83.1 mm), true inclinations (θ, φ), and find the position of point B if B is in: (i) First quadrant, (ii) Second quadrant, (iii) Third quadrant, (iv) Fourth quadrant.',
    input: {
      mode: 'APPARENT_VALUES',
      nameA: 'A',
      nameB: 'B',
      color: '#2563eb',
      endA: {
        name: 'A',
        hpRelation: 'ABOVE',
        distanceHp: 30,
        vpRelation: 'IN_FRONT',
        distanceVp: 35,
      },
      endB: {
        name: 'B',
        hpRelation: 'ABOVE',
        distanceHp: 87.45,
        vpRelation: 'IN_FRONT',
        distanceVp: 79.72,
      },
      dep: 40,
      trueLength: 83.07,
      thetaDeg: 43.75,
      phiDeg: 32.57,
      endBQuadrant: 'ABOVE_FRONT',
      frontViewLength: 70,
      topViewLength: 60,
      apparentInputType: 'LENGTHS_DEP',
      targetQuadrantB: 'FIRST',
    },
  },
  {
    id: 'sample-line-1',
    title: 'Line AB: Inclined to both HP (30°) & VP (45°)',
    difficulty: 'Exam Standard',
    badge: 'Standard Oblique',
    description:
      'A line AB of 80 mm length has End A 20 mm above HP and 30 mm in front of VP. The line is inclined at 30° to HP and 45° to VP. Draw its projections and find its apparent angles.',
    input: {
      mode: 'TRUE_LENGTH_ANGLES',
      nameA: 'A',
      nameB: 'B',
      color: '#2563eb',
      endA: {
        name: 'A',
        hpRelation: 'ABOVE',
        distanceHp: 20,
        vpRelation: 'IN_FRONT',
        distanceVp: 30,
      },
      endB: {
        name: 'B',
        hpRelation: 'ABOVE',
        distanceHp: 60,
        vpRelation: 'IN_FRONT',
        distanceVp: 86,
      },
      dep: 50,
      trueLength: 80,
      thetaDeg: 30,
      phiDeg: 45,
      endBQuadrant: 'ABOVE_FRONT',
    },
  },
  {
    id: 'sample-line-2',
    title: 'Line CD: Parallel to Both HP and VP',
    difficulty: 'Basic',
    badge: 'Parallel to XY',
    description:
      'A straight line CD of 75 mm length lies parallel to both HP and VP. It is 35 mm above HP and 40 mm in front of VP. Draw its projections.',
    input: {
      mode: 'END_POINTS',
      nameA: 'C',
      nameB: 'D',
      color: '#059669',
      endA: {
        name: 'C',
        hpRelation: 'ABOVE',
        distanceHp: 35,
        vpRelation: 'IN_FRONT',
        distanceVp: 40,
      },
      endB: {
        name: 'D',
        hpRelation: 'ABOVE',
        distanceHp: 35,
        vpRelation: 'IN_FRONT',
        distanceVp: 40,
      },
      dep: 75,
      trueLength: 75,
      thetaDeg: 0,
      phiDeg: 0,
      endBQuadrant: 'ABOVE_FRONT',
    },
  },
  {
    id: 'sample-line-3',
    title: 'Line EF: Perpendicular to HP & Parallel to VP',
    difficulty: 'Basic',
    badge: 'Vertical Line',
    description:
      'A straight line EF of 60 mm length is perpendicular to HP. Its lower end E is 20 mm above HP and 30 mm in front of VP. Draw elevation and plan.',
    input: {
      mode: 'END_POINTS',
      nameA: 'E',
      nameB: 'F',
      color: '#7c3aed',
      endA: {
        name: 'E',
        hpRelation: 'ABOVE',
        distanceHp: 20,
        vpRelation: 'IN_FRONT',
        distanceVp: 30,
      },
      endB: {
        name: 'F',
        hpRelation: 'ABOVE',
        distanceHp: 80,
        vpRelation: 'IN_FRONT',
        distanceVp: 30,
      },
      dep: 0,
      trueLength: 60,
      thetaDeg: 90,
      phiDeg: 0,
      endBQuadrant: 'ABOVE_FRONT',
    },
  },
  {
    id: 'sample-line-4',
    title: 'Line PQ: Inclined to HP (45°) and Parallel to VP',
    difficulty: 'Intermediate',
    badge: 'Inclined to HP',
    description:
      'A line PQ of 70 mm length is inclined at 45° to HP and parallel to VP. End P is 15 mm above HP and 25 mm in front of VP.',
    input: {
      mode: 'TRUE_LENGTH_ANGLES',
      nameA: 'P',
      nameB: 'Q',
      color: '#ea580c',
      endA: {
        name: 'P',
        hpRelation: 'ABOVE',
        distanceHp: 15,
        vpRelation: 'IN_FRONT',
        distanceVp: 25,
      },
      endB: {
        name: 'Q',
        hpRelation: 'ABOVE',
        distanceHp: 64.5,
        vpRelation: 'IN_FRONT',
        distanceVp: 25,
      },
      dep: 49.5,
      trueLength: 70,
      thetaDeg: 45,
      phiDeg: 0,
      endBQuadrant: 'ABOVE_FRONT',
    },
  },
  {
    id: 'sample-line-5',
    title: 'Line RS: Specified by End Points (DEP = 55 mm)',
    difficulty: 'Exam Standard',
    badge: 'DEP Method',
    description:
      'End R of a line RS is 25 mm above HP and 20 mm in front of VP. End S is 65 mm above HP and 50 mm in front of VP. The distance between end projectors is 55 mm. Find TL, θ, φ, α, and β.',
    input: {
      mode: 'END_POINTS',
      nameA: 'R',
      nameB: 'S',
      color: '#0284c7',
      endA: {
        name: 'R',
        hpRelation: 'ABOVE',
        distanceHp: 25,
        vpRelation: 'IN_FRONT',
        distanceVp: 20,
      },
      endB: {
        name: 'S',
        hpRelation: 'ABOVE',
        distanceHp: 65,
        vpRelation: 'IN_FRONT',
        distanceVp: 50,
      },
      dep: 55,
      trueLength: 74.3,
      thetaDeg: 32.5,
      phiDeg: 23.8,
      endBQuadrant: 'ABOVE_FRONT',
    },
  },
  {
    id: 'sample-line-perp-hp',
    title: 'Textbook Problem: Line AB Perpendicular to HP & Parallel to VP (TL=25mm)',
    difficulty: 'Basic',
    badge: 'Perpendicular Line',
    description:
      'A line AB 25mm is parallel to the VP and perpendicular to the HP. Point A is 35mm above the HP and 20mm in front of the VP. B is 10 mm above the HP. Top view projects to a single coincident point a(b) 20mm in front of VP; front view is a 25mm vertical true length line.',
    input: {
      mode: 'END_POINTS',
      nameA: 'A',
      nameB: 'B',
      color: '#2563eb',
      endA: {
        name: 'A',
        hpRelation: 'ABOVE',
        distanceHp: 35,
        vpRelation: 'IN_FRONT',
        distanceVp: 20,
      },
      endB: {
        name: 'B',
        hpRelation: 'ABOVE',
        distanceHp: 10,
        vpRelation: 'IN_FRONT',
        distanceVp: 20,
      },
      dep: 0,
      trueLength: 25,
      thetaDeg: 90,
      phiDeg: 0,
      endBQuadrant: 'ABOVE_FRONT',
    },
  },
];
