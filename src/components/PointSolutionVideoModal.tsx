/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ComputedPoint } from '../types/projection';
import {
  buildPointVideoSteps,
  PointVideoStep,
  splitNarrationIntoSubtitleCues,
  SubtitleCue,
} from '../utils/pointVideoScript';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Compass,
  Wrench,
  Lightbulb,
  Clock,
  CheckCircle2,
  Video,
  Captions,
} from 'lucide-react';

interface PointSolutionVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  point: ComputedPoint | null;
  allPoints: ComputedPoint[];
  onSelectPoint?: (id: string) => void;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

function formatSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type NarratorVoicePreset = 'warm-mentor' | 'clear-instructor';

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
  // Average natural speaking rate ~2.55 words/sec at 1x speed
  const baseMs = (words / 2.55) * 1000;
  return Math.max(2200, baseMs / Math.max(0.6, rate));
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

    // Penalize creaky / robotic engines heavily
    if (/espeak|festival|mbrola|flite|pico|speech-dispatcher/i.test(label)) {
      score -= 120;
    }

    // Strongly favor neural / online / natural voices
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

export const PointSolutionVideoModal: React.FC<PointSolutionVideoModalProps> = ({
  isOpen,
  onClose,
  point,
  allPoints,
  onSelectPoint,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
}) => {
  const steps = useMemo<PointVideoStep[]>(() => {
    if (!point) return [];
    return buildPointVideoSteps(point);
  }, [point]);

  const totalDurationMs = useMemo(
    () => steps.reduce((acc, s) => acc + s.durationMs, 0),
    [steps]
  );

  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [stepProgress, setStepProgress] = useState<number>(0); // 0..1 within active step
  const [activeCueIdx, setActiveCueIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const voicePreset: NarratorVoicePreset = 'warm-mentor';
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [studioVoiceAvailable, setStudioVoiceAvailable] = useState<boolean | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastSpokenKeyRef = useRef<string | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCacheRef = useRef<Map<string, string>>(new Map());
  const pendingFetchesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechSessionIdRef = useRef<number>(0);
  const playbackSpeedRef = useRef<number>(playbackSpeed);

  // Strict single-voice locks so the narrator never switches voices mid-video
  const sessionEngineRef = useRef<'studio' | 'browser' | null>(null);
  const lockedBrowserVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speechStartTimeRef = useRef<number | null>(null);
  const lastBoundaryTimeRef = useRef<number>(0);
  const speechEngineActiveRef = useRef<'audio' | 'tts' | null>(null);

  const stepCues = useMemo<SubtitleCue[]>(() => {
    const step = steps[activeStepIdx];
    if (!step) return [];
    return splitNarrationIntoSubtitleCues(step.narration);
  }, [steps, activeStepIdx]);
  const stepCuesRef = useRef<SubtitleCue[]>(stepCues);
  useEffect(() => {
    stepCuesRef.current = stepCues;
    setActiveCueIdx(0);
  }, [stepCues]);

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

  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const audioSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Eagerly load browser voices on mount so Step 1 and Step 2+ always share the exact same voice
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

  // Refresh studio TTS availability when modal opens
  useEffect(() => {
    if (!isOpen) return;
    void checkStudioStatus();
  }, [isOpen, checkStudioStatus]);

  const stopSpeech = useCallback(() => {
    speechSessionIdRef.current += 1;
    isSpeakingRef.current = false;
    speechEngineActiveRef.current = null;
    speechStartTimeRef.current = null;
    lastBoundaryTimeRef.current = 0;

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
  }, [speechSupported]);

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

      // Wait briefly once on first speech so Chrome/Edge populates voices before Step 1 starts
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
        pool = availableVoicesRef.current.length > 0 ? availableVoicesRef.current : window.speechSynthesis.getVoices();
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
    async (step: PointVideoStep, preset: NarratorVoicePreset, rate: number, sessionId: number) => {
      if (!speechSupported || speechSessionIdRef.current !== sessionId) {
        isSpeakingRef.current = false;
        return;
      }
      const chosenVoice = await resolveSingleBrowserVoice(preset, sessionId);
      if (speechSessionIdRef.current !== sessionId) {
        isSpeakingRef.current = false;
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(step.narration);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang || 'en-US';
        } else {
          utterance.lang = 'en-US';
        }
        utterance.pitch = 0.92;
        utterance.rate = Math.max(0.75, Math.min(1.4, rate * 0.95));
        utterance.volume = 1;
        activeUtteranceRef.current = utterance;
        isSpeakingRef.current = true;
        speechEngineActiveRef.current = 'tts';
        speechStartTimeRef.current = performance.now();
        lastBoundaryTimeRef.current = 0;

        const cues = splitNarrationIntoSubtitleCues(step.narration);

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
            speechEngineActiveRef.current = null;
            activeUtteranceRef.current = null;
            setActiveCueIdx(Math.max(0, cues.length - 1));
          }
        };
        utterance.onerror = () => {
          if (speechSessionIdRef.current === sessionId) {
            isSpeakingRef.current = false;
            speechEngineActiveRef.current = null;
            activeUtteranceRef.current = null;
          }
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        isSpeakingRef.current = false;
        speechEngineActiveRef.current = null;
      }
    },
    [speechSupported, resolveSingleBrowserVoice]
  );

  const speakStep = useCallback(
    async (step: PointVideoStep | undefined, nextStep: PointVideoStep | undefined, preset: NarratorVoicePreset) => {
      if (!step || !voiceEnabled) return;
      stopSpeech();

      const sessionId = speechSessionIdRef.current;
      const controller = new AbortController();
      speechAbortRef.current = controller;

      // Determine & lock a single voice engine for the entire video session
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
        const blobUrl = await fetchStudioAudioUrl(step.narration, preset, controller.signal);

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

            const cues = splitNarrationIntoSubtitleCues(step.narration);

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
                speechEngineActiveRef.current = null;
                setActiveCueIdx(Math.max(0, cues.length - 1));
              }
            };
            audio.onerror = () => {
              if (speechSessionIdRef.current === sessionId) {
                isSpeakingRef.current = false;
                speechEngineActiveRef.current = null;
                // Only fall back to browser voice if studio fails and lock session to browser
                sessionEngineRef.current = 'browser';
                void speakWithBrowserFallback(step, preset, playbackSpeedRef.current, sessionId);
              }
            };

            await audio.play();

            // Pre-fetch next step's audio sequentially so transitions are instant and don't burst API rate limits
            if (nextStep) {
              void fetchStudioAudioUrl(nextStep.narration, preset);
            }
            return;
          } catch {
            audioElementRef.current = null;
            speechEngineActiveRef.current = null;
          }
        }

        // If studio audio could not be obtained (e.g. quota exhausted), switch lock cleanly to browser voice
        sessionEngineRef.current = 'browser';
      }

      if (controller.signal.aborted || speechSessionIdRef.current !== sessionId) {
        return;
      }

      await speakWithBrowserFallback(step, preset, playbackSpeedRef.current, sessionId);
    },
    [
      voiceEnabled,
      stopSpeech,
      audioSupported,
      studioVoiceAvailable,
      checkStudioStatus,
      fetchStudioAudioUrl,
      speakWithBrowserFallback,
    ]
  );

  // Reset timeline & single-voice session lock when modal opens or active point changes
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      stopSpeech();
      lastSpokenKeyRef.current = null;
      sessionEngineRef.current = null;
      return;
    }
    sessionEngineRef.current = null;
    setActiveStepIdx(0);
    setStepProgress(prefersReducedMotion ? 1 : 0);
    setActiveCueIdx(0);
    setIsPlaying(true);
    lastSpokenKeyRef.current = null;
  }, [isOpen, point?.id, prefersReducedMotion, stopSpeech]);

  // Trigger voiceover when step changes while playing
  useEffect(() => {
    if (!isOpen || !isPlaying || !voiceEnabled) {
      if (!isPlaying || !voiceEnabled) {
        stopSpeech();
      }
      return;
    }
    const currentStep = steps[activeStepIdx];
    if (!currentStep) return;
    const nextStep = steps[activeStepIdx + 1];
    const key = `${point?.id || 'pt'}-${currentStep.id}-${voicePreset}`;
    if (lastSpokenKeyRef.current !== key) {
      lastSpokenKeyRef.current = key;
      void speakStep(currentStep, nextStep, voicePreset);
    }
  }, [isOpen, isPlaying, voiceEnabled, activeStepIdx, steps, point?.id, speakStep, stopSpeech]);

  // Stop speech & revoke cached Blob URLs cleanly on unmount
  useEffect(() => {
    const cache = audioUrlCacheRef.current;
    return () => {
      stopSpeech();
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
    };
  }, [stopSpeech]);

  // Main animation timeline loop
  useEffect(() => {
    if (!isOpen || !isPlaying || steps.length === 0) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const deltaMs = Math.min(100, now - lastFrameTimeRef.current);
      lastFrameTimeRef.current = now;

      const curStep = steps[activeStepIdx];
      if (!curStep) {
        setIsPlaying(false);
        return;
      }

      // Keep progressive subtitle synced smoothly with active speech or step progress
      const cues = stepCuesRef.current;
      if (cues.length > 0) {
        const audio = audioElementRef.current;
        if (audio && speechEngineActiveRef.current === 'audio' && audio.duration > 0 && Number.isFinite(audio.duration)) {
          const nextCue = findCueIndexByRatio(cues, audio.currentTime / audio.duration);
          setActiveCueIdx((prev) => (prev === nextCue ? prev : nextCue));
        } else if (
          speechEngineActiveRef.current === 'tts' &&
          speechStartTimeRef.current !== null &&
          now - lastBoundaryTimeRef.current > 650
        ) {
          // Smoothly advance phrase-by-phrase if browser voice doesn't emit word boundaries
          const estMs = estimateSpeechDurationMs(curStep.narration, playbackSpeed);
          const ratio = clamp01((now - speechStartTimeRef.current) / estMs);
          const nextCue = findCueIndexByRatio(cues, ratio);
          setActiveCueIdx((prev) => (prev === nextCue ? prev : nextCue));
        }
      }

      if (prefersReducedMotion) {
        setStepProgress(1);
      } else {
        setStepProgress((prev) => {
          const increment = (deltaMs * playbackSpeed) / curStep.durationMs;
          const next = prev + increment;

          if (!voiceEnabled || !isSpeakingRef.current) {
            const cueFromProgress = findCueIndexByRatio(stepCuesRef.current, next);
            setActiveCueIdx((prevCue) => (prevCue === cueFromProgress ? prevCue : cueFromProgress));
          }

          if (next >= 1) {
            // Wait gently if voiceover audio is still mid-sentence
            if (voiceEnabled && (audioSupported || speechSupported) && isSpeakingRef.current) {
              return 0.99;
            }
            if (activeStepIdx < steps.length - 1) {
              setActiveStepIdx((s) => Math.min(steps.length - 1, s + 1));
              return 0;
            } else {
              setIsPlaying(false);
              return 1;
            }
          }
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [isOpen, isPlaying, activeStepIdx, steps, playbackSpeed, voiceEnabled, audioSupported, speechSupported, prefersReducedMotion]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
          e.preventDefault();
          setIsPlaying((p) => !p);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        lastSpokenKeyRef.current = null;
        stopSpeech();
        setActiveStepIdx((i) => Math.min(steps.length - 1, i + 1));
        setStepProgress(prefersReducedMotion ? 1 : 0);
        setActiveCueIdx(0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lastSpokenKeyRef.current = null;
        stopSpeech();
        setActiveStepIdx((i) => Math.max(0, i - 1));
        setStepProgress(prefersReducedMotion ? 1 : 0);
        setActiveCueIdx(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, steps.length, prefersReducedMotion, stopSpeech]);

  const elapsedMs = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < activeStepIdx; i++) {
      sum += steps[i]?.durationMs || 0;
    }
    const cur = steps[activeStepIdx]?.durationMs || 0;
    return sum + cur * stepProgress;
  }, [steps, activeStepIdx, stepProgress]);

  const timelineRatio = totalDurationMs > 0 ? clamp01(elapsedMs / totalDurationMs) : 0;

  const handleScrub = (ratio: number) => {
    if (totalDurationMs <= 0 || steps.length === 0) return;
    const targetMs = clamp01(ratio) * totalDurationMs;
    let acc = 0;
    for (let i = 0; i < steps.length; i++) {
      const dur = steps[i].durationMs;
      if (targetMs <= acc + dur || i === steps.length - 1) {
        const localProgress = dur > 0 ? clamp01((targetMs - acc) / dur) : 1;
        lastSpokenKeyRef.current = null;
        stopSpeech();
        setActiveStepIdx(i);
        setStepProgress(localProgress);
        const cues = splitNarrationIntoSubtitleCues(steps[i].narration);
        setActiveCueIdx(findCueIndexByRatio(cues, localProgress));
        break;
      }
      acc += dur;
    }
  };

  const handleJumpToStep = (idx: number) => {
    lastSpokenKeyRef.current = null;
    stopSpeech();
    setActiveStepIdx(idx);
    setStepProgress(prefersReducedMotion ? 1 : 0);
    setActiveCueIdx(0);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopSpeech();
    } else {
      if (activeStepIdx === steps.length - 1 && stepProgress >= 0.99) {
        setActiveStepIdx(0);
        setStepProgress(0);
        setActiveCueIdx(0);
      }
      lastSpokenKeyRef.current = null;
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    lastSpokenKeyRef.current = null;
    stopSpeech();
    setActiveStepIdx(0);
    setStepProgress(prefersReducedMotion ? 1 : 0);
    setActiveCueIdx(0);
    setIsPlaying(true);
  };

  const handleToggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) {
      stopSpeech();
    } else if (isPlaying) {
      lastSpokenKeyRef.current = null;
    }
  };

  if (!isOpen || !point || steps.length === 0) return null;

  const activeStep = steps[activeStepIdx] || steps[0];
  const activeCue = stepCues[Math.min(activeCueIdx, Math.max(0, stepCues.length - 1))] || null;

  // =========================================================================
  // DETERMINISTIC DRAWING COORDINATES & ANIMATION PARAMETERS
  // =========================================================================
  const viewW = 800;
  const viewH = 480;

  // Smart XY vertical offset so same-side quadrants (Q2 / Q4) have generous room
  const bothAbove = point.frontViewY >= 0 && point.topViewY >= 0 && (point.frontViewY > 0 || point.topViewY > 0);
  const bothBelow = point.frontViewY <= 0 && point.topViewY <= 0 && (point.frontViewY < 0 || point.topViewY < 0);

  const originY = bothAbove ? 305 : bothBelow ? 175 : 240;
  const availAbove = originY - 58;
  const availBelow = viewH - 58 - originY;

  const maxUpMm = Math.max(point.frontViewY, point.topViewY, 0);
  const maxDownMm = Math.max(-point.frontViewY, -point.topViewY, 0);

  const scaleUp = maxUpMm > 0 ? availAbove / maxUpMm : 3.0;
  const scaleDown = maxDownMm > 0 ? availBelow / maxDownMm : 3.0;
  const scale = Math.min(Math.max(Math.min(scaleUp, scaleDown, 3.0), 1.15), 3.0);

  const projX = 335; // Balanced left-center so right side has clean room for dimensions & insets
  const elevY = originY - point.frontViewY * scale;
  const planY = originY - point.topViewY * scale;
  const viewsCoincide = Math.abs(elevY - planY) < 2;
  const isSameSide =
    !viewsCoincide &&
    ((point.frontViewY > 0 && point.topViewY > 0) || (point.frontViewY < 0 && point.topViewY < 0));

  let dimFvX = projX + 46;
  let dimTvX = projX + 46;
  if (isSameSide) {
    if (point.distHp <= point.distVp) {
      dimFvX = projX + 40;
      dimTvX = projX + 86;
    } else {
      dimTvX = projX + 40;
      dimFvX = projX + 86;
    }
  }

  // Stage-wise completion flags
  const t = stepProgress;
  const s = activeStepIdx; // 0..6

  const showQuadrantInset = s === 0 || (s === 4 && t < 0.72);
  const xyDrawRatio = s > 1 ? 1 : s === 1 ? easeOutCubic((t - 0.06) / 0.7) : 0;
  const xyLabelsOpacity = s > 1 ? 1 : s === 1 ? easeOutCubic((t - 0.76) / 0.2) : 0;

  const projTopY = Math.min(elevY, planY, originY) - 28;
  const projBotY = Math.max(elevY, planY, originY) + 28;
  const projLength = Math.max(40, projBotY - projTopY);
  const projDrawRatio = s > 2 ? 1 : s === 2 ? easeOutCubic((t - 0.22) / 0.6) : 0;
  const projOriginOpacity = s > 2 ? 1 : s === 2 ? easeOutCubic((t - 0.82) / 0.16) : 0;

  const fvMeasureRatio = s > 3 ? 1 : s === 3 ? easeOutCubic((t - 0.2) / 0.5) : 0;
  const fvDotOpacity = s > 3 ? 1 : s === 3 ? easeOutCubic((t - 0.72) / 0.22) : 0;
  const fvCurrY = originY + (elevY - originY) * fvMeasureRatio;

  const tvMeasureRatio = s > 4 ? 1 : s === 4 ? easeOutCubic((t - 0.28) / 0.48) : 0;
  const tvDotOpacity = s > 4 ? 1 : s === 4 ? easeOutCubic((t - 0.76) / 0.2) : 0;
  const tvCurrY = originY + (planY - originY) * tvMeasureRatio;

  const extDrawRatio = s > 5 ? 1 : s === 5 ? easeOutCubic(t / 0.35) : 0;
  const dimDrawRatio = s > 5 ? 1 : s === 5 ? easeOutCubic((t - 0.35) / 0.42) : 0;
  const dimTextOpacity = s > 5 ? 1 : s === 5 ? easeOutCubic((t - 0.75) / 0.22) : 0;

  const titleBlockOpacity = s > 6 ? 1 : s === 6 ? easeOutCubic(t / 0.32) : 0;
  const auditCheckCount =
    s === 6 ? Math.min(4, Math.floor(clamp01((t - 0.3) / 0.62) * 4.2)) : 0;

  // Active pencil nib position for smooth hand-drawn feel
  let pencilPos: { x: number; y: number; grade: 'HB' | '2H' } | null = null;
  if (s === 1 && t >= 0.05 && t <= 0.8) {
    pencilPos = { x: 48 + 704 * xyDrawRatio, y: originY, grade: 'HB' };
  } else if (s === 2 && t >= 0.2 && t <= 0.85) {
    pencilPos = { x: projX, y: projTopY + projLength * projDrawRatio, grade: '2H' };
  } else if (s === 3 && t >= 0.7 && t <= 0.96) {
    pencilPos = { x: projX, y: elevY, grade: 'HB' };
  } else if (s === 4 && t >= 0.74 && t <= 0.96) {
    pencilPos = { x: projX, y: planY, grade: 'HB' };
  } else if (s === 5 && t >= 0.35 && t <= 0.78) {
    pencilPos = { x: dimFvX, y: originY + (elevY - originY) * dimDrawRatio, grade: '2H' };
  }

  // 90° CW Rotation inset animation factor for Step 5
  const foldAngleDeg = s === 4 ? Math.min(90, easeOutCubic(t / 0.65) * 90) : 90;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="point-video-modal-title"
    >
      <div className="w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#7138E8] text-white flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="point-video-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Guided Drafting Walkthrough — Point {point.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                <span>
                  {point.hpRelation === 'ON' ? 'On HP' : `${point.distHp} mm ${point.hpRelation === 'ABOVE' ? 'above' : 'below'} HP`}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {point.vpRelation === 'ON' ? 'On VP' : `${point.distVp} mm ${point.vpRelation === 'IN_FRONT' ? 'in front of' : 'behind'} VP`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {activeStep.stepNumber} / {steps.length} Steps
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allPoints.length > 1 && onSelectPoint && (
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-xs">
                {allPoints.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPoint(p.id)}
                    className={`px-2.5 py-1 rounded-md font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8] ${
                      p.id === point.id
                        ? 'bg-[#7138E8] text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Pt {p.name}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8]"
              aria-label="Close solution walkthrough"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-Zone Educational Sandbox Layout */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] overflow-y-auto lg:overflow-hidden">
          {/* LEFT ZONE: Animated Drafting Sheet Stage + Video Transport */}
          <div className="flex flex-col bg-slate-100/80 dark:bg-slate-950/60 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 gap-3 min-h-0">
            {/* Step Progress Strip (Clean segmented bar) */}
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold truncate">{activeStep.title}</div>
              <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                {activeStep.instrument}
              </div>
            </div>

            {/* White Drawing Sheet Canvas */}
            <div className="relative w-full flex-1 min-h-[290px] sm:min-h-[360px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white shadow-sm overflow-hidden flex items-center justify-center">
              <svg
                viewBox={`0 0 ${viewW} ${viewH}`}
                className="w-full h-full max-h-[52vh] select-none"
                role="img"
                aria-label={`Animated construction diagram for Point ${point.name}: ${activeStep.title}`}
              >
                <defs>
                  <pattern id="vid-sheet-grid-minor" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f1f5f9" strokeWidth="0.6" />
                  </pattern>
                  <pattern id="vid-sheet-grid-major" width="50" height="50" patternUnits="userSpaceOnUse">
                    <rect width="50" height="50" fill="url(#vid-sheet-grid-minor)" />
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="0.9" />
                  </pattern>

                  <marker
                    id="vid-arrow-start"
                    viewBox="0 0 10 10"
                    refX="0"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 10 2 L 0 5 L 10 8 z" fill="#0284c7" />
                  </marker>
                  <marker
                    id="vid-arrow-end"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#0284c7" />
                  </marker>
                  <marker
                    id="vid-rot-arrow"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#d97706" />
                  </marker>
                </defs>

                {/* Drawing Sheet Surface & Margin Borders */}
                <rect width={viewW} height={viewH} fill="#ffffff" />
                <rect width={viewW} height={viewH} fill="url(#vid-sheet-grid-major)" />
                <rect x="14" y="14" width={viewW - 28} height={viewH - 28} fill="none" stroke="#334155" strokeWidth="1.4" />
                <rect x="18" y="18" width={viewW - 36} height={viewH - 36} fill="none" stroke="#94a3b8" strokeWidth="0.6" />

                {/* GIVEN DATA CALLOUT BLOCK (Top-Left, always present from Step 1 onward) */}
                <g transform="translate(30, 30)">
                  <rect
                    x="0"
                    y="0"
                    width="228"
                    height="62"
                    rx="4"
                    fill="#f8fafc"
                    stroke={s === 0 ? '#7138E8' : '#cbd5e1'}
                    strokeWidth={s === 0 ? '1.6' : '0.9'}
                  />
                  <text x="10" y="17" fill="#0f172a" fontSize="10.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                    GIVEN DATA · POINT {point.name}
                  </text>
                  <text x="10" y="34" fill={vpColor} fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                    • HP: {point.hpRelation === 'ON' ? 'On HP (0 mm)' : `${point.distHp} mm ${point.hpRelation === 'ABOVE' ? 'Above' : 'Below'} HP`} → {point.frontViewLabel}
                  </text>
                  <text x="10" y="50" fill={hpColor} fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                    • VP: {point.vpRelation === 'ON' ? 'On VP (0 mm)' : `${point.distVp} mm ${point.vpRelation === 'IN_FRONT' ? 'In Front' : 'Behind'} VP`} → {point.topViewLabel}
                  </text>
                </g>

                {/* ========================================================= */}
                {/* STEP 2: REFERENCE LINE X-Y + ANIMATED STRAIGHTEDGE        */}
                {/* ========================================================= */}
                {xyDrawRatio > 0 && (
                  <g>
                    {/* Animated Straightedge / T-Square blade below XY */}
                    {s === 1 && t < 0.85 && (
                      <g opacity={t > 0.7 ? (0.85 - t) / 0.15 : 0.92}>
                        <rect
                          x="44"
                          y={originY + 2}
                          width="712"
                          height="18"
                          rx="2"
                          fill="#e2e8f0"
                          stroke="#64748b"
                          strokeWidth="1"
                        />
                        {Array.from({ length: 35 }).map((_, idx) => (
                          <line
                            key={idx}
                            x1={54 + idx * 20}
                            y1={originY + 2}
                            x2={54 + idx * 20}
                            y2={originY + (idx % 5 === 0 ? 11 : 7)}
                            stroke="#475569"
                            strokeWidth="0.8"
                          />
                        ))}
                      </g>
                    )}

                    {/* X-Y Ground Reference Line */}
                    <line
                      x1="48"
                      y1={originY}
                      x2={48 + 704 * xyDrawRatio}
                      y2={originY}
                      stroke="#0f172a"
                      strokeWidth="1.8"
                    />

                    {/* Endpoints X and Y & Zone Labels */}
                    <g opacity={xyLabelsOpacity}>
                      <circle cx="48" cy={originY} r="2.2" fill="#0f172a" />
                      <circle cx="752" cy={originY} r="2.2" fill="#0f172a" />
                      <text
                        x="38"
                        y={originY + 5}
                        fill="#0f172a"
                        fontSize="16"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        X
                      </text>
                      <text
                        x="762"
                        y={originY + 5}
                        fill="#0f172a"
                        fontSize="16"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        textAnchor="start"
                      >
                        Y
                      </text>
                      <text
                        x="56"
                        y={originY - 9}
                        fill={vpColor}
                        opacity="0.72"
                        fontSize="9.5"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                      >
                        VP (Front View Plane)
                      </text>
                      <text
                        x="56"
                        y={originY + 18}
                        fill={hpColor}
                        opacity="0.72"
                        fontSize="9.5"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                      >
                        HP (Top View Plane)
                      </text>
                    </g>
                  </g>
                )}

                {/* ========================================================= */}
                {/* STEP 3: VERTICAL PROJECTOR LINE (2H) + 90° SET-SQUARE     */}
                {/* ========================================================= */}
                {s >= 2 && (
                  <g>
                    {/* Animated 90° Set-Square */}
                    {s === 2 && t < 0.88 && (
                      <g
                        transform={`translate(${projX - 68 * (1 - easeOutCubic(t / 0.25))}, 0)`}
                        opacity={t > 0.76 ? (0.88 - t) / 0.12 : 0.9}
                      >
                        <polygon
                          points={`${projX - 2},${originY - 2} ${projX - 2},${originY - 115} ${projX - 88},${originY - 2}`}
                          fill="rgba(56, 189, 248, 0.18)"
                          stroke="#0284c7"
                          strokeWidth="1.2"
                        />
                        {/* 90-degree square corner symbol */}
                        <rect
                          x={projX - 14}
                          y={originY - 14}
                          width="12"
                          height="12"
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="1"
                        />
                      </g>
                    )}

                    {/* Continuous Thin 2H Projector Line */}
                    {projDrawRatio > 0 && (
                      <line
                        x1={projX}
                        y1={projTopY}
                        x2={projX}
                        y2={projTopY + projLength * projDrawRatio}
                        stroke="#64748b"
                        strokeWidth="1.05"
                      />
                    )}

                    {/* Intersection dot 'o' on XY */}
                    <g opacity={projOriginOpacity}>
                      <circle cx={projX} cy={originY} r="2.5" fill="#0f172a" />
                      <text
                        x={projX - 9}
                        y={originY + 13}
                        fill="#475569"
                        fontSize="10.5"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        o
                      </text>
                    </g>
                  </g>
                )}

                {/* ========================================================= */}
                {/* STEP 4: SCALE MEASURING & FRONT VIEW a'                   */}
                {/* ========================================================= */}
                {s >= 3 && (
                  <g>
                    {/* Animated Millimeter Scale along left of projector during Step 4 */}
                    {s === 3 && t < 0.88 && (
                      <g opacity={t > 0.78 ? (0.88 - t) / 0.1 : 0.92}>
                        <rect
                          x={projX - 30}
                          y={Math.min(originY, elevY) - 18}
                          width="22"
                          height={Math.abs(elevY - originY) + 36}
                          rx="2"
                          fill="#fef3c7"
                          stroke="#d97706"
                          strokeWidth="1"
                        />
                        {Array.from({ length: Math.max(4, Math.floor((Math.abs(elevY - originY) + 24) / 8)) }).map(
                          (_, idx) => {
                            const tickY = Math.min(originY, elevY) - 10 + idx * 8;
                            return (
                              <line
                                key={idx}
                                x1={projX - 15}
                                y1={tickY}
                                x2={projX - 8}
                                y2={tickY}
                                stroke="#92400e"
                                strokeWidth="0.8"
                              />
                            );
                          }
                        )}
                      </g>
                    )}

                    {/* Active measurement travel trace in Step 4 */}
                    {s === 3 && point.distHp > 0 && fvMeasureRatio > 0 && (
                      <g>
                        <line
                          x1={projX}
                          y1={originY}
                          x2={projX}
                          y2={fvCurrY}
                          stroke={vpColor}
                          strokeWidth="2.4"
                          opacity="0.7"
                        />
                        <text
                          x={projX + 12}
                          y={(originY + fvCurrY) / 2 + 4}
                          fill={vpColor}
                          fontSize="11"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                        >
                          {Math.round(point.distHp * fvMeasureRatio)} mm
                        </text>
                      </g>
                    )}

                    {/* Front View Dot + Crosshair + Label */}
                    <g opacity={fvDotOpacity}>
                      <line x1={projX - 5} y1={elevY} x2={projX + 5} y2={elevY} stroke={vpColor} strokeWidth="1" />
                      <line x1={projX} y1={elevY - 5} x2={projX} y2={elevY + 5} stroke={vpColor} strokeWidth="1" />
                      <circle
                        cx={projX}
                        cy={elevY}
                        r="4.2"
                        fill={vpColor}
                        stroke="#ffffff"
                        strokeWidth="1.4"
                      />
                      <text
                        x={projX - 12}
                        y={elevY + (point.frontViewY >= 0 ? -6 : 14)}
                        fill={vpColor}
                        fontSize="14"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        {viewsCoincide && s >= 4 && tvDotOpacity > 0.5
                          ? `${point.frontViewLabel}, ${point.topViewLabel}`
                          : point.frontViewLabel}
                      </text>
                    </g>
                  </g>
                )}

                {/* ========================================================= */}
                {/* STEP 5: TOP VIEW a (AFTER 90° CW HP ROTATION)             */}
                {/* ========================================================= */}
                {s >= 4 && (
                  <g>
                    {/* Animated measurement trace in Step 5 */}
                    {s === 4 && point.distVp > 0 && tvMeasureRatio > 0 && (
                      <g>
                        <line
                          x1={projX}
                          y1={originY}
                          x2={projX}
                          y2={tvCurrY}
                          stroke={hpColor}
                          strokeWidth="2.4"
                          opacity="0.7"
                        />
                        <text
                          x={projX + 12}
                          y={(originY + tvCurrY) / 2 + 4}
                          fill={hpColor}
                          fontSize="11"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                        >
                          {Math.round(point.distVp * tvMeasureRatio)} mm
                        </text>
                      </g>
                    )}

                    {/* Top View Dot + Crosshair + Label (unless coincident, handled above) */}
                    {!viewsCoincide && (
                      <g opacity={tvDotOpacity}>
                        <line x1={projX - 5} y1={planY} x2={projX + 5} y2={planY} stroke={hpColor} strokeWidth="1" />
                        <line x1={projX} y1={planY - 5} x2={projX} y2={planY + 5} stroke={hpColor} strokeWidth="1" />
                        <circle
                          cx={projX}
                          cy={planY}
                          r="4.2"
                          fill={hpColor}
                          stroke="#ffffff"
                          strokeWidth="1.4"
                        />
                        <text
                          x={projX - 12}
                          y={planY + (point.topViewY >= 0 ? -6 : 14)}
                          fill={hpColor}
                          fontSize="14"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          {point.topViewLabel}
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* ========================================================= */}
                {/* STEP 6: EXTENSION LINES & DIMENSION LINES (2H)            */}
                {/* ========================================================= */}
                {s >= 5 && (
                  <g>
                    {/* Front View Height Dimension (distHp) */}
                    {point.distHp > 0 && (
                      <g>
                        <line
                          x1={projX + 4}
                          y1={elevY}
                          x2={projX + 4 + (dimFvX + 7 - (projX + 4)) * extDrawRatio}
                          y2={elevY}
                          stroke="#64748b"
                          strokeWidth="0.85"
                        />
                        <line
                          x1={projX + 4}
                          y1={originY}
                          x2={projX + 4 + (dimFvX + 7 - (projX + 4)) * extDrawRatio}
                          y2={originY}
                          stroke="#64748b"
                          strokeWidth="0.85"
                        />
                        {dimDrawRatio > 0 && (
                          <line
                            x1={dimFvX}
                            y1={originY}
                            x2={dimFvX}
                            y2={originY + (elevY - originY) * dimDrawRatio}
                            stroke="#0284c7"
                            strokeWidth="1.2"
                            markerStart={dimDrawRatio > 0.75 ? 'url(#vid-arrow-start)' : undefined}
                            markerEnd={dimDrawRatio > 0.75 ? 'url(#vid-arrow-end)' : undefined}
                          />
                        )}
                        <text
                          x={dimFvX + 5}
                          y={(originY + elevY) / 2 + 4}
                          fill="#0369a1"
                          fontSize="11"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          opacity={dimTextOpacity}
                        >
                          {point.distHp}
                        </text>
                      </g>
                    )}

                    {/* Top View Depth Dimension (distVp) */}
                    {point.distVp > 0 && !viewsCoincide && (
                      <g>
                        <line
                          x1={projX + 4}
                          y1={planY}
                          x2={projX + 4 + (dimTvX + 7 - (projX + 4)) * extDrawRatio}
                          y2={planY}
                          stroke="#64748b"
                          strokeWidth="0.85"
                        />
                        <line
                          x1={projX + 4}
                          y1={originY}
                          x2={projX + 4 + (dimTvX + 7 - (projX + 4)) * extDrawRatio}
                          y2={originY}
                          stroke="#64748b"
                          strokeWidth="0.85"
                        />
                        {dimDrawRatio > 0 && (
                          <line
                            x1={dimTvX}
                            y1={originY}
                            x2={dimTvX}
                            y2={originY + (planY - originY) * dimDrawRatio}
                            stroke="#0284c7"
                            strokeWidth="1.2"
                            markerStart={dimDrawRatio > 0.75 ? 'url(#vid-arrow-start)' : undefined}
                            markerEnd={dimDrawRatio > 0.75 ? 'url(#vid-arrow-end)' : undefined}
                          />
                        )}
                        <text
                          x={dimTvX + 5}
                          y={(originY + planY) / 2 + 4}
                          fill="#0369a1"
                          fontSize="11"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="bold"
                          opacity={dimTextOpacity}
                        >
                          {point.distVp}
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* ========================================================= */}
                {/* INSET DIAGRAM: 3D QUADRANT CROSS-SECTION (STEP 1) &       */}
                {/* 90° CLOCKWISE HP ROTATION PROOF (STEP 5)                  */}
                {/* ========================================================= */}
                {showQuadrantInset && (
                  <g transform="translate(505, 30)">
                    <rect
                      x="0"
                      y="0"
                      width="265"
                      height="170"
                      rx="6"
                      fill="#0f172a"
                      stroke="#334155"
                      strokeWidth="1.2"
                    />
                    <text x="12" y="19" fill="#e2e8f0" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                      {s === 0 ? '3D SIDE VIEW · QUADRANT LOCATOR' : 'WHY HP ROTATES 90° CLOCKWISE'}
                    </text>

                    {/* VP Vertical Axis */}
                    <line x1="132" y1="32" x2="132" y2="150" stroke={vpColor} strokeWidth="1.8" />
                    <text x="137" y="42" fill="#fca5a5" fontSize="8.5" fontFamily="monospace">VP (+Z)</text>

                    {/* HP Horizontal Axis */}
                    <line x1="28" y1="92" x2="238" y2="92" stroke={hpColor} strokeWidth="1.8" />
                    <text x="200" y="86" fill="#93c5fd" fontSize="8.5" fontFamily="monospace">Front (+Y)</text>
                    <text x="30" y="86" fill="#93c5fd" fontSize="8.5" fontFamily="monospace">Behind (-Y)</text>

                    {/* Origin XY */}
                    <circle cx="132" cy="92" r="3" fill="#ffffff" />
                    <text x="122" y="106" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="bold">XY</text>

                    {/* Quadrant Roman Labels */}
                    <text x="184" y="58" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">Q1</text>
                    <text x="72" y="58" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">Q2</text>
                    <text x="72" y="132" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">Q3</text>
                    <text x="184" y="132" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="bold">Q4</text>

                    {/* Step 1: Active Spatial Point Dot */}
                    {s === 0 && (() => {
                      const qx = 132 + (point.y > 0 ? 44 : point.y < 0 ? -44 : 0);
                      const qy = 92 - (point.z > 0 ? 32 : point.z < 0 ? -32 : 0);
                      return (
                        <g>
                          <line x1={qx} y1={qy} x2="132" y2={qy} stroke="#fca5a5" strokeDasharray="3,2" strokeWidth="1" />
                          <line x1={qx} y1={qy} x2={qx} y2="92" stroke="#93c5fd" strokeDasharray="3,2" strokeWidth="1" />
                          <circle cx={qx} cy={qy} r="5" fill="#a855f7" stroke="#ffffff" strokeWidth="1.5" />
                          <text x={qx + 8} y={qy - 6} fill="#f8fafc" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                            {point.name}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Step 5: Rotating HP plane arm showing 90° CW swing */}
                    {s === 4 && (() => {
                      const rad = (foldAngleDeg * Math.PI) / 180;
                      const armLen = 46;
                      // Front HP (+Y) rotates clockwise -> downward
                      const frontX = 132 + armLen * Math.cos(rad);
                      const frontY = 92 + armLen * Math.sin(rad);
                      // Rear HP (-Y) rotates clockwise -> upward
                      const rearX = 132 - armLen * Math.cos(rad);
                      const rearY = 92 - armLen * Math.sin(rad);
                      return (
                        <g>
                          <line x1={rearX} y1={rearY} x2={frontX} y2={frontY} stroke="#f59e0b" strokeWidth="2.5" />
                          <path
                            d="M 184 92 A 52 52 0 0 1 132 144"
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="1.4"
                            strokeDasharray="3,2"
                            markerEnd="url(#vid-rot-arrow)"
                          />
                          <circle
                            cx={point.vpRelation === 'BEHIND' ? rearX : point.vpRelation === 'IN_FRONT' ? frontX : 132}
                            cy={point.vpRelation === 'BEHIND' ? rearY : point.vpRelation === 'IN_FRONT' ? frontY : 92}
                            r="4.5"
                            fill="#38bdf8"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <text x="142" y="158" fill="#fbbf24" fontSize="9" fontFamily="monospace" fontWeight="bold">
                            HP rotated {Math.round(foldAngleDeg)}° CW
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* ========================================================= */}
                {/* STEP 7: TITLE BLOCK + VERIFICATION CHECKLIST OVERLAY      */}
                {/* ========================================================= */}
                {s >= 6 && (
                  <g>
                    {/* Title Block at Bottom-Right */}
                    <g transform="translate(520, 386)" opacity={titleBlockOpacity}>
                      <rect x="0" y="0" width="252" height="66" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
                      <line x1="0" y1="22" x2="252" y2="22" stroke="#94a3b8" strokeWidth="0.8" />
                      <text x="10" y="15" fill="#0f172a" fontSize="9.5" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                        EDraw · PROJECTION OF POINTS
                      </text>
                      <text x="10" y="36" fill="#334155" fontSize="8.8" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                        All Dimensions Are In mm · Scale 1:1
                      </text>
                      <text x="10" y="53" fill="#475569" fontSize="8.5" fontFamily="'JetBrains Mono', monospace">
                        Elevation: {point.frontViewLabel} · Plan: {point.topViewLabel}
                      </text>
                    </g>

                    {/* Audit Badge Stamp (Top-Right) */}
                    {auditCheckCount > 0 && (
                      <g transform="translate(520, 30)">
                        <rect
                          x="0"
                          y="0"
                          width="252"
                          height="108"
                          rx="6"
                          fill="#ecfdf5"
                          stroke="#10b981"
                          strokeWidth="1.2"
                        />
                        <text x="12" y="20" fill="#065f46" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                          BIS SP 46 FINAL AUDIT
                        </text>
                        {[
                          '1. X–Y line drawn & labeled',
                          '2. Projector continuous thin 2H',
                          `3. ${point.frontViewLabel} (prime) & ${point.topViewLabel} (no prime)`,
                          '4. Dimensions & Title Block set',
                        ]
                          .slice(0, auditCheckCount)
                          .map((item, idx) => (
                            <text
                              key={item}
                              x="14"
                              y={40 + idx * 18}
                              fill="#047857"
                              fontSize="9.8"
                              fontFamily="'JetBrains Mono', monospace"
                              fontWeight="600"
                            >
                              ✓ {item}
                            </text>
                          ))}
                      </g>
                    )}
                  </g>
                )}

                {/* ========================================================= */}
                {/* ANIMATED PENCIL NIB CURSOR (Tracks active drawing stroke) */}
                {/* ========================================================= */}
                {pencilPos && (
                  <g transform={`translate(${pencilPos.x}, ${pencilPos.y})`}>
                    <polygon
                      points="0,0 7,-16 14,-11"
                      fill={pencilPos.grade === 'HB' ? '#1e293b' : '#475569'}
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                    <polygon points="7,-16 26,-42 33,-37 14,-11" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                    <rect
                      x="24"
                      y="-48"
                      width="24"
                      height="14"
                      rx="3"
                      fill="#0f172a"
                    />
                    <text
                      x="36"
                      y="-38"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {pencilPos.grade}
                    </text>
                  </g>
                )}
              </svg>

              {/* Progressive Synchronized Live Subtitles (phrase-by-phrase with the voice) */}
              {showCaptions && activeCue && (
                <div className="absolute bottom-2.5 inset-x-3 pointer-events-none flex justify-center">
                  <div
                    key={`${activeStep.id}-${activeCueIdx}`}
                    className="max-w-xl px-4 py-2 rounded-lg bg-slate-950/90 text-white text-xs sm:text-sm font-medium leading-snug text-center shadow-lg border border-white/15"
                  >
                    {activeCue.text}
                  </div>
                </div>
              )}
            </div>

            {/* Video Transport Bar & Timeline Scrubber */}
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {/* Scrubber Slider with Chapter Markers */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 w-11 shrink-0">
                  {formatSeconds(elapsedMs)}
                </span>
                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={Math.round(timelineRatio * 1000)}
                    onChange={(e) => handleScrub(Number(e.target.value) / 1000)}
                    aria-label="Walkthrough timeline scrubber"
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#7138E8] bg-slate-200 dark:bg-slate-700"
                  />
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 w-11 text-right shrink-0">
                  {formatSeconds(totalDurationMs)}
                </span>
              </div>

              {/* Transport Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="px-4 py-2 rounded-lg bg-[#7138E8] hover:bg-[#5E28D1] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8]"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleJumpToStep(Math.max(0, activeStepIdx - 1))}
                    disabled={activeStepIdx === 0}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8]"
                    title="Previous Step"
                    aria-label="Previous step"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleJumpToStep(Math.min(steps.length - 1, activeStepIdx + 1))}
                    disabled={activeStepIdx === steps.length - 1}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8]"
                    title="Next Step"
                    aria-label="Next step"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleReplay}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8]"
                    title="Restart from Step 1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replay</span>
                  </button>
                </div>

                {/* Audio, Captions & Playback Speed */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(audioSupported || speechSupported) && (
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8] ${
                        voiceEnabled
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title="Toggle spoken teacher voiceover"
                    >
                      {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>{voiceEnabled ? 'Voice On' : 'Muted'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCaptions((c) => !c)}
                    className={`px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8] ${
                      showCaptions
                        ? 'border-[#7138E8]/40 bg-[#F1EBFF] dark:bg-purple-950/50 text-[#7138E8] dark:text-purple-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                    title="Toggle live captions on canvas"
                  >
                    <Captions className="w-3.5 h-3.5" />
                    <span>CC</span>
                  </button>

                  <select
                    value={playbackSpeed}
                    onChange={(e) => {
                      const nextRate = Number(e.target.value);
                      setPlaybackSpeed(nextRate);
                      if (isPlaying && voiceEnabled && !audioElementRef.current) {
                        lastSpokenKeyRef.current = null;
                      }
                    }}
                    aria-label="Playback speed"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8]"
                  >
                    <option value={0.75}>0.75×</option>
                    <option value={1}>1×</option>
                    <option value={1.25}>1.25×</option>
                    <option value={1.5}>1.5×</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT ZONE: What / How / Why / When Teacher Deck & Step Chapters */}
          <div className="flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 gap-4 bg-white dark:bg-slate-900">
            {/* Chapter Stepper Buttons */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Drafting Chapters
                </span>
                <span className="font-mono tabular-nums">
                  {activeStep.pencilGrade} · Step {activeStep.stepNumber}/7
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                {steps.map((step, idx) => {
                  const isCurrent = idx === activeStepIdx;
                  const isDone = idx < activeStepIdx;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => handleJumpToStep(idx)}
                      title={step.title}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8] ${
                        isCurrent
                          ? 'bg-[#7138E8] text-white shadow-xs'
                          : isDone
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
                      }`}
                    >
                      {step.stepNumber}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Structured 4-Part Pedagogical Breakdown: WHAT · HOW · WHY · WHEN */}
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                  <Compass className="w-3.5 h-3.5 text-[#7138E8] dark:text-purple-400 shrink-0" />
                  <span>What to do</span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeStep.what}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                  <Wrench className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>How to draw it</span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeStep.how}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Why it works</span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeStep.why}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>When to apply</span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeStep.when}
                </p>
              </div>
            </div>

            {/* Interactive Step Playlist */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Full Construction Sequence
              </div>
              <div className="space-y-1">
                {steps.map((step, idx) => {
                  const isCurrent = idx === activeStepIdx;
                  const isDone = idx < activeStepIdx;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => handleJumpToStep(idx)}
                      className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7138E8] ${
                        isCurrent
                          ? 'bg-[#F1EBFF] dark:bg-purple-950/50 text-[#5B24CE] dark:text-purple-200 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <span className="w-4 text-center font-mono tabular-nums font-bold shrink-0">
                            {step.stepNumber}.
                          </span>
                        )}
                        <span className="truncate">{step.shortTitle}</span>
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                        {formatSeconds(step.durationMs)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
