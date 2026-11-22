/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  ArrowRight,
  Code2,
  Play,
  Wand2,
  ShieldCheck,
  Cpu,
  Info,
  ScanText,
} from 'lucide-react';
import type { LineProblemInput } from '../../types/lines';
import type {
  CanonicalEngineeringProblem,
  MissingRequirement,
  PipelineStageTrace,
} from '../../pipeline/schema';
import {
  STRAIGHT_LINE_PROPERTIES,
  validateCanonicalProblem,
} from '../../pipeline/schema';
import type { StructuredQuestionData } from '../../utils/structuredQuestionJson';
import { PipelineStageTracker } from './PipelineStageTracker';
import { ValidatedSvgCanvas } from './ValidatedSvgCanvas';

export type { StructuredQuestionData };

interface QuestionToGraphicsGeneratorProps {
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
  onNavigateToLineModule?: (lineInput: LineProblemInput) => void;
}

interface PipelineRunApiResponse {
  ok: boolean;
  failed_stage: string | null;
  error: string | null;
  configuration_hint?: string;
  stages: PipelineStageTrace[];
  raw_ocr_text: string | null;
  ocr_engine_used: string | null;
  initial_json: CanonicalEngineeringProblem | null;
  validated_json: CanonicalEngineeringProblem | null;
  missing_requirements?: MissingRequirement[];
  svg: string | null;
  line_input: LineProblemInput | null;
}

interface PipelineCapabilitiesResponse {
  ok: boolean;
  python_solver: {
    available: boolean;
    python_bin: string;
    script_exists: boolean;
    version?: string;
    error?: string;
  };
  ocr: {
    glm_ocr: {
      preferred: boolean;
      configured: boolean;
      model: string;
      endpoint_configured_via: string;
      hosted_guidance: string;
    };
    gemini_vision: {
      configured: boolean;
      model: string;
    };
    tesseract_local: {
      available: boolean;
    };
  };
}

type OcrEngineSelection = 'auto' | 'glm-ocr' | 'gemini-vision' | 'tesseract';

const PRESET_QUESTIONS = [
  {
    id: 'p1',
    title: 'N.D. Bhatt Classic: Line AB Inclined to Both HP & VP',
    badge: 'Fully Given',
    text: 'A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections.',
  },
  {
    id: 'p2',
    title: 'Derivable Unknowns: Line NM (Given TL, FV, TV)',
    badge: 'Python Derives θ, φ, DEP',
    text: 'A line NM 75 mm long has its front view 60 mm long and top view 55 mm long. End N is 15 mm above HP and 20 mm in front of VP. Draw its projections and find true inclinations.',
  },
  {
    id: 'p3',
    title: 'Unit Conversion: Line LK (cm & m to mm)',
    badge: 'Mixed Units',
    text: 'A line LK 8 cm long is inclined at 30° to the HP and 45° to the VP. End L is 0.02 m above HP and 3 cm in front of VP. Draw its projections.',
  },
  {
    id: 'p4',
    title: 'Parallel to HP & Inclined to VP: Line JP',
    badge: 'Auxiliary Case',
    text: 'A line JP 65 mm long is parallel to the HP and inclined at 30° to the VP. Point J is 30 mm above the HP and 15 mm in front of the VP. Draw its projections.',
  },
  {
    id: 'p5',
    title: 'Perpendicular to HP: Line AB (Visible & Hidden)',
    badge: 'BIS SP 46',
    text: 'A line AB 40 mm long is perpendicular to the HP and parallel to the VP. Point A is 50 mm above the HP and 25 mm in front of the VP. Point B is 10 mm above the HP. Draw its projections.',
  },
  {
    id: 'p6',
    title: 'Underdetermined Question (Safety Gate Test)',
    badge: 'Missing Dimensions',
    text: 'A line AB has its end A 20 mm above HP and 30 mm in front of VP. The line is inclined at 30° to HP. Draw its projections.',
  },
  {
    id: 'p7',
    title: 'Contradictory Measurements (Safety Gate Test)',
    badge: 'Invalid θ + φ > 90°',
    text: 'A line AB 80 mm long is inclined at 60° to the HP and 50° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections.',
  },
];

