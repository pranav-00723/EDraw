/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type NarratorVoicePreset = 'warm-mentor' | 'clear-instructor';

const VOICE_MAP: Record<
  NarratorVoicePreset,
  { voiceName: 'Charon' | 'Kore'; style: string; label: string }
> = {
  'warm-mentor': {
    voiceName: 'Charon',
    style:
      'Bold, warm, grounded, natural human engineering professor speaking clearly and reassuringly with steady pacing, rich tone, and zero robotic cadence.',
    label: 'Warm Mentor',
  },
  'clear-instructor': {
    voiceName: 'Kore',
    style:
      'Clear, articulate, friendly, natural human instructor explaining a technical drawing step-by-step with warm conversational tone and crisp pronunciation.',
    label: 'Clear Instructor',
  },
};

const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const MAX_CACHE_ENTRIES = 120;
const DISK_CACHE_DIR = '/tmp/edraw-tts-cache';
const QUOTA_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown after consecutive 429s

// In-memory LRU-style cache + persistent /tmp WAV cache so replays never re-hit API quota
const audioCache = new Map<string, { audioBase64: string; mimeType: string }>();
let quotaExhaustedUntil = 0;

function ensureDiskCacheDir(): void {
  try {
    if (!fs.existsSync(DISK_CACHE_DIR)) {
      fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
    }
  } catch {
    // Non-fatal if /tmp is unavailable
  }
}

function readDiskCache(cacheKey: string): { audioBase64: string; mimeType: string } | null {
  try {
    const filePath = path.join(DISK_CACHE_DIR, `${cacheKey}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.audioBase64 === 'string' && parsed.audioBase64.length > 0) {
      return {
        audioBase64: parsed.audioBase64,
        mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : 'audio/wav',
      };
    }
  } catch {
    // Ignore corrupt or unreadable cache files
  }
  return null;
}

function writeDiskCache(cacheKey: string, entry: { audioBase64: string; mimeType: string }): void {
  try {
    ensureDiskCacheDir();
    const filePath = path.join(DISK_CACHE_DIR, `${cacheKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf8');
  } catch {
    // Non-fatal disk cache failure
  }
}

export function isTtsConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return key.length > 10 && !key.includes('YOUR_');
}

export function isTtsQuotaCooldownActive(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

export function isStudioTtsAvailable(): boolean {
  return isTtsConfigured() && !isTtsQuotaCooldownActive();
}

function makeCacheKey(text: string, preset: NarratorVoicePreset): string {
  return crypto.createHash('sha256').update(`${preset}:${text}`).digest('hex');
}

function isQuotaError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    err?.status === 429 ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TtsSynthesisResult {
  ok: true;
  audioBase64: string;
  mimeType: string;
  voiceName: string;
  cached: boolean;
}

export interface TtsSynthesisError {
  ok: false;
  status: number;
  code: 'TTS_UNCONFIGURED' | 'INVALID_INPUT' | 'TTS_QUOTA_EXCEEDED' | 'TTS_FAILED';
  error: string;
}

export async function synthesizeNarrationSpeech(params: {
  text: string;
  voicePreset?: unknown;
}): Promise<TtsSynthesisResult | TtsSynthesisError> {
  const text = typeof params.text === 'string' ? params.text.trim() : '';
  if (!text || text.length > 2000) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      error: 'Narration text must be between 1 and 2000 characters.',
    };
  }

  if (!isTtsConfigured()) {
    return {
      ok: false,
      status: 503,
      code: 'TTS_UNCONFIGURED',
      error: 'Studio voice synthesis is not configured in server environment variables.',
    };
  }

  const preset: NarratorVoicePreset =
    params.voicePreset === 'clear-instructor' ? 'clear-instructor' : 'warm-mentor';
  const voiceSpec = VOICE_MAP[preset];
  const cacheKey = makeCacheKey(text, preset);

  // 1. Check in-memory LRU cache first
  const cached = audioCache.get(cacheKey);
  if (cached) {
    audioCache.delete(cacheKey);
    audioCache.set(cacheKey, cached);
    return {
      ok: true,
      audioBase64: cached.audioBase64,
      mimeType: cached.mimeType,
      voiceName: voiceSpec.voiceName,
      cached: true,
    };
  }

  // 2. Check persistent disk cache (works even if quota cooldown is active)
  const diskCached = readDiskCache(cacheKey);
  if (diskCached) {
    if (audioCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = audioCache.keys().next().value;
      if (oldestKey) audioCache.delete(oldestKey);
    }
    audioCache.set(cacheKey, diskCached);
    return {
      ok: true,
      audioBase64: diskCached.audioBase64,
      mimeType: diskCached.mimeType,
      voiceName: voiceSpec.voiceName,
      cached: true,
    };
  }

  // 3. Respect temporary cooldown if quota was recently exhausted
  if (isTtsQuotaCooldownActive()) {
    return {
      ok: false,
      status: 429,
      code: 'TTS_QUOTA_EXCEEDED',
      error: 'Studio voice quota temporarily exhausted.',
    };
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const maxAttempts = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: voiceSpec.style,
                },
              } as any,
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceSpec.voiceName },
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;
      const mimeType = inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        return {
          ok: false,
          status: 502,
          code: 'TTS_FAILED',
          error: 'Speech synthesis returned empty audio payload.',
        };
      }

      const entry = { audioBase64: base64Audio, mimeType };
      if (audioCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = audioCache.keys().next().value;
        if (oldestKey) audioCache.delete(oldestKey);
      }
      audioCache.set(cacheKey, entry);
      writeDiskCache(cacheKey, entry);
      quotaExhaustedUntil = 0;

      return {
        ok: true,
        audioBase64: base64Audio,
        mimeType,
        voiceName: voiceSpec.voiceName,
        cached: false,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        await sleep(450 * attempt);
      }
    }
  }

  console.error('Error in synthesizeNarrationSpeech:', lastError);
  if (isQuotaError(lastError)) {
    quotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN_MS;
    return {
      ok: false,
      status: 429,
      code: 'TTS_QUOTA_EXCEEDED',
      error: lastError?.message || 'Studio voice quota exceeded.',
    };
  }

  return {
    ok: false,
    status: 502,
    code: 'TTS_FAILED',
    error: lastError?.message || 'Unable to synthesize voice narration right now.',
  };
}
