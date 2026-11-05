/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HpRelation, VpRelation } from './projection';

export type LineInputMode = 'END_POINTS' | 'TRUE_LENGTH_ANGLES' | 'APPARENT_VALUES';

export type LineOrientationType =
  | 'PARALLEL_BOTH'
  | 'PERPENDICULAR_HP'
  | 'PERPENDICULAR_VP'
  | 'INCLINED_HP_PARALLEL_VP'
  | 'INCLINED_VP_PARALLEL_HP'
  | 'INCLINED_BOTH';

export interface EndPointSpec {
  name: string;
  hpRelation: HpRelation;
  distanceHp: number; // mm
  vpRelation: VpRelation;
  distanceVp: number; // mm
}

export type TargetQuadrantB = 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH';

export interface LineProblemInput {
  mode: LineInputMode;
  nameA: string;
  nameB: string;
  color: string;
  
  // End A
  endA: EndPointSpec;
  
  // End B (Used in END_POINTS mode)
  endB: EndPointSpec;
  dep: number; // Distance between end projectors (mm)
  
  // True Length & Angles (Used in TRUE_LENGTH_ANGLES mode)
  trueLength: number; // mm
  thetaDeg: number;   // True inclination to HP in degrees (0 - 90)
  phiDeg: number;     // True inclination to VP in degrees (0 - 90)
  endBQuadrant: 'ABOVE_FRONT' | 'ABOVE_BEHIND' | 'BELOW_FRONT' | 'BELOW_BEHIND';

  // Apparent Values Mode (When True Length is NOT given and must be calculated)
  frontViewLength?: number; // Elevation Length (EL, mm) e.g. 70
  topViewLength?: number;   // Plan Length (PL, mm) e.g. 60
  apparentInputType?: 'LENGTHS_DEP' | 'LENGTHS_ANGLES';
  alphaDeg?: number;       // Apparent angle of front view with XY (degrees)
  betaDeg?: number;        // Apparent angle of top view with XY (degrees)
  targetQuadrantB?: TargetQuadrantB; // Quadrant i, ii, iii, or iv for End B
  hiddenA?: boolean; // When true, rendered in brackets e.g. (a) or (a′)
  hiddenB?: boolean; // When true, rendered in brackets e.g. (b) or (b′)
}

export interface QuadrantSolutionItem {
  quadrantKey: TargetQuadrantB;
  quadrantLabel: string;
  quadrantNum: 'i' | 'ii' | 'iii' | 'iv';
  hpRelation: HpRelation;
  distHp: number; // mm
  vpRelation: VpRelation;
  distVp: number; // mm
  summary: string;
  zB: number;
  yB: number;
}

export interface TracePoint {
  exists: boolean;
  type: 'HT' | 'VT';
  // 3D coordinates
  x: number;
  y: number;
  z: number;
  // 2D Orthographic representation
  // For HT: h' is on XY (y=0), h is at y_HT (below XY if +y, above if -y)
  // For VT: v is on XY (z=0), v' is at z_VT (above XY if +z, below if -z)
  groundProj: { x: number; y: number; label: string };
  traceProj: { x: number; y: number; label: string };
  description: string;
}

export interface ComputedLine {
  id: string;
  nameA: string;
  nameB: string;
  color: string;
  input: LineProblemInput;
  hiddenA?: boolean;
  hiddenB?: boolean;

  // 3D coordinates (mm)
  // End A
  xA: number;
  yA: number; // +y in front of VP, -y behind VP
  zA: number; // +z above HP, -z below HP

  // End B
  xB: number;
  yB: number;
  zB: number;

  // Lengths (mm)
  trueLength: number;
  frontViewLength: number; // Elevation Length (EL)
  topViewLength: number;   // Plan Length (PL)
  dep: number;             // Distance between end projectors

  // Angles (degrees)
  thetaDeg: number; // True angle with HP
  phiDeg: number;   // True angle with VP
  alphaDeg: number; // Apparent angle of Front View with XY
  betaDeg: number;  // Apparent angle of Top View with XY

  // 2D Orthographic coordinates (relative to XY, mm)
  // Front View: a' and b'
  aFront: { x: number; y: number; label: string };
  bFront: { x: number; y: number; label: string };
  
  // Top View: a and b
  aTop: { x: number; y: number; label: string };
  bTop: { x: number; y: number; label: string };

  // Rotating line construction positions (for True Length verification in 2D)
  // b1' is on locus of b' (shows TL with theta in elevation)
  b1Front: { x: number; y: number; label: string };
  // b2 is on locus of b (shows TL with phi in plan)
  b2Top: { x: number; y: number; label: string };

  // Traces
  ht: TracePoint;
  vt: TracePoint;

  // Orientation and classification
  orientation: LineOrientationType;
  orientationTitle: string;
  orientationDesc: string;

  // Engineering calculation notes
  calculations: {
    deltaX: number;
    deltaY: number;
    deltaZ: number;
    validAngleSum: boolean; // sin^2(theta) + sin^2(phi) <= 1
  };

  // Dedicated data when solved from apparent lengths & angles (True length unknown initially)
  isSolvedFromApparent?: boolean;
  apparentSolution?: {
    el: number;
    pl: number;
    dep: number;
    deltaZ: number;
    deltaY: number;
    calculatedTL: number;
    thetaDeg: number;
    phiDeg: number;
    alphaDeg: number;
    betaDeg: number;
    quadrantSolutions: QuadrantSolutionItem[];
  };
}

export interface SampleLineProblem {
  id: string;
  title: string;
  difficulty: 'Basic' | 'Intermediate' | 'Exam Standard';
  description: string;
  badge: string;
  input: LineProblemInput;
}
