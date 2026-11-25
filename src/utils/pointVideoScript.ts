/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ComputedPoint } from '../types/projection';

export interface PointVideoStep {
  id:
    | 'classify'
    | 'xy_line'
    | 'projector'
    | 'front_view'
    | 'top_view'
    | 'dimensions'
    | 'verify';
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  shortTitle: string;
  title: string;
  durationMs: number;
  instrument: string;
  pencilGrade: 'Concept' | 'HB' | '2H' | 'Audit';
  what: string;
  how: string;
  why: string;
  when: string;
  narration: string;
}

export interface SubtitleCue {
  text: string;
  startChar: number;
  endChar: number;
  startRatio: number;
  endRatio: number;
}

function formatHpPhrase(pt: ComputedPoint): string {
  if (pt.hpRelation === 'ON') return 'on HP (0 mm from HP)';
  if (pt.hpRelation === 'ABOVE') return `${pt.distHp} mm above HP`;
  return `${pt.distHp} mm below HP`;
}

function formatVpPhrase(pt: ComputedPoint): string {
  if (pt.vpRelation === 'ON') return 'on VP (0 mm from VP)';
  if (pt.vpRelation === 'IN_FRONT') return `${pt.distVp} mm in front of VP`;
  return `${pt.distVp} mm behind VP`;
}

function formatQuadrantLabel(pt: ComputedPoint): string {
  switch (pt.quadrant) {
    case 'FIRST':
      return 'First Quadrant';
    case 'SECOND':
      return 'Second Quadrant';
    case 'THIRD':
      return 'Third Quadrant';
    case 'FOURTH':
      return 'Fourth Quadrant';
    case 'ON_HP_IN_FRONT':
      return 'Boundary between 1st and 4th Quadrants (On HP, In Front of VP)';
    case 'ON_HP_BEHIND':
      return 'Boundary between 2nd and 3rd Quadrants (On HP, Behind VP)';
    case 'ON_VP_ABOVE':
      return 'Boundary between 1st and 2nd Quadrants (On VP, Above HP)';
    case 'ON_VP_BELOW':
      return 'Boundary between 3rd and 4th Quadrants (On VP, Below HP)';
    case 'ON_BOTH_XY':
      return 'XY Intersection Axis (On both HP and VP)';
  }
}

function formatSpokenPointLabel(label: string): string {
  const clean = label.replace(/[()]/g, '').trim();
  if (clean.includes('′')) {
    return `${clean.replace(/′/g, '')} prime`;
  }
  return clean;
}

