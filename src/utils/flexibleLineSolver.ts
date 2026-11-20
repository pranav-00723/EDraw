/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LineProblemInput } from '../types/lines';
import { HpRelation, VpRelation } from '../types/projection';

export interface FlexibleEndPoint {
  name: string;
  hpRelation: HpRelation | '';
  distanceHp: string;
  vpRelation: VpRelation | '';
  distanceVp: string;
}

export interface FlexibleLineInput {
  end1: FlexibleEndPoint;
  end2: FlexibleEndPoint;
  trueLength: string;      // mm
  thetaDeg: string;        // True inclination with HP (deg)
  phiDeg: string;          // True inclination with VP (deg)
  frontViewLength: string; // EL (mm)
  topViewLength: string;   // PL (mm)
  alphaDeg: string;        // Apparent inclination of FV with XY (deg)
  betaDeg: string;         // Apparent inclination of TV with XY (deg)
  dep: string;             // Distance between end projectors (mm)
  htVpRelation: VpRelation | '';
  htDistanceVp: string;    // HT distance in front of / behind VP (mm)
  vtHpRelation: HpRelation | '';
  vtDistanceHp: string;    // VT distance above / below HP (mm)
}

export function createDefaultFlexibleInput(): FlexibleLineInput {
  return {
    end1: {
      name: 'A',
      hpRelation: 'ABOVE',
      distanceHp: '20',
      vpRelation: 'IN_FRONT',
      distanceVp: '25',
    },
    end2: {
      name: 'B',
      hpRelation: '',
      distanceHp: '',
      vpRelation: '',
      distanceVp: '',
    },
    trueLength: '70',
    thetaDeg: '30',
    phiDeg: '45',
    frontViewLength: '',
    topViewLength: '',
    alphaDeg: '',
    betaDeg: '',
    dep: '',
    htVpRelation: '',
    htDistanceVp: '',
    vtHpRelation: '',
    vtDistanceHp: '',
  };
}

