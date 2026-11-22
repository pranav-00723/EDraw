/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModuleImplementationStatus = 'implemented' | 'partial' | 'unsupported';

export type EngineeringModuleId =
  | 'projection_of_points'
  | 'projection_of_straight_lines'
  | 'projection_of_planes'
  | 'projection_of_solids'
  | 'sections_of_solids'
  | 'development_of_surfaces'
  | 'isometric_projections'
  | 'orthographic_projections'
  | 'perspective_drawing'
  | 'engineering_curves'
  | 'intersection_of_surfaces'
  | 'auxiliary_views'
  | 'unknown_module';

export interface EngineeringModuleDescriptor {
  id: EngineeringModuleId;
  name: string;
  implementation_status: ModuleImplementationStatus;
  supported_terminology: string[];
  recognized_entities: string[];
  measurement_types: string[];
  valid_constraints: string[];
  equation_families: string[];
  solver_capabilities: {
    deterministic_solver: boolean;
    partial_solving: boolean;
    contradiction_detection: boolean;
    underdetermination_diagnostics: boolean;
    multi_branch_ambiguity: boolean;
  };
  output_requirements: string[];
  rendering_capabilities: {
    svg_2d: boolean;
    interactive_module_route: string | null;
    generated_js_config: boolean;
  };
  validation_rules: string[];
  supported_problem_classes: string[];
  unsupported_problem_classes: string[];
}

export const ENGINEERING_MODULE_REGISTRY: Readonly<
  Record<EngineeringModuleId, EngineeringModuleDescriptor>