export function buildPointVideoSteps(pt: ComputedPoint): PointVideoStep[] {
  const hpPhrase = formatHpPhrase(pt);
  const vpPhrase = formatVpPhrase(pt);
  const quadLabel = formatQuadrantLabel(pt);
  const spokenFv = formatSpokenPointLabel(pt.frontViewLabel);
  const spokenTv = formatSpokenPointLabel(pt.topViewLabel);

  const fvDirection =
    pt.frontViewY > 0
      ? `${pt.distHp} mm ABOVE XY`
      : pt.frontViewY < 0
      ? `${pt.distHp} mm BELOW XY`
      : 'directly ON the XY line';

  const tvDirection =
    pt.topViewY > 0
      ? `${pt.distVp} mm ABOVE XY`
      : pt.topViewY < 0
      ? `${pt.distVp} mm BELOW XY`
      : 'directly ON the XY line';

  const viewsCoincide = Math.abs(pointFrontMinusTop(pt)) < 0.5;
  const sameSideNonCoincident =
    !viewsCoincide &&
    ((pt.frontViewY > 0 && pt.topViewY > 0) || (pt.frontViewY < 0 && pt.topViewY < 0));

  const bothAbove = pt.frontViewY >= 0 && pt.topViewY >= 0 && (pt.frontViewY > 0 || pt.topViewY > 0);
  const bothBelow = pt.frontViewY <= 0 && pt.topViewY <= 0 && (pt.frontViewY < 0 || pt.topViewY < 0);

  const xyPlacementAdvice = bothAbove
    ? 'Since both views lie above XY, draw the XY line slightly lower than center so there is ample space above it.'
    : bothBelow
    ? 'Since both views lie below XY, draw the XY line slightly higher than center so there is ample space below it.'
    : 'Center the XY line horizontally across your drawing area so both the VP zone above and HP zone below have equal room.';

  const step1: PointVideoStep = {
    id: 'classify',
    stepNumber: 1,
    shortTitle: 'Decode & Classify',
    title: `Step 1 · Read Problem & Identify ${quadLabel}`,
    durationMs: 7800,
    instrument: 'Mental Analysis · Quadrant Diagram',
    pencilGrade: 'Concept',
    what: `Extract the two perpendicular distances for Point ${pt.name}: ${hpPhrase}, and ${vpPhrase}. This places Point ${pt.name} in the ${quadLabel}.`,
    how: `Write a neat "Given" block on the top-left of your rough margin: HP = ${hpPhrase}; VP = ${vpPhrase}. Underline "above/below HP" (governs Front View) and "in front/behind VP" (governs Top View).`,
    why: `In orthographic projection, 3D space is divided by two perpendicular planes—HP and VP. Knowing the quadrant tells you in advance whether Front View (${pt.frontViewLabel}) and Top View (${pt.topViewLabel}) will fall on opposite sides or the same side of XY.`,
    when: `Always do this before drawing a single line on the sheet so you leave enough blank space above and below XY.`,
    narration: `Let's begin with Step 1. Before touching your pencil to the sheet, read the given data for Point ${pt.name}. It sits ${hpPhrase}, and ${vpPhrase}, which places it in the ${quadLabel}. Doing this first tells us right away where each view will land, so we leave plenty of room on the paper.`,
  };

  const step2: PointVideoStep = {
    id: 'xy_line',
    stepNumber: 2,
    shortTitle: 'Draw X–Y Line',
    title: 'Step 2 · Draw the Reference Ground Line (X–Y)',
    durationMs: 7500,
    instrument: 'HB / H Pencil · Mini-Drafter or T-Square',
    pencilGrade: 'HB',
    what: `Draw a clean horizontal reference line across the sheet and label its ends X (left) and Y (right).`,
    how: `Lock your mini-drafter or T-square horizontally. Using an HB or H pencil in one steady left-to-right stroke, draw a thin continuous line (~0.35 mm). Print uppercase X and Y cleanly at the two ends. ${xyPlacementAdvice}`,
    why: `The X–Y line is the exact intersection edge where the Vertical Plane (VP) and Horizontal Plane (HP) meet at 90 degrees. Every distance in Front View and Top View is measured perpendicular to this zero-datum line.`,
    when: `Draw X–Y first as the structural baseline of every projection problem—never plot any point before X–Y is established.`,
    narration: `Step 2: Draw the horizontal reference line, X Y. Lock your mini-drafter horizontally, take an H or HB pencil, and pull one smooth, continuous line from left to right. Label X on the left and Y on the right. Think of X Y as the hinge between the vertical and horizontal planes—every measurement starts here.`,
  };

  const step3: PointVideoStep = {
    id: 'projector',
    stepNumber: 3,
    shortTitle: 'Draw Projector',
    title: 'Step 3 · Draw a Thin Continuous Vertical Projector (2H)',
    durationMs: 7500,
    instrument: '2H Pencil · 90° Set-Square / Drafter',
    pencilGrade: '2H',
    what: `Pick the horizontal station ${pt.x !== 0 ? `at x = ${pt.x} mm` : 'near the center'} on X–Y, mark intersection o, and draw a vertical projector perpendicular to X–Y.`,
    how: `Align your set-square or drafter at exactly 90° to the X–Y line. With a sharp 2H pencil and very light pressure, draw a continuous thin construction line extending both above and below X–Y. Never make projector lines dashed or dotted.`,
    why: `Because the front observer and top observer look at the exact same point ${pt.name} in 3D space, both projections share the same lateral coordinate along X–Y and must stay strictly aligned vertically.`,
    when: `Draw the vertical projector immediately after X–Y and before measuring either view, so ${pt.frontViewLabel} and ${pt.topViewLabel} are guaranteed to align vertically.`,
    narration: `Step 3: Now rest your set-square at ninety degrees to X Y, mark the center point o, and draw a light vertical projector line using a sharp 2H pencil. Keep it thin and continuous—never dashed or dotted. We draw this line first so both our front view and top view stay perfectly aligned.`,
  };

  const fvWhy =
    pt.hpRelation === 'ABOVE'
      ? `Looking from the front, a point ${pt.distHp} mm above HP projects straight onto the Vertical Plane ${pt.distHp} mm above the X–Y hinge. Since VP stays fixed upright, it stays ABOVE X–Y.`
      : pt.hpRelation === 'BELOW'
      ? `Looking from the front, a point ${pt.distHp} mm below HP projects straight onto the lower Vertical Plane ${pt.distHp} mm below the X–Y hinge. Since VP stays fixed, it stays BELOW X–Y.`
      : `Because Point ${pt.name} lies directly ON the Horizontal Plane (distance from HP is 0), its height relative to HP is zero—so its front view sits right ON the X–Y line.`;

  const step4: PointVideoStep = {
    id: 'front_view',
    stepNumber: 4,
    shortTitle: `Plot Front View ${pt.frontViewLabel}`,
    title: `Step 4 · Measure & Plot Front View ${pt.frontViewLabel} (Elevation)`,
    durationMs: 8200,
    instrument: 'Millimeter Scale / Divider · HB Pencil',
    pencilGrade: 'HB',
    what: `Locate Front View ${pt.frontViewLabel} along the vertical projector at ${fvDirection}.`,
    how:
      pt.distHp > 0
        ? `Place the zero mark of your millimeter scale (or divider) at intersection o on X–Y. Measure exactly ${pt.distHp} mm ${pt.frontViewY > 0 ? 'upward' : 'downward'} along the 2H projector. Mark a crisp dot with an HB pencil and label it lowercase ${pt.frontViewLabel} (with a prime ′) neatly to the left.`
        : `Since distance from HP is 0 mm, mark the Front View dot directly on intersection o on the X–Y line with an HB pencil and label it lowercase ${pt.frontViewLabel}.`,
    why: `${fvWhy} Remember the golden rule: Front View always uses the distance from HP, never the distance from VP.`,
    when: `Plot the Front View right after drawing the vertical projector, while your scale is aligned along the projector axis.`,
    narration: `Step 4: Let's plot the front view, ${spokenFv}. Place your millimeter scale at point o on X Y, measure ${pt.distHp} millimeters ${pt.frontViewY > 0 ? 'straight up above X Y' : pt.frontViewY < 0 ? 'straight down below X Y' : 'and stay right on the X Y line'}, mark a crisp dot with your HB pencil, and label it ${spokenFv}. Always remember: the front view uses the distance from H P.`,
  };

  const tvRotationWhy =
    pt.vpRelation === 'IN_FRONT'
      ? `In BIS/ISO convention, HP rotates 90° clockwise around X–Y to flatten onto the sheet. The front half of HP (in front of VP) swings DOWNWARD, carrying ${pt.topViewLabel} to ${pt.distVp} mm BELOW X–Y.`
      : pt.vpRelation === 'BEHIND'
      ? `In BIS/ISO convention, HP rotates 90° clockwise around X–Y to flatten onto the sheet. The rear half of HP (behind VP) swings UPWARD, carrying ${pt.topViewLabel} to ${pt.distVp} mm ABOVE X–Y.`
      : `Because Point ${pt.name} lies directly ON the Vertical Plane (distance from VP is 0), rotating HP 90° clockwise leaves the point right on the X–Y hinge.`;

  const coincidenceNote = viewsCoincide
    ? ` Notice that ${pt.frontViewLabel} and ${pt.topViewLabel} land at the exact same spot! Combine the label as "${pt.frontViewLabel}, ${pt.topViewLabel}" so both views are clearly identified.`
    : '';

  const spokenCoincidenceNote = viewsCoincide
    ? ` Notice both ${spokenFv} and ${spokenTv} land on the exact same spot, so write both labels together right beside that point.`
    : '';

  const step5: PointVideoStep = {
    id: 'top_view',
    stepNumber: 5,
    shortTitle: `Plot Top View ${pt.topViewLabel}`,
    title: `Step 5 · Rotate HP 90° CW & Plot Top View ${pt.topViewLabel} (Plan)`,
    durationMs: 8800,
    instrument: 'Millimeter Scale / Divider · HB Pencil',
    pencilGrade: 'HB',
    what: `Locate Top View ${pt.topViewLabel} along the same vertical projector at ${tvDirection}.${coincidenceNote}`,
    how:
      pt.distVp > 0
        ? `Measure ${pt.distVp} mm from o along the same 2H projector (${pt.topViewY < 0 ? 'downward below X–Y' : 'upward above X–Y'}). Mark the HB dot and print lowercase ${pt.topViewLabel} without a prime.${coincidenceNote}`
        : `Because distance from VP is 0 mm, mark ${pt.topViewLabel} directly on X–Y at o (lowercase, no prime).${coincidenceNote}`,
    why: `${tvRotationWhy} Top View always uses the distance from VP and never carries a prime symbol.`,
    when: `Plot Top View immediately after Front View on the same vertical projector, carefully checking whether "in front" (below XY) or "behind" (above XY) applies.`,
    narration: `Step 5: Now let's plot the top view, ${spokenTv}. When we unfold the horizontal plane ninety degrees clockwise around X Y, ${pt.vpRelation === 'IN_FRONT' ? 'the front side swings downward below X Y' : pt.vpRelation === 'BEHIND' ? 'the rear side swings upward above X Y' : 'a point on V P stays right on X Y'}. Measure ${pt.distVp} millimeters along the same projector and label it lowercase ${spokenTv}, with no prime.${spokenCoincidenceNote}`,
  };

  const staggerHow = sameSideNonCoincident
    ? `Because ${pt.frontViewLabel} and ${pt.topViewLabel} are on the SAME side of X–Y, stagger the two dimension lines: place the shorter distance (${Math.min(pt.distHp, pt.distVp)} mm) closer to the projector and the larger distance (${Math.max(pt.distHp, pt.distVp)} mm) slightly farther right so dimension lines never cross!`
    : `Place each dimension line ~10 to 15 mm to the right of the projector so the numbers stay clear of the point labels.`;

  const step6: PointVideoStep = {
    id: 'dimensions',
    stepNumber: 6,
    shortTitle: 'Dimension Lines',
    title: 'Step 6 · Draw 2H Extension Lines, Dimension Lines & 3:1 Arrows',
    durationMs: 8000,
    instrument: '2H Pencil · Scale · Fine Arrowheads',
    pencilGrade: '2H',
    what: `Add neat extension lines, vertical dimension lines, filled 3:1 arrowheads, and exact millimeter values (${pt.distHp > 0 ? `${pt.distHp}` : ''}${pt.distHp > 0 && pt.distVp > 0 ? ' and ' : ''}${pt.distVp > 0 ? `${pt.distVp}` : ''}${pt.distHp === 0 && pt.distVp === 0 ? '0 mm on XY' : ''}).`,
    how: `Draw thin 2H horizontal extension lines starting ~1.5 mm away from the point dots. ${staggerHow} Add sharp 3:1 closed arrowheads touching the extension lines and write dimensions cleanly parallel to the line.`,
    why: `Engineering drawings communicate exact size unambiguously. Staggering smaller dimensions inside larger ones prevents crossing lines and keeps every measurement readable on an exam sheet.`,
    when: `Always dimension AFTER plotting both ${pt.frontViewLabel} and ${pt.topViewLabel}, once you know whether they sit on opposite sides or the same side of X–Y.`,
    narration: `Step 6: Next, add clean dimensions with your 2H pencil. Draw thin horizontal extension lines from X Y and from each plotted point, then add vertical dimension lines with neat three-to-one arrowheads. ${sameSideNonCoincident ? 'Because both views sit on the same side of X Y, place the shorter distance inside and the longer distance outside so the lines never cross.' : 'Write the exact millimeter values clearly beside each arrow.'}`,
  };

  const step7: PointVideoStep = {
    id: 'verify',
    stepNumber: 7,
    shortTitle: 'Verify & Title Block',
    title: 'Step 7 · Final BIS SP 46 Audit & Title Block Check',
    durationMs: 7400,
    instrument: 'HB Pencil · Final Inspection Checklist',
    pencilGrade: 'Audit',
    what: `Complete the Title Block ("All Dimensions Are In mm") and audit all 4 exam checks on your finished graph.`,
    how: `Verify: (1) X–Y line is crisp and labeled; (2) Projector is a continuous thin 2H line, not dashed; (3) Front View ${pt.frontViewLabel} has a prime (′) and Top View ${pt.topViewLabel} does not; (4) Distances ${pt.distHp} mm (from HP) and ${pt.distVp} mm (from VP) match ${quadLabel}.`,
    why: `A 15-second final inspection catches common exam mistakes—such as swapped HP/VP distances, missing prime symbols, or dashed projectors—before you submit your drawing sheet.`,
    when: `Perform this final audit right after dimensioning, before erasing construction smudges or moving on to the next question.`,
    narration: `Step 7: Take fifteen seconds for a final inspection before you wrap up. Check that X Y is crisp and labeled, your projector is a thin solid 2H line, ${spokenFv} has a prime while ${spokenTv} does not, and the title block states all dimensions are in millimeters. Your projection graph is complete and ready for full marks.`,
  };

  return [step1, step2, step3, step4, step5, step6, step7];
}

