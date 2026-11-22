/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import {
  ENGINEERING_MODULE_REGISTRY,
  type EngineeringModuleId,
  type ModuleImplementationStatus,
} from './moduleRegistry.ts';

export const CANONICAL_SCHEMA_VERSION = '1.0.0' as const;

export const MeasurementUnitSchema = z.enum(['mm', 'deg']);
export type MeasurementUnit = z.infer<typeof MeasurementUnitSchema>;

export const MeasurementStatusSchema = z.enum([
  'given',
  'unknown',
  'derived',
  'ambiguous',
  'inconsistent',
]);
export type MeasurementStatus = z.infer<typeof MeasurementStatusSchema>;

export const FieldValidationStatusSchema = z.enum([
  'unvalidated',
  'validated',
  'failed',
]);
export type FieldValidationStatus = z.infer<typeof FieldValidationStatusSchema>;

export const SourceStageSchema = z.enum([
  'stage_1_ocr',
  'stage_2_parser',
  'stage_2_semantic_interpreter',
  'stage_3_python_solver',
  'stage_4_validator',
  'user_edit',
]);
export type SourceStage = z.infer<typeof SourceStageSchema>;

export const EpistemicStatusSchema = z.enum([
  'observed',
  'inferred',
  'assumed',
  'calculated',
  'unresolved',
]);
export type EpistemicStatus = z.infer<typeof EpistemicStatusSchema>;

export const QuantityReferenceSchema = z.object({
  entity: z.string().min(1),
  relation: z.string().min(1),
  target: z.string().min(1),
});
export type QuantityReference = z.infer<typeof QuantityReferenceSchema>;

export const MeasurementProvenanceSchema = z.object({
  source_stage: SourceStageSchema,
  epistemic_status: EpistemicStatusSchema.optional(),
  excerpt: z.string().nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  formula: z.string().nullable().default(null),
  reason: z.string().nullable().default(null),
});
export type MeasurementProvenance = z.infer<typeof MeasurementProvenanceSchema>;

export const MeasurementFieldSchema = z.object({
  property: z.string().min(1),
  value: z.number().finite().nullable(),
  unit: MeasurementUnitSchema,
  original_value: z.number().finite().nullable().optional(),
  original_unit: z.string().nullable().optional(),
  status: MeasurementStatusSchema,
  reference: QuantityReferenceSchema.optional(),
  provenance: MeasurementProvenanceSchema,
  validation_status: FieldValidationStatusSchema,
});
export type MeasurementField = z.infer<typeof MeasurementFieldSchema>;

export const UncertainReadingSchema = z.object({
  id: z.string().min(1),
  raw_token: z.string().min(1),
  suspected_property: z.string().nullable().default(null),
  reason: z.string().min(1),
  severity: z.enum(['warning', 'blocking']),
  suggested_interpretation: z.string().nullable().default(null),
});
export type UncertainReading = z.infer<typeof UncertainReadingSchema>;

export const GeometricConstraintSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'parallel_hp',
    'parallel_vp',
    'perpendicular_hp',
    'perpendicular_vp',
    'in_hp',
    'in_vp',
    'above_hp',
    'below_hp',
    'in_front_vp',
    'behind_vp',
    'on_xy',
    'quadrant',
    'direction_cosines',
    'endpoint_relation',
    'relative_offset',
    'view_angle',
    'module_constraint',
  ]),
  target: z.string().min(1),
  relation: z.string().min(1),
  value: z.union([z.number().finite(), z.string(), z.boolean()]).nullable().default(null),
  unit: z.string().nullable().default(null),
  status: z.enum(['given', 'derived', 'violated']),
  excerpt: z.string().nullable().default(null),
});
export type GeometricConstraint = z.infer<typeof GeometricConstraintSchema>;

export const Point2DSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  label: z.string().min(1),
});
export type Point2D = z.infer<typeof Point2DSchema>;

export const Point3DSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
export type Point3D = z.infer<typeof Point3DSchema>;

