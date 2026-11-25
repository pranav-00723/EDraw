/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { splitNarrationIntoSubtitleCues, SubtitleCue } from '../utils/pointVideoScript';

export type NarratorVoicePreset = 'warm-mentor' | 'clear-instructor';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
  return URL.createObjectURL(blob);
}

function findCueIndexByRatio(cues: SubtitleCue[], ratio: number): number {
  if (cues.length === 0) return 0;
  const r = clamp01(ratio);
  for (let i = 0; i < cues.length; i++) {
    if (r <= cues[i].endRatio || i === cues.length - 1) {
      return i;
    }
  }
  return cues.length - 1;
}

function findCueIndexByChar(cues: SubtitleCue[], charIndex: number): number {
  if (cues.length === 0) return 0;
  for (let i = 0; i < cues.length; i++) {
    if (charIndex <= cues[i].endChar) {
      return i;
    }
  }
  return cues.length - 1;
}

function estimateSpeechDurationMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const baseMs = (words / 2.55) * 1000;
  return Math.max(2400, baseMs / Math.max(0.6, rate));
}

function selectBestNaturalVoice(
  voices: SpeechSynthesisVoice[],
  preset: NarratorVoicePreset
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const englishVoices = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  const strongWarmVoiceRegex =
    /google uk english male|andrew|brian|guy|daniel|christopher|eric|ryan|roger|george|oliver|davis|tony/i;
  const fallbackWarmRegex = /google us english/i;
  const clearInstructorRegex =
    /aria|ava|emma|jenny|samantha|serena|victoria|karen|google uk english female|google us english/i;

  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;

  for (const voice of pool) {
    const label = `${voice.name} ${voice.voiceURI}`;
    let score = 0;

    if (/espeak|festival|mbrola|flite|pico|speech-dispatcher/i.test(label)) {
      score -= 120;
    }
    if (/natural|neural|online|wavenet|studio|enhanced|premium/i.test(label)) {
      score += 60;
    }
    if (/microsoft|google|apple/i.test(label)) {
      score += 18;
    }

    if (preset === 'warm-mentor') {
      if (strongWarmVoiceRegex.test(label)) {
        score += 42;
      } else if (fallbackWarmRegex.test(label)) {
        score += 14;
      }
    } else if (preset === 'clear-instructor' && clearInstructorRegex.test(label)) {
      score += 32;
    }

    if (/en[-_](US|GB)/i.test(voice.lang)) {
      score += 10;
    }
    if (!voice.localService) {
      score += 12;
    }

    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice;
}

export interface UseStepVoiceoverOptions {
  activeText: string;
  playbackSpeed?: number;
  voicePreset?: NarratorVoicePreset;
  onSpeechFinished?: () => void;
}

export function useStepVoiceover({
  activeText,
  playbackSpeed = 1,
  voicePreset = 'warm-mentor',
  onSpeechFinished,
}: UseStepVoiceoverOptions) {
  const [voiceEnabled, setVoiceEnabledState] = useState<boolean>(true);
  const voiceEnabledRef = useRef<boolean>(true);
  const setVoiceEnabled = useCallback((next: boolean) => {
    voiceEnabledRef.current = next;
    setVoiceEnabledState(next);
  }, []);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeCueIdx, setActiveCueIdx] = useState<number>(0);
  const [studioVoiceAvailable, setStudioVoiceAvailable] = useState<boolean | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const stepCues = splitNarrationIntoSubtitleCues(activeText || '');
  const stepCuesRef = useRef<SubtitleCue[]>(stepCues);
  useEffect(() => {
    stepCuesRef.current = stepCues;
    setActiveCueIdx(0);
  }, [activeText]);

  const isSpeakingRef = useRef<boolean>(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCacheRef = useRef<Map<string, string>>(new Map());
  const pendingFetchesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechSessionIdRef = useRef<number>(0);
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  const onSpeechFinishedRef = useRef(onSpeechFinished);
  onSpeechFinishedRef.current = onSpeechFinished;

  const sessionEngineRef = useRef<'studio' | 'browser' | null>(null);
  const lockedBrowserVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechStartTimeRef = useRef<number | null>(null);
  const lastBoundaryTimeRef = useRef<number>(0);
  const speechEngineActiveRef = useRef<'audio' | 'tts' | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const cueTimerRef = useRef<number | null>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';
  const audioSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    if (audioElementRef.current) {
      try {
        audioElementRef.current.preservesPitch = true;
        audioElementRef.current.playbackRate = playbackSpeed;
      } catch {
        // Ignore playbackRate assignment errors on unready audio elements
      }
    }
  }, [playbackSpeed]);

  // Eagerly load browser voices on mount so every step shares the exact same voice
  useEffect(() => {
    if (!speechSupported) return;
    const updateVoices = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        if (list && list.length > 0) {
          availableVoicesRef.current = list;
          setAvailableVoices(list);
        }
      } catch {
        // Ignore browser voice enumeration errors
      }
    };
    updateVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', updateVoices);
    };
  }, [speechSupported]);

  const checkStudioStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/tts/status');
      if (!res.ok) {
        setStudioVoiceAvailable(false);
        return false;
      }
      const data = await res.json();
      const available = Boolean(data?.studioVoiceAvailable);
      setStudioVoiceAvailable(available);
      return available;
    } catch {
      setStudioVoiceAvailable(false);
      return false;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (watchdogTimerRef.current !== null) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (cueTimerRef.current !== null) {
      window.clearInterval(cueTimerRef.current);
      cueTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    speechSessionIdRef.current += 1;
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    speechEngineActiveRef.current = null;
    speechStartTimeRef.current = null;
    lastBoundaryTimeRef.current = 0;
    clearTimers();

    if (speechAbortRef.current) {
      speechAbortRef.current.abort();
      speechAbortRef.current = null;
    }

    if (audioElementRef.current) {
      try {
        audioElementRef.current.onended = null;
        audioElementRef.current.onerror = null;
        audioElementRef.current.onplay = null;
        audioElementRef.current.ontimeupdate = null;
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch {
        // Ignore audio cleanup errors
      }
      audioElementRef.current = null;
    }

    if (speechSupported) {
      try {
        activeUtteranceRef.current = null;
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech errors
      }
    }
  }, [speechSupported, clearTimers]);

  const fetchStudioAudioUrl = useCallback(
    async (text: string, preset: NarratorVoicePreset, signal?: AbortSignal): Promise<string | null> => {
      const cacheKey = `${preset}:${text}`;
      const existing = audioUrlCacheRef.current.get(cacheKey);
      if (existing) return existing;

      const inflight = pendingFetchesRef.current.get(cacheKey);
      if (inflight) return inflight;

      const promise = (async () => {
        try {
          const response = await fetch('/api/tts/narrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voicePreset: preset }),
            signal,
          });
          if (response.status === 503 || response.status === 429) {
            setStudioVoiceAvailable(false);
            return null;
          }
          if (!response.ok) return null;
          const payload = await response.json();
          if (!payload?.ok || !payload?.audioBase64) return null;
          const blobUrl = base64ToBlobUrl(payload.audioBase64, payload.mimeType || 'audio/wav');
          audioUrlCacheRef.current.set(cacheKey, blobUrl);
          setStudioVoiceAvailable(true);
          return blobUrl;
        } catch {
          return null;
        } finally {
          pendingFetchesRef.current.delete(cacheKey);
        }
      })();

      pendingFetchesRef.current.set(cacheKey, promise);
      return promise;
    },
    []
  );

  const resolveSingleBrowserVoice = useCallback(
    async (preset: NarratorVoicePreset, sessionId: number): Promise<SpeechSynthesisVoice | null> => {
      if (lockedBrowserVoiceRef.current) {
        return lockedBrowserVoiceRef.current;
      }
      if (!speechSupported) return null;

      let pool =
        availableVoicesRef.current.length > 0
          ? availableVoicesRef.current
          : availableVoices.length > 0
          ? availableVoices
          : window.speechSynthesis.getVoices();

      if ((!pool || pool.length === 0) && typeof window !== 'undefined') {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.speechSynthesis.removeEventListener?.('voiceschanged', onChanged);
            resolve();
          };
          const onChanged = () => {
            const loaded = window.speechSynthesis.getVoices();
            if (loaded && loaded.length > 0) {
              availableVoicesRef.current = loaded;
              setAvailableVoices(loaded);
              finish();
            }
          };
          window.speechSynthesis.addEventListener?.('voiceschanged', onChanged);
          setTimeout(finish, 260);
        });
        if (speechSessionIdRef.current !== sessionId) return null;
        pool =
          availableVoicesRef.current.length > 0
            ? availableVoicesRef.current
            : window.speechSynthesis.getVoices();
      }

      const chosen = selectBestNaturalVoice(pool || [], preset);
      if (chosen) {
        lockedBrowserVoiceRef.current = chosen;
      }
      return chosen;
    },
    [speechSupported, availableVoices]
  );

  const speakWithBrowserFallback = useCallback(
    async (text: string, preset: NarratorVoicePreset, rate: number, sessionId: number) => {
      if (!speechSupported || speechSessionIdRef.current !== sessionId) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        onSpeechFinishedRef.current?.();
        return;
      }
      const chosenVoice = await resolveSingleBrowserVoice(preset, sessionId);
      if (speechSessionIdRef.current !== sessionId) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang || 'en-US';
        } else {
          utterance.lang = 'en-US';
        }
        utterance.pitch = 0.94;
        utterance.rate = Math.max(0.75, Math.min(1.4, rate * 0.96));
        utterance.volume = 1;
        activeUtteranceRef.current = utterance;
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        speechEngineActiveRef.current = 'tts';
        speechStartTimeRef.current = performance.now();
        lastBoundaryTimeRef.current = 0;

        const cues = splitNarrationIntoSubtitleCues(text);
        const estMs = estimateSpeechDurationMs(text, rate);

        // Smooth progressive caption ticker when browser voice does not emit frequent boundaries
        cueTimerRef.current = window.setInterval(() => {
          if (speechSessionIdRef.current !== sessionId) return;
          if (
            speechStartTimeRef.current !== null &&
            performance.now() - lastBoundaryTimeRef.current > 650 &&
            cues.length > 0
          ) {
            const ratio = clamp01((performance.now() - speechStartTimeRef.current) / estMs);
            const nextCue = findCueIndexByRatio(cues, ratio);
            setActiveCueIdx((prev) => (prev === nextCue ? prev : nextCue));
          }
        }, 180);

        // Safety watchdog in case a browser speech engine drops the onend event
        watchdogTimerRef.current = window.setTimeout(() => {
          if (speechSessionIdRef.current === sessionId && isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            speechEngineActiveRef.current = null;
            activeUtteranceRef.current = null;
            clearTimers();
            setActiveCueIdx(Math.max(0, cues.length - 1));
            onSpeechFinishedRef.current?.();
          }
        }, estMs + 3500);

        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          if (speechSessionIdRef.current !== sessionId) return;
          if (typeof event.charIndex === 'number') {
            lastBoundaryTimeRef.current = performance.now();
            const idx = findCueIndexByChar(cues, event.charIndex);
            setActiveCueIdx((prev) => (prev === idx ? prev : idx));
          }
        };

        utterance.onend = () => {
          if (speechSessionIdRef.current === sessionId) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            speechEngineActiveRef.current = null;
            activeUtteranceRef.current = null;
            clearTimers();
            setActiveCueIdx(Math.max(0, cues.length - 1));
            onSpeechFinishedRef.current?.();
          }
        };

        utterance.onerror = () => {
          if (speechSessionIdRef.current === sessionId) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            speechEngineActiveRef.current = null;
            activeUtteranceRef.current = null;
            clearTimers();
            onSpeechFinishedRef.current?.();
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        speechEngineActiveRef.current = null;
        clearTimers();
        onSpeechFinishedRef.current?.();
      }
    },
    [speechSupported, resolveSingleBrowserVoice, clearTimers]
  );

  const speak = useCallback(
    async (text: string, nextText?: string, options?: { forceUnmute?: boolean }) => {
      if (options?.forceUnmute && !voiceEnabledRef.current) {
        setVoiceEnabled(true);
      }
      if (!text.trim() || (!voiceEnabledRef.current && !options?.forceUnmute)) return;
      stop();

      const sessionId = speechSessionIdRef.current;
      const controller = new AbortController();
      speechAbortRef.current = controller;

      let engine = sessionEngineRef.current;
      if (engine === null) {
        if (!audioSupported) {
          engine = 'browser';
        } else if (studioVoiceAvailable === false) {
          engine = 'browser';
        } else if (studioVoiceAvailable === true) {
          engine = 'studio';
        } else {
          const available = await checkStudioStatus();
          if (controller.signal.aborted || speechSessionIdRef.current !== sessionId) return;
          engine = available ? 'studio' : 'browser';
        }
        sessionEngineRef.current = engine;
      }

      if (engine === 'studio' && audioSupported) {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        const blobUrl = await fetchStudioAudioUrl(text, voicePreset, controller.signal);

        if (controller.signal.aborted || speechSessionIdRef.current !== sessionId) {
          return;
        }

        if (blobUrl) {
          try {
            const audio = new Audio(blobUrl);
            audio.preservesPitch = true;
            audio.playbackRate = playbackSpeedRef.current;
            audioElementRef.current = audio;
            speechEngineActiveRef.current = 'audio';
            speechStartTimeRef.current = performance.now();

            const cues = splitNarrationIntoSubtitleCues(text);

            audio.ontimeupdate = () => {
              if (speechSessionIdRef.current !== sessionId) return;
              if (audio.duration > 0 && Number.isFinite(audio.duration)) {
                const idx = findCueIndexByRatio(cues, audio.currentTime / audio.duration);
                setActiveCueIdx((prev) => (prev === idx ? prev : idx));
              }
            };

            audio.onended = () => {
              if (speechSessionIdRef.current === sessionId) {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                speechEngineActiveRef.current = null;
                clearTimers();
                setActiveCueIdx(Math.max(0, cues.length - 1));
                onSpeechFinishedRef.current?.();
              }
            };

            audio.onerror = () => {
              if (speechSessionIdRef.current === sessionId) {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                speechEngineActiveRef.current = null;
                clearTimers();
                sessionEngineRef.current = 'browser';
                void speakWithBrowserFallback(text, voicePreset, playbackSpeedRef.current, sessionId);
              }
            };

            await audio.play();

            if (nextText && nextText.trim()) {
              void fetchStudioAudioUrl(nextText, voicePreset);
            }
            return;
          } catch {
            audioElementRef.current = null;
            speechEngineActiveRef.current = null;
          }
        }

        sessionEngineRef.current = 'browser';
      }

      if (controller.signal.aborted || speechSessionIdRef.current !== sessionId) {
        return;
      }

      await speakWithBrowserFallback(text, voicePreset, playbackSpeedRef.current, sessionId);
    },
    [
      setVoiceEnabled,
      stop,
      audioSupported,
      studioVoiceAvailable,
      checkStudioStatus,
      fetchStudioAudioUrl,
      voicePreset,
      clearTimers,
      speakWithBrowserFallback,
    ]
  );

  const toggleMute = useCallback((): boolean => {
    const nextEnabled = !voiceEnabledRef.current;
    setVoiceEnabled(nextEnabled);
    if (!nextEnabled) {
      stop();
    }
    return nextEnabled;
  }, [setVoiceEnabled, stop]);

  useEffect(() => {
    const cache = audioUrlCacheRef.current;
    return () => {
      stop();
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
    };
  }, [stop]);

  return {
    voiceEnabled,
    isMuted: !voiceEnabled,
    setVoiceEnabled,
    toggleMute,
    isSpeaking,
    isSpeakingRef,
    stepCues,
    activeCueIdx,
    activeCue: stepCues[Math.min(activeCueIdx, Math.max(0, stepCues.length - 1))] || null,
    studioVoiceAvailable,
    speak,
    stop,
  };
}
