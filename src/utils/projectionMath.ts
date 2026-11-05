import { ComputedPoint, PointInput, QuadrantType, PresetProblem } from '../types/projection';

export const POINT_COLORS = [
  '#2563eb', // Royal Blue
  '#dc2626', // Crimson Red
  '#16a34a', // Emerald Green
  '#9333ea', // Purple
  '#d97706', // Amber
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#ea580c', // Orange
  '#059669', // Emerald
  '#0d9488', // Teal
  '#7c3aed', // Violet
  '#e11d48', // Rose
  '#c026d3', // Fuchsia
  '#3b82f6', // Sky Blue
  '#334155', // Slate
];

export interface ColorSwatch {
  hex: string;
  name: string;
}

export const MARKER_COLOR_GRID: ColorSwatch[] = [
  { hex: '#2563eb', name: 'Royal Blue' },
  { hex: '#3b82f6', name: 'Sky Blue' },
  { hex: '#0891b2', name: 'Cyan' },
  { hex: '#0d9488', name: 'Teal' },
  { hex: '#059669', name: 'Emerald' },
  { hex: '#16a34a', name: 'Green' },
  { hex: '#ca8a04', name: 'Gold' },
  { hex: '#d97706', name: 'Amber' },
  { hex: '#ea580c', name: 'Orange' },
  { hex: '#dc2626', name: 'Crimson Red' },
  { hex: '#e11d48', name: 'Rose' },
  { hex: '#db2777', name: 'Pink' },
  { hex: '#c026d3', name: 'Fuchsia' },
  { hex: '#9333ea', name: 'Purple' },
  { hex: '#4f46e5', name: 'Indigo' },
  { hex: '#334155', name: 'Slate' },
];

/**
 * Computes the exact 3D Cartesian coordinates and 2D Orthographic projections
 * for an Engineering Drawing point according to standard conventions (BIS / ISO).
 *
 * Coordinate Convention:
 * - X-axis: lateral direction along the intersection line (XY) of HP and VP.
 * - Y-axis: distance perpendicular to VP.
 *     +Y = in front of VP
 *     -Y = behind VP
 *      0 = on VP
 * - Z-axis: height relative to HP.
 *     +Z = above HP
 *     -Z = below HP
 *      0 = on HP
 *
 * 2D Orthographic Unfolding Convention:
 * - Reference line: XY (intersection of HP and VP).
 * - Front View (a' or A'): Projected onto VP.
 *     Vertical displacement = Z.
 *     If Z > 0 (above HP): drawn ABOVE XY line.
 *     If Z < 0 (below HP): drawn BELOW XY line.
 *     If Z = 0 (on HP): drawn ON XY line.
 * - Top View (a or A): Projected onto HP.
 *     When HP rotates 90° clockwise to become coplanar with VP:
 *     If Y > 0 (in front of VP): moves BELOW XY line by Y mm.
 *     If Y < 0 (behind VP): moves ABOVE XY line by |Y| mm.
 *     If Y = 0 (on VP): lies ON XY line.
 */
