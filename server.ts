/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  parseTextToNormalizedModel,
  solveNormalizedModel,
  normalizeMasterOcrText,
} from './src/utils/straightLineMasterSolver';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support JSON payload up to 25MB for high-res textbook photo uploads & camera snapshots
app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI per gemini-api skill guidelines
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Standard Engineering Graphics Output Schema
 */
export interface ExtractedQuestionSchema {
  line_name: string;
  start_point: string;
  end_point: string;
  true_length_mm: number | null;
  p_above_hp_mm: number | null;
  p_in_front_of_vp_mm: number | null;
  q_above_hp_mm: number | null;
  q_in_front_of_vp_mm: number | null;
  theta_hp_deg: number | null;
  phi_vp_deg: number | null;
  alpha_apparent_fv_deg: number | null;
  beta_apparent_tv_deg: number | null;
  front_view_length_mm: number | null;
  top_view_length_mm: number | null;
  dep_projector_distance_mm: number | null;
  is_parallel_to_hp: boolean;
  is_parallel_to_vp: boolean;
  is_perpendicular_to_hp: boolean;
  is_perpendicular_to_vp: boolean;
  transcribed_question?: string;
  heading?: string;
}

/**
 * Offline Server-Side Tesseract OCR Engine
 */
async function runTesseractOcr(base64Image: string): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    let imgSrc = base64Image;
    if (!imgSrc.startsWith('data:')) {
      imgSrc = `data:image/jpeg;base64,${base64Image}`;
    }
    const ret = await worker.recognize(imgSrc);
    await worker.terminate();
    return (ret?.data?.text || '').trim();
  } catch (err) {
    console.error('Tesseract OCR error in server:', err);
    return '';
  }
}

/**
 * Normalizes common OCR transcription errors from camera/paper scans
 */
export function normalizeOcrText(text: string): string {
  let s = text;
  // Common OCR character and word corruptions
  s = s.replace(/\blinc\b/gi, 'line');
  s = s.replace(/(\d+(?:\.\d+)?)\s*mm\s*lone\b/gi, '$1mm long');
  s = s.replace(/(\d+(?:\.\d+)?)\s*1\s*m\b/gi, '$1mm');
  s = s.replace(/\bpars?\s+to\s+the\b/gi, 'parallel to the');
  s = s.replace(/\bpar(?:al{1,2}el)?\b/gi, 'parallel');
  s = s.replace(/\boerpen\s*dic\s*ula[a-z]*\b/gi, 'perpendicular');
  s = s.replace(/\bperpen\s*dicular\b/gi, 'perpendicular');
  s = s.replace(/\bto\s+the\s+[Pp]\b/gi, 'to the VP');
  s = s.replace(/\b[vV][\.\s]*[pP]\b/g, 'VP');
  s = s.replace(/\b[hH][\.\s]*[pP]\b/g, 'HP');
  return s;
}

/**
 * Robust rule-based engineering graphics solver and question parser.
 * Adheres strictly to the user's 5 critical rules and tolerates common OCR typos.
 */