export const SolvedLineCoordinatesSchema = z.object({
  xy_line_y: z.number().finite(),
  start_3d: Point3DSchema,
  end_3d: Point3DSchema,
  front_view: z.object({
    start: Point2DSchema,
    end: Point2DSchema,
  }),
  top_view: z.object({
    start: Point2DSchema,
    end: Point2DSchema,
  }),
  auxiliary: z.object({
    b1_prime: Point2DSchema,
    b2: Point2DSchema,
  }),
});
export type SolvedLineCoordinates = z.infer<typeof SolvedLineCoordinatesSchema>;

export const HpRelationHintSchema = z.enum(['above', 'below', 'on']).nullable();
export const VpRelationHintSchema = z.enum(['in_front', 'behind', 'on']).nullable();

export const StraightLineGeometrySchema = z.object({
  entity_type: z.literal('straight_line'),
  line_label: z.string().min(2).max(12),
  endpoints: z.object({
    start: z.string().min(1).max(4),
    end: z.string().min(1).max(4),
  }),
  planes: z.array(z.enum(['HP', 'VP', 'PP'])).min(2),
  quadrant_hints: z.object({
    start_hp: HpRelationHintSchema,
    start_vp: VpRelationHintSchema,
    end_hp: HpRelationHintSchema,
    end_vp: VpRelationHintSchema,
    branch_preference: z
      .enum(['first_quadrant_positive', 'explicit_endpoints', 'unspecified'])
      .default('unspecified'),
  }),
  solved_coordinates: SolvedLineCoordinatesSchema.nullable().default(null),
});
export type StraightLineGeometry = z.infer<typeof StraightLineGeometrySchema>;

export const PointEntitySpecSchema = z.object({
  label: z.string().min(1).max(8),
  x_mm: z.number().finite().nullable().default(null),
  y_mm: z.number().finite().nullable().default(null),
  z_mm: z.number().finite().nullable().default(null),
  hp_relation: HpRelationHintSchema.default(null),
  vp_relation: VpRelationHintSchema.default(null),
  declared_quadrant: z.enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH']).nullable().default(null),
  evidence_excerpts: z.array(z.string()).default([]),
});
export type PointEntitySpec = z.infer<typeof PointEntitySpecSchema>;

export const PointRelativeRelationSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1).max(8),
  reference: z.string().min(1).max(8),
  axis: z.enum(['x', 'y', 'z']),
  delta_mm: z.number().finite(),
  excerpt: z.string().min(1),
});
export type PointRelativeRelation = z.infer<typeof PointRelativeRelationSchema>;

export const SolvedPointRecordSchema = z.object({
  label: z.string().min(1),
  status: z.enum(['solved', 'underdetermined', 'inconsistent']),
  x_mm: z.number().finite().nullable(),
  x_is_layout_default: z.boolean().default(false),
  y_mm: z.number().finite().nullable(),
  z_mm: z.number().finite().nullable(),
  hp_relation: HpRelationHintSchema,
  vp_relation: VpRelationHintSchema,
  front_view_y: z.number().finite().nullable(),
  top_view_y: z.number().finite().nullable(),
  front_view_label: z.string().min(1),
  top_view_label: z.string().min(1),
  quadrant: z.string().nullable(),
  valid_quadrants: z.array(z.number().int()).default([]),
  front_view_desc: z.string(),
  top_view_desc: z.string(),
  explanation: z.string(),
});
export type SolvedPointRecord = z.infer<typeof SolvedPointRecordSchema>;

export const PointSetGeometrySchema = z.object({
  entity_type: z.literal('point_set'),
  points: z.array(PointEntitySpecSchema).min(1),
  relative_relations: z.array(PointRelativeRelationSchema).default([]),
  planes: z.array(z.enum(['HP', 'VP', 'PP'])).min(2),
  solved_points: z.array(SolvedPointRecordSchema).nullable().default(null),
});
export type PointSetGeometry = z.infer<typeof PointSetGeometrySchema>;

// Extensible geometry union for future Engineering Drawing domains
export const FuturePlaneGeometrySchema = z.object({
  entity_type: z.literal('plane'),
  label: z.string().min(1),
  shape: z.string().min(1),
  planes: z.array(z.enum(['HP', 'VP', 'PP'])).min(2),
});