export function computePointCoordinates(input: PointInput): ComputedPoint {
  const x = Number(input.x) || 0;

  // Vertical position Z relative to HP
  let z = 0;
  let distHp = 0;
  if (input.hpRelation === 'ABOVE') {
    distHp = Math.abs(Number(input.distanceHp) || 0);
    z = distHp;
  } else if (input.hpRelation === 'BELOW') {
    distHp = Math.abs(Number(input.distanceHp) || 0);
    z = -distHp;
  } else {
    // ON HP
    z = 0;
    distHp = 0;
  }

  // Depth position Y relative to VP
  let y = 0;
  let distVp = 0;
  if (input.vpRelation === 'IN_FRONT') {
    distVp = Math.abs(Number(input.distanceVp) || 0);
    y = distVp;
  } else if (input.vpRelation === 'BEHIND') {
    distVp = Math.abs(Number(input.distanceVp) || 0);
    y = -distVp;
  } else {
    // ON VP
    y = 0;
    distVp = 0;
  }

  // Determine Quadrant / Plane Boundary
  let quadrant: QuadrantType;
  let quadrantTitle: string;
  let explanation: string;
  let validQuadrants: number[] = [1];

  const isAbove = z > 0;
  const isBelow = z < 0;
  const isOnHp = z === 0;

  const isInFront = y > 0;
  const isBehind = y < 0;
  const isOnVp = y === 0;

  const pName = (input.name.trim() || 'P').toUpperCase();
  const pNameLower = (input.name.trim() || 'p').toLowerCase();
  const isHidden = !!input.isHidden;
  const rawFvName = `${pNameLower}′`;
  const rawTvName = pNameLower;
  const fvName = isHidden ? `(${rawFvName})` : rawFvName;
  const tvName = isHidden ? `(${rawTvName})` : rawTvName;

  if (isOnHp && isOnVp) {
    quadrant = 'ON_BOTH_XY';
    validQuadrants = [1, 2, 3, 4];
    quadrantTitle = 'On HP & On VP (XY Line — Valid across Quadrants 1, 2, 3, 4)';
    explanation = `Point ${pName} lies simultaneously on the Horizontal Plane (HP) and Vertical Plane (VP) along the reference line XY (HP = 0, VP = 0). It is considered valid across all Quadrants (1, 2, 3, 4). Both Front View (${fvName}) and Top View (${tvName}) coincide directly on the XY line.`;
  } else if (isOnHp) {
    if (isInFront) {
      quadrant = 'ON_HP_IN_FRONT';
      validQuadrants = [1, 4];
      quadrantTitle = 'On HP, In Front of VP (Valid in Quadrants 1 & 4)';
      explanation = `Point ${pName} lies on HP (HP = 0) and ${distVp} mm in front of VP (IFVP > 0). It forms the boundary between the 1st and 4th quadrants and is valid in Quadrants (1, 4). Front View (${fvName}) lies on reference line XY, and Top View (${tvName}) lies ${distVp} mm BELOW XY.`;
    } else {
      quadrant = 'ON_HP_BEHIND';
      validQuadrants = [2, 3];
      quadrantTitle = 'On HP, Behind VP (Valid in Quadrants 2 & 3)';
      explanation = `Point ${pName} lies on HP (HP = 0) and ${distVp} mm behind VP (BVP > 0). It forms the boundary between the 2nd and 3rd quadrants and is valid in Quadrants (2, 3). Front View (${fvName}) lies on reference line XY, and Top View (${tvName}) lies ${distVp} mm ABOVE XY.`;
    }
  } else if (isOnVp) {
    if (isAbove) {
      quadrant = 'ON_VP_ABOVE';
      validQuadrants = [1, 2];
      quadrantTitle = 'On VP, Above HP (Valid in Quadrants 1 & 2)';
      explanation = `Point ${pName} lies on VP (VP = 0) and ${distHp} mm above HP (AHP > 0). It forms the boundary between the 1st and 2nd quadrants and is valid in Quadrants (1, 2). Front View (${fvName}) lies ${distHp} mm ABOVE XY, and Top View (${tvName}) lies on reference line XY.`;
    } else {
      quadrant = 'ON_VP_BELOW';
      validQuadrants = [3, 4];
      quadrantTitle = 'On VP, Below HP (Valid in Quadrants 3 & 4)';
      explanation = `Point ${pName} lies on VP (VP = 0) and ${distHp} mm below HP (BHP > 0). It forms the boundary between the 3rd and 4th quadrants and is valid in Quadrants (3, 4). Front View (${fvName}) lies ${distHp} mm BELOW XY, and Top View (${tvName}) lies on reference line XY.`;
    }
  } else if (isAbove && isInFront) {
    quadrant = 'FIRST';
    validQuadrants = [1];
    quadrantTitle = 'First Quadrant (Above HP & In Front of VP)';
    explanation = `Point ${pName} is ${distHp} mm above HP and ${distVp} mm in front of VP. It lies strictly in the 1st Quadrant. Front View (${fvName}) is ${distHp} mm ABOVE XY; Top View (${tvName}) is ${distVp} mm BELOW XY.`;
  } else if (isAbove && isBehind) {
    quadrant = 'SECOND';
    validQuadrants = [2];
    quadrantTitle = 'Second Quadrant (Above HP & Behind VP)';
    explanation = `Point ${pName} is ${distHp} mm above HP and ${distVp} mm behind VP. It lies strictly in the 2nd Quadrant. Front View (${fvName}) is ${distHp} mm ABOVE XY; Top View (${tvName}) is also ${distVp} mm ABOVE XY (both views above XY).`;
  } else if (isBelow && isBehind) {
    quadrant = 'THIRD';
    validQuadrants = [3];
    quadrantTitle = 'Third Quadrant (Below HP & Behind VP)';
    explanation = `Point ${pName} is ${distHp} mm below HP and ${distVp} mm behind VP. It lies strictly in the 3rd Quadrant. Front View (${fvName}) is ${distHp} mm BELOW XY; Top View (${tvName}) is ${distVp} mm ABOVE XY.`;
  } else {
    // isBelow && isInFront
    quadrant = 'FOURTH';
    validQuadrants = [4];
    quadrantTitle = 'Fourth Quadrant (Below HP & In Front of VP)';
    explanation = `Point ${pName} is ${distHp} mm below HP and ${distVp} mm in front of VP. It lies strictly in the 4th Quadrant. Front View (${fvName}) is ${distHp} mm BELOW XY; Top View (${tvName}) is also ${distVp} mm BELOW XY (both views below XY).`;
  }

  // 2D Coordinates relative to XY line (mm):
  // frontViewY: + above XY, - below XY
  const frontViewY = z;
  const frontViewDesc =
    z > 0
      ? `${distHp} mm Above XY`
      : z < 0
      ? `${distHp} mm Below XY`
      : `On Reference Line XY`;

  // topViewY:
  // in front (+y) -> -y (below XY)
  // behind (-y) -> +|y| (above XY)
  // on VP (0) -> 0 (on XY)
  const topViewY = -y;
  const topViewDesc =
    y > 0
      ? `${distVp} mm Below XY`
      : y < 0
      ? `${distVp} mm Above XY`
      : `On Reference Line XY`;

  return {
    id: input.id,
    name: pName,
    color: input.color || POINT_COLORS[0],
    isHidden,
    x,
    y,
    z,
    distHp,
    hpRelation: input.hpRelation,
    distVp,
    vpRelation: input.vpRelation,
    quadrant,
    quadrantTitle,
    explanation,
    validQuadrants,
    frontViewY,
    frontViewLabel: fvName,
    frontViewDesc,
    topViewY,
    topViewLabel: tvName,
    topViewDesc,
  };
}