function parseNum(val: string): number | undefined {
  if (val === undefined || val === null) return undefined;
  const trimmed = val.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function signedHp(rel: HpRelation | '', distStr: string): number | undefined {
  if (rel === 'ON') return 0;
  const d = parseNum(distStr);
  if (d === undefined) return undefined;
  if (rel === 'BELOW') return -Math.abs(d);
  return Math.abs(d); // default ABOVE
}

function signedVp(rel: VpRelation | '', distStr: string): number | undefined {
  if (rel === 'ON') return 0;
  const d = parseNum(distStr);
  if (d === undefined) return undefined;
  if (rel === 'BEHIND') return -Math.abs(d);
  return Math.abs(d); // default IN_FRONT
}

export interface FlexibleSolveResult {
  lineInput: LineProblemInput;
  warnings: string[];
  errors: string[];
  solvedSummary: string;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Iteratively propagates constraints from any subset of known parameters
 * to solve for the complete 3D line geometry and all missing parameters.
 */
export function solveFlexibleLineInput(
  flex: FlexibleLineInput,
  color: string = '#2563eb'
): FlexibleSolveResult {
  const warnings: string[] = [];

  const nameA = (flex.end1.name || 'A').trim().toUpperCase() || 'A';
  const nameB = (flex.end2.name || 'B').trim().toUpperCase() || 'B';

  let zA = signedHp(flex.end1.hpRelation, flex.end1.distanceHp);
  let yA = signedVp(flex.end1.vpRelation, flex.end1.distanceVp);
  let zB = signedHp(flex.end2.hpRelation, flex.end2.distanceHp);
  let yB = signedVp(flex.end2.vpRelation, flex.end2.distanceVp);

  let tl = parseNum(flex.trueLength);
  let theta = parseNum(flex.thetaDeg);
  let phi = parseNum(flex.phiDeg);
  let el = parseNum(flex.frontViewLength);
  let pl = parseNum(flex.topViewLength);
  let alpha = parseNum(flex.alphaDeg);
  let beta = parseNum(flex.betaDeg);
  let dep = parseNum(flex.dep);

  const yHT = signedVp(flex.htVpRelation, flex.htDistanceVp);
  const zVT = signedHp(flex.vtHpRelation, flex.vtDistanceHp);

  let dz: number | undefined =
    zA !== undefined && zB !== undefined ? zB - zA : undefined;
  let dy: number | undefined =
    yA !== undefined && yB !== undefined ? yB - yA : undefined;

  // Iterative constraint propagation (up to 6 passes)
  for (let pass = 0; pass < 6; pass++) {
    // 1. Endpoints <-> dz, dy
    if (dz === undefined && zA !== undefined && zB !== undefined) dz = zB - zA;
    if (dy === undefined && yA !== undefined && yB !== undefined) dy = yB - yA;
    if (zB === undefined && zA !== undefined && dz !== undefined) zB = zA + dz;
    if (zA === undefined && zB !== undefined && dz !== undefined) zA = zB - dz;
    if (yB === undefined && yA !== undefined && dy !== undefined) yB = yA + dy;
    if (yA === undefined && yB !== undefined && dy !== undefined) yA = yB - dy;

    // 2. Trace equations:
    // HT (z = 0): yHT = yA - zA * (dy / dz)  => dy = (yA - yHT) * dz / zA
    if (yHT !== undefined && zA !== undefined && yA !== undefined && Math.abs(zA) > 1e-6) {
      if (dy === undefined && dz !== undefined && Math.abs(dz) > 1e-6) {
        dy = ((yA - yHT) * dz) / zA;
      } else if (dz === undefined && dy !== undefined && Math.abs(yA - yHT) > 1e-6) {
        dz = (dy * zA) / (yA - yHT);
      }
    }
    // VT (y = 0): zVT = zA - yA * (dz / dy) => dz = (zA - zVT) * dy / yA
    if (zVT !== undefined && yA !== undefined && zA !== undefined && Math.abs(yA) > 1e-6) {
      if (dz === undefined && dy !== undefined && Math.abs(dy) > 1e-6) {
        dz = ((zA - zVT) * dy) / yA;
      } else if (dy === undefined && dz !== undefined && Math.abs(zA - zVT) > 1e-6) {
        dy = (dz * yA) / (zA - zVT);
      }
    }

    // 3. True Length & True Angles (theta, phi)
    if (tl !== undefined) {
      if (theta !== undefined) {
        if (dz === undefined) dz = tl * Math.sin(theta * DEG2RAD);
        if (pl === undefined) pl = tl * Math.cos(theta * DEG2RAD);
      }
      if (phi !== undefined) {
        if (dy === undefined) dy = tl * Math.sin(phi * DEG2RAD);
        if (el === undefined) el = tl * Math.cos(phi * DEG2RAD);
      }
      if (dz !== undefined && theta === undefined && tl > 0) {
        theta = Math.asin(Math.min(1, Math.abs(dz) / tl)) * RAD2DEG;
      }
      if (dy !== undefined && phi === undefined && tl > 0) {
        phi = Math.asin(Math.min(1, Math.abs(dy) / tl)) * RAD2DEG;
      }
      if (el !== undefined && dy === undefined) {
        dy = Math.sqrt(Math.max(0, tl * tl - el * el));
      }
      if (pl !== undefined && dz === undefined) {
        dz = Math.sqrt(Math.max(0, tl * tl - pl * pl));
      }
      if (el !== undefined && phi === undefined && tl > 0) {
        phi = Math.acos(Math.min(1, el / tl)) * RAD2DEG;
      }
      if (pl !== undefined && theta === undefined && tl > 0) {
        theta = Math.acos(Math.min(1, pl / tl)) * RAD2DEG;
      }
    } else {
      // Solve TL from dz & theta, or dy & phi, or dep, dy, dz
      if (dz !== undefined && theta !== undefined && Math.sin(theta * DEG2RAD) > 1e-4) {
        tl = Math.abs(dz) / Math.sin(theta * DEG2RAD);
      } else if (dy !== undefined && phi !== undefined && Math.sin(phi * DEG2RAD) > 1e-4) {
        tl = Math.abs(dy) / Math.sin(phi * DEG2RAD);
      } else if (pl !== undefined && theta !== undefined && Math.cos(theta * DEG2RAD) > 1e-4) {
        tl = pl / Math.cos(theta * DEG2RAD);
      } else if (el !== undefined && phi !== undefined && Math.cos(phi * DEG2RAD) > 1e-4) {
        tl = el / Math.cos(phi * DEG2RAD);
      } else if (dep !== undefined && dy !== undefined && dz !== undefined) {
        tl = Math.sqrt(dep * dep + dy * dy + dz * dz);
      } else if (el !== undefined && dy !== undefined) {
        tl = Math.sqrt(el * el + dy * dy);
      } else if (pl !== undefined && dz !== undefined) {
        tl = Math.sqrt(pl * pl + dz * dz);
      }
    }

    // 4. Front View (el, alpha, dep, dz)
    if (el !== undefined) {
      if (alpha !== undefined) {
        if (dz === undefined) dz = el * Math.sin(alpha * DEG2RAD);
        if (dep === undefined) dep = el * Math.cos(alpha * DEG2RAD);
      }
      if (dep !== undefined && dz === undefined) {
        dz = Math.sqrt(Math.max(0, el * el - dep * dep));
      }
      if (dz !== undefined && dep === undefined) {
        dep = Math.sqrt(Math.max(0, el * el - dz * dz));
      }
    } else {
      if (dz !== undefined && alpha !== undefined && Math.sin(alpha * DEG2RAD) > 1e-4) {
        el = Math.abs(dz) / Math.sin(alpha * DEG2RAD);
      } else if (dep !== undefined && alpha !== undefined && Math.cos(alpha * DEG2RAD) > 1e-4) {
        el = dep / Math.cos(alpha * DEG2RAD);
      } else if (dep !== undefined && dz !== undefined) {
        el = Math.sqrt(dep * dep + dz * dz);
      }
    }

    // 5. Top View (pl, beta, dep, dy)
    if (pl !== undefined) {
      if (beta !== undefined) {
        if (dy === undefined) dy = pl * Math.sin(beta * DEG2RAD);
        if (dep === undefined) dep = pl * Math.cos(beta * DEG2RAD);
      }
      if (dep !== undefined && dy === undefined) {
        dy = Math.sqrt(Math.max(0, pl * pl - dep * dep));
      }
      if (dy !== undefined && dep === undefined) {
        dep = Math.sqrt(Math.max(0, pl * pl - dy * dy));
      }
    } else {
      if (dy !== undefined && beta !== undefined && Math.sin(beta * DEG2RAD) > 1e-4) {
        pl = Math.abs(dy) / Math.sin(beta * DEG2RAD);
      } else if (dep !== undefined && beta !== undefined && Math.cos(beta * DEG2RAD) > 1e-4) {
        pl = dep / Math.cos(beta * DEG2RAD);
      } else if (dep !== undefined && dy !== undefined) {
        pl = Math.sqrt(dep * dep + dy * dy);
      }
    }

    // 6. dep from tl, dy, dz
    if (dep === undefined && tl !== undefined && dy !== undefined && dz !== undefined) {
      const dxSq = tl * tl - dy * dy - dz * dz;
      if (dxSq < -0.5) {
        warnings.push('Given angles/lengths exceed True Length (ΔY² + ΔZ² > TL²). Clamping DEP to 0.');
      }
      dep = Math.sqrt(Math.max(0, dxSq));
    }
  }

  // Fallback defaults only for genuinely under-constrained parameters
  const finalZA = zA ?? 20;
  const finalYA = yA ?? 25;
  const finalDz = dz ?? (tl !== undefined && theta !== undefined ? tl * Math.sin(theta * DEG2RAD) : 25);
  const finalDy = dy ?? (tl !== undefined && phi !== undefined ? tl * Math.sin(phi * DEG2RAD) : 30);
  const finalZB = zB ?? finalZA + finalDz;
  const finalYB = yB ?? finalYA + finalDy;

  let finalDep = dep;
  if (finalDep === undefined) {
    if (tl !== undefined) {
      finalDep = Math.sqrt(Math.max(0, tl * tl - finalDy * finalDy - finalDz * finalDz));
    } else {
      finalDep = 40;
    }
  }

  const lineInput: LineProblemInput = {
    mode: 'END_POINTS',
    nameA,
    nameB,
    color,
    endA: {
      name: nameA,
      hpRelation: finalZA === 0 ? 'ON' : finalZA > 0 ? 'ABOVE' : 'BELOW',
      distanceHp: Math.abs(finalZA),
      vpRelation: finalYA === 0 ? 'ON' : finalYA > 0 ? 'IN_FRONT' : 'BEHIND',
      distanceVp: Math.abs(finalYA),
    },
    endB: {
      name: nameB,
      hpRelation: finalZB === 0 ? 'ON' : finalZB > 0 ? 'ABOVE' : 'BELOW',
      distanceHp: Math.abs(finalZB),
      vpRelation: finalYB === 0 ? 'ON' : finalYB > 0 ? 'IN_FRONT' : 'BEHIND',
      distanceVp: Math.abs(finalYB),
    },
    dep: Math.round(finalDep * 100) / 100,
    trueLength: tl ?? Math.round(Math.sqrt(finalDep * finalDep + finalDy * finalDy + finalDz * finalDz) * 100) / 100,
    thetaDeg: theta ?? 0,
    phiDeg: phi ?? 0,
    endBQuadrant: 'ABOVE_FRONT',
  };

  const finalTL = Math.sqrt(finalDep * finalDep + finalDy * finalDy + finalDz * finalDz);
  const finalEL = Math.sqrt(finalDep * finalDep + finalDz * finalDz);
  const finalPL = Math.sqrt(finalDep * finalDep + finalDy * finalDy);
  const finalTheta = finalTL > 1e-6 ? Math.asin(Math.min(1, Math.abs(finalDz) / finalTL)) * RAD2DEG : 0;
  const finalPhi = finalTL > 1e-6 ? Math.asin(Math.min(1, Math.abs(finalDy) / finalTL)) * RAD2DEG : 0;
  const finalAlpha = finalEL > 1e-6 ? Math.acos(Math.min(1, finalDep / finalEL)) * RAD2DEG : 0;
  const finalBeta = finalPL > 1e-6 ? Math.acos(Math.min(1, finalDep / finalPL)) * RAD2DEG : 0;

  const errors: string[] = [];
  const LEN_TOL = 1.0; // 1 mm tolerance
  const ANG_TOL = 1.0; // 1 deg tolerance

  const rawTL = parseNum(flex.trueLength);
  const rawTheta = parseNum(flex.thetaDeg);
  const rawPhi = parseNum(flex.phiDeg);
  const rawEL = parseNum(flex.frontViewLength);
  const rawPL = parseNum(flex.topViewLength);
  const rawAlpha = parseNum(flex.alphaDeg);
  const rawBeta = parseNum(flex.betaDeg);
  const rawDep = parseNum(flex.dep);

  if (rawTheta !== undefined && rawPhi !== undefined) {
    const sumSq = Math.sin(rawTheta * DEG2RAD) ** 2 + Math.sin(rawPhi * DEG2RAD) ** 2;
    if (sumSq > 1.0001) {
      errors.push(`True angles θ (${rawTheta}°) and φ (${rawPhi}°) are impossible in 3D space (θ + φ cannot exceed 90°).`);
    }
  }
  if (rawTL !== undefined && rawEL !== undefined && rawEL > rawTL + LEN_TOL) {
    errors.push(`Front View Length (${rawEL} mm) cannot be greater than True Length (${rawTL} mm).`);
  }
  if (rawTL !== undefined && rawPL !== undefined && rawPL > rawTL + LEN_TOL) {
    errors.push(`Top View Length (${rawPL} mm) cannot be greater than True Length (${rawTL} mm).`);
  }
  if (rawDep !== undefined && rawTL !== undefined && rawDep > rawTL + LEN_TOL) {
    errors.push(`DEP (${rawDep} mm) cannot be greater than True Length (${rawTL} mm).`);
  }
  if (rawDep !== undefined && rawEL !== undefined && rawDep > rawEL + LEN_TOL) {
    errors.push(`DEP (${rawDep} mm) cannot be greater than Front View Length (${rawEL} mm).`);
  }
  if (rawDep !== undefined && rawPL !== undefined && rawDep > rawPL + LEN_TOL) {
    errors.push(`DEP (${rawDep} mm) cannot be greater than Top View Length (${rawPL} mm).`);
  }

  // Check consistency against solved geometry
  if (rawTL !== undefined && Math.abs(rawTL - finalTL) > LEN_TOL) {
    errors.push(`True Length (${rawTL} mm) conflicts with other inputs (expected ~${finalTL.toFixed(1)} mm).`);
  }
  if (rawEL !== undefined && Math.abs(rawEL - finalEL) > LEN_TOL) {
    errors.push(`Front View Length (${rawEL} mm) conflicts with other inputs (expected ~${finalEL.toFixed(1)} mm).`);
  }
  if (rawPL !== undefined && Math.abs(rawPL - finalPL) > LEN_TOL) {
    errors.push(`Top View Length (${rawPL} mm) conflicts with other inputs (expected ~${finalPL.toFixed(1)} mm).`);
  }
  if (rawDep !== undefined && Math.abs(rawDep - finalDep) > LEN_TOL) {
    errors.push(`DEP (${rawDep} mm) conflicts with other inputs (expected ~${finalDep.toFixed(1)} mm).`);
  }
  if (rawTheta !== undefined && Math.abs(rawTheta - finalTheta) > ANG_TOL) {
    errors.push(`True angle θ (${rawTheta}°) conflicts with other inputs (expected ~${finalTheta.toFixed(1)}°).`);
  }
  if (rawPhi !== undefined && Math.abs(rawPhi - finalPhi) > ANG_TOL) {
    errors.push(`True angle φ (${rawPhi}°) conflicts with other inputs (expected ~${finalPhi.toFixed(1)}°).`);
  }
  if (rawAlpha !== undefined && Math.abs(rawAlpha - finalAlpha) > ANG_TOL) {
    errors.push(`Apparent angle α (${rawAlpha}°) conflicts with other inputs (expected ~${finalAlpha.toFixed(1)}°).`);
  }
  if (rawBeta !== undefined && Math.abs(rawBeta - finalBeta) > ANG_TOL) {
    errors.push(`Apparent angle β (${rawBeta}°) conflicts with other inputs (expected ~${finalBeta.toFixed(1)}°).`);
  }

  return {
    lineInput,
    warnings,
    errors,
    solvedSummary: `Solved ${nameA}${nameB}: TL=${lineInput.trueLength.toFixed(1)}mm, DEP=${lineInput.dep.toFixed(1)}mm`,
  };
}