export const FutureSolidGeometrySchema = z.object({
  entity_type: z.literal('solid'),
  label: z.string().min(1),
  solid_type: z.string().min(1),
  planes: z.array(z.enum(['HP', 'VP', 'PP'])).min(2),
});

export const GeneralUnsupportedGeometrySchema = z.object({
  entity_type: z.literal('general'),
  topic: z.string().min(1),
  label: z.string().min(1),
  planes: z.array(z.enum(['HP', 'VP', 'PP'])).default(['HP', 'VP']),
});

export const GeometryEntitySchema = z.discriminatedUnion('entity_type', [
  StraightLineGeometrySchema,
  PointSetGeometrySchema,
  FuturePlaneGeometrySchema,
  FutureSolidGeometrySchema,
  GeneralUnsupportedGeometrySchema,
]);
export type GeometryEntity = z.infer<typeof GeometryEntitySchema>;

export const ValidationIssueSchema = z.object({
  code: z.string().min(1),
  stage: z.enum([
    'stage_1_ocr',
    'stage_2_parser',
    'stage_3_python_solver',
    'stage_4_validator',
    'stage_5_render',
  ]),
  severity: z.enum(['info', 'warning', 'error']),
  field: z.string().nullable().default(null),
  message: z.string().min(1),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const AmbiguityRecordSchema = z.object({
  id: z.string().min(1),
  property: z.string().min(1),
  reason: z.string().min(1),
  candidates: z.array(z.record(z.string(), z.union([z.number(), z.string(), z.null()]))).default([]),
});
export type AmbiguityRecord = z.infer<typeof AmbiguityRecordSchema>;

export const ValidationCheckSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  passed: z.boolean(),
  expected: z.string(),
  actual: z.string(),
  tolerance: z.number().nullable().default(null),
});
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

export const MissingRequirementSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['length', 'inclination', 'position', 'distance', 'orientation', 'coordinate', 'module_support']),
  parameter: z.string().min(1),
  label: z.string().min(1),
  unit: z.enum(['mm', 'deg']).nullable().default(null),
  alternatives: z.array(z.string()).default([]),
  reason: z.string().min(1),
  example_fix: z.string().min(1),
});
export type MissingRequirement = z.infer<typeof MissingRequirementSchema>;

export const SolverStatusSchema = z.enum([
  'unsolved',
  'solved',
  'partially_solved',
  'underdetermined',
  'ambiguous',
  'inconsistent',
  'unsupported',
  'needs_clarification',
  'error',
]);
export type SolverStatus = z.infer<typeof SolverStatusSchema>;

export const ModuleIdSchema = z.enum(
  Object.keys(ENGINEERING_MODULE_REGISTRY) as [EngineeringModuleId, ...EngineeringModuleId[]]
);

export const ModuleClassificationSchema = z.object({
  id: ModuleIdSchema,
  name: z.string().min(1),
  implementation_status: z.enum(['implemented', 'partial', 'unsupported'] as [
    ModuleImplementationStatus,
    ...ModuleImplementationStatus[],
  ]),
  confidence: z.number().min(0).max(1).nullable().default(null),
  selection_reason: z.string().default('Classified via semantic interpretation'),
  unsupported_capabilities: z.array(z.string()).default([]),
});
export type ModuleClassification = z.infer<typeof ModuleClassificationSchema>;

export const InterpretedEntitySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['point', 'straight_line', 'plane', 'solid', 'curve', 'view', 'reference_plane', 'unknown']),
  label: z.string().min(1),
  role: z.string().default('primary'),
});
export type InterpretedEntity = z.infer<typeof InterpretedEntitySchema>;

export const InterpretationMetadataSchema = z.object({
  interpretation_method: z.enum(['gemini_semantic', 'deterministic_semantic', 'hybrid', 'user_edit']).default('deterministic_semantic'),
  entities: z.array(InterpretedEntitySchema).default([]),
  assumptions: z.array(z.string()).default([]),
  unresolved_questions: z.array(z.string()).default([]),
  repair_notes: z.array(z.string()).default([]),
});
export type InterpretationMetadata = z.infer<typeof InterpretationMetadataSchema>;