export const SAMPLE_PROBLEMS: PresetProblem[] = [
  {
    title: '1st Quadrant Standard',
    subtitle: 'Point A (30 mm above HP, 40 mm in front of VP)',
    badge: '1st Quadrant',
    description:
      'Standard introductory projection: Point is above HP and in front of VP. Front view A′ appears above XY line, top view A appears below XY line.',
    points: [
      {
        name: 'A',
        color: '#2563eb',
        hpRelation: 'ABOVE',
        distanceHp: 30,
        vpRelation: 'IN_FRONT',
        distanceVp: 40,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: '2nd Quadrant (Both Views Above XY)',
    subtitle: 'Point B (25 mm above HP, 35 mm behind VP)',
    badge: '2nd Quadrant',
    description:
      'In the 2nd Quadrant, both the front view B′ and top view B appear above the reference line XY when HP is rotated 90° clockwise.',
    points: [
      {
        name: 'B',
        color: '#dc2626',
        hpRelation: 'ABOVE',
        distanceHp: 25,
        vpRelation: 'BEHIND',
        distanceVp: 35,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: '3rd Quadrant (Top View Above XY)',
    subtitle: 'Point C (40 mm below HP, 30 mm behind VP)',
    badge: '3rd Quadrant',
    description:
      'In the 3rd Quadrant (Third Angle Projection), top view C appears above XY line, and front view C′ appears below XY line.',
    points: [
      {
        name: 'C',
        color: '#16a34a',
        hpRelation: 'BELOW',
        distanceHp: 40,
        vpRelation: 'BEHIND',
        distanceVp: 30,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: '4th Quadrant (Both Views Below XY)',
    subtitle: 'Point D (35 mm below HP, 25 mm in front of VP)',
    badge: '4th Quadrant',
    description:
      'In the 4th Quadrant, both the front view D′ and top view D appear below the reference line XY.',
    points: [
      {
        name: 'D',
        color: '#9333ea',
        hpRelation: 'BELOW',
        distanceHp: 35,
        vpRelation: 'IN_FRONT',
        distanceVp: 25,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: 'Point on HP (Plane Boundary)',
    subtitle: 'Point E (On HP, 45 mm in front of VP)',
    badge: 'Plane Boundary: On HP',
    description:
      'Since point E is on HP, its front view E′ is on the XY line, and top view E is 45 mm below XY line.',
    points: [
      {
        name: 'E',
        color: '#d97706',
        hpRelation: 'ON',
        distanceHp: 0,
        vpRelation: 'IN_FRONT',
        distanceVp: 45,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: 'Point on VP (Plane Boundary)',
    subtitle: 'Point F (30 mm above HP, On VP)',
    badge: 'Plane Boundary: On VP',
    description:
      'Since point F is on VP, its top view F is on the XY line, and front view F′ is 30 mm above XY line.',
    points: [
      {
        name: 'F',
        color: '#0891b2',
        hpRelation: 'ABOVE',
        distanceHp: 30,
        vpRelation: 'ON',
        distanceVp: 0,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: 'Point on XY Line (Both Planes)',
    subtitle: 'Point G (On both HP and VP)',
    badge: 'XY Line',
    description:
      'Point G lies on the intersection of HP and VP (the XY reference line). Both front view G′ and top view G coincide directly on the XY line.',
    points: [
      {
        name: 'G',
        color: '#4f46e5',
        hpRelation: 'ON',
        distanceHp: 0,
        vpRelation: 'ON',
        distanceVp: 0,
        x: 0,
        showOptionalX: false,
      },
    ],
  },
  {
    title: 'Multi-Point Comparison (P, Q, R)',
    subtitle: 'Points in 1st, 2nd, and 3rd Quadrants with lateral offsets',
    badge: 'Multi-Point',
    description:
      'Compare three points along the XY reference axis with lateral distances: P (1st Quad), Q (2nd Quad), and R (3rd Quad).',
    points: [
      {
        name: 'P',
        color: '#2563eb',
        hpRelation: 'ABOVE',
        distanceHp: 30,
        vpRelation: 'IN_FRONT',
        distanceVp: 40,
        x: -40,
        showOptionalX: true,
      },
      {
        name: 'Q',
        color: '#dc2626',
        hpRelation: 'ABOVE',
        distanceHp: 25,
        vpRelation: 'BEHIND',
        distanceVp: 35,
        x: 0,
        showOptionalX: true,
      },
      {
        name: 'R',
        color: '#16a34a',
        hpRelation: 'BELOW',
        distanceHp: 40,
        vpRelation: 'BEHIND',
        distanceVp: 30,
        x: 40,
        showOptionalX: true,
      },
    ],
  },
];