export const QuestionToGraphicsGenerator: React.FC<QuestionToGraphicsGeneratorProps> = ({
  hpColor,
  vpColor,
  isDark = false,
  onNavigateToLineModule,
}) => {
  const [inputText, setInputText] = useState<string>(PRESET_QUESTIONS[0].text);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_QUESTIONS[0].id);
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [ocrEngine, setOcrEngine] = useState<OcrEngineSelection>('auto');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [capabilities, setCapabilities] = useState<PipelineCapabilitiesResponse | null>(null);
  const [showOcrSetupHelp, setShowOcrSetupHelp] = useState<boolean>(false);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineRunApiResponse | null>(null);

  // Active tab: Stage 5 Drawing | Stage 2 Editable Initial JSON | Stage 4 Validated JSON | Trace & Checks
  const [activeTab, setActiveTab] = useState<
    'drawing' | 'initial_json' | 'validated_json' | 'trace'
  >('drawing');

  // Editable Stage 2 Initial JSON state
  const [initialJsonDraft, setInitialJsonDraft] = useState<string>('');
  const [isInitialJsonEdited, setIsInitialJsonEdited] = useState<boolean>(false);
  const [initialJsonSyntaxError, setInitialJsonSyntaxError] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'initial' | 'validated' | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Fetch backend pipeline capabilities (Python 3 solver & OCR engines)
  useEffect(() => {
    let mounted = true;
    fetch('/api/pipeline/capabilities')
      .then((res) => res.json())
      .then((data: PipelineCapabilitiesResponse) => {
        if (mounted && data?.ok) {
          setCapabilities(data);
        }
      })
      .catch(() => {
        // Non-fatal; pipeline run will report explicit errors if unavailable
      });
    return () => {
      mounted = false;
    };
  }, []);

  const executePipeline = useCallback(
    async (payload: {
      text?: string;
      imageBase64?: string;
      mimeType?: string;
      ocrEngine?: OcrEngineSelection;
      editedInitialJson?: unknown;
    }) => {
      const reqId = ++activeRequestIdRef.current;
      setIsRunning(true);

      try {
        const res = await fetch('/api/pipeline/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            isDark,
          }),
        });

        const data: PipelineRunApiResponse = await res.json();
        if (reqId !== activeRequestIdRef.current) return;

        setPipelineResult(data);

        if (data.raw_ocr_text && payload.imageBase64) {
          setInputText(data.raw_ocr_text);
        }

        if (data.initial_json) {
          setInitialJsonDraft(JSON.stringify(data.initial_json, null, 2));
          setIsInitialJsonEdited(false);
          setInitialJsonSyntaxError(null);
        }
      } catch (err: any) {
        if (reqId !== activeRequestIdRef.current) return;
        setPipelineResult({
          ok: false,
          failed_stage: 'stage_1_ocr',
          error: err?.message || 'Unable to reach the EDraw pipeline backend.',
          stages: [],
          raw_ocr_text: null,
          ocr_engine_used: null,
          initial_json: null,
          validated_json: null,
          svg: null,
          line_input: null,
        });
      } finally {
        if (reqId === activeRequestIdRef.current) {
          setIsRunning(false);
        }
      }
    },
    [isDark]
  );

  // Run default preset through the full 5-stage pipeline on initial mount
  useEffect(() => {
    executePipeline({ text: PRESET_QUESTIONS[0].text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render Stage 5 SVG cleanly if dark mode toggles on an already validated solution
  useEffect(() => {
    if (!pipelineResult?.validated_json?.validation.ready_for_render) return;
    let cancelled = false;
    fetch('/api/pipeline/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: pipelineResult.validated_json,
        isDark,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res?.ok && typeof res.svg === 'string') {
          setPipelineResult((prev) => (prev ? { ...prev, svg: res.svg } : prev));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const handleSelectPreset = (preset: (typeof PRESET_QUESTIONS)[number]) => {
    setSelectedPresetId(preset.id);
    setInputMode('text');
    setInputText(preset.text);
    setActiveTab('drawing');
    executePipeline({ text: preset.text });
  };

  const handleRunTextPipeline = () => {
    if (!inputText.trim()) return;
    setActiveTab('drawing');
    executePipeline({ text: inputText });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '');
      setImagePreview(base64);
      setActiveTab('drawing');
      executePipeline({
        imageBase64: base64,
        mimeType: file.type || 'image/jpeg',
        ocrEngine,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleInitialJsonDraftChange = (next: string) => {
    setInitialJsonDraft(next);
    setIsInitialJsonEdited(true);
    try {
      const parsed = JSON.parse(next);
      const checked = validateCanonicalProblem(parsed);
      if (checked.ok) {
        setInitialJsonSyntaxError(null);
      } else {
        setInitialJsonSyntaxError(checked.errors.slice(0, 3).join('; '));
      }
    } catch (err: any) {
      setInitialJsonSyntaxError(err?.message || 'Invalid JSON syntax');
    }
  };

  const handleFormatInitialJson = () => {
    try {
      const parsed = JSON.parse(initialJsonDraft);
      setInitialJsonDraft(JSON.stringify(parsed, null, 2));
    } catch (err: any) {
      setInitialJsonSyntaxError(err?.message || 'Invalid JSON syntax');
    }
  };

  const handleResetInitialJson = () => {
    if (!pipelineResult?.initial_json) return;
    setInitialJsonDraft(JSON.stringify(pipelineResult.initial_json, null, 2));
    setIsInitialJsonEdited(false);
    setInitialJsonSyntaxError(null);
  };

  const handleReSolveEditedJson = () => {
    try {
      const parsed = JSON.parse(initialJsonDraft);
      const checked = validateCanonicalProblem(parsed);
      if (!checked.ok) {
        setInitialJsonSyntaxError(checked.errors.slice(0, 3).join('; '));
        return;
      }
      setInitialJsonSyntaxError(null);
      setActiveTab('drawing');
      executePipeline({ editedInitialJson: checked.data });
    } catch (err: any) {
      setInitialJsonSyntaxError(err?.message || 'Invalid JSON syntax');
    }
  };

  const handleCopy = (target: 'initial' | 'validated') => {
    const content =
      target === 'initial'
        ? initialJsonDraft
        : pipelineResult?.validated_json
        ? JSON.stringify(pipelineResult.validated_json, null, 2)
        : '';
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), 1800);
  };

  const validatedJson = pipelineResult?.validated_json ?? null;
  const readyForRender = Boolean(validatedJson?.validation.ready_for_render && pipelineResult?.svg);
  const geom = validatedJson?.geometry;
  const lineLabel =
    geom?.entity_type === 'straight_line'
      ? geom.line_label
      : pipelineResult?.initial_json?.geometry.entity_type === 'straight_line'
      ? pipelineResult.initial_json.geometry.line_label
      : '—';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      {/* Header & Workflow Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 text-[11px] font-bold font-mono rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs">
              5-STAGE PIPELINE
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Engineering Drawing Problem Solver &amp; Sketch Generator
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Stage 1 OCR → Stage 2 Canonical JSON (null unknowns) → Stage 3 Python Geometry Solver → Stage 4 Validation → Stage 5 BIS SP 46 SVG
          </p>
        </div>

        {/* Capabilities Strip */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              capabilities?.python_solver.available
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {capabilities?.python_solver.available
                ? capabilities.python_solver.version || 'Python 3 Ready'
                : 'Python Solver'}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setShowOcrSetupHelp((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition ${
              capabilities?.ocr.glm_ocr.configured
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <ScanText className="w-3.5 h-3.5" />
            <span>
              {capabilities?.ocr.glm_ocr.configured
                ? `GLM-OCR (${capabilities.ocr.glm_ocr.model})`
                : 'OCR Engines'}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible GLM-OCR / Hosted Environment Configuration Info */}
      {showOcrSetupHelp && capabilities?.ocr && (
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/30 text-xs text-slate-700 dark:text-slate-200 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Stage 1 OCR Engine Status &amp; Local Ollama Integration Boundary
            </span>
            <button
              type="button"
              onClick={() => setShowOcrSetupHelp(false)}
              className="text-[11px] font-mono text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-900">
              Preferred: <strong>GLM-OCR</strong> —{' '}
              {capabilities.ocr.glm_ocr.configured
                ? `Configured (${capabilities.ocr.glm_ocr.model})`
                : `Not configured (${capabilities.ocr.glm_ocr.endpoint_configured_via} unset)`}
            </div>
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-900">
              Fallback 1: <strong>Gemini Vision</strong> —{' '}
              {capabilities.ocr.gemini_vision.configured
                ? `Configured (${capabilities.ocr.gemini_vision.model})`
                : 'API key unset'}
            </div>
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-900">
              Fallback 2: <strong>Local Tesseract</strong> —{' '}
              {capabilities.ocr.tesseract_local.available ? 'Available' : 'Unavailable'}
            </div>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {capabilities.ocr.glm_ocr.hosted_guidance}
          </p>
        </div>
      )}

      {/* Live 5-Stage Pipeline Status Tracker */}
      <PipelineStageTracker
        stages={pipelineResult?.stages ?? []}
        isRunning={isRunning}
        failedStage={pipelineResult?.failed_stage ?? null}
      />

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Stage 1 Input & Quick Given/Derived Summary */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                Stage 1 · Problem Input
              </span>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    inputMode === 'text'
                      ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('image')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    inputMode === 'image'
                      ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Image OCR
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="preset-question-select"
                className="text-[11px] font-mono text-slate-500 dark:text-slate-400"
              >
                Benchmark Problems &amp; Safety-Gate Tests:
              </label>
              <select
                id="preset-question-select"
                value={selectedPresetId}
                onChange={(e) => {
                  const found = PRESET_QUESTIONS.find((p) => p.id === e.target.value);
                  if (found) handleSelectPreset(found);
                }}
                className="w-full text-xs font-sans rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {PRESET_QUESTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.badge})
                  </option>
                ))}
              </select>
            </div>

            {inputMode === 'text' ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor="engineering-question-input" className="sr-only">
                  Engineering Drawing Question Statement
                </label>
                <textarea
                  id="engineering-question-input"
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Enter a straight-line engineering drawing question (e.g. A line NM 75 mm long...)"
                  className="w-full text-xs font-sans rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
                />
                <button
                  type="button"
                  onClick={handleRunTextPipeline}
                  disabled={isRunning || !inputText.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isRunning ? 'Running 5-Stage Pipeline...' : 'Run 5-Stage Pipeline'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="ocr-engine-select"
                    className="text-[11px] font-mono text-slate-500 dark:text-slate-400"
                  >
                    Stage 1 OCR Engine:
                  </label>
                  <select
                    id="ocr-engine-select"
                    value={ocrEngine}
                    onChange={(e) => setOcrEngine(e.target.value as OcrEngineSelection)}
                    className="w-full text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                  >
                    <option value="auto">Auto (GLM-OCR preferred → Gemini Vision → Tesseract)</option>
                    <option value="glm-ocr">GLM-OCR via Ollama (OLLAMA_BASE_URL)</option>
                    <option value="gemini-vision">Gemini Vision OCR</option>
                    <option value="tesseract">Local Tesseract OCR</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 text-center hover:border-blue-500 transition cursor-pointer flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950"
                >
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {uploadedFileName
                      ? `Selected: ${uploadedFileName} (Click to replace)`
                      : 'Upload Engineering Drawing Question Image'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    PNG, JPG, WebP — Runs Stage 1 OCR through Stage 5 SVG automatically
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />

                {imagePreview && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-40 bg-slate-100 dark:bg-slate-950">
                    <img
                      src={imagePreview}
                      alt="Uploaded engineering drawing question"
                      className="w-full h-full object-contain max-h-40"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provenance Summary: Explicit Givens vs Python-Derived Unknowns */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Givens vs Python-Derived Values
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Line <strong>{lineLabel}</strong>
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-mono max-h-[340px] overflow-y-auto">
              {STRAIGHT_LINE_PROPERTIES.map((spec) => {
                const givenField = validatedJson?.givens[spec.property] ?? pipelineResult?.initial_json?.givens[spec.property];
                const unknownField = validatedJson?.unknowns[spec.property] ?? pipelineResult?.initial_json?.unknowns[spec.property];
                const field = givenField || unknownField;

                const statusBadge =
                  field?.status === 'given'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                    : field?.status === 'derived'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : field?.status === 'inconsistent'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                    : field?.status === 'ambiguous'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

                return (
                  <div key={spec.property} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-slate-600 dark:text-slate-300 block truncate">
                        {spec.label}
                      </span>
                      {field?.original_unit && field.original_unit !== field.unit && (
                        <span className="text-[10px] text-slate-400">
                          converted from {field.original_value} {field.original_unit}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {field && field.value !== null
                          ? `${Number(field.value.toFixed(2))} ${field.unit}`
                          : 'null'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${statusBadge}`}>
                        {field?.status ?? 'unknown'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {onNavigateToLineModule && (
              <button
                type="button"
                disabled={!readyForRender || !pipelineResult?.line_input}
                onClick={() => {
                  if (readyForRender && pipelineResult?.line_input) {
                    onNavigateToLineModule(pipelineResult.line_input);
                  }
                }}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>
                  {readyForRender
                    ? 'Open Validated Line in Straight Lines Module'
                    : 'Solve & Validate Before Opening in Lines Module'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Stage Tabs & Outputs */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Tab Strip */}
          <div
            role="tablist"
            aria-label="Pipeline stage outputs"
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 text-xs font-semibold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'drawing'}
              onClick={() => setActiveTab('drawing')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeTab === 'drawing'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              5. Drawing (SVG)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'initial_json'}
              onClick={() => setActiveTab('initial_json')}
              className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'initial_json'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>2. Initial JSON</span>
              {isInitialJsonEdited && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    initialJsonSyntaxError ? 'bg-rose-500' : 'bg-blue-500'
                  }`}
                />
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'validated_json'}
              onClick={() => setActiveTab('validated_json')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeTab === 'validated_json'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              4. Validated JSON
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'trace'}
              onClick={() => setActiveTab('trace')}
              className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'trace'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>OCR &amp; Checks</span>
            </button>
          </div>

          {/* TAB 1: Stage 5 Validated Drawing */}
          {activeTab === 'drawing' && (
            <ValidatedSvgCanvas
              svg={pipelineResult?.svg ?? null}
              validatedJson={validatedJson}
              lineInput={pipelineResult?.line_input ?? null}
              error={pipelineResult?.error ?? null}
              configurationHint={pipelineResult?.configuration_hint}
              failedStage={pipelineResult?.failed_stage ?? null}
              isRunning={isRunning}
              hpColor={hpColor}
              vpColor={vpColor}
              isDark={isDark}
              onJumpToInitialJson={() => setActiveTab('initial_json')}
            />
          )}

          {/* TAB 2: Stage 2 Editable Initial Canonical JSON */}
          {activeTab === 'initial_json' && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Code2 className="w-4 h-4 text-blue-500" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Stage 2 · Initial Canonical JSON (v1.0.0)
                  </h2>
                  {initialJsonSyntaxError ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                      Schema / JSON Error
                    </span>
                  ) : isInitialJsonEdited ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                      Edited · Ready to Re-Solve
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                      Unknowns = null
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFormatInitialJson}
                    disabled={Boolean(initialJsonSyntaxError)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-mono flex items-center gap-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Format</span>
                  </button>
                  {isInitialJsonEdited && (
                    <button
                      type="button"
                      onClick={handleResetInitialJson}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-xs font-mono flex items-center gap-1 text-amber-800 dark:text-amber-200 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopy('initial')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono flex items-center gap-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    {copiedTarget === 'initial' ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedTarget === 'initial' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReSolveEditedJson}
                    disabled={isRunning || Boolean(initialJsonSyntaxError) || !initialJsonDraft.trim()}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Re-Solve in Python &amp; Render</span>
                  </button>
                </div>
              </div>

              <label htmlFor="stage2-initial-json-editor" className="sr-only">
                Stage 2 Initial Canonical JSON Editor
              </label>
              <textarea
                id="stage2-initial-json-editor"
                aria-label="Stage 2 Initial Canonical JSON Editor"
                aria-invalid={Boolean(initialJsonSyntaxError)}
                value={initialJsonDraft}
                onChange={(e) => handleInitialJsonDraftChange(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className={`w-full min-h-[440px] h-[480px] p-4 rounded-xl bg-slate-950 text-slate-100 text-[12px] font-mono leading-relaxed border focus:outline-none focus:ring-2 resize-y ${
                  initialJsonSyntaxError
                    ? 'border-rose-500/80 focus:ring-rose-500'
                    : 'border-slate-800 focus:ring-blue-500'
                }`}
              />

              {initialJsonSyntaxError ? (
                <div
                  role="alert"
                  className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{initialJsonSyntaxError}</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Editing this JSON never skips Stage 3 or Stage 4: clicking{' '}
                  <strong>Re-Solve in Python &amp; Render</strong> sends your edited canonical JSON back through the deterministic Python geometry solver and independent validator.
                </p>
              )}
            </div>
          )}

          {/* TAB 3: Stage 4 Updated & Validated JSON */}
          {activeTab === 'validated_json' && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Stage 4 · Updated &amp; Validated Canonical JSON
                  </h2>
                  {validatedJson && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                        validatedJson.validation.ready_for_render
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                      }`}
                    >
                      {validatedJson.validation.solver_status}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy('validated')}
                  disabled={!validatedJson}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-mono flex items-center gap-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {copiedTarget === 'validated' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedTarget === 'validated' ? 'Copied' : 'Copy Validated JSON'}</span>
                </button>
              </div>

              {validatedJson ? (
                <>
                  {/* Derived Formula Provenance Table */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      Python-Derived Unknowns &amp; Formulas
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-mono max-h-48 overflow-y-auto">
                      {Object.values(validatedJson.unknowns).map((u) => (
                        <div key={u.property} className="px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{u.property}</span>
                          <span className="text-slate-500 truncate max-w-[260px]" title={u.provenance.formula || u.provenance.reason || ''}>
                            {u.provenance.formula || u.provenance.reason || '—'}
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            {u.value !== null ? `${u.value} ${u.unit}` : 'null'} ({u.status})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <pre className="w-full max-h-[380px] overflow-auto p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono leading-relaxed border border-slate-800">
                    {JSON.stringify(validatedJson, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="text-xs text-slate-500 py-8 text-center">
                  No Stage 4 validated JSON available yet.
                </p>
              )}
            </div>
          )}

          {/* TAB 4: Stage 1 Raw OCR Trace & Stage 4 Independent Geometric Checks */}
          {activeTab === 'trace' && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-4">
              {/* Stage 1 Raw OCR Text */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Stage 1 · Raw OCR / Source Text Trace
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Engine: <strong>{pipelineResult?.ocr_engine_used ?? '—'}</strong>
                  </span>
                </div>
                <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {pipelineResult?.raw_ocr_text ?? 'No OCR output recorded.'}
                </pre>
              </div>

              {/* Independent Geometric Validation Checks */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Stage 3 &amp; 4 · Independent Geometric Validation Matrix
                </span>

                {validatedJson && validatedJson.validation.checks.length > 0 ? (
                  <div className="space-y-2">
                    {validatedJson.validation.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {chk.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Expected: {chk.expected} · Actual: {chk.actual}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                            chk.passed
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {chk.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No geometric validation checks recorded (pipeline halted before coordinates were solved).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