export const DerivationStepSchema = z.object({
  step: z.number().int().positive(),
  formula: z.string().min(1),
  explanation: z.string().min(1),
  result: z.string().optional(),
});
export type DerivationStep = z.infer<typeof DerivationStepSchema>;

export const ExecutionMetadataSchema = z.object({
  solver_id: z.string().nullable().default(null),
  renderer_id: z.string().nullable().default(null),
  visualization_config: z.record(z.string(), z.unknown()).default({}),
  generated_js_module: z.string().nullable().default(null),
  js_validation: z
    .object({
      valid: z.boolean(),
      errors: z.array(z.string()).default([]),
    })
    .default({ valid: false, errors: [] }),
});
export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;

export const TaskDomainSchema = z.enum([
  'point_projection',
  'straight_line_projection',
  'plane_projection',
  'solid_projection',
  'section_of_solids',
  'development_of_surfaces',
  'isometric_projections',
  'orthographic_projections',
  'perspective_drawing',
  'engineering_curves',
  'intersection_of_surfaces',
  'auxiliary_views',
  'unknown',
]);
export type TaskDomain = z.infer<typeof TaskDomainSchema>;

export const CanonicalEngineeringProblemSchema = z.object({
  schema_version: z.literal(CANONICAL_SCHEMA_VERSION),
  problem_id: z.string().regex(/^[a-zA-Z0-9_-]{4,64}$/, 'problem_id must be 4-64 safe characters'),
  module: ModuleClassificationSchema.optional(),
  source: z.object({
    input_type: z.enum(['image', 'text']),
    ocr_engine: z.string().min(1),
    raw_text: z.string(),
    normalized_text: z.string(),
    confidence: z.number().min(0).max(1).nullable().default(null),
    diagram_evidence: z.array(z.string()).optional().default([]),
    warnings: z.array(z.string()).default([]),
    uncertain_readings: z.array(UncertainReadingSchema).default([]),
    ambiguities: z.array(z.string()).optional().default([]),
  }),
  task: z.object({
    domain: TaskDomainSchema,
    projection_system: z.enum(['first_angle', 'third_angle']),
    requested_outputs: z.array(z.string()).min(1),
    description: z.string(),
  }),
  interpretation: InterpretationMetadataSchema.optional(),
  geometry: GeometryEntitySchema,
  givens: z.record(z.string(), MeasurementFieldSchema),
  unknowns: z.record(z.string(), MeasurementFieldSchema),
  constraints: z.array(GeometricConstraintSchema).default([]),
  drawing_instructions: z.object({
    ready_to_render: z.boolean(),
    coordinate_system: z.enum(['first_angle_bis_sp46', 'third_angle_iso']),
    scale: z.number().positive().nullable().default(null),
    views: z.array(z.enum(['front_view', 'top_view', 'side_view'])).min(1),
    annotations: z.array(z.string()).default([]),
    blocked_reason: z.string().nullable().default(null),
  }),
  validation: z.object({
    schema_valid: z.boolean(),
    solver_status: SolverStatusSchema,
    geometry_valid: z.boolean(),
    ready_for_render: z.boolean(),
    issues: z.array(ValidationIssueSchema).default([]),
    ambiguities: z.array(AmbiguityRecordSchema).default([]),
    missing_requirements: z.array(MissingRequirementSchema).default([]),
    checks: z.array(ValidationCheckSchema).default([]),
  }),
  derivation: z.array(DerivationStepSchema).optional().default([]),
  execution: ExecutionMetadataSchema.optional(),
});

export type CanonicalEngineeringProblem = z.infer<typeof CanonicalEngineeringProblemSchema>;