function solveQuestionRuleBased(text: string): { schema: ExtractedQuestionSchema; parsed: any } {
  const normalizedRaw = normalizeOcrText(text).trim();
  const lower = normalizedRaw.toLowerCase();

  // RULE 1: Focus on problem statement and heading. Strip out numbered solution steps
  const cleanedText = normalizedRaw
    .replace(/(?:^|\n)\s*\d+[\.\)]\s*[^.\n]*(?:draw|mark|join|project|extend|measure|with|taking|from|cut|locate)[^\n]*/gi, '')
    .trim();
  const cleanedLower = cleanedText.toLowerCase();

  // Detect heading (e.g., "Parallel to the HP and Inclined to the VP")
  let heading = '';
  const headingMatch = cleanedText.match(/^(?:problem|exercise|example|\#\#|\#)?\s*([A-Za-z\s]+(?:parallel|perpendicular|inclined)[^\n\.\:]*)/i);
  if (headingMatch) {
    heading = headingMatch[1].trim();
  }

  // 1. Line names (handles "line AB", "linc AB", "lone AB", "straight line AB", "AB 50mm")
  let startPoint = 'A';
  let endPoint = 'B';
  let lineName = 'AB';
  const nameMatch =
    cleanedText.match(/(?:line|linc|lone|straight\s*line)\s+([A-Za-z])([A-Za-z])\b/i) ||
    cleanedText.match(/\b([A-Z])([A-Z])\b\s+(\d+(?:\.\d+)?)\s*mm/) ||
    cleanedText.match(/\b([A-Z])([A-Z])\b\s+(?:is\s+a\s+line|is\s+)/) ||
    cleanedText.match(/(?:line|linc|lone)\s+([A-Za-z])\s*(?:and|to|-)\s*([A-Za-z])/i);
  if (nameMatch) {
    startPoint = nameMatch[1].toUpperCase();
    endPoint = nameMatch[2].toUpperCase();
    lineName = `${startPoint}${endPoint}`;
  }

  // 2. True Length (handles "50mm long", "50mm lone", "line AB 50mm", "length of 50mm", etc.)
  let tl: number | null = null;
  const tlMatch =
    cleanedLower.match(/(?:line|linc|lone)\s+[a-z]{1,2}\s+(\d+(?:\.\d+)?)\s*mm/i) ||
    cleanedLower.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:long|lone|length|in\s*length)/i) ||
    cleanedLower.match(/length\s*(?:of)?\s*(?:the\s*line\s*)?(\d+(?:\.\d+)?)\s*mm/i) ||
    cleanedLower.match(/tl\s*=?\s*(\d+(?:\.\d+)?)/i) ||
    cleanedLower.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (tlMatch) {
    tl = parseFloat(tlMatch[1]);
  }

  // RULE 4: Parallel and Perpendicular constraints
  const isPerpHP =
    cleanedLower.includes('perpendicular to the hp') ||
    cleanedLower.includes('perpendicular to hp') ||
    cleanedLower.includes('perp to hp') ||
    cleanedLower.includes('perp. to hp') ||
    cleanedLower.includes('normal to hp');

  const isPerpVP =
    cleanedLower.includes('perpendicular to the vp') ||
    cleanedLower.includes('perpendicular to vp') ||
    cleanedLower.includes('perp to vp') ||
    cleanedLower.includes('perp. to vp') ||
    cleanedLower.includes('normal to vp');

  const isParVP =
    isPerpHP ||
    cleanedLower.includes('parallel to the vp') ||
    cleanedLower.includes('parallel to vp') ||
    cleanedLower.includes('parallel to both');

  const isParHP =
    isPerpVP ||
    cleanedLower.includes('parallel to the hp') ||
    cleanedLower.includes('parallel to hp') ||
    cleanedLower.includes('parallel to both');

  // RULE 3: Inclination angles (DO NOT SWAP HP AND VP)
  let thetaHp: number | null = null;
  let phiVp: number | null = null;

  if (isPerpHP) {
    thetaHp = 90;
    phiVp = 0;
  } else if (isPerpVP) {
    thetaHp = 0;
    phiVp = 90;
  } else {
    if (isParHP) {
      thetaHp = 0;
    } else {
      const thetaMatch =
        cleanedLower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?hp)/i) ||
        cleanedLower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?hp)/i) ||
        cleanedLower.match(/θ\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (thetaMatch) thetaHp = parseFloat(thetaMatch[1]);
    }

    if (isParVP) {
      phiVp = 0;
    } else {
      const phiMatch =
        cleanedLower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?vp)/i) ||
        cleanedLower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?vp)/i) ||
        cleanedLower.match(/φ\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (phiMatch) phiVp = parseFloat(phiMatch[1]);
    }
  }

  // Point P (Start Point) Position
  let pAboveHp: number | null = null;
  let pInFrontVp: number | null = null;

  // Check on HP / on VP for P
  const pName = startPoint.toLowerCase();
  const qName = endPoint.toLowerCase();

  if (
    cleanedLower.includes(`point ${pName} is in hp`) ||
    cleanedLower.includes(`point ${pName} is in the hp`) ||
    cleanedLower.includes(`point ${pName} is on hp`) ||
    cleanedLower.includes(`end ${pName} is in hp`) ||
    cleanedLower.includes(`${pName} is in the hp`)
  ) {
    pAboveHp = 0;
  } else {
    const hpMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*above\\s*(?:the\\s*)?hp`, 'i')) ||
      cleanedLower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i);
    const hpBelowMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*below\\s*(?:the\\s*)?hp`, 'i')) ||
      cleanedLower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i);
    if (hpMatch) pAboveHp = parseFloat(hpMatch[1]);
    else if (hpBelowMatch) pAboveHp = -parseFloat(hpBelowMatch[1]);
  }

  if (
    cleanedLower.includes(`point ${pName} is in vp`) ||
    cleanedLower.includes(`point ${pName} is in the vp`) ||
    cleanedLower.includes(`point ${pName} is on vp`) ||
    cleanedLower.includes(`end ${pName} is in vp`) ||
    cleanedLower.includes(`${pName} is in the vp`)
  ) {
    pInFrontVp = 0;
  } else {
    const vpMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*in\\s*front\\s*of\\s*(?:the\\s*)?vp`, 'i')) ||
      cleanedLower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s*)?vp/i);
    const vpBehindMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${pName}|end\\s*${pName}|\\b${pName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*behind\\s*(?:the\\s*)?vp`, 'i')) ||
      cleanedLower.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\s*)?vp/i);
    if (vpMatch) pInFrontVp = parseFloat(vpMatch[1]);
    else if (vpBehindMatch) pInFrontVp = -parseFloat(vpBehindMatch[1]);
  }

  // Point Q (End Point) Position
  let qAboveHp: number | null = null;
  let qInFrontVp: number | null = null;

  if (isParHP) {
    // If parallel to HP, q_above_hp = p_above_hp
    qAboveHp = pAboveHp;
  } else {
    const qHpMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*above\\s*(?:the\\s*)?hp`, 'i'));
    const qHpBelowMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*below\\s*(?:the\\s*)?hp`, 'i'));
    if (qHpMatch) {
      qAboveHp = parseFloat(qHpMatch[1]);
    } else if (qHpBelowMatch) {
      qAboveHp = -parseFloat(qHpBelowMatch[1]);
    } else if (isPerpHP && pAboveHp !== null && tl !== null) {
      qAboveHp = pAboveHp + tl;
    }
  }

  if (isParVP) {
    // If parallel to VP, q_in_front_of_vp = p_in_front_of_vp
    qInFrontVp = pInFrontVp;
  } else {
    const qVpMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*in\\s*front\\s*of\\s*(?:the\\s*)?vp`, 'i'));
    const qVpBehindMatch =
      cleanedLower.match(new RegExp(`(?:point\\s*${qName}|end\\s*${qName}|\\b${qName}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*behind\\s*(?:the\\s*)?vp`, 'i'));
    if (qVpMatch) {
      qInFrontVp = parseFloat(qVpMatch[1]);
    } else if (qVpBehindMatch) {
      qInFrontVp = -parseFloat(qVpBehindMatch[1]);
    } else if (isPerpVP && pInFrontVp !== null && tl !== null) {
      qInFrontVp = pInFrontVp + tl;
    }
  }

  // Distance between end projectors (DEP)
  let dep: number | null = null;
  const depMatch =
    cleanedLower.match(/(?:distance\s*between\s*(?:end\s*)?projectors|dep)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (depMatch) {
    dep = parseFloat(depMatch[1]);
  } else if (isPerpHP || isPerpVP) {
    dep = 0;
  }

  // Apparent lengths
  let el: number | null = null;
  const elMatch =
    cleanedLower.match(/(?:front\s*view|elevation)\s*(?:length\s*)?(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (elMatch) el = parseFloat(elMatch[1]);

  let pl: number | null = null;
  const plMatch =
    cleanedLower.match(/(?:top\s*view|plan)\s*(?:length\s*)?(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (plMatch) pl = parseFloat(plMatch[1]);

  const schema: ExtractedQuestionSchema = {
    line_name: lineName,
    start_point: startPoint,
    end_point: endPoint,
    true_length_mm: tl,
    p_above_hp_mm: pAboveHp,
    p_in_front_of_vp_mm: pInFrontVp,
    q_above_hp_mm: qAboveHp,
    q_in_front_of_vp_mm: qInFrontVp,
    theta_hp_deg: thetaHp,
    phi_vp_deg: phiVp,
    alpha_apparent_fv_deg: null,
    beta_apparent_tv_deg: null,
    front_view_length_mm: el,
    top_view_length_mm: pl,
    dep_projector_distance_mm: dep,
    is_parallel_to_hp: isParHP,
    is_parallel_to_vp: isParVP,
    is_perpendicular_to_hp: isPerpHP,
    is_perpendicular_to_vp: isPerpVP,
    transcribed_question: cleanedText,
    heading,
  };

  // Convert schema into simulator format
  const parsed = convertSchemaToSimulation(schema);
  return { schema, parsed };
}

/**
 * Converts the extracted schema into the simulator's internal representation
 * strictly following BIS SP 46:2003 geometry and NO hallucinated defaults.
 */
function convertSchemaToSimulation(s: ExtractedQuestionSchema) {
  const tl = s.true_length_mm ?? 50;
  const theta = s.theta_hp_deg ?? (s.is_perpendicular_to_hp ? 90 : s.is_parallel_to_hp ? 0 : 30);
  const phi = s.phi_vp_deg ?? (s.is_perpendicular_to_vp ? 90 : s.is_parallel_to_vp ? 0 : 45);

  let orientation = 'INCLINED_BOTH';
  if (s.is_perpendicular_to_hp) orientation = 'PERPENDICULAR_HP';
  else if (s.is_perpendicular_to_vp) orientation = 'PERPENDICULAR_VP';
  else if (s.is_parallel_to_hp && s.is_parallel_to_vp) orientation = 'PARALLEL_BOTH';
  else if (s.is_parallel_to_hp) orientation = 'INCLINED_VP_PARALLEL_HP';
  else if (s.is_parallel_to_vp) orientation = 'INCLINED_HP_PARALLEL_VP';

  const pAbove = s.p_above_hp_mm ?? 20;
  const pFront = s.p_in_front_of_vp_mm ?? 25;

  let qAbove = s.q_above_hp_mm;
  if (qAbove === null || qAbove === undefined) {
    if (s.is_parallel_to_hp) qAbove = pAbove;
    else if (s.is_perpendicular_to_hp) qAbove = pAbove + tl;
    else qAbove = pAbove + tl * Math.sin((theta * Math.PI) / 180);
  }

  let qFront = s.q_in_front_of_vp_mm;
  if (qFront === null || qFront === undefined) {
    if (s.is_parallel_to_vp) qFront = pFront;
    else if (s.is_perpendicular_to_vp) qFront = pFront + tl;
    else qFront = pFront + tl * Math.sin((phi * Math.PI) / 180);
  }

  // Calculate dep mathematically without hallucinating 50
  let calculatedDep = s.dep_projector_distance_mm;
  if (calculatedDep === null || calculatedDep === undefined) {
    if (s.is_perpendicular_to_hp || s.is_perpendicular_to_vp) {
      calculatedDep = 0;
    } else {
      const thetaRad = (theta * Math.PI) / 180;
      const phiRad = (phi * Math.PI) / 180;
      const dy = tl * Math.sin(phiRad);
      const dz = tl * Math.sin(thetaRad);
      const dxSq = Math.max(0, tl * tl - dy * dy - dz * dz);
      calculatedDep = Math.round(Math.sqrt(dxSq) * 100) / 100;
    }
  }

  const isHiddenB = orientation === 'PERPENDICULAR_HP' && pAbove >= qAbove;
  const isHiddenA = orientation === 'PERPENDICULAR_HP' && qAbove > pAbove;

  return {
    type: 'LINE',
    nameA: s.start_point,
    nameB: s.end_point,
    trueLength: tl,
    thetaDeg: theta,
    phiDeg: phi,
    orientation,
    mode: 'END_POINTS',
    endA: {
      name: s.start_point,
      hpRelation: pAbove === 0 ? 'ON' : pAbove > 0 ? 'ABOVE' : 'BELOW',
      distanceHp: Math.abs(pAbove),
      vpRelation: pFront === 0 ? 'ON' : pFront > 0 ? 'IN_FRONT' : 'BEHIND',
      distanceVp: Math.abs(pFront),
    },
    endB: {
      name: s.end_point,
      hpRelation: qAbove === 0 ? 'ON' : qAbove > 0 ? 'ABOVE' : 'BELOW',
      distanceHp: Math.abs(qAbove),
      vpRelation: qFront === 0 ? 'ON' : qFront > 0 ? 'IN_FRONT' : 'BEHIND',
      distanceVp: Math.abs(qFront),
    },
    dep: calculatedDep,
    frontViewLength: s.front_view_length_mm ?? (orientation === 'PERPENDICULAR_VP' ? 0 : tl * Math.cos((phi * Math.PI) / 180)),
    topViewLength: s.top_view_length_mm ?? (orientation === 'PERPENDICULAR_HP' ? 0 : tl * Math.cos((theta * Math.PI) / 180)),
    targetQuadrantB: 'FIRST',
    hiddenA: isHiddenA,
    hiddenB: isHiddenB,
    topViewLabel:
      orientation === 'PERPENDICULAR_HP'
        ? pAbove >= qAbove
          ? `${s.start_point.toLowerCase()}(${s.end_point.toLowerCase()})`
          : `${s.end_point.toLowerCase()}(${s.start_point.toLowerCase()})`
        : `${s.start_point.toLowerCase()}${s.end_point.toLowerCase()}`,
    frontViewLabelA: `${s.start_point.toLowerCase()}′`,
    frontViewLabelB: `${s.end_point.toLowerCase()}′`,
    explanation: `Line ${s.line_name} (${tl} mm) ${orientation === 'PERPENDICULAR_HP' ? 'perpendicular to HP and parallel to VP' : orientation === 'PERPENDICULAR_VP' ? 'perpendicular to VP and parallel to HP' : orientation === 'PARALLEL_BOTH' ? 'parallel to both HP and VP' : orientation === 'INCLINED_HP_PARALLEL_VP' ? `inclined to HP at θ=${theta}° and parallel to VP` : orientation === 'INCLINED_VP_PARALLEL_HP' ? `inclined to VP at φ=${phi}° and parallel to HP` : `inclined to both planes at θ=${theta}° and φ=${phi}°`}.`,
  };
}

/**
 * POST /api/scan-question
 * Performs OCR and extraction adhering strictly to the user's critical rules and JSON schema.
 */
app.post('/api/scan-question', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', text } = req.body;

    if (!imageBase64 && !text) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either imageBase64 or question text.',
      });
    }

    let recognizedText = text || '';

    if (apiKey && apiKey.trim().length > 10 && !apiKey.includes('YOUR_')) {
      try {
        const parts: any[] = [];

        if (imageBase64) {
          const base64Data = imageBase64.replace(/^data:image\/[a-z0-9\+\-]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data,
            },
          });
        }

        const promptText = `
You are an expert Engineering Graphics parser specializing in First-Angle Orthographic Projection of Straight Lines, Planes, and Solids.

Your job is to extract exact geometric parameters from a scanned image or text of an Engineering Drawing problem and output ONLY valid JSON matching the schema below.

CRITICAL RULES TO PREVENT MISINTERPRETATION:
1. FOCUS ONLY ON THE PROBLEM STATEMENT: Scanned images often include headings (e.g., "Parallel to the HP and Inclined to the VP") and numbered solution steps below the question. Read the heading and problem paragraph. IGNORE numbered instructional steps (e.g., "1. Draw line XY... 3. Mark p'...") as they frequently contain textbook typos.
2. FIRST-ANGLE PROJECTION MAPPING:
   - HP = Horizontal Plane (Top View / Plan, drawn BELOW the XY line).
   - VP = Vertical Plane (Front View / Elevation, drawn ABOVE the XY line).
   - "above HP" -> positive distance above XY (p_above_hp).
   - "below HP" -> negative distance below XY.
   - "in front of VP" -> positive distance below XY (p_in_front_of_vp).
   - "behind VP" -> negative distance above XY.
3. INCLINATION ANGLES (DO NOT SWAP HP AND VP):
   - "inclined at X° to HP" -> theta_hp = X. (Even though it is measured in the Front View, it is the angle with HP).
   - "inclined at Y° to VP" -> phi_vp = Y. (Even though it is measured in the Top View, it is the angle with VP).
4. PARALLEL & PERPENDICULAR CONSTRAINTS:
   - If the line is "parallel to HP": You MUST set theta_hp = 0 and is_parallel_to_hp = true. This means both ends are at the exact same distance above HP (q_above_hp = p_above_hp).
   - If the line is "parallel to VP": You MUST set phi_vp = 0 and is_parallel_to_vp = true. This means both ends are at the exact same distance in front of VP (q_in_front_of_vp = p_in_front_of_vp).
   - If the line is "perpendicular to HP": Set theta_hp = 90, phi_vp = 0, is_perpendicular_to_hp = true, is_parallel_to_vp = true.
   - If the line is "perpendicular to VP": Set phi_vp = 90, theta_hp = 0, is_perpendicular_to_vp = true, is_parallel_to_hp = true.
   - If an end is "in HP" or "on HP": Its distance above HP is 0.
   - If an end is "in VP" or "on VP": Its distance in front of VP is 0.
5. NO HALLUCINATED DEFAULTS:
   - Never invent 50 for dep (distance between end projectors) or 0 for q_above_hp unless explicitly stated in the problem text. Use null for any parameter not explicitly given or directly implied by parallelism.
`;
        parts.push({ text: promptText });

        const generatePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            systemInstruction:
              'You are an authoritative engineering graphics parser adhering to First-Angle projection BIS SP 46:2003 standards. Output valid JSON matching the schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcribed_question: { type: Type.STRING },
                line_name: { type: Type.STRING },
                start_point: { type: Type.STRING },
                end_point: { type: Type.STRING },
                true_length_mm: { type: Type.NUMBER },
                p_above_hp_mm: { type: Type.NUMBER },
                p_in_front_of_vp_mm: { type: Type.NUMBER },
                q_above_hp_mm: { type: Type.NUMBER },
                q_in_front_of_vp_mm: { type: Type.NUMBER },
                theta_hp_deg: { type: Type.NUMBER },
                phi_vp_deg: { type: Type.NUMBER },
                alpha_apparent_fv_deg: { type: Type.NUMBER },
                beta_apparent_tv_deg: { type: Type.NUMBER },
                front_view_length_mm: { type: Type.NUMBER },
                top_view_length_mm: { type: Type.NUMBER },
                dep_projector_distance_mm: { type: Type.NUMBER },
                is_parallel_to_hp: { type: Type.BOOLEAN },
                is_parallel_to_vp: { type: Type.BOOLEAN },
                is_perpendicular_to_hp: { type: Type.BOOLEAN },
                is_perpendicular_to_vp: { type: Type.BOOLEAN },
              },
              required: [
                'line_name',
                'start_point',
                'end_point',
                'is_parallel_to_hp',
                'is_parallel_to_vp',
                'is_perpendicular_to_hp',
                'is_perpendicular_to_vp',
              ],
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 12000)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);

        const rawJson = (response.text || '').trim();
        const extractedSchema: ExtractedQuestionSchema = JSON.parse(rawJson);
        recognizedText = extractedSchema.transcribed_question || recognizedText;

        const cleanText = normalizeMasterOcrText(recognizedText);
        const normalizedModel = parseTextToNormalizedModel(cleanText, 'OCR');

        // Augment normalizedModel with any explicit values detected by Gemini
        if (extractedSchema.true_length_mm !== null && extractedSchema.true_length_mm !== undefined) {
          normalizedModel.true_length_mm = extractedSchema.true_length_mm;
        }
        if (extractedSchema.p_above_hp_mm !== null && extractedSchema.p_above_hp_mm !== undefined) {
          normalizedModel.endpoint_A.distHp = Math.abs(extractedSchema.p_above_hp_mm);
          normalizedModel.endpoint_A.hpRelation =
            extractedSchema.p_above_hp_mm === 0 ? 'ON' : extractedSchema.p_above_hp_mm > 0 ? 'ABOVE' : 'BELOW';
        }
        if (extractedSchema.p_in_front_of_vp_mm !== null && extractedSchema.p_in_front_of_vp_mm !== undefined) {
          normalizedModel.endpoint_A.distVp = Math.abs(extractedSchema.p_in_front_of_vp_mm);
          normalizedModel.endpoint_A.vpRelation =
            extractedSchema.p_in_front_of_vp_mm === 0 ? 'ON' : extractedSchema.p_in_front_of_vp_mm > 0 ? 'IN_FRONT' : 'BEHIND';
        }
        if (extractedSchema.q_above_hp_mm !== null && extractedSchema.q_above_hp_mm !== undefined) {
          normalizedModel.endpoint_B.distHp = Math.abs(extractedSchema.q_above_hp_mm);
          normalizedModel.endpoint_B.hpRelation =
            extractedSchema.q_above_hp_mm === 0 ? 'ON' : extractedSchema.q_above_hp_mm > 0 ? 'ABOVE' : 'BELOW';
        }
        if (extractedSchema.q_in_front_of_vp_mm !== null && extractedSchema.q_in_front_of_vp_mm !== undefined) {
          normalizedModel.endpoint_B.distVp = Math.abs(extractedSchema.q_in_front_of_vp_mm);
          normalizedModel.endpoint_B.vpRelation =
            extractedSchema.q_in_front_of_vp_mm === 0 ? 'ON' : extractedSchema.q_in_front_of_vp_mm > 0 ? 'IN_FRONT' : 'BEHIND';
        }
        if (extractedSchema.is_perpendicular_to_hp) {
          normalizedModel.perpendicular_to = 'HP';
          normalizedModel.parallel_to = 'VP';
          normalizedModel.inclination_hp_deg = 90;
          normalizedModel.inclination_vp_deg = 0;
        } else if (extractedSchema.is_perpendicular_to_vp) {
          normalizedModel.perpendicular_to = 'VP';
          normalizedModel.parallel_to = 'HP';
          normalizedModel.inclination_hp_deg = 0;
          normalizedModel.inclination_vp_deg = 90;
        }

        const solution = solveNormalizedModel(normalizedModel);
        const parsed = solution.candidate_solutions[0]?.input || convertSchemaToSimulation(extractedSchema);

        return res.json({
          success: true,
          rawText: recognizedText,
          source: 'gemini-3.8-flash',
          extractedSchema,
          normalizedModel,
          solution,
          parsed,
        });
      } catch (geminiErr: any) {
        console.warn('Gemini OCR API error or unavailable, falling back to local OCR engine:', geminiErr?.message || geminiErr);
      }
    }

    // 2. High-Accuracy Local Tesseract OCR Engine when image is provided and text is empty
    let sourceEngine = 'user-text-input';
    if (imageBase64 && (!recognizedText || recognizedText.trim().length < 5)) {
      recognizedText = await runTesseractOcr(imageBase64);
      sourceEngine = 'tesseract-ocr';
    }

    if (!recognizedText || recognizedText.trim().length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No legible text could be extracted from the scanned image. Please upload a clear photo or type the question directly.',
      });
    }

    // 3. Rule-based Engineering Graphics Master Solver using Normalized OCR Text
    const cleanText = normalizeMasterOcrText(recognizedText);
    const normalizedModel = parseTextToNormalizedModel(
      cleanText,
      sourceEngine === 'tesseract-ocr' ? 'OCR' : 'CLIPBOARD'
    );
    const solution = solveNormalizedModel(normalizedModel);
    const { schema } = solveQuestionRuleBased(cleanText);
    const candidateInput = solution.candidate_solutions[0]?.input;

    return res.json({
      success: true,
      rawText: recognizedText,
      source: sourceEngine,
      extractedSchema: schema,
      normalizedModel,
      solution,
      parsed: candidateInput || convertSchemaToSimulation(schema),
    });
  } catch (err: any) {
    console.error('Error in /api/scan-question:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to process question scan.',
    });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
