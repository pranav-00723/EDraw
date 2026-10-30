export type QuadrantType =
  | 'FIRST'
  | 'SECOND'
  | 'THIRD'
  | 'FOURTH'
  | 'ON_HP_IN_FRONT'
  | 'ON_HP_BEHIND'
  | 'ON_VP_ABOVE'
  | 'ON_VP_BELOW'
  | 'ON_BOTH_XY';

export type HpRelation = 'ABOVE' | 'BELOW' | 'ON';
export type VpRelation = 'IN_FRONT' | 'BEHIND' | 'ON';

export interface PointInput {
  id: string;
  name: string;
  color: string;
  hpRelation: HpRelation;
  distanceHp: number; // in mm, non-negative
  vpRelation: VpRelation;
  distanceVp: number; // in mm, non-negative
  x: number; // lateral offset in mm along XY line
  showOptionalX: boolean;
}

export interface ComputedPoint {
  id: string;
  name: string;
  color: string;
  // 3D Cartesian coordinates (mm)
  // X: lateral along XY intersection line
  // Y: distance perpendicular to VP (positive in front, negative behind, 0 on VP)
  // Z: height above HP (positive above, negative below, 0 on HP)
  x: number;
  y: number;
  z: number;

  // Engineering distances
  distHp: number;
  hpRelation: HpRelation;
  distVp: number;
  vpRelation: VpRelation;

  // Classification
  quadrant: QuadrantType;
  quadrantTitle: string;
  explanation: string;

  // 2D Orthographic Projection Coordinates (relative to XY line, in mm)
  // Front View (Elevation): Labeled A'
  // Height relative to XY: + above XY, - below XY, 0 on XY
  frontViewY: number;
  frontViewLabel: string; // e.g., "A'"
  frontViewDesc: string;

  // Top View (Plan): Labeled A
  // In front of VP (+Y) rotates 90° clockwise -> falls BELOW XY (-Y)
  // Behind VP (-Y) rotates 90° clockwise -> falls ABOVE XY (+|Y|)
  topViewY: number;
  topViewLabel: string; // e.g., "A"
  topViewDesc: string;
}

export interface PresetProblem {
  title: string;
  subtitle: string;
  badge: string;
  points: Omit<PointInput, 'id'>[];
  description: string;
}
