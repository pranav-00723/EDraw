/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { UncertainReading } from '../../src/pipeline/schema.ts';

export type OcrEnginePreference = 'auto' | 'glm-ocr' | 'gemini-vision' | 'tesseract';

export interface OcrExtractionSuccess {
  ok: true;
  stage: 'stage_1_ocr';
  engine_used: string;
  input_type: 'image' | 'text';
  raw_text: string;
  confidence: number | null;
  warnings: string[];
  uncertain_readings: UncertainReading[];
}

export interface OcrExtractionFailure {
  ok: false;
  stage: 'stage_1_ocr';
  engine_attempted: string[];
  error: string;
  configuration_hint?: string;
}

export type OcrExtractionResult = OcrExtractionSuccess | OcrExtractionFailure;

export interface OcrCapabilities {
  glm_ocr: {
    preferred: true;
    configured: boolean;
    model: string;
    endpoint_configured_via: 'OLLAMA_BASE_URL';
    hosted_guidance: string;
  };
  gemini_vision: {
    configured: boolean;
    model: string;
  };
  tesseract_local: {
    available: boolean;
  };
}

const DEFAULT_OLLAMA_MODEL = 'glm-ocr';
const GEMINI_OCR_MODEL = 'gemini-4-hydrogen';

const OCR_SYSTEM_PROMPT = `You are a verbatim Engineering Drawing OCR transcription engine.
Transcribe ALL text, mathematical symbols (°, θ, φ, α, β, ′), object/endpoint labels (e.g. AB, PQ, NM, LK, JP), plane references (HP, VP), units (mm, cm, m, deg), and measurements exactly as written in the image.
CRITICAL RULES:
- Preserve exact problem wording, symbols, labels, and numbers.
- Do NOT solve the problem.
- Do NOT invent missing measurements or silently guess illegible digits.
- If a number or symbol is blurry or ambiguous, wrap it in [UNCERTAIN: <best reading>] so downstream validation can flag it.
- Output ONLY the transcribed question text.`;

export function getOllamaConfig(): { baseUrl: string | null; model: string; apiKey: string | null } {
  const rawUrl = (process.env.OLLAMA_BASE_URL || '').trim();
  const model = (process.env.OLLAMA_OCR_MODEL || DEFAULT_OLLAMA_MODEL).trim() || DEFAULT_OLLAMA_MODEL;
  const apiKey = (process.env.OLLAMA_API_KEY || '').trim() || null;

  if (!rawUrl) {
    return { baseUrl: null, model, apiKey };
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { baseUrl: null, model, apiKey };
    }
    return { baseUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''), model, apiKey };
  } catch {
    return { baseUrl: null, model, apiKey };
  }
}

export function isGeminiConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return key.length > 10 && !key.includes('YOUR_');
}

export function getOcrCapabilities(): OcrCapabilities {
  const ollama = getOllamaConfig();
  return {
    glm_ocr: {
      preferred: true,
      configured: Boolean(ollama.baseUrl),
      model: ollama.model,
      endpoint_configured_via: 'OLLAMA_BASE_URL',
      hosted_guidance:
        'When running EDraw on a hosted backend, localhost on your personal computer is unreachable. Set OLLAMA_BASE_URL in server environment variables to a reachable HTTPS tunnel/endpoint (for example via Cloudflare Tunnel or ngrok forwarding your local Ollama port 11434) running the glm-ocr model.',
    },
    gemini_vision: {
      configured: isGeminiConfigured(),
      model: GEMINI_OCR_MODEL,
    },
    tesseract_local: {
      available: true,
    },
  };
}

/**
 * Inspects raw OCR text for common symbol misrecognitions without silently altering numbers.
 */
