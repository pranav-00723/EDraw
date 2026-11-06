/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HpRelation, VpRelation } from './projection';
import { TargetQuadrantB, ComputedLine, LineProblemInput } from './lines';

export type MasterLineCategory =
  | 'SL_01_PARALLEL_BOTH'
  | 'SL_02_PERPENDICULAR_HP'
  | 'SL_03_PERPENDICULAR_VP'
  | 'SL_04_INCLINED_HP_PARALLEL_VP'
  | 'SL_05_INCLINED_VP_PARALLEL_HP'
  | 'SL_06_INCLINED_BOTH'
  | 'SL_07_ENDPOINT_COORDINATES'
  | 'SL_08_DIFFERENT_QUADRANTS'
  | 'SL_09_FIND_TRUE_LENGTH'
  | 'SL_10_FIND_TRUE_INCLINATIONS'
  | 'SL_11_FIND_APPARENT_ANGLES'
  | 'SL_12_TRACES_HT_VT'
  | 'SL_13_MISSING_PROJECTION'
  | 'SL_14_CHANGE_OF_POSITION'
  | 'SL_15_AUXILIARY_PLANE'
  | 'SL_16_EXISTING_PROJECTIONS'
  | 'SL_17_INVERSE_GEOMETRY'
  | 'SL_18_MULTIPLE_SOLUTIONS'
  | 'SL_19_INCONSISTENT_CONSTRAINTS'
  | 'SL_20_UNDERDETERMINED'
  | 'SL_21_ERROR_DIAGNOSIS'
  | 'SL_22_MIXED_FORMAT';

export type MasterValidationStatus =
  | 'VALID'
  | 'INCONSISTENT_CONSTRAINTS'
  | 'UNDERDETERMINED'
  | 'MULTIPLE_SOLUTIONS'
  | 'UNCERTAIN_OCR';

export type ConstructionMethodType = 'DIRECT' | 'ROTATING_LINE' | 'AUXILIARY_PLANE';

export interface ConstraintSourceMeta {
  value: any;
  unit?: string;
  source: 'MANUAL' | 'OCR' | 'CLIPBOARD' | 'DERIVED' | 'SAMPLE' | 'DEFAULT' | 'TEST_SUITE';
  confidence?: number;
  explicit: boolean;
  notes?: string;
}

export interface NormalizedEndpoint {
  name: string;
  x: number | null; // lateral along XY (mm)
  y: number | null; // + in front of VP, - behind VP (mm)
  z: number | null; // + above HP, - below HP (mm)
  hpRelation: HpRelation | null;
  distHp: number | null;
  vpRelation: VpRelation | null;
  distVp: number | null;
  quadrant: TargetQuadrantB | null;
}

export interface TraceIntersection {
  exists: boolean;
  type: 'HT' | 'VT';
  x: number;
  y: number;
  z: number;
  isFiniteSegment: boolean; // True if segment itself intersects, false if infinite extension intersects
  description: string;
}

export interface AuxiliaryPlaneGeometry {
  aipX1Y1AngleDeg: number;
  avpX2Y2AngleDeg: number;
  aipElevationLength: number;
  avpPlanLength: number;
  auxiliaryTrueLength: number;
  explanation: string;
}

export interface MasterConstructionStep {
  step: number;
  title: string;
  description: string;
  tool: string;
  pencilGrade: '2H (Construction)' | 'H (Dimension)' | 'HB (Final Line)';
}

export interface NormalizedConstraintModel {
  input_mode: 'MANUAL' | 'OCR' | 'CLIPBOARD' | 'SAMPLE' | 'TEST_SUITE';
  category: MasterLineCategory;
  categoryTitle: string;
  categoryDescription: string;
  task_type: string;

  // Extracted Quantities (null when unknown - never defaulted to zero)
  true_length_mm: number | null;
  endpoint_A: NormalizedEndpoint;
  endpoint_B: NormalizedEndpoint;
  inclination_hp_deg: number | null; // theta
  inclination_vp_deg: number | null; // phi
  front_view_length_mm: number | null; // EL
  top_view_length_mm: number | null; // PL
  front_view_angle_deg: number | null; // alpha
  top_view_angle_deg: number | null; // beta
  dep_projector_distance_mm: number | null;
  parallel_to: 'HP' | 'VP' | 'BOTH' | 'NONE' | null;
  perpendicular_to: 'HP' | 'VP' | 'NONE' | null;
  quadrant_A: TargetQuadrantB | null;
  quadrant_B: TargetQuadrantB | null;

  known_traces: {
    ht: TraceIntersection | null;
    vt: TraceIntersection | null;
  };

  construction_method: ConstructionMethodType;
  ocr_candidates: Record<string, any[]>;
  source_of_each_constraint: Record<string, ConstraintSourceMeta>;

  // Validation & Solution State
  validation_status: MasterValidationStatus;
  validation_messages: string[];
  contradiction_explanation?: string;
  missing_constraints_explanation?: string;
  degrees_of_freedom: number;
  solution_count: number;
  candidate_solutions: ComputedLine[];

  // Geometric Constructions
  auxiliary_view_geometry?: AuxiliaryPlaneGeometry;
  construction_steps: MasterConstructionStep[];
}

export interface RegressionTestDefinition {
  id: string;
  number: number;
  question: string;
  expectedStatus: MasterValidationStatus;
  category: MasterLineCategory;
  expectedValues: {
    trueLength?: number;
    frontViewLength?: number;
    topViewLength?: number;
    thetaDeg?: number;
    phiDeg?: number;
    dep?: number;
    isFiniteHT?: boolean;
    isFiniteVT?: boolean;
  };
  expectedExplanation: string;
  tags: string[];
}
