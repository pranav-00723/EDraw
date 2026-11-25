/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RotatingStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface LineVideoStep {
  num: RotatingStepNumber;
  id:
    | 'xy_line'
    | 'endpoint_a'
    | 'aux_ab1'
    | 'aux_ab2'
    | 'loci'
    | 'rotate_top_view'
    | 'rotate_front_view'
    | 'verify';
  title: string;
  sub: string;
  description: string;
  mathNote: string;
  narration: string;
}

export interface LineVideoScriptParams {
  nameA: string;
  nameB: string;
  tl: number;
  theta: number;
  phi: number;
  plAux: number;
  elAux: number;
  zA: number;
  yA: number;
  zB: number;
  yB: number;
  depCalculated: number;
  alphaApparent: number;
  betaApparent: number;
  hasHt?: boolean;
  hasVt?: boolean;
}

function fmtSpokenNum(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function buildLineVideoSteps(params: LineVideoScriptParams): LineVideoStep[] {
  const {
    nameA,
    nameB,
    tl,
    theta,
    phi,
    plAux,
    elAux,
    zA,
    yA,
    zB,
    yB,
    depCalculated,
    alphaApparent,
    betaApparent,
    hasHt = false,
    hasVt = false,
  } = params;

  const lineLabel = `${(nameA || 'A').trim()}${(nameB || 'B').trim()}`;

  const spokenZAPhrase =
    Math.abs(zA) < 0.05
      ? 'directly on the X Y line because end A lies on the horizontal plane'
      : zA > 0
      ? `${fmtSpokenNum(Math.abs(zA))} millimeters above X Y`
      : `${fmtSpokenNum(Math.abs(zA))} millimeters below X Y`;

  const spokenYAPhrase =
    Math.abs(yA) < 0.05
      ? 'directly on the X Y line because end A lies on the vertical plane'
      : yA > 0
      ? `${fmtSpokenNum(Math.abs(yA))} millimeters below X Y, representing ${fmtSpokenNum(Math.abs(yA))} millimeters in front of V P`
      : `${fmtSpokenNum(Math.abs(yA))} millimeters above X Y, representing ${fmtSpokenNum(Math.abs(yA))} millimeters behind V P`;

  const thetaSpoken =
    theta < 0.1
      ? 'parallel to X Y at zero degrees'
      : `inclined at ${fmtSpokenNum(theta)} degrees to the horizontal`;

  const phiSpoken =
    phi < 0.1
      ? 'parallel to X Y at zero degrees'
      : `inclined at ${fmtSpokenNum(phi)} degrees to the horizontal`;

  const tracesSpoken =
    hasHt && hasVt
      ? 'Both horizontal and vertical traces are also projected onto the drawing.'
      : hasHt
      ? 'The horizontal trace H T is also projected where the line meets the horizontal plane.'
      : hasVt
      ? 'The vertical trace V T is also projected where the line meets the vertical plane.'
      : '';

  return [
    {
      num: 1,
      id: 'xy_line',
      title: 'Step 1: Reference Line XY',
      sub: 'Establish the ground line representing the intersection of HP and VP',
      description:
        'Draw the horizontal reference line XY. In First-Angle projection, the area above XY represents the Vertical Plane (VP for Front View/Elevation), and the area below XY represents the Horizontal Plane (HP for Top View/Plan).',
      mathNote: 'Ground line XY: y = 0. Establishes the coordinate origin and drafting scale.',
      narration: `Step 1: Draw the horizontal reference line, X Y. This line is the intersection hinge between the vertical and horizontal planes. In first-angle projection for line ${lineLabel}, the region above X Y holds the front view on V P, and the region below X Y holds the top view on H P.`,
    },
    {
      num: 2,
      id: 'endpoint_a',
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
      narration: `Step 2: Locate endpoint A. First draw a thin vertical projector perpendicular to X Y. Along this projector, mark front view a prime ${spokenZAPhrase}, and mark top view a ${spokenYAPhrase}. Both views stay aligned on this exact vertical projector.`,
    },
    {
      num: 3,
      id: 'aux_ab1',
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
      narration: `Step 3: Construct the first auxiliary position, assuming the line is parallel to V P. From a prime, draw the true length line a prime b one prime equal to ${fmtSpokenNum(tl)} millimeters, ${thetaSpoken}. Then drop a vertical projector straight down from b one prime to meet the horizontal line through a at point b one. That gives us the plan length, a b one, equal to ${fmtSpokenNum(plAux)} millimeters.`,
    },
    {
      num: 4,
      id: 'aux_ab2',
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
      narration: `Step 4: Next, construct the second auxiliary position, assuming the line is parallel to H P. From a, draw the true length line a b two equal to ${fmtSpokenNum(tl)} millimeters, ${phiSpoken}. Project vertically upward from b two to meet the horizontal line through a prime at b two prime. That gives us the elevation length, a prime b two prime, equal to ${fmtSpokenNum(elAux)} millimeters.`,
    },
    {
      num: 5,
      id: 'loci',
      title: 'Step 5: Locus Construction (Locus of b′ and Locus of b)',
      sub: 'Draw continuous horizontal locus lines parallel to XY through b₁′ and b₂ with NO gaps',
      description: `Through b₁′ in VP, draw the horizontal line parallel to XY: this is the "Locus of b′". Through b₂ in HP, draw the horizontal line parallel to XY: this is the "Locus of b". The locus lines extend seamlessly across the drawing with no gaps, defining the fixed vertical height and depth bounds for end B.`,
      mathNote: `Locus of b′: height = ${zB.toFixed(1)} mm above HP. Locus of b: depth = ${yB.toFixed(
        1
      )} mm in front of VP.`,
      narration: `Step 5: Draw the horizontal locus lines without any gaps. Through b one prime in the front view, draw a continuous line parallel to X Y for the locus of b prime at ${fmtSpokenNum(zB)} millimeters. Through b two in the top view, draw a continuous line parallel to X Y for the locus of b at ${fmtSpokenNum(yB)} millimeters. The final views of endpoint B must land on these two tracks.`,
    },
    {
      num: 6,
      id: 'rotate_top_view',
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
      narration: `Step 6: Rotate to find the final top view. Place your compass needle at a, open it to the plan length a b one of ${fmtSpokenNum(plAux)} millimeters, and swing an arc until it cuts the locus of b. Label that intersection b, and join a to b with a bold continuous line. This completes the final top view at apparent angle beta equal to ${fmtSpokenNum(betaApparent)} degrees.`,
    },
    {
      num: 7,
      id: 'rotate_front_view',
      title: 'Step 7: Final Front View Rotation & End Projector Verification',
      sub: 'Center a′, radius R = a′b₂′ (Elevation Length), swing arc to cut Locus of b′ at b′',
      description: `With front view a′ as center and radius equal to elevation length a′b₂′ (EL = ${elAux.toFixed(
        1
      )} mm), swing a circular arc to intersect the Locus of b′ at point b′. Join a′ and b′ with a thick continuous line for the final Front View. Now connect b′ and b with a thin vertical projector: notice b′ and b lie on the EXACT same vertical line perpendicular to XY!`,
      mathNote: `Center a′, Radius R = a′b₂′ = ${elAux.toFixed(
        1
      )} mm. Projector check: x(b′) ≡ x(b) = DEP = ${depCalculated.toFixed(2)} mm! Verified!`,
      narration: `Step 7: Rotate to find the final front view. Place your compass at a prime with radius equal to the elevation length ${fmtSpokenNum(elAux)} millimeters, and swing an arc to cut the locus of b prime at point b prime. Join a prime to b prime with a bold line. Now draw a vertical projector between b prime and b—notice they align vertically at projector distance ${fmtSpokenNum(depCalculated)} millimeters.`,
    },
    {
      num: 8,
      id: 'verify',
      title: 'Step 8: Finishing & Engineering Graphics Verification',
      sub: 'Highlight final views, show apparent angles (α, β), and verify all geometric invariants',
      description: `The complete orthographic projection is obtained: Front View a′b′ (Elevation) and Top View ab (Plan) are highlighted in bold. Apparent angles α = ${alphaApparent.toFixed(
        1
      )}° and β = ${betaApparent.toFixed(
        1
      )}° are marked. All construction lines, auxiliary lines, and loci are preserved according to BIS SP 46 standard.`,
      mathNote: `TL = ${tl.toFixed(1)} mm | EL = ${elAux.toFixed(1)} mm | PL = ${plAux.toFixed(
        1
      )} mm | θ = ${theta.toFixed(1)}° | φ = ${phi.toFixed(1)}° | α = ${alphaApparent.toFixed(
        1
      )}° | β = ${betaApparent.toFixed(1)}° | DEP = ${depCalculated.toFixed(1)} mm.`,
      narration: `Step 8: Final verification. Your orthographic graph for line ${lineLabel} is complete: the bold front view a prime b prime measures ${fmtSpokenNum(elAux)} millimeters at apparent angle alpha equal to ${fmtSpokenNum(alphaApparent)} degrees, and the bold top view a b measures ${fmtSpokenNum(plAux)} millimeters at apparent angle beta equal to ${fmtSpokenNum(betaApparent)} degrees, with all construction lines and loci preserved. ${tracesSpoken}`.trim(),
    },
  ];
}