export const STRAIGHT_LINE_PROPERTIES: ReadonlyArray<{
  property: string;
  unit: MeasurementUnit;
  label: string;
}> = [
  { property: 'true_length', unit: 'mm', label: 'True Length (TL)' },
  { property: 'front_view_length', unit: 'mm', label: 'Front View Length (FV)' },
  { property: 'top_view_length', unit: 'mm', label: 'Top View Length (TV)' },
  { property: 'dep', unit: 'mm', label: 'Distance Between End Projectors (DEP / |Δx|)' },
  { property: 'abs_delta_z', unit: 'mm', label: 'Vertical Elevation Difference (|Δz|)' },
  { property: 'abs_delta_y', unit: 'mm', label: 'Depth Difference Relative to VP (|Δy|)' },
  { property: 'theta_hp', unit: 'deg', label: 'True Inclination to HP (θ)' },
  { property: 'phi_vp', unit: 'deg', label: 'True Inclination to VP (φ)' },
  { property: 'alpha_fv', unit: 'deg', label: 'Front View Angle with XY (α)' },
  { property: 'beta_tv', unit: 'deg', label: 'Top View Angle with XY (β)' },
  { property: 'start_z_hp', unit: 'mm', label: 'Start Point Distance from HP (z₁)' },
  { property: 'start_y_vp', unit: 'mm', label: 'Start Point Distance from VP (y₁)' },
  { property: 'end_z_hp', unit: 'mm', label: 'End Point Distance from HP (z₂)' },
  { property: 'end_y_vp', unit: 'mm', label: 'End Point Distance from VP (y₂)' },
];

export type PipelineStageName =
  | 'stage_1_ocr'
  | 'stage_2_initial_json'
  | 'stage_3_python_solver'
  | 'stage_4_validate_json'
  | 'stage_5_render_svg';

export type StageExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export interface PipelineStageTrace {
  stage: PipelineStageName;
  label: string;
  status: StageExecutionStatus;
  duration_ms: number;
  summary: string;
  error?: string | null;
}

export function validateCanonicalProblem(
  input: unknown
):
  | { ok: true; data: CanonicalEngineeringProblem }
  | { ok: false; errors: string[] } {
  const result = CanonicalEngineeringProblemSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const pathStr = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${pathStr}: ${issue.message}`;
  });
  return { ok: false, errors };
}

export function createMeasurementField(params: {
  property: string;
  value: number | null;
  unit: MeasurementUnit;
  status: MeasurementStatus;
  source_stage: SourceStage;
  epistemic_status?: EpistemicStatus;
  reference?: QuantityReference;
  excerpt?: string | null;
  dependencies?: string[];
  formula?: string | null;
  reason?: string | null;
  original_value?: number | null;
  original_unit?: string | null;
  validation_status?: FieldValidationStatus;
}): MeasurementField {
  const inferredEpistemic: EpistemicStatus =
    params.epistemic_status ??
    (params.status === 'given'
      ? 'observed'
      : params.status === 'derived'
      ? 'calculated'
      : 'unresolved');

  return {
    property: params.property,
    value: params.value,
    unit: params.unit,
    ...(params.original_value !== undefined ? { original_value: params.original_value } : {}),
    ...(params.original_unit !== undefined ? { original_unit: params.original_unit } : {}),
    status: params.status,
    ...(params.reference ? { reference: params.reference } : {}),
    provenance: {
      source_stage: params.source_stage,
      epistemic_status: inferredEpistemic,
      excerpt: params.excerpt ?? null,
      dependencies: params.dependencies ?? [],
      formula: params.formula ?? null,
      reason: params.reason ?? null,
    },
    validation_status: params.validation_status ?? 'unvalidated',
  };
}

export function getMeasurementValue(
  problem: CanonicalEngineeringProblem,
  property: string
): number | null {
  const fromGiven = problem.givens[property];
  if (fromGiven && typeof fromGiven.value === 'number' && Number.isFinite(fromGiven.value)) {
    return fromGiven.value;
  }
  const fromUnknown = problem.unknowns[property];
  if (fromUnknown && typeof fromUnknown.value === 'number' && Number.isFinite(fromUnknown.value)) {
    return fromUnknown.value;
  }
  return null;
}