export function detectUncertainOcrReadings(rawText: string): UncertainReading[] {
  const readings: UncertainReading[] = [];
  const text = rawText || '';

  // 1. Explicit [UNCERTAIN: ...] tags emitted by OCR engine
  const explicitRegex = /\[UNCERTAIN:\s*([^\]]+)\]/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = explicitRegex.exec(text)) !== null) {
    idx += 1;
    readings.push({
      id: `ocr_explicit_${idx}`,
      raw_token: match[0],
      suspected_property: null,
      reason: `OCR flagged "${match[1].trim()}" as visually uncertain.`,
      severity: 'blocking',
      suggested_interpretation: match[1].trim(),
    });
  }

  // 2. Classic degree-symbol misrecognition as trailing zero:
  // e.g. "inclined at 300 to HP" or "at 450 to the VP" or "300° to HP"
  const degreeAsZeroRegex =
    /(?:inclined\s*(?:at)?|angle\s*(?:of)?|at|making)\s+(\d{3,4})\s*(?:°|deg|degrees)?\s*(?:to|with)\s*(?:the\s*)?(h\.?\s*p\.?|v\.?\s*p\.?)/gi;
  while ((match = degreeAsZeroRegex.exec(text)) !== null) {
    const rawNum = match[1];
    const numVal = Number(rawNum);
    const plane = match[2].replace(/[\s.]+/g, '').toUpperCase();
    const suspectedProp = plane === 'HP' ? 'theta_hp' : 'phi_vp';
    if (numVal > 90 && rawNum.endsWith('0')) {
      const candidateDeg = Number(rawNum.slice(0, -1));
      if (candidateDeg >= 0 && candidateDeg <= 90) {
        idx += 1;
        readings.push({
          id: `ocr_deg_zero_${idx}`,
          raw_token: match[0],
          suspected_property: suspectedProp,
          reason: `Read "${rawNum}" for inclination to ${plane} (> 90°). The degree symbol (°) may have been OCR-misread as a trailing "0".`,
          severity: 'blocking',
          suggested_interpretation: `${candidateDeg}° to ${plane}`,
        });
      }
    }
  }

  // 3. Degree symbol misread as letter 'o', 'O', or corrupted symbol next to angle (e.g., "30o to HP", "45º" is ok, "30O", "30?" or "30§")
  const degreeAsBadSymRegex =
    /(\d+(?:\.\d+)?)\s*([?§@#%$]|o\b|O\b)\s*(?:to|with)\s*(?:the\s*)?(h\.?\s*p\.?|v\.?\s*p\.?)/g;
  while ((match = degreeAsBadSymRegex.exec(text)) !== null) {
    const plane = match[3].replace(/[\s.]+/g, '').toUpperCase();
    const suspectedProp = plane === 'HP' ? 'theta_hp' : 'phi_vp';
    idx += 1;
    readings.push({
      id: `ocr_deg_sym_${idx}`,
      raw_token: match[0],
      suspected_property: suspectedProp,
      reason: `Possible OCR symbol misrecognition "${match[1]}${match[2]}" before ${plane}. Confirm whether this means ${match[1]}°.`,
      severity: 'blocking',
      suggested_interpretation: `${match[1]}° to ${plane}`,
    });
  }

  // 4. Corrupted dimension unit (e.g. "75 1m", "50 rn", "80 mm?" or "50mm lone")
  const badUnitRegex = /\b(\d+(?:\.\d+)?)\s*(?:1\s*m|rn|rnm|m\s*\?|mm\?)\b/gi;
  while ((match = badUnitRegex.exec(text)) !== null) {
    idx += 1;
    readings.push({
      id: `ocr_unit_${idx}`,
      raw_token: match[0],
      suspected_property: 'true_length',
      reason: `Uncertain unit token "${match[0]}" detected in OCR output. Confirm whether the intended measurement is ${match[1]} mm.`,
      severity: 'blocking',
      suggested_interpretation: `${match[1]} mm`,
    });
  }

  // 5. Conflicting duplicate true-length mentions (e.g. "line AB 80 mm long ... 65 mm long")
  // Exclude projected view lengths like "front view 60 mm long" or "top view 55 mm long".
  const allLengthMentions = Array.from(
    text.matchAll(/\b(\d+(?:\.\d+)?)\s*(mm|cm|m)\s+(?:long|in\s+length)\b/gi)
  );
  const trueLengthMentions = allLengthMentions.filter((m) => {
    const startIdx = m.index ?? 0;
    const prefix = text.slice(Math.max(0, startIdx - 40), startIdx);
    return !/(?:front\s+view|top\s+view|elevation|plan|side\s+view|end\s+view|projector(?:s)?)\s*(?:length\s*)?(?:is|of|measures|=)?\s*$/i.test(
      prefix
    );
  });
  if (trueLengthMentions.length > 1) {
    const distinct = new Set(trueLengthMentions.map((m) => `${m[1]}${m[2].toLowerCase()}`));
    if (distinct.size > 1) {
      idx += 1;
      readings.push({
        id: `ocr_conflict_length_${idx}`,
        raw_token: trueLengthMentions.map((m) => m[0]).join(' / '),
        suspected_property: 'true_length',
        reason: `Multiple conflicting true-length readings detected in source text: ${Array.from(distinct).join(', ')}.`,
        severity: 'blocking',
        suggested_interpretation: null,
      });
    }
  }

  return readings;
}

async function runOllamaGlmOcr(
  base64Image: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ text: string; model: string }> {
  const { baseUrl, model, apiKey } = getOllamaConfig();
  if (!baseUrl) {
    throw new Error(
      'OLLAMA_BASE_URL is not configured. To use GLM-OCR in a hosted environment, expose Ollama over HTTPS and set OLLAMA_BASE_URL.'
    );
  }

  const strippedBase64 = base64Image.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetchImpl(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: OCR_SYSTEM_PROMPT,
        images: [strippedBase64],
        stream: false,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`Ollama GLM-OCR returned HTTP ${res.status}: ${bodyText.slice(0, 180)}`);
    }

    const data = (await res.json()) as { response?: string; message?: { content?: string } };
    const text = (data.response || data.message?.content || '').trim();
    if (!text) {
      throw new Error('Ollama GLM-OCR returned empty transcription.');
    }
    return { text, model };
  } finally {
    clearTimeout(timeout);
  }
}

