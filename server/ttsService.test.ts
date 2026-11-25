/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { isTtsConfigured, synthesizeNarrationSpeech } from './ttsService.ts';

test('synthesizeNarrationSpeech rejects empty and oversized narration text', async () => {
  const emptyRes = await synthesizeNarrationSpeech({ text: '   ' });
  assert.equal(emptyRes.ok, false);
  if (!emptyRes.ok) {
    assert.equal(emptyRes.status, 400);
    assert.equal(emptyRes.code, 'INVALID_INPUT');
  }

  const longRes = await synthesizeNarrationSpeech({ text: 'a'.repeat(2005) });
  assert.equal(longRes.ok, false);
  if (!longRes.ok) {
    assert.equal(longRes.status, 400);
    assert.equal(longRes.code, 'INVALID_INPUT');
  }
});

test('synthesizeNarrationSpeech returns 503 TTS_UNCONFIGURED when GEMINI_API_KEY is unset', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.equal(isTtsConfigured(), false);

    const res = await synthesizeNarrationSpeech({
      text: 'Step 1: Identify the quadrant before drawing.',
      voicePreset: 'warm-mentor',
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 503);
      assert.equal(res.code, 'TTS_UNCONFIGURED');
    }
  } finally {
    if (prevKey !== undefined) {
      process.env.GEMINI_API_KEY = prevKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});
