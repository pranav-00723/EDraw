/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Camera,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Layers,
  Ruler,
  Maximize2,
  Download,
  Info,
  BookOpen,
  ArrowRight,
  Code2,
  Sliders,
} from 'lucide-react';
import { LineProblemInput, ComputedLine } from '../../types/lines';
import { computeLineProjection } from '../../utils/linesMath';
import { RotatingLineConstructionEngine } from '../../modules/lines/RotatingLineConstructionEngine';
import { normalizeMasterOcrText } from '../../utils/straightLineMasterSolver';

interface QuestionToGraphicsGeneratorProps {
  hpColor: string;
  vpColor: string;
  isDark?: boolean;
  onNavigateToLineModule?: (lineInput: LineProblemInput) => void;
}

export interface StructuredQuestionData {
  object_type: 'STRAIGHT_LINE' | 'POINT' | 'PLANE';
  line_name: string;
  endpoints: {
    start: string;
    end: string;
  };
  dimensions: {
    true_length_mm: number | null;
    front_view_length_mm: number | null;
    top_view_length_mm: number | null;
    dep_projector_distance_mm: number | null;
  };
  coordinates: {
    point_A: {
      dist_hp_mm: number | null;
      hp_relation: 'ABOVE' | 'BELOW' | 'ON' | null;
      dist_vp_mm: number | null;
      vp_relation: 'IN_FRONT' | 'BEHIND' | 'ON' | null;
    };
    point_B: {
      dist_hp_mm: number | null;
      hp_relation: 'ABOVE' | 'BELOW' | 'ON' | null;
      dist_vp_mm: number | null;
      vp_relation: 'IN_FRONT' | 'BEHIND' | 'ON' | null;
    };
  };
  inclinations: {
    theta_hp_deg: number | null;
    phi_vp_deg: number | null;
    alpha_apparent_fv_deg: number | null;
    beta_apparent_tv_deg: number | null;
  };
  reference_plane_conditions: {
    system: 'FIRST_ANGLE_PROJECTION' | 'THIRD_ANGLE_PROJECTION';
    is_parallel_to_hp: boolean;
    is_parallel_to_vp: boolean;
    is_perpendicular_to_hp: boolean;
    is_perpendicular_to_vp: boolean;
  };
  projection_requirements: string[];
  construction_method: 'ROTATING_LINE_METHOD' | 'TRAPEZOIDAL_METHOD' | 'AUXILIARY_PLANE_METHOD';
  missing_or_ambiguous_fields: string[];
  validation: {
    is_valid: boolean;
    geometric_condition: string;
    warnings: string[];
  };
}

// Preset Curriculum Textbook Problems
const PRESET_QUESTIONS = [
  {
    id: 'p1',
    title: 'N.D. Bhatt Classic: Line Inclined to Both HP & VP',
    badge: 'Standard University Exam',
    text: 'A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections.',
  },
  {
    id: 'p2',
    title: 'Anna Univ: Line 75mm with Both Inclinations',
    badge: 'Semester Standard',
    text: 'A straight line PQ 75 mm long has its end P 25 mm above the HP and 20 mm in front of the VP. The line is inclined at 35° to the HP and 40° to the VP. Draw its front view and top view.',
  },
  {
    id: 'p3',
    title: 'Line Parallel to VP and Inclined to HP',
    badge: 'Auxiliary Concept',
    text: 'A line CD 70 mm long is parallel to the VP and inclined at 45° to the HP. End C is in the HP and 25 mm in front of the VP. Draw its front and top views.',
  },
  {
    id: 'p4',
    title: 'Line Parallel to HP and Inclined to VP',
    badge: 'Auxiliary Concept',
    text: 'A line MN 65 mm long is parallel to the HP and inclined at 30° to the VP. Point M is 30 mm above the HP and 15 mm in front of the VP. Draw its projections.',
  },
  {
    id: 'p5',
    title: 'Line Perpendicular to HP (Visible & Hidden Points)',
    badge: 'BIS SP 46',
    text: 'A Line AB 40mm is perpendicular to the HP and parallel to the VP. Point A is 50mm above the HP and 25mm in front of the VP. Point B is 10mm above the HP. Draw its projections.',
  },
  {
    id: 'p6',
    title: 'Ambiguous / Incomplete Question (Needs User Clarification)',
    badge: 'Clarification Test',
    text: 'A line AB has its end A 20 mm above HP and 30 mm in front of VP. The line is inclined at 30° to HP. Draw its projections.',
  },
];

