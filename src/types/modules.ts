/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModuleId = 'points' | 'lines' | 'planes' | 'solids' | 'sections';

export type AppRoute =
  | '/'
  | '/dashboard'
  | '/projection-of-points'
  | '/projection-of-lines';

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  code: string; // e.g. "V1", "V2", "V3"
  subtitle: string;
  description: string;
  route: string;
  iconName: 'Compass' | 'Ruler' | 'Square' | 'Box' | 'Scissors';
  status: 'active' | 'upcoming';
  badges: string[];
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'points',
    code: 'V1',
    title: 'Projection of Points',
    subtitle: 'Point Coordinates, Quadrants & 2D/3D Orthographics',
    description:
      'Analyze single and multi-point positions relative to HP and VP. Instant quadrant detection, lowercase with prime notation (a, a′), and interactive 3D Cartesian space.',
    route: '/projection-of-points',
    iconName: 'Compass',
    status: 'active',
    badges: ['Completed', '1st–4th Quadrant', 'Multi-Point'],
  },
  {
    id: 'lines',
    code: 'V2',
    title: 'Projection of Straight Lines',
    subtitle: 'True Length, True Angles (θ, φ), Apparent Angles (α, β) & Traces',
    description:
      'Solve straight line problems using end-points or true inclination methods. Computes Front View (EL), Top View (PL), Rotating Line Method constructions, Loci, and Traces (HT, VT).',
    route: '/projection-of-lines',
    iconName: 'Ruler',
    status: 'active',
    badges: ['New V2', 'Rotating Line Method', 'HT & VT Traces'],
  },
  {
    id: 'planes',
    code: 'V3',
    title: 'Projection of Planes',
    subtitle: 'Triangular, Rectangular & Circular Laminae',
    description:
      'Inclination to HP & VP, auxiliary views, corner/edge rests, and surface inclinations for 2D laminar figures.',
    route: '/projection-of-planes',
    iconName: 'Square',
    status: 'upcoming',
    badges: ['Coming in V3', 'Lamina Views'],
  },
  {
    id: 'solids',
    code: 'V4',
    title: 'Projection of Solids',
    subtitle: 'Prisms, Pyramids, Cylinders & Cones',
    description:
      'Axis inclinations to reference planes, base corner rests, generator projections, and hidden line conventions.',
    route: '/projection-of-solids',
    iconName: 'Box',
    status: 'upcoming',
    badges: ['Roadmap', 'Polyhedra & Solids of Revolution'],
  },
  {
    id: 'sections',
    code: 'V5',
    title: 'Section of Solids & Development',
    subtitle: 'Cutting Planes & True Shapes',
    description:
      'Sectional views, hatching conventions, true shape of sections, and parallel/radial line surface developments.',
    route: '/section-of-solids',
    iconName: 'Scissors',
    status: 'upcoming',
    badges: ['Roadmap', 'Hatching & Development'],
  },
];
