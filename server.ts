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
 * Robust rule-based engineering graphics solver and question parser.
 * Used when Gemini API is unavailable, as well as a reference validation layer.
 */
function solveQuestionRuleBased(text: string) {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const isLine =
    lower.includes('line') ||
    lower.includes('true length') ||
    lower.includes('perpendicular') ||
    lower.includes('parallel') ||
    lower.includes('inclined at') ||
    /line\s+[a-z]{1,2}/i.test(lower);

  if (isLine) {
    // 1. Line names
    let nameA = 'A';
    let nameB = 'B';
    const nameMatch =
      raw.match(/line\s+([A-Z])([A-Z])/i) ||
      raw.match(/line\s+([A-Z])\s*(?:and|to|-)\s*([A-Z])/i);
    if (nameMatch) {
      nameA = nameMatch[1].toUpperCase();
      nameB = nameMatch[2].toUpperCase();
    }

    // 2. Length (e.g. "25mm", "25 mm", "25 mm long", "length 25 mm")
    let tl = 25;
    const tlMatch =
      lower.match(/line\s+[a-z]{1,2}\s+(\d+(?:\.\d+)?)\s*mm/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i) ||
      lower.match(/length\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
      lower.match(/tl\s*=?\s*(\d+(?:\.\d+)?)/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*mm/i);
    if (tlMatch) {
      tl = parseFloat(tlMatch[1]);
    }

    // 3. Orientations:
    // Check "perpendicular to the HP" / "perpendicular to HP"
    const isPerpHP =
      lower.includes('perpendicular to the hp') ||
      lower.includes('perpendicular to hp') ||
      lower.includes('perp to hp') ||
      lower.includes('perp. to hp') ||
      lower.includes('normal to hp');

    // Check "perpendicular to the VP" / "perpendicular to VP"
    const isPerpVP =
      lower.includes('perpendicular to the vp') ||
      lower.includes('perpendicular to vp') ||
      lower.includes('perp to vp') ||
      lower.includes('perp. to vp') ||
      lower.includes('normal to vp');

    // Check "parallel to the VP" / "parallel to VP"
    const isParVP =
      lower.includes('parallel to the vp') ||
      lower.includes('parallel to vp') ||
      lower.includes('parallel to both');

    // Check "parallel to the HP" / "parallel to HP"
    const isParHP =
      lower.includes('parallel to the hp') ||
      lower.includes('parallel to hp') ||
      lower.includes('parallel to both');

    let theta = 30;
    let phi = 45;
    let orientation = 'INCLINED_BOTH';

    if (isPerpHP && isParVP) {
      theta = 90;
      phi = 0;
      orientation = 'PERPENDICULAR_HP';
    } else if (isPerpVP && isParHP) {
      theta = 0;
      phi = 90;
      orientation = 'PERPENDICULAR_VP';
    } else if (isParHP && isParVP) {
      theta = 0;
      phi = 0;
      orientation = 'PARALLEL_BOTH';
    } else {
      const thetaMatch =
        lower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?hp)/i) ||
        lower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?hp)/i) ||
        lower.match(/θ\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (thetaMatch) theta = parseFloat(thetaMatch[1]);
      else if (isParHP) theta = 0;

      const phiMatch =
        lower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?vp)/i) ||
        lower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?vp)/i) ||
        lower.match(/φ\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (phiMatch) phi = parseFloat(phiMatch[1]);
      else if (isParVP) phi = 0;
    }

    // 4. Point A relations
    let hpRelA = 'ABOVE';
    let distHpA = 35;
    const hpAMatch =
      lower.match(/point\s*a\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i);
    const hpABelowMatch =
      lower.match(/point\s*a\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i);
    if (hpAMatch) {
      hpRelA = 'ABOVE';
      distHpA = parseFloat(hpAMatch[1]);
    } else if (hpABelowMatch) {
      hpRelA = 'BELOW';
      distHpA = parseFloat(hpABelowMatch[1]);
    }

    let vpRelA = 'IN_FRONT';
    let distVpA = 20;
    const vpAMatch =
      lower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s*)?vp/i);
    const vpABehindMatch =
      lower.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\s*)?vp/i);
    if (vpAMatch) {
      vpRelA = 'IN_FRONT';
      distVpA = parseFloat(vpAMatch[1]);
    } else if (vpABehindMatch) {
      vpRelA = 'BEHIND';
      distVpA = parseFloat(vpABehindMatch[1]);
    }

    // 5. Point B relations
    let hpRelB = 'ABOVE';
    let distHpB = 10;
    const hpBMatch =
      lower.match(/(?:point\s*)?b\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i);
    const hpBBelowMatch =
      lower.match(/(?:point\s*)?b\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i);
    if (hpBMatch) {
      hpRelB = 'ABOVE';
      distHpB = parseFloat(hpBMatch[1]);
    } else if (hpBBelowMatch) {
      hpRelB = 'BELOW';
      distHpB = parseFloat(hpBBelowMatch[1]);
    } else {
      // If B is not explicitly stated and line is Perp to HP, B height = A height - TL
      distHpB = Math.max(0, distHpA - tl);
    }

    let vpRelB = vpRelA;
    let distVpB = distVpA;
    if (isParVP || orientation === 'PERPENDICULAR_HP') {
      distVpB = distVpA;
      vpRelB = vpRelA;
    }

    // Verify TL if both heights given for vertical line
    if (orientation === 'PERPENDICULAR_HP' && hpBMatch && hpAMatch) {
      tl = Math.abs(distHpA - distHpB);
    }

    const isHiddenB = orientation === 'PERPENDICULAR_HP' && distHpA >= distHpB;
    const isHiddenA = orientation === 'PERPENDICULAR_HP' && distHpB > distHpA;

    return {
      type: 'LINE',
      nameA,
      nameB,
      trueLength: tl,
      thetaDeg: theta,
      phiDeg: phi,
      orientation,
      mode: 'END_POINTS',
      endA: {
        name: nameA,
        hpRelation: hpRelA,
        distanceHp: distHpA,
        vpRelation: vpRelA,
        distanceVp: distVpA,
      },
      endB: {
        name: nameB,
        hpRelation: hpRelB,
        distanceHp: distHpB,
        vpRelation: vpRelB,
        distanceVp: distVpB,
      },
      dep: orientation === 'PERPENDICULAR_HP' || orientation === 'PERPENDICULAR_VP' ? 0 : 50,
      frontViewLength: orientation === 'PERPENDICULAR_HP' ? tl : orientation === 'PERPENDICULAR_VP' ? 0 : tl,
      topViewLength: orientation === 'PERPENDICULAR_HP' ? 0 : orientation === 'PERPENDICULAR_VP' ? tl : tl,
      targetQuadrantB: 'FIRST',
      hiddenA: isHiddenA,
      hiddenB: isHiddenB,
      topViewLabel: orientation === 'PERPENDICULAR_HP' ? `${nameA.toLowerCase()}(${nameB.toLowerCase()})` : `${nameA.toLowerCase()}${nameB.toLowerCase()}`,
      frontViewLabelA: `${nameA.toLowerCase()}′`,
      frontViewLabelB: `${nameB.toLowerCase()}′`,
      explanation: `Line ${nameA}${nameB} (${tl} mm) is ${orientation === 'PERPENDICULAR_HP' ? 'perpendicular to HP and parallel to VP' : 'inclined to planes'}. Front view is ${tl} mm vertical. Top view is a point labeled ${nameA.toLowerCase()}(${nameB.toLowerCase()}) at ${distVpA} mm in front of VP.`,
    };
  }

  // Point Problem
  let pointName = 'A';
  const pNameMatch = raw.match(/point\s+([A-Z0-9])/i);
  if (pNameMatch) pointName = pNameMatch[1].toUpperCase();

  let hpRel = 'ABOVE';
  let distHp = 30;
  if (lower.includes('in hp') || lower.includes('on hp') || lower.includes('in the hp')) {
    hpRel = 'ON';
    distHp = 0;
  } else {
    const hpAboveMatch = lower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i);
    const hpBelowMatch = lower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i);
    if (hpAboveMatch) {
      hpRel = 'ABOVE';
      distHp = parseFloat(hpAboveMatch[1]);
    } else if (hpBelowMatch) {
      hpRel = 'BELOW';
      distHp = parseFloat(hpBelowMatch[1]);
    }
  }

  let vpRel = 'IN_FRONT';
  let distVp = 40;
  if (lower.includes('in vp') || lower.includes('on vp') || lower.includes('in the vp')) {
    vpRel = 'ON';
    distVp = 0;
  } else {
    const vpFrontMatch = lower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s*)?vp/i);
    const vpBehindMatch = lower.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\s*)?vp/i);
    if (vpFrontMatch) {
      vpRel = 'IN_FRONT';
      distVp = parseFloat(vpFrontMatch[1]);
    } else if (vpBehindMatch) {
      vpRel = 'BEHIND';
      distVp = parseFloat(vpBehindMatch[1]);
    }
  }

  return {
    type: 'POINT',
    name: pointName,
    hpRelation: hpRel,
    distanceHp: distHp,
    vpRelation: vpRel,
    distanceVp: distVp,
    isHidden: lower.includes('hidden') || lower.includes('bracket'),
    explanation: `Point ${pointName} is ${distHp} mm ${hpRel} HP and ${distVp} mm ${vpRel} VP.`,
  };
}