function pointFrontMinusTop(pt: ComputedPoint): number {
  return pt.frontViewY - pt.topViewY;
}

/**
 * Splits a step's narration paragraph into concise phrase-by-phrase subtitle cues
 * (around 4–10 words each) with exact character ranges and speech-weighted ratios,
 * so captions track the spoken voice progressively instead of appearing all at once.
 */
export function splitNarrationIntoSubtitleCues(narration: string): SubtitleCue[] {
  const source = narration.trim();
  if (!source) return [];

  // 1. Split at natural sentence and clause punctuation boundaries while preserving offsets
  const rawClauses: Array<{ text: string; startChar: number; endChar: number }> = [];
  const clauseRegex = /[^.!?:;—]+(?:[.!?:;—]+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = clauseRegex.exec(source)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const leadingSpaces = raw.indexOf(trimmed);
    const startChar = match.index + leadingSpaces;
    const endChar = startChar + trimmed.length;
    rawClauses.push({ text: trimmed, startChar, endChar });
  }

  // 2. Further split at commas if a clause is long (> 52 chars)
  const commaSplitClauses: Array<{ text: string; startChar: number; endChar: number }> = [];
  for (const clause of rawClauses) {
    if (clause.text.length <= 52) {
      commaSplitClauses.push(clause);
      continue;
    }
    const subRegex = /[^,]+(?:,+|$)/g;
    let subMatch: RegExpExecArray | null;
    while ((subMatch = subRegex.exec(clause.text)) !== null) {
      const subRaw = subMatch[0];
      const subTrim = subRaw.trim();
      if (!subTrim) continue;
      const offset = subRaw.indexOf(subTrim);
      const s = clause.startChar + subMatch.index + offset;
      commaSplitClauses.push({ text: subTrim, startChar: s, endChar: s + subTrim.length });
    }
  }

  // 3. Merge tiny lead-in prefixes like "Step 2:" with the next short clause if combined <= 58 chars
  const mergedClauses: Array<{ text: string; startChar: number; endChar: number }> = [];
  for (const clause of commaSplitClauses) {
    const prev = mergedClauses[mergedClauses.length - 1];
    if (
      prev &&
      (/^Step\s+\d+:/i.test(prev.text) || prev.text.split(/\s+/).length <= 2) &&
      prev.text.length + 1 + clause.text.length <= 58
    ) {
      prev.text = `${prev.text} ${clause.text}`;
      prev.endChar = clause.endChar;
    } else {
      mergedClauses.push({ ...clause });
    }
  }

  // 4. Break any remaining long phrase (> 58 chars or > 10 words) near natural conjunctions or midpoint
  const finalChunks: Array<{ text: string; startChar: number; endChar: number }> = [];
  for (const item of mergedClauses) {
    const words = item.text.split(/\s+/);
    if (item.text.length <= 58 && words.length <= 10) {
      finalChunks.push(item);
      continue;
    }

    const numParts = Math.ceil(Math.max(item.text.length / 48, words.length / 8));
    const wordsPerPart = Math.ceil(words.length / numParts);
    let cursor = item.startChar;

    for (let i = 0; i < words.length; i += wordsPerPart) {
      const sliceWords = words.slice(i, i + wordsPerPart);
      const chunkText = sliceWords.join(' ');
      const foundIdx = source.indexOf(sliceWords[0], cursor);
      const s = foundIdx >= 0 ? foundIdx : cursor;
      const lastWord = sliceWords[sliceWords.length - 1];
      const lastIdx = source.indexOf(lastWord, s);
      const e = lastIdx >= 0 ? lastIdx + lastWord.length : s + chunkText.length;
      finalChunks.push({ text: chunkText, startChar: s, endChar: e });
      cursor = e;
    }
  }

  // 5. Assign speech-weighted startRatio and endRatio (0..1)
  const weights = finalChunks.map((chunk) => {
    let w = Math.max(6, chunk.text.length);
    if (/[.!?]$/.test(chunk.text)) w += 7;
    else if (/[:;—]$/.test(chunk.text)) w += 4;
    else if (/,$/.test(chunk.text)) w += 3;
    return w;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
  let accWeight = 0;

  return finalChunks.map((chunk, idx) => {
    const startRatio = accWeight / totalWeight;
    accWeight += weights[idx];
    const endRatio = idx === finalChunks.length - 1 ? 1 : accWeight / totalWeight;
    return {
      text: chunk.text,
      startChar: chunk.startChar,
      endChar: chunk.endChar,
      startRatio,
      endRatio,
    };
  });
}