async function runGeminiVisionOcr(base64Image: string, mimeType: string): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const strippedBase64 = base64Image.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  const generatePromise = ai.models.generateContent({
    model: GEMINI_OCR_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: strippedBase64,
          },
        },
        { text: OCR_SYSTEM_PROMPT },
      ],
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini Vision OCR timed out after 15s.')), 15000)
  );

  const response = await Promise.race([generatePromise, timeoutPromise]);
  const text = (response.text || '').trim();
  if (!text) {
    throw new Error('Gemini Vision OCR returned empty text.');
  }
  return text;
}

async function runLocalTesseractOcr(base64Image: string): Promise<{ text: string; confidence: number | null }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const imgSrc = base64Image.startsWith('data:')
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;
    const ret = await worker.recognize(imgSrc);
    const text = (ret?.data?.text || '').trim();
    const rawConf = typeof ret?.data?.confidence === 'number' ? ret.data.confidence : null;
    const confidence = rawConf !== null ? Math.max(0, Math.min(1, rawConf / 100)) : null;
    if (!text) {
      throw new Error('Tesseract OCR could not extract legible text from this image.');
    }
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

/**
 * Stage 1 Entry Point: Extract text from image or accept direct question text.
 * Never fabricates text if OCR fails.
 */
export async function runStage1Ocr(params: {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  engine?: OcrEnginePreference;
  fetchImpl?: typeof fetch;
}): Promise<OcrExtractionResult> {
  const preferred: OcrEnginePreference = params.engine || 'auto';

  // Direct text path (preserves traceability through Stage 1 -> Stage 2)
  if (!params.imageBase64) {
    const rawText = typeof params.text === 'string' ? params.text.trim() : '';
    if (!rawText) {
      return {
        ok: false,
        stage: 'stage_1_ocr',
        engine_attempted: ['direct-text'],
        error: 'No image or question text provided to Stage 1 OCR.',
      };
    }
    const uncertain_readings = detectUncertainOcrReadings(rawText);
    return {
      ok: true,
      stage: 'stage_1_ocr',
      engine_used: 'direct-text-input',
      input_type: 'text',
      raw_text: rawText,
      confidence: 1,
      warnings: uncertain_readings.map((u) => u.reason),
      uncertain_readings,
    };
  }

  const imageBase64 = params.imageBase64.trim();
  const mimeType = (params.mimeType || 'image/jpeg').trim();
  const attempted: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const tryGlm = async (): Promise<OcrExtractionSuccess | null> => {
    attempted.push('glm-ocr (ollama)');
    try {
      const out = await runOllamaGlmOcr(imageBase64, params.fetchImpl);
      const uncertain_readings = detectUncertainOcrReadings(out.text);
      return {
        ok: true,
        stage: 'stage_1_ocr',
        engine_used: `ollama:${out.model}`,
        input_type: 'image',
        raw_text: out.text,
        confidence: null,
        warnings: [...warnings, ...uncertain_readings.map((u) => u.reason)],
        uncertain_readings,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`GLM-OCR: ${msg}`);
      return null;
    }
  };

  const tryGemini = async (): Promise<OcrExtractionSuccess | null> => {
    attempted.push(`gemini-vision (${GEMINI_OCR_MODEL})`);
    try {
      const text = await runGeminiVisionOcr(imageBase64, mimeType);
      const uncertain_readings = detectUncertainOcrReadings(text);
      return {
        ok: true,
        stage: 'stage_1_ocr',
        engine_used: `gemini-vision:${GEMINI_OCR_MODEL}`,
        input_type: 'image',
        raw_text: text,
        confidence: null,
        warnings: [...warnings, ...uncertain_readings.map((u) => u.reason)],
        uncertain_readings,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Gemini Vision: ${msg}`);
      return null;
    }
  };

  const tryTesseract = async (): Promise<OcrExtractionSuccess | null> => {
    attempted.push('tesseract-local');
    try {
      const out = await runLocalTesseractOcr(imageBase64);
      const uncertain_readings = detectUncertainOcrReadings(out.text);
      if (out.confidence !== null && out.confidence < 0.65) {
        warnings.push(
          `Local Tesseract OCR confidence is low (${Math.round(out.confidence * 100)}%). Verify extracted measurements carefully.`
        );
      }
      return {
        ok: true,
        stage: 'stage_1_ocr',
        engine_used: 'tesseract-local',
        input_type: 'image',
        raw_text: out.text,
        confidence: out.confidence,
        warnings: [...warnings, ...uncertain_readings.map((u) => u.reason)],
        uncertain_readings,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Tesseract: ${msg}`);
      return null;
    }
  };

  if (preferred === 'glm-ocr') {
    const res = await tryGlm();
    if (res) return res;
    return {
      ok: false,
      stage: 'stage_1_ocr',
      engine_attempted: attempted,
      error: errors.join(' | ') || 'GLM-OCR failed.',
      configuration_hint: getOcrCapabilities().glm_ocr.hosted_guidance,
    };
  }

  if (preferred === 'gemini-vision') {
    const res = await tryGemini();
    if (res) return res;
    return {
      ok: false,
      stage: 'stage_1_ocr',
      engine_attempted: attempted,
      error: errors.join(' | ') || 'Gemini Vision OCR failed.',
    };
  }

  if (preferred === 'tesseract') {
    const res = await tryTesseract();
    if (res) return res;
    return {
      ok: false,
      stage: 'stage_1_ocr',
      engine_attempted: attempted,
      error: errors.join(' | ') || 'Local Tesseract OCR failed.',
    };
  }

  // Auto order: GLM-OCR (preferred if OLLAMA_BASE_URL set) -> Gemini Vision (if configured) -> Local Tesseract
  if (getOllamaConfig().baseUrl) {
    const glmRes = await tryGlm();
    if (glmRes) return glmRes;
    warnings.push('Preferred GLM-OCR endpoint was unavailable; fell back to next configured OCR engine.');
  } else {
    warnings.push(
      'Preferred GLM-OCR (OLLAMA_BASE_URL) is not configured in this environment; using available fallback OCR engine.'
    );
  }

  if (isGeminiConfigured()) {
    const gemRes = await tryGemini();
    if (gemRes) return gemRes;
  }

  const tessRes = await tryTesseract();
  if (tessRes) return tessRes;

  return {
    ok: false,
    stage: 'stage_1_ocr',
    engine_attempted: attempted,
    error: `All OCR engines failed to extract text: ${errors.join(' | ')}`,
    configuration_hint: getOcrCapabilities().glm_ocr.hosted_guidance,
  };
}