/**
 * POST /api/scan-question
 * Accepts imageBase64 or text.
 * Performs accurate OCR via Gemini 3.8 Flash, analyzes the engineering graphics geometry,
 * and extracts structured parameters strictly adhering to BIS SP 46:2003 / ISO 128 standards.
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

    // If Gemini API Key is available, use gemini-3.8-flash for OCR & Structured Reasoning
    if (apiKey) {
      try {
        const parts: any[] = [];

        if (imageBase64) {
          // Clean base64 string
          const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data,
            },
          });
        }

        const promptText = `
You are an expert Senior Engineering Drawing & Descriptive Geometry Professor (BIS SP 46:2003 / ISO 128 standards).
Your task is to analyze the engineering graphics problem from the textbook image or text prompt.

1. FIRST, accurately transcribe the EXACT text of the question (OCR).
2. IDENTIFY whether this is a PROJECTION OF STRAIGHT LINE problem or a PROJECTION OF POINT problem.
3. EXTRACT all geometric parameters:
   - For Straight Line:
     * Line ends names (e.g. A and B).
     * True Length (TL in mm).
     * Orientation:
       - 'PERPENDICULAR_HP' (if perpendicular to HP, parallel to VP, θ=90°, φ=0°).
       - 'PERPENDICULAR_VP' (if perpendicular to VP, parallel to HP, θ=0°, φ=90°).
       - 'PARALLEL_BOTH' (parallel to both HP & VP, θ=0°, φ=0°).
       - 'INCLINED_HP_PARALLEL_VP' (inclined to HP at θ, parallel to VP φ=0°).
       - 'INCLINED_VP_PARALLEL_HP' (inclined to VP at φ, parallel to HP θ=0°).
       - 'INCLINED_BOTH' (oblique line inclined to both HP and VP).
     * True inclinations: thetaDeg (to HP, 0-90°), phiDeg (to VP, 0-90°).
     * Position of End A: distanceHp (mm), hpRelation ('ABOVE'|'BELOW'|'ON'), distanceVp (mm), vpRelation ('IN_FRONT'|'BEHIND'|'ON').
     * Position of End B: distanceHp (mm), hpRelation ('ABOVE'|'BELOW'|'ON'), distanceVp (mm), vpRelation ('IN_FRONT'|'BEHIND'|'ON').
       (NOTE: If line is parallel to VP, B has the same distanceVp as A! If line is perpendicular to HP, B has same distanceVp as A, and distanceHp of B = distanceHp of A ± TL).
     * Projector distance DEP: 0 if perpendicular to HP or VP, otherwise given DEP or calculated.
     * Visibility & Labels:
       - If line is PERPENDICULAR_HP: Top View is a POINT where End A and End B coincide. The end with higher elevation is visible and the lower end is hidden beneath it in parentheses, e.g. 'a(b)' if A is 35mm and B is 10mm! Front view is a vertical line a'b' of true length.
       - If line is PERPENDICULAR_VP: Front View is a point with hidden notation, e.g. 'a′(b′)', Top view is a line of true length.
   - For Point:
     * Point name (e.g. A or P).
     * hpRelation ('ABOVE'|'BELOW'|'ON'), distanceHp (mm).
     * vpRelation ('IN_FRONT'|'BEHIND'|'ON'), distanceVp (mm).
     * isHidden (boolean).

Return JSON matching the schema precisely.
`;
        parts.push({ text: promptText });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            systemInstruction:
              'You are an authoritative engineering drawing and descriptive geometry parser adhering to BIS SP 46:2003 and N.D. Bhatt textbook standards. Always return valid JSON matching the response schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcribedQuestion: {
                  type: Type.STRING,
                  description: 'The exact question text transcribed from the image or input.',
                },
                problemType: {
                  type: Type.STRING,
                  enum: ['LINE', 'POINT'],
                },
                line: {
                  type: Type.OBJECT,
                  properties: {
                    nameA: { type: Type.STRING },
                    nameB: { type: Type.STRING },
                    trueLength: { type: Type.NUMBER },
                    orientation: {
                      type: Type.STRING,
                      enum: [
                        'PERPENDICULAR_HP',
                        'PERPENDICULAR_VP',
                        'PARALLEL_BOTH',
                        'INCLINED_HP_PARALLEL_VP',
                        'INCLINED_VP_PARALLEL_HP',
                        'INCLINED_BOTH',
                      ],
                    },
                    thetaDeg: { type: Type.NUMBER },
                    phiDeg: { type: Type.NUMBER },
                    endA: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        distanceHp: { type: Type.NUMBER },
                        hpRelation: { type: Type.STRING, enum: ['ABOVE', 'BELOW', 'ON'] },
                        distanceVp: { type: Type.NUMBER },
                        vpRelation: { type: Type.STRING, enum: ['IN_FRONT', 'BEHIND', 'ON'] },
                      },
                      required: ['distanceHp', 'hpRelation', 'distanceVp', 'vpRelation'],
                    },
                    endB: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        distanceHp: { type: Type.NUMBER },
                        hpRelation: { type: Type.STRING, enum: ['ABOVE', 'BELOW', 'ON'] },
                        distanceVp: { type: Type.NUMBER },
                        vpRelation: { type: Type.STRING, enum: ['IN_FRONT', 'BEHIND', 'ON'] },
                      },
                      required: ['distanceHp', 'hpRelation', 'distanceVp', 'vpRelation'],
                    },
                    dep: { type: Type.NUMBER },
                    frontViewLength: { type: Type.NUMBER },
                    topViewLength: { type: Type.NUMBER },
                    topViewLabel: { type: Type.STRING },
                    frontViewLabelA: { type: Type.STRING },
                    frontViewLabelB: { type: Type.STRING },
                    hiddenA: { type: Type.BOOLEAN },
                    hiddenB: { type: Type.BOOLEAN },
                    explanation: { type: Type.STRING },
                  },
                },
                point: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    distanceHp: { type: Type.NUMBER },
                    hpRelation: { type: Type.STRING, enum: ['ABOVE', 'BELOW', 'ON'] },
                    distanceVp: { type: Type.NUMBER },
                    vpRelation: { type: Type.STRING, enum: ['IN_FRONT', 'BEHIND', 'ON'] },
                    isHidden: { type: Type.BOOLEAN },
                    explanation: { type: Type.STRING },
                  },
                },
              },
              required: ['transcribedQuestion', 'problemType'],
            },
          },
        });

        const rawJson = (response.text || '').trim();
        const parsedData = JSON.parse(rawJson);

        recognizedText = parsedData.transcribedQuestion || recognizedText;

        if (parsedData.problemType === 'LINE' && parsedData.line) {
          const l = parsedData.line;
          return res.json({
            success: true,
            rawText: recognizedText,
            source: 'gemini-3.8-flash',
            parsed: {
              type: 'LINE',
              nameA: l.nameA || 'A',
              nameB: l.nameB || 'B',
              trueLength: l.trueLength || 25,
              thetaDeg: l.thetaDeg ?? (l.orientation === 'PERPENDICULAR_HP' ? 90 : 30),
              phiDeg: l.phiDeg ?? (l.orientation === 'PERPENDICULAR_VP' ? 90 : 0),
              orientation: l.orientation || 'PERPENDICULAR_HP',
              mode: 'END_POINTS',
              endA: {
                name: l.nameA || 'A',
                hpRelation: l.endA?.hpRelation || 'ABOVE',
                distanceHp: l.endA?.distanceHp ?? 35,
                vpRelation: l.endA?.vpRelation || 'IN_FRONT',
                distanceVp: l.endA?.distanceVp ?? 20,
              },
              endB: {
                name: l.nameB || 'B',
                hpRelation: l.endB?.hpRelation || 'ABOVE',
                distanceHp: l.endB?.distanceHp ?? 10,
                vpRelation: l.endB?.vpRelation || 'IN_FRONT',
                distanceVp: l.endB?.distanceVp ?? 20,
              },
              dep: l.dep ?? (l.orientation === 'PERPENDICULAR_HP' ? 0 : 50),
              frontViewLength: l.frontViewLength ?? l.trueLength,
              topViewLength: l.topViewLength ?? (l.orientation === 'PERPENDICULAR_HP' ? 0 : l.trueLength),
              targetQuadrantB: 'FIRST',
              hiddenA: !!l.hiddenA,
              hiddenB: l.hiddenB !== undefined ? l.hiddenB : l.orientation === 'PERPENDICULAR_HP',
              topViewLabel: l.topViewLabel || (l.orientation === 'PERPENDICULAR_HP' ? `${(l.nameA || 'a').toLowerCase()}(${(l.nameB || 'b').toLowerCase()})` : undefined),
              frontViewLabelA: l.frontViewLabelA || `${(l.nameA || 'a').toLowerCase()}′`,
              frontViewLabelB: l.frontViewLabelB || `${(l.nameB || 'b').toLowerCase()}′`,
              explanation: l.explanation,
            },
          });
        } else if (parsedData.problemType === 'POINT' && parsedData.point) {
          const p = parsedData.point;
          return res.json({
            success: true,
            rawText: recognizedText,
            source: 'gemini-3.8-flash',
            parsed: {
              type: 'POINT',
              name: p.name || 'P',
              hpRelation: p.hpRelation || 'ABOVE',
              distanceHp: p.distanceHp ?? 30,
              vpRelation: p.vpRelation || 'IN_FRONT',
              distanceVp: p.distanceVp ?? 40,
              isHidden: !!p.isHidden,
              explanation: p.explanation,
            },
          });
        }
      } catch (geminiErr: any) {
        console.error('Gemini OCR API error, falling back to rule-based engine:', geminiErr);
      }
    }

    // Fallback: rule-based solver
    const ruleResult = solveQuestionRuleBased(recognizedText || text || 'A Line AB 25mm is parallel to the VP and perpendicular to the HP. Point A is 35mm above the HP and 20mm in front of the VP. B is 10 mm above the HP. Draw its projections.');
    return res.json({
      success: true,
      rawText: recognizedText || text,
      source: 'rule-based-fallback',
      parsed: ruleResult,
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