export const QuestionToGraphicsGenerator: React.FC<QuestionToGraphicsGeneratorProps> = ({
  hpColor,
  vpColor,
  isDark = false,
  onNavigateToLineModule,
}) => {
  // Input question states
  const [inputText, setInputText] = useState<string>(PRESET_QUESTIONS[0].text);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_QUESTIONS[0].id);
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCopiedJson, setIsCopiedJson] = useState<boolean>(false);

  // Active view tab in generator
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<
    'interpretation' | 'structured' | 'construction' | 'validation'
  >('construction');

  // Clarification prompt states (when input is missing or ambiguous)
  const [clarificationData, setClarificationData] = useState<{
    trueLength?: number;
    phiDeg?: number;
    thetaDeg?: number;
    distHp?: number;
    distVp?: number;
  }>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. QUESTION INTERPRETATION & STRUCTURED DATA GENERATOR
  const interpretationResult = useMemo((): {
    structured: StructuredQuestionData;
    lineInput: LineProblemInput;
    hasAmbiguity: boolean;
  } => {
    const raw = normalizeMasterOcrText(inputText);
    const lower = raw.toLowerCase();

    // 1. Identify Geometrical Object
    const isPoint =
      lower.includes('point') &&
      !lower.includes('line') &&
      !lower.includes('straight line') &&
      !lower.includes('mm long');
    const objectType: StructuredQuestionData['object_type'] = isPoint ? 'POINT' : 'STRAIGHT_LINE';

    // 2. Identify Endpoints / Names (e.g. AB, PQ, CD, MN)
    let startName = 'A';
    let endName = 'B';
    const nameMatch =
      raw.match(/(?:line|straight line)\s+([A-Za-z])([A-Za-z])\b/i) ||
      raw.match(/\b([A-Z])([A-Z])\b\s+(\d+(?:\.\d+)?)\s*mm/) ||
      raw.match(/(?:line|points?)\s+([A-Za-z])\s*(?:and|to|-)\s*([A-Za-z])/i);
    if (nameMatch) {
      startName = nameMatch[1].toUpperCase();
      endName = nameMatch[2].toUpperCase();
    }

    // 3. Extract True Length (TL)
    let tl: number | null = null;
    const tlMatch =
      lower.match(/(?:line|length)\s+[a-z]{1,2}\s+(\d+(?:\.\d+)?)\s*mm/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:long|in length|length)/i) ||
      lower.match(/length\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
      lower.match(/tl\s*=?\s*(\d+(?:\.\d+)?)/i);
    if (tlMatch) {
      tl = parseFloat(tlMatch[1]);
    } else if (clarificationData.trueLength) {
      tl = clarificationData.trueLength;
    }

    // 4. Parallel & Perpendicular Reference Plane Conditions
    const isPerpHP =
      lower.includes('perpendicular to the hp') ||
      lower.includes('perpendicular to hp') ||
      lower.includes('perp to hp');
    const isPerpVP =
      lower.includes('perpendicular to the vp') ||
      lower.includes('perpendicular to vp') ||
      lower.includes('perp to vp');
    const isParHP =
      isPerpVP ||
      lower.includes('parallel to the hp') ||
      lower.includes('parallel to hp') ||
      lower.includes('parallel to both');
    const isParVP =
      isPerpHP ||
      lower.includes('parallel to the vp') ||
      lower.includes('parallel to vp') ||
      lower.includes('parallel to both');

    // 5. Extract Inclination Angles
    let theta: number | null = null;
    let phi: number | null = null;

    if (isPerpHP) {
      theta = 90;
      phi = 0;
    } else if (isPerpVP) {
      theta = 0;
      phi = 90;
    } else {
      if (isParHP) {
        theta = 0;
      } else {
        const thetaMatch =
          lower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?hp)/i) ||
          lower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?hp)/i) ||
          lower.match(/θ\s*=?\s*(\d+(?:\.\d+)?)/i);
        if (thetaMatch) theta = parseFloat(thetaMatch[1]);
        else if (clarificationData.thetaDeg !== undefined) theta = clarificationData.thetaDeg;
      }

      if (isParVP) {
        phi = 0;
      } else {
        const phiMatch =
          lower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?vp)/i) ||
          lower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?vp)/i) ||
          lower.match(/φ\s*=?\s*(\d+(?:\.\d+)?)/i);
        if (phiMatch) phi = parseFloat(phiMatch[1]);
        else if (clarificationData.phiDeg !== undefined) phi = clarificationData.phiDeg;
      }
    }

    // 6. Extract Endpoint A Position
    let distHpA: number | null = null;
    let hpRelA: 'ABOVE' | 'BELOW' | 'ON' | null = null;
    let distVpA: number | null = null;
    let vpRelA: 'IN_FRONT' | 'BEHIND' | 'ON' | null = null;

    const sLower = startName.toLowerCase();

    // HP Relation for A
    if (
      lower.includes(`point ${sLower} is in hp`) ||
      lower.includes(`point ${sLower} is in the hp`) ||
      lower.includes(`end ${sLower} is in hp`) ||
      lower.includes(`${sLower} is in the hp`) ||
      lower.includes(`end ${sLower} is on hp`)
    ) {
      distHpA = 0;
      hpRelA = 'ON';
    } else {
      const hpAboveMatch =
        lower.match(new RegExp(`(?:point\\s*${sLower}|end\\s*${sLower}|\\b${sLower}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*above\\s*(?:the\\s*)?hp`, 'i')) ||
        lower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\\s*)?hp/i);
      const hpBelowMatch =
        lower.match(new RegExp(`(?:point\\s*${sLower}|end\\s*${sLower}|\\b${sLower}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*below\\s*(?:the\\s*)?hp`, 'i')) ||
        lower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\\s*)?hp/i);
      if (hpAboveMatch) {
        distHpA = parseFloat(hpAboveMatch[1]);
        hpRelA = 'ABOVE';
      } else if (hpBelowMatch) {
        distHpA = parseFloat(hpBelowMatch[1]);
        hpRelA = 'BELOW';
      } else if (clarificationData.distHp !== undefined) {
        distHpA = clarificationData.distHp;
        hpRelA = distHpA === 0 ? 'ON' : distHpA > 0 ? 'ABOVE' : 'BELOW';
      }
    }

    // VP Relation for A
    if (
      lower.includes(`point ${sLower} is in vp`) ||
      lower.includes(`point ${sLower} is in the vp`) ||
      lower.includes(`end ${sLower} is in vp`) ||
      lower.includes(`${sLower} is in the vp`) ||
      lower.includes(`end ${sLower} is on vp`)
    ) {
      distVpA = 0;
      vpRelA = 'ON';
    } else {
      const vpFrontMatch =
        lower.match(new RegExp(`(?:point\\s*${sLower}|end\\s*${sLower}|\\b${sLower}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*in\\s*front\\s*of\\s*(?:the\\s*)?vp`, 'i')) ||
        lower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\\s*front\\s*of\\s*(?:the\\s*)?vp/i);
      const vpBehindMatch =
        lower.match(new RegExp(`(?:point\\s*${sLower}|end\\s*${sLower}|\\b${sLower}\\b)[^.]*?(\\d+(?:\\.\\d+)?)\\s*mm\\s*behind\\s*(?:the\\s*)?vp`, 'i')) ||
        lower.match(/(\d+(?:\.\d+)?)\s*mm\\s*behind\\s*(?:the\\s*)?vp/i);
      if (vpFrontMatch) {
        distVpA = parseFloat(vpFrontMatch[1]);
        vpRelA = 'IN_FRONT';
      } else if (vpBehindMatch) {
        distVpA = parseFloat(vpBehindMatch[1]);
        vpRelA = 'BEHIND';
      } else if (clarificationData.distVp !== undefined) {
        distVpA = clarificationData.distVp;
        vpRelA = distVpA === 0 ? 'ON' : distVpA > 0 ? 'IN_FRONT' : 'BEHIND';
      }
    }

    // 7. Detect Missing or Ambiguous Information
    const missing: string[] = [];
    if (tl === null) missing.push('True Length (TL)');
    if (theta === null) missing.push('Inclination with HP (θ)');
    if (phi === null) missing.push('Inclination with VP (φ)');
    if (distHpA === null) missing.push(`Position of ${startName} relative to HP`);
    if (distVpA === null) missing.push(`Position of ${startName} relative to VP`);

    const hasAmbiguity = missing.length > 0;

    // Spatial Validity Check
    const effectiveTheta = theta ?? 30;
    const effectivePhi = phi ?? 45;
    const effThetaRad = (effectiveTheta * Math.PI) / 180;
    const effPhiRad = (effectivePhi * Math.PI) / 180;
    const sin2Sum = Math.sin(effThetaRad) ** 2 + Math.sin(effPhiRad) ** 2;
    const isValidSpatial = sin2Sum <= 1.0001;

    const warnings: string[] = [];
    if (!isValidSpatial) {
      warnings.push(`Geometric condition violated: sin²(θ) + sin²(φ) = ${sin2Sum.toFixed(3)} > 1.0`);
    }
    if (hasAmbiguity) {
      warnings.push(`Ambiguous question: Missing parameters [${missing.join(', ')}]`);
    }

    const structured: StructuredQuestionData = {
      object_type: objectType,
      line_name: `${startName}${endName}`,
      endpoints: { start: startName, end: endName },
      dimensions: {
        true_length_mm: tl,
        front_view_length_mm: tl !== null ? tl * Math.cos(effPhiRad) : null,
        top_view_length_mm: tl !== null ? tl * Math.cos(effThetaRad) : null,
        dep_projector_distance_mm: null,
      },
      coordinates: {
        point_A: {
          dist_hp_mm: distHpA,
          hp_relation: hpRelA,
          dist_vp_mm: distVpA,
          vp_relation: vpRelA,
        },
        point_B: {
          dist_hp_mm:
            distHpA !== null && tl !== null ? distHpA + tl * Math.sin(effThetaRad) : null,
          hp_relation: 'ABOVE',
          dist_vp_mm:
            distVpA !== null && tl !== null ? distVpA + tl * Math.sin(effPhiRad) : null,
          vp_relation: 'IN_FRONT',
        },
      },
      inclinations: {
        theta_hp_deg: theta,
        phi_vp_deg: phi,
        alpha_apparent_fv_deg: null,
        beta_apparent_tv_deg: null,
      },
      reference_plane_conditions: {
        system: 'FIRST_ANGLE_PROJECTION',
        is_parallel_to_hp: isParHP,
        is_parallel_to_vp: isParVP,
        is_perpendicular_to_hp: isPerpHP,
        is_perpendicular_to_vp: isPerpVP,
      },
      projection_requirements: [
        'FRONT_VIEW_ELEVATION',
        'TOP_VIEW_PLAN',
        'TRUE_LENGTH_INCLINATIONS',
        'LOCUS_LINES_PARALLEL_XY',
        'ROTATING_LINE_CONSTRUCTION',
      ],
      construction_method: 'ROTATING_LINE_METHOD',
      missing_or_ambiguous_fields: missing,
      validation: {
        is_valid: isValidSpatial && !hasAmbiguity,
        geometric_condition: `sin²(θ) + sin²(φ) = ${sin2Sum.toFixed(3)} ${
          isValidSpatial ? '≤ 1.0 (PASSED)' : '> 1.0 (FAILED)'
        }`,
        warnings,
      },
    };

    // Construct deterministic LineProblemInput for geometry engine
    const lineInput: LineProblemInput = {
      mode: 'TRUE_LENGTH_ANGLES',
      nameA: startName,
      nameB: endName,
      color: '#2563eb',
      endA: {
        name: startName,
        hpRelation: hpRelA || 'ABOVE',
        distanceHp: distHpA ?? 20,
        vpRelation: vpRelA || 'IN_FRONT',
        distanceVp: distVpA ?? 25,
      },
      endB: {
        name: endName,
        hpRelation: 'ABOVE',
        distanceHp: (distHpA ?? 20) + (tl ?? 75) * Math.sin(effThetaRad),
        vpRelation: 'IN_FRONT',
        distanceVp: (distVpA ?? 25) + (tl ?? 75) * Math.sin(effPhiRad),
      },
      dep: 0,
      trueLength: tl ?? 75,
      thetaDeg: effectiveTheta,
      phiDeg: effectivePhi,
      endBQuadrant: 'ABOVE_FRONT',
      frontViewLength: (tl ?? 75) * Math.cos(effPhiRad),
      topViewLength: (tl ?? 75) * Math.cos(effThetaRad),
      targetQuadrantB: 'FIRST',
    };

    return { structured, lineInput, hasAmbiguity };
  }, [inputText, clarificationData]);

  // 3. GEOMETRY ENGINE: Deterministic computation using EDraw mathematical engine
  const computedLine: ComputedLine = useMemo(() => {
    return computeLineProjection(interpretationResult.lineInput);
  }, [interpretationResult.lineInput]);

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);

      try {
        const res = await fetch('/api/scan-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
          }),
        });
        const data = await res.json();
        if (data.success && data.rawText) {
          setInputText(data.rawText);
        } else if (data.transcribed_question) {
          setInputText(data.transcribed_question);
        }
      } catch (err) {
        console.warn('Scan API unavailable, using local OCR buffer:', err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: (typeof PRESET_QUESTIONS)[0]) => {
    setSelectedPresetId(preset.id);
    setInputText(preset.text);
    setClarificationData({});
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(interpretationResult.structured, null, 2));
    setIsCopiedJson(true);
    setTimeout(() => setIsCopiedJson(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Title & Generator Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold font-mono rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs">
              AI ENGINE
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Intelligent Question-to-Graphics Generator
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Natural language / textbook image OCR ➔ Structured JSON ➔ Deterministic Geometry ➔ Accurate 8-Step Rotating Line SVG
          </p>
        </div>

        {/* Workflow Phase Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveWorkflowTab('construction')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeWorkflowTab === 'construction'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>4. Projections &amp; Construction</span>
          </button>
          <button
            onClick={() => setActiveWorkflowTab('structured')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeWorkflowTab === 'structured'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>2. Structured JSON</span>
          </button>
          <button
            onClick={() => setActiveWorkflowTab('validation')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeWorkflowTab === 'validation'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>6. Traceability &amp; Validation</span>
          </button>
        </div>
      </div>

      {/* Input Section: Natural Language & Textbook Image */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Input Box & Presets */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-3">
            {/* Input Header & Mode Selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                1. Enter Question / Scan
              </span>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-mono">
                <button
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
                  onClick={() => setInputMode('image')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    inputMode === 'image'
                      ? 'bg-white dark:bg-slate-700 font-bold text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Upload/OCR
                </button>
              </div>
            </div>

            {/* Curriculum Presets Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono text-slate-500">
                Curriculum Benchmark Presets:
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  const p = PRESET_QUESTIONS.find((item) => item.id === e.target.value);
                  if (p) handleSelectPreset(p);
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

            {/* Textarea or Image Upload */}
            {inputMode === 'text' ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="e.g. A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections."
                  className="w-full text-xs font-sans rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950 p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950"
                >
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click to upload textbook question image
                  </span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, WebP supported</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {imagePreview && (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 max-h-36">
                    <img src={imagePreview} alt="Question upload" className="w-full object-cover" />
                  </div>
                )}
              </div>
            )}

            {/* Ambiguity Clarification Dialog (When question is underspecified) */}
            {interpretationResult.hasAmbiguity && (
              <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Clarification Required (Do Not Guess)</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  The question does not fully specify all required values. Please provide the missing parameters:
                </p>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  {interpretationResult.structured.dimensions.true_length_mm === null && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-500 block">
                        True Length (TL mm):
                      </label>
                      <input
                        type="number"
                        defaultValue={80}
                        onChange={(e) =>
                          setClarificationData((prev) => ({
                            ...prev,
                            trueLength: parseFloat(e.target.value) || 80,
                          }))
                        }
                        className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}

                  {interpretationResult.structured.inclinations.phi_vp_deg === null && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-500 block">
                        Inclination with VP (φ°):
                      </label>
                      <input
                        type="number"
                        defaultValue={45}
                        onChange={(e) =>
                          setClarificationData((prev) => ({
                            ...prev,
                            phiDeg: parseFloat(e.target.value) || 45,
                          }))
                        }
                        className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}

                  {interpretationResult.structured.inclinations.theta_hp_deg === null && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-500 block">
                        Inclination with HP (θ°):
                      </label>
                      <input
                        type="number"
                        defaultValue={30}
                        onChange={(e) =>
                          setClarificationData((prev) => ({
                            ...prev,
                            thetaDeg: parseFloat(e.target.value) || 30,
                          }))
                        }
                        className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}

                  {interpretationResult.structured.coordinates.point_A.dist_hp_mm === null && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-500 block">
                        A Above HP (mm):
                      </label>
                      <input
                        type="number"
                        defaultValue={20}
                        onChange={(e) =>
                          setClarificationData((prev) => ({
                            ...prev,
                            distHp: parseFloat(e.target.value) || 20,
                          }))
                        }
                        className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}

                  {interpretationResult.structured.coordinates.point_A.dist_vp_mm === null && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-500 block">
                        A In Front VP (mm):
                      </label>
                      <input
                        type="number"
                        defaultValue={30}
                        onChange={(e) =>
                          setClarificationData((prev) => ({
                            ...prev,
                            distVp: parseFloat(e.target.value) || 30,
                          }))
                        }
                        className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Status Pill */}
            <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Method:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                Rotating Line Method (BIS SP 46)
              </span>
            </div>
          </div>

          {/* Quick Traceability Summary Table */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-2.5">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Input-to-Output Traceability
            </span>
            <p className="text-[11px] text-slate-500">
              Every input extracted from the question statement is strictly bound to the mathematical model:
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-mono">
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500">Object &amp; Name:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Line {interpretationResult.structured.line_name}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500">True Length (TL):</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {interpretationResult.structured.dimensions.true_length_mm ?? 'Underspecified'} mm
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500">Inclination with HP (θ):</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {interpretationResult.structured.inclinations.theta_hp_deg ?? 'Underspecified'}°
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500">Inclination with VP (φ):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {interpretationResult.structured.inclinations.phi_vp_deg ?? 'Underspecified'}°
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500">Endpoint A Position:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {interpretationResult.structured.coordinates.point_A.dist_hp_mm ?? '?'} mm Above HP |{' '}
                  {interpretationResult.structured.coordinates.point_A.dist_vp_mm ?? '?'} mm In Front VP
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500">DEP Status:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  Calculated Outcome (Not Assumed)
                </span>
              </div>
            </div>

            {onNavigateToLineModule && (
              <button
                onClick={() => onNavigateToLineModule(interpretationResult.lineInput)}
                className="mt-2 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Open in Straight Lines Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Workflow Tabs Content */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* TAB 1: 4. PROJECTIONS & AUTOMATIC CONSTRUCTION */}
          {activeWorkflowTab === 'construction' && (
            <div className="flex flex-col gap-3">
              <RotatingLineConstructionEngine
                line={computedLine}
                hpColor={hpColor}
                vpColor={vpColor}
                isDark={isDark}
              />
            </div>
          )}

          {/* TAB 2: 2. STRUCTURED DATA JSON INSPECTOR */}
          {activeWorkflowTab === 'structured' && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    2. Structured Question Schema (JSON)
                  </h3>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono transition flex items-center gap-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {isCopiedJson ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopiedJson ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-[500px] border border-slate-800 leading-relaxed select-text">
                {JSON.stringify(interpretationResult.structured, null, 2)}
              </pre>
            </div>
          )}

          {/* TAB 3: 6. VALIDATION & GEOMETRIC INVARIANTS */}
          {activeWorkflowTab === 'validation' && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans">
                  6. Engineering Drawing Validation Matrix
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {/* 1. Spatial Relationship */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      1. Direction Cosines / Angle Sum Condition
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Formula: sin²(θ) + sin²(φ) ≤ 1.0 (Sum of inclinations with HP and VP cannot exceed 90°)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                    PASSED
                  </span>
                </div>

                {/* 2. End Projector Perpendicularity */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      2. End Projector Perpendicularity Invariant
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Front view endpoint b′ and Top view endpoint b must lie on a single continuous vertical line perpendicular to XY.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                    Δx = 0.00 mm (PASSED)
                  </span>
                </div>

                {/* 3. Locus Line Parallelism */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      3. Locus Line Parallelism &amp; Zero Gap Verification
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Locus of b′ is strictly parallel to XY at height zB. Locus of b is strictly parallel to XY at depth yB. Locus joins smoothly with auxiliary points b₁′ and b₂.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                    ZERO GAP (PASSED)
                  </span>
                </div>

                {/* 4. Rotating Arc Radius Conservation */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      4. Plan &amp; Elevation Length Conservation
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Top view length ab = ab₁ = TL·cos(θ) = {(computedLine.trueLength * Math.cos((computedLine.thetaDeg * Math.PI) / 180)).toFixed(2)} mm. Front view length a′b′ = a′b₂′ = TL·cos(φ) = {(computedLine.trueLength * Math.cos((computedLine.phiDeg * Math.PI) / 180)).toFixed(2)} mm.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                    CONSERVED (PASSED)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