> = {
  projection_of_points: {
    id: 'projection_of_points',
    name: 'Projection of Points',
    implementation_status: 'implemented',
    supported_terminology: [
      'point',
      'quadrant',
      'first quadrant',
      'second quadrant',
      'third quadrant',
      'fourth quadrant',
      'above HP',
      'below HP',
      'on HP',
      'in HP',
      'in front of VP',
      'behind VP',
      'on VP',
      'in VP',
      'XY line',
      'front view',
      'top view',
      'elevation',
      'plan',
      'coordinates',
    ],
    recognized_entities: ['point', 'point_set'],
    measurement_types: [
      'x',
      'y',
      'z',
      'dist_hp',
      'dist_vp',
      'front_view_y',
      'top_view_y',
      'delta_x',
      'delta_y',
      'delta_z',
    ],
    valid_constraints: [
      'above_hp',
      'below_hp',
      'in_hp',
      'in_front_vp',
      'behind_vp',
      'in_vp',
      'on_xy',
      'quadrant',
      'relative_x',
      'relative_y',
      'relative_z',
    ],
    equation_families: [
      'z_from_hp_relation',
      'y_from_vp_relation',
      'front_view_y = z',
      'top_view_y = -y',
      'quadrant_classification',
      'relative_point_offset_propagation',
    ],
    solver_capabilities: {
      deterministic_solver: true,
      partial_solving: true,
      contradiction_detection: true,
      underdetermination_diagnostics: true,
      multi_branch_ambiguity: true,
    },
    output_requirements: [
      'coordinates_3d',
      'front_view_position',
      'top_view_position',
      'quadrant_or_boundary',
    ],
    rendering_capabilities: {
      svg_2d: true,
      interactive_module_route: '/projection-of-points',
      generated_js_config: true,
    },
    validation_rules: [
      'z_matches_hp_relation',
      'y_matches_vp_relation',
      'front_view_equals_z',
      'top_view_equals_neg_y',
      'quadrant_agrees_with_signs',
      'vertical_projector_x_alignment',
    ],
    supported_problem_classes: [
      'Single point in any of the 4 quadrants',
      'Boundary points on HP, VP, or XY line',
      'Multiple points with relative height/depth/lateral offsets',
      'Quadrant determination from view positions',
      'Partially solved and underdetermined point specifications',
    ],
    unsupported_problem_classes: [
      'Auxiliary side-plane (PP) profile view distance without lateral reference',
    ],
  },

  projection_of_straight_lines: {
    id: 'projection_of_straight_lines',
    name: 'Projection of Straight Lines',
    implementation_status: 'implemented',
    supported_terminology: [
      'straight line',
      'line segment',
      'true length',
      'front view',
      'top view',
      'elevation',
      'plan',
      'inclined to HP',
      'inclined to VP',
      'parallel to HP',
      'parallel to VP',
      'perpendicular to HP',
      'perpendicular to VP',
      'distance between end projectors',
      'DEP',
      'angle with XY',
      'apparent inclination',
      'traces',
    ],
    recognized_entities: ['straight_line', 'point'],
    measurement_types: [
      'true_length',
      'front_view_length',
      'top_view_length',
      'dep',
      'delta_x',
      'abs_delta_y',
      'abs_delta_z',
      'delta_y',
      'delta_z',
      'theta_hp',
      'phi_vp',
      'alpha_fv',
      'beta_tv',
      'start_z_hp',
      'start_y_vp',
      'end_z_hp',
      'end_y_vp',
    ],
    valid_constraints: [
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
      'quadrant',
      'direction_cosines',
      'endpoint_relation',
      'relative_height',
      'relative_depth',
    ],
    equation_families: [
      'L^2 = dx^2 + dy^2 + dz^2',
      'L_F^2 = dx^2 + dz^2',
      'L_T^2 = dx^2 + dy^2',
      'sin(theta) = |dz| / L',
      'cos(theta) = L_T / L',
      'sin(phi) = |dy| / L',
      'cos(phi) = L_F / L',
      'tan(alpha_F) = |dz| / dx',
      'tan(beta_T) = |dy| / dx',
      'sin^2(theta) + sin^2(phi) <= 1',
    ],
    solver_capabilities: {
      deterministic_solver: true,
      partial_solving: true,
      contradiction_detection: true,
      underdetermination_diagnostics: true,
      multi_branch_ambiguity: true,
    },
    output_requirements: [
      'true_length',
      'front_view_length',
      'top_view_length',
      'dep',
      'theta_hp',
      'phi_vp',
      'alpha_fv',
      'beta_tv',
      'endpoint_coordinates',
    ],
    rendering_capabilities: {
      svg_2d: true,
      interactive_module_route: '/projection-of-lines',
      generated_js_config: true,
    },
    validation_rules: [
      'fv_leq_tl',
      'tv_leq_tl',
      'dep_leq_fv_and_tv',
      'direction_cosines_bound',
      '3d_pythagoras_residual',
      'end_projector_x_alignment',
      'view_angle_distinct_from_true_inclination',
    ],
    supported_problem_classes: [
      'Lines parallel/perpendicular to HP or VP',
      'Lines inclined to one or both reference planes',
      'Problems with unknown true length derived from FV, TV, DEP, or endpoints',
      'Problems given apparent view lengths and angles with XY',
      'Arbitrary endpoint labels (AB, CD, NM, LK, JP, etc.)',
      'Multi-branch ambiguity detection and inconsistent constraint detection',
    ],
    unsupported_problem_classes: [
      'Non-Euclidean curved segments',
      'Profile-plane-only trace reconstruction without endpoint heights/depths',
    ],
  },

  projection_of_planes: {
    id: 'projection_of_planes',
    name: 'Projection of Planes / Laminas',
    implementation_status: 'unsupported',
    supported_terminology: [
      'lamina',
      'plane figure',
      'pentagonal plate',
      'hexagonal plate',
      'triangular lamina',
      'square plate',
      'circular plate',
      'surface inclined',
    ],
    recognized_entities: ['plane'],
    measurement_types: ['side_length', 'diameter', 'surface_inclination_hp', 'surface_inclination_vp'],
    valid_constraints: ['resting_edge', 'resting_corner', 'surface_inclined_hp', 'surface_inclined_vp'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['front_view', 'top_view'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['All 2D plane/lamina projections (adapter planned)'],
  },

  projection_of_solids: {
    id: 'projection_of_solids',
    name: 'Projection of Solids',
    implementation_status: 'unsupported',
    supported_terminology: [
      'prism',
      'pyramid',
      'cylinder',
      'cone',
      'tetrahedron',
      'cube',
      'hexahedron',
      'axis inclined',
      'base edge',
      'apex',
      'slant edge',
    ],
    recognized_entities: ['solid'],
    measurement_types: ['base_edge', 'base_diameter', 'axis_height', 'axis_inclination_hp', 'axis_inclination_vp'],
    valid_constraints: ['resting_on_base', 'resting_on_base_edge', 'resting_on_corner', 'axis_inclined'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['front_view', 'top_view'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['All 3D polyhedra/solid projections (adapter planned)'],
  },

  sections_of_solids: {
    id: 'sections_of_solids',
    name: 'Sections of Solids',
    implementation_status: 'unsupported',
    supported_terminology: ['section plane', 'cutting plane', 'sectional top view', 'true shape of section', 'VT', 'HT'],
    recognized_entities: ['solid', 'section_plane'],
    measurement_types: ['cutting_angle', 'cutting_offset'],
    valid_constraints: ['section_plane_inclination'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['sectional_view', 'true_shape_of_section'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Sectional views and true shape of section'],
  },

  development_of_surfaces: {
    id: 'development_of_surfaces',
    name: 'Development of Surfaces',
    implementation_status: 'unsupported',
    supported_terminology: ['development of lateral surface', 'stretch-out', 'parallel line development', 'radial line development'],
    recognized_entities: ['solid', 'surface'],
    measurement_types: ['base_perimeter', 'slant_length', 'sector_angle'],
    valid_constraints: ['lateral_development'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['developed_surface'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Surface development drawings'],
  },

  isometric_projections: {
    id: 'isometric_projections',
    name: 'Isometric Projections & Views',
    implementation_status: 'unsupported',
    supported_terminology: ['isometric projection', 'isometric view', 'isometric scale', 'isometric axes'],
    recognized_entities: ['solid', 'isometric_box'],
    measurement_types: ['length', 'width', 'height', 'isometric_scale_factor'],
    valid_constraints: ['isometric_30deg_axes'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['isometric_drawing'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Isometric projections'],
  },

  orthographic_projections: {
    id: 'orthographic_projections',
    name: 'Orthographic Projections of Machine Blocks',
    implementation_status: 'unsupported',
    supported_terminology: ['orthographic view', 'pictorial view', 'end view', 'sectional front view', 'first angle projection of block'],
    recognized_entities: ['solid', 'machine_part'],
    measurement_types: ['overall_length', 'overall_width', 'overall_height'],
    valid_constraints: ['multi_view_projection'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['front_view', 'top_view', 'side_view'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Multi-view machine component drawings'],
  },

  perspective_drawing: {
    id: 'perspective_drawing',
    name: 'Perspective Projection',
    implementation_status: 'unsupported',
    supported_terminology: ['perspective view', 'picture plane', 'station point', 'vanishing point', 'horizon line', 'ground line'],
    recognized_entities: ['solid', 'perspective_rig'],
    measurement_types: ['station_point_distance', 'eye_height'],
    valid_constraints: ['visual_ray_intersection'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['perspective_view'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Visual-ray and vanishing-point perspective drawings'],
  },

  engineering_curves: {
    id: 'engineering_curves',
    name: 'Engineering Curves',
    implementation_status: 'unsupported',
    supported_terminology: ['ellipse', 'parabola', 'hyperbola', 'cycloid', 'epicycloid', 'hypocycloid', 'involute', 'helix', 'eccentricity', 'directrix', 'focus'],
    recognized_entities: ['curve'],
    measurement_types: ['eccentricity', 'major_axis', 'minor_axis', 'rolling_radius'],
    valid_constraints: ['conic_locus', 'rolling_locus'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['curve_plot', 'tangent_and_normal'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Conics, cycloidal curves, involutes, spirals, helices'],
  },

  intersection_of_surfaces: {
    id: 'intersection_of_surfaces',
    name: 'Intersection of Surfaces',
    implementation_status: 'unsupported',
    supported_terminology: ['intersection curve', 'penetration', 'intersecting cylinders', 'penetrating prism'],
    recognized_entities: ['solid', 'surface'],
    measurement_types: ['axis_offset', 'cylinder_radius'],
    valid_constraints: ['surface_intersection'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['curve_of_intersection'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Interpenetration curves of 3D solids'],
  },

  auxiliary_views: {
    id: 'auxiliary_views',
    name: 'Auxiliary Views',
    implementation_status: 'unsupported',
    supported_terminology: ['auxiliary inclined plane', 'AIP', 'auxiliary vertical plane', 'AVP', 'auxiliary view'],
    recognized_entities: ['auxiliary_plane'],
    measurement_types: ['auxiliary_angle'],
    valid_constraints: ['auxiliary_projection'],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: ['auxiliary_view'],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Auxiliary views onto AIP / AVP'],
  },

  unknown_module: {
    id: 'unknown_module',
    name: 'Unclassified / Clarification Required',
    implementation_status: 'unsupported',
    supported_terminology: [],
    recognized_entities: [],
    measurement_types: [],
    valid_constraints: [],
    equation_families: [],
    solver_capabilities: {
      deterministic_solver: false,
      partial_solving: false,
      contradiction_detection: false,
      underdetermination_diagnostics: false,
      multi_branch_ambiguity: false,
    },
    output_requirements: [],
    rendering_capabilities: { svg_2d: false, interactive_module_route: null, generated_js_config: false },
    validation_rules: [],
    supported_problem_classes: [],
    unsupported_problem_classes: ['Insufficient domain context to classify safely'],
  },
};

export function getModuleDescriptor(moduleId: EngineeringModuleId): EngineeringModuleDescriptor {
  return ENGINEERING_MODULE_REGISTRY[moduleId] || ENGINEERING_MODULE_REGISTRY.unknown_module;
}

export function listRegisteredModules(): EngineeringModuleDescriptor[] {
  return Object.values(ENGINEERING_MODULE_REGISTRY).filter((m) => m.id !== 'unknown_module');
}

export function mapModuleToTaskDomain(
  moduleId: EngineeringModuleId
):
  | 'point_projection'
  | 'straight_line_projection'
  | 'plane_projection'
  | 'solid_projection'
  | 'section_of_solids'
  | 'development_of_surfaces'
  | 'isometric_projections'
  | 'orthographic_projections'
  | 'perspective_drawing'
  | 'engineering_curves'
  | 'intersection_of_surfaces'
  | 'auxiliary_views'
  | 'unknown' {
  switch (moduleId) {
    case 'projection_of_points':
      return 'point_projection';
    case 'projection_of_straight_lines':
      return 'straight_line_projection';
    case 'projection_of_planes':
      return 'plane_projection';
    case 'projection_of_solids':
      return 'solid_projection';
    case 'sections_of_solids':
      return 'section_of_solids';
    case 'development_of_surfaces':
      return 'development_of_surfaces';
    case 'isometric_projections':
      return 'isometric_projections';
    case 'orthographic_projections':
      return 'orthographic_projections';
    case 'perspective_drawing':
      return 'perspective_drawing';
    case 'engineering_curves':
      return 'engineering_curves';
    case 'intersection_of_surfaces':
      return 'intersection_of_surfaces';
    case 'auxiliary_views':
      return 'auxiliary_views';
    default:
      return 'unknown';
  }
}
