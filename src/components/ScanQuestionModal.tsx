/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Camera,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  BookOpen,
  Zap,
  Loader2,
  Image as ImageIcon,
  Check,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { PointInput, HpRelation, VpRelation } from '../types/projection';
import { LineProblemInput, TargetQuadrantB, LineInputMode } from '../types/lines';
import {
  parseTextToNormalizedModel,
  solveNormalizedModel,
  normalizeMasterOcrText,
} from '../utils/straightLineMasterSolver';
import {
  NormalizedConstraintModel,
  MasterValidationStatus,
} from '../types/masterLines';

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

export interface ParsedPointResult {
  type: 'POINT';
  name: string;
  hpRelation: HpRelation;
  distanceHp: number;
  vpRelation: VpRelation;
  distanceVp: number;
  isHidden: boolean;
  explanation?: string;
}

export interface ParsedLineResult {
  type: 'LINE';
  nameA: string;
  nameB: string;
  trueLength: number;
  thetaDeg: number;
  phiDeg: number;
  orientation?: string;
  endA: {
    name?: string;
    hpRelation: HpRelation;
    distanceHp: number;
    vpRelation: VpRelation;
    distanceVp: number;
  };
  endB?: {
    name?: string;
    hpRelation: HpRelation;
    distanceHp: number;
    vpRelation: VpRelation;
    distanceVp: number;
  };
  mode: LineInputMode;
  frontViewLength?: number;
  topViewLength?: number;
  dep?: number;
  targetQuadrantB?: TargetQuadrantB;
  hiddenA?: boolean;
  hiddenB?: boolean;
  topViewLabel?: string;
  frontViewLabelA?: string;
  frontViewLabelB?: string;
  explanation?: string;
}

export type ParsedQuestionResult = ParsedPointResult | ParsedLineResult;

interface ScanQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPoint: (point: PointInput) => void;
  onApplyLine: (lineInput: LineProblemInput) => void;
  isDark?: boolean;
  initialTopic?: 'points' | 'lines';
}

const SAMPLE_TEXTBOOK_QUESTIONS = [
  {
    title: 'Perpendicular to HP and Parallel to VP (Classroom Problem)',
    topic: 'lines' as const,
    text: 'A Line AB 25mm is parallel to the VP and perpendicular to the HP. Point A is 35mm above the HP and 20mm in front of the VP. B is 10 mm above the HP. Draw its projections.',
  },
  {
    title: 'Parallel to HP and Inclined to VP (Standard Heading)',
    topic: 'lines' as const,
    text: 'A Line PQ 70mm long is parallel to the HP and inclined at 30° to the VP. Point P is 25mm above the HP and 20mm in front of the VP. Draw its projections.',
  },
  {
    title: 'Parallel to VP and Inclined to HP',
    topic: 'lines' as const,
    text: 'A line CD 80 mm long is parallel to the VP and inclined at 45° to the HP. End C is in the HP and 30 mm in front of the VP. Draw its front view and top view.',
  },
  {
    title: 'Line Inclined to Both Planes (N.D. Bhatt Classic)',
    topic: 'lines' as const,
    text: 'A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections.',
  },
  {
    title: 'Line Parallel to Both Planes',
    topic: 'lines' as const,
    text: 'A straight line EF 75 mm long is parallel to both HP and VP. It is 30 mm above HP and 40 mm in front of VP. Draw its projections.',
  },
  {
    title: 'Point in 1st Quadrant (Classic)',
    topic: 'points' as const,
    text: 'A point A is 30 mm above HP and 40 mm in front of VP. Draw its orthographic projections and state its quadrant.',
  },
  {
    title: 'Point on HP, Behind VP (Boundary Condition)',
    topic: 'points' as const,
    text: 'A point B is in the HP and 35 mm behind the VP. Draw its front and top views.',
  },
  {
    title: 'Point on Both Planes (Ground Line)',
    topic: 'points' as const,
    text: 'A point P lies in both HP and VP. Determine the position of its projections with respect to XY line.',
  },
];

export const ScanQuestionModal: React.FC<ScanQuestionModalProps> = ({
  isOpen,
  onClose,
  onApplyPoint,
  onApplyLine,
  isDark = false,
  initialTopic = 'lines',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'text' | 'samples'>('upload');
  const [questionText, setQuestionText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedQuestionResult | null>(null);
  const [normalizedModel, setNormalizedModel] = useState<NormalizedConstraintModel | null>(null);
  const [extractedSchema, setExtractedSchema] = useState<ExtractedQuestionSchema | null>(null);
  const [appliedNotification, setAppliedNotification] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [ocrEngine, setOcrEngine] = useState<string>('');

  // Camera state & graceful fallback
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!isOpen) return null;

  /**
   * Deterministic Master Solver parser connecting directly to straightLineMasterSolver
   */
  const parseWithMasterSolver = (
    text: string,
    source: 'CLIPBOARD' | 'OCR' | 'SAMPLE' = 'CLIPBOARD'
  ) => {
    const cleanText = normalizeMasterOcrText(text.trim());
    if (!cleanText || cleanText.length < 6) {
      setParsedResult(null);
      setNormalizedModel(null);
      setExtractedSchema(null);
      return;
    }

    const model = parseTextToNormalizedModel(cleanText, source);
    const solution = solveNormalizedModel(model);
    setNormalizedModel(model);

    if (solution.candidate_solutions && solution.candidate_solutions.length > 0) {
      const cand = solution.candidate_solutions[0];
      const parsed: ParsedLineResult = {
        type: 'LINE',
        nameA: cand.nameA,
        nameB: cand.nameB,
        trueLength: cand.trueLength,
        thetaDeg: cand.thetaDeg,
        phiDeg: cand.phiDeg,
        orientation: cand.orientation,
        endA: {
          name: cand.nameA,
          hpRelation: cand.input.endA.hpRelation,
          distanceHp: cand.input.endA.distanceHp,
          vpRelation: cand.input.endA.vpRelation,
          distanceVp: cand.input.endA.distanceVp,
        },
        endB: {
          name: cand.nameB,
          hpRelation: cand.input.endB.hpRelation,
          distanceHp: cand.input.endB.distanceHp,
          vpRelation: cand.input.endB.vpRelation,
          distanceVp: cand.input.endB.distanceVp,
        },
        mode: cand.input.mode,
        dep: cand.dep,
        frontViewLength: cand.frontViewLength,
        topViewLength: cand.topViewLength,
        explanation: cand.orientationDesc,
      };
      setParsedResult(parsed);
      setOcrEngine(source === 'SAMPLE' ? 'textbook-dataset' : 'master-geometry-solver');
    } else {
      setParsedResult(null);
    }
  };

  /**
   * Process image via server-side Gemini 3.8 Flash OCR and Tesseract engine
   */
  const processImageOcr = async (dataUrl: string, mimeType = 'image/jpeg') => {
    setIsScanning(true);
    setScanError(null);
    setParsedResult(null);
    setNormalizedModel(null);
    setExtractedSchema(null);

    try {
      const res = await fetch('/api/scan-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        const text = data.rawText || '';
        setQuestionText(text);

        const model = data.normalizedModel || parseTextToNormalizedModel(text, 'OCR');
        const solution = data.solution || solveNormalizedModel(model);
        setNormalizedModel(model);

        if (solution.candidate_solutions && solution.candidate_solutions.length > 0) {
          const cand = solution.candidate_solutions[0];
          setParsedResult({
            type: 'LINE',
            nameA: cand.nameA,
            nameB: cand.nameB,
            trueLength: cand.trueLength,
            thetaDeg: cand.thetaDeg,
            phiDeg: cand.phiDeg,
            orientation: cand.orientation,
            endA: {
              name: cand.nameA,
              hpRelation: cand.input.endA.hpRelation,
              distanceHp: cand.input.endA.distanceHp,
              vpRelation: cand.input.endA.vpRelation,
              distanceVp: cand.input.endA.distanceVp,
            },
            endB: {
              name: cand.nameB,
              hpRelation: cand.input.endB.hpRelation,
              distanceHp: cand.input.endB.distanceHp,
              vpRelation: cand.input.endB.vpRelation,
              distanceVp: cand.input.endB.distanceVp,
            },
            mode: cand.input.mode,
            dep: cand.dep,
            frontViewLength: cand.frontViewLength,
            topViewLength: cand.topViewLength,
            explanation: cand.orientationDesc,
          });
        }
        if (data.extractedSchema) {
          setExtractedSchema(data.extractedSchema);
        }
        setOcrEngine(data.source || 'gemini-3.8-flash');
      } else {
        throw new Error(data.error || 'Failed to extract drawing values');
      }
    } catch (err: any) {
      console.warn('Server OCR error:', err);
      if (questionText && questionText.trim().length > 5) {
        parseWithMasterSolver(questionText, 'OCR');
      } else {
        setScanError(
          err.message || 'Unable to recognize text from this photo. Please try uploading a sharper image or type the question directly.'
        );
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous question state completely so no stale values display
    setQuestionText('');
    setParsedResult(null);
    setNormalizedModel(null);
    setExtractedSchema(null);
    setScanError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedImage(dataUrl);
      processImageOcr(dataUrl, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  // Safe Camera Start Handler with Permission Handling
  const startCamera = async () => {
    setCameraPermissionError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraPermissionError('Camera is not directly supported in this browser window. Please upload a photo or use the system camera file picker below.');
        setIsCameraActive(false);
        return;
      }

      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err?.message || err);
      setIsCameraActive(false);
      setCameraPermissionError(
        'Camera permission was not granted by your browser or is restricted in this frame. You can snap a photo with your device camera using the button below or upload an image.'
      );
    }
  };



  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Reset old state immediately
    setQuestionText('');
    setParsedResult(null);
    setNormalizedModel(null);
    setExtractedSchema(null);
    setScanError(null);

    setSelectedImage(dataUrl);
    stopCamera();
    setActiveTab('upload');
    processImageOcr(dataUrl, 'image/jpeg');
  };

  const handleTextChange = (val: string) => {
    setQuestionText(val);
    setAppliedNotification(false);
    parseWithMasterSolver(val, 'CLIPBOARD');
  };

  const handleSelectSample = (sample: typeof SAMPLE_TEXTBOOK_QUESTIONS[0]) => {
    setQuestionText(sample.text);
    parseWithMasterSolver(sample.text, 'SAMPLE');
    setActiveTab('text');
  };

  const handleApply = () => {
    if (normalizedModel) {
      const solution = solveNormalizedModel(normalizedModel);
      if (solution.candidate_solutions && solution.candidate_solutions.length > 0) {
        onApplyLine(solution.candidate_solutions[0].input);
        setAppliedNotification(true);
        setTimeout(() => {
          stopCamera();
          onClose();
        }, 600);
        return;
      }
    }

    if (!parsedResult) return;

    if (parsedResult.type === 'POINT') {
      const pointInput: PointInput = {
        id: `scanned-${Date.now()}`,
        name: parsedResult.name,
        color: '#2563eb',
        hpRelation: parsedResult.hpRelation,
        distanceHp: parsedResult.distanceHp,
        vpRelation: parsedResult.vpRelation,
        distanceVp: parsedResult.distanceVp,
        x: 0,
        showOptionalX: false,
        isHidden: parsedResult.isHidden,
      };
      onApplyPoint(pointInput);
    } else {
      const lineInput: LineProblemInput = {
        mode: parsedResult.mode,
        nameA: parsedResult.nameA,
        nameB: parsedResult.nameB,
        color: '#2563eb',
        trueLength: parsedResult.trueLength,
        thetaDeg: parsedResult.thetaDeg,
        phiDeg: parsedResult.phiDeg,
        endA: {
          name: parsedResult.nameA,
          hpRelation: parsedResult.endA.hpRelation,
          distanceHp: parsedResult.endA.distanceHp,
          vpRelation: parsedResult.endA.vpRelation,
          distanceVp: parsedResult.endA.distanceVp,
        },
        endB: parsedResult.endB
          ? {
              name: parsedResult.nameB,
              hpRelation: parsedResult.endB.hpRelation,
              distanceHp: parsedResult.endB.distanceHp,
              vpRelation: parsedResult.endB.vpRelation,
              distanceVp: parsedResult.endB.distanceVp,
            }
          : {
              name: parsedResult.nameB,
              hpRelation: 'ABOVE',
              distanceHp:
                parsedResult.orientation === 'PERPENDICULAR_HP'
                  ? parsedResult.endA.distanceHp + parsedResult.trueLength
                  : parsedResult.endA.distanceHp,
              vpRelation: 'IN_FRONT',
              distanceVp: parsedResult.endA.distanceVp,
            },
        dep: parsedResult.dep !== undefined ? parsedResult.dep : 0,
        frontViewLength: parsedResult.frontViewLength ?? parsedResult.trueLength,
        topViewLength: parsedResult.topViewLength ?? (parsedResult.orientation === 'PERPENDICULAR_HP' ? 0 : parsedResult.trueLength),
        targetQuadrantB: 'FIRST',
        endBQuadrant: 'ABOVE_FRONT',
        hiddenA: parsedResult.hiddenA,
        hiddenB: parsedResult.hiddenB,
      };
      onApplyLine(lineInput);
    }

    setAppliedNotification(true);
    setTimeout(() => {
      stopCamera();
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Engineering Graphics Problem Parser
                </h3>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                  First-Angle Orthographic
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Accurately extract True Length, inclinations, and end positions without hallucinated defaults
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-xs">
          <button
            onClick={() => {
              stopCamera();
              setActiveTab('upload');
            }}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('camera');
              startCamera();
            }}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'camera'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveTab('text');
            }}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Type / Edit Text</span>
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveTab('samples');
            }}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'samples'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Curated Problems</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          {/* Tab: Upload Photo */}
          {activeTab === 'upload' && (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition bg-slate-50/50 dark:bg-slate-800/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    Upload physical paper photo, textbook page, or screenshot
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports JPG, PNG, WEBP, or device photo capture
                  </p>
                </div>
              </div>

              {selectedImage && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <img
                    src={selectedImage}
                    alt="Uploaded question"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        OCR Problem Statement:
                      </span>
                      {ocrEngine && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {ocrEngine}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {questionText || 'Analyzing image with Gemini 3.8 Flash...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Live Camera */}
          {activeTab === 'camera' && (
            <div className="flex flex-col gap-3">
              {cameraPermissionError ? (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 flex flex-col gap-3 text-slate-800 dark:text-slate-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-xs block text-amber-900 dark:text-amber-300">
                        Direct Camera Access Restricted
                      </span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5 leading-relaxed">
                        {cameraPermissionError}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="file"
                      ref={nativeCameraInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />
                    <button
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Photo with Device Camera</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Upload File Instead
                    </button>
                    <button
                      onClick={startCamera}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Retry Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
                    <button
                      onClick={capturePhoto}
                      className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 shadow-lg cursor-pointer text-xs"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap Question Photo</span>
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-3 py-2 rounded-full bg-slate-800/80 text-white text-xs hover:bg-slate-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Type / Edit Text */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Engineering Problem Statement:</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Heading, problem text, angles, and constraints
                </span>
              </label>
              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="e.g. A Line PQ 70mm long is parallel to the HP and inclined at 30° to the VP. Point P is 25mm above the HP and 20mm in front of the VP. Draw its projections."
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
              />
            </div>
          )}

          {/* Tab: Curated Problems */}
          {activeTab === 'samples' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_TEXTBOOK_QUESTIONS.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSample(sample)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-blue-500 cursor-pointer transition flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs line-clamp-1">
                      {sample.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                        sample.topic === 'points'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {sample.topic.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {sample.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Scanning Progress */}
          {isScanning && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <div>
                <span className="font-bold text-blue-900 dark:text-blue-300 text-xs">
                  Running Multimodal OCR &amp; First-Angle Geometric Parser...
                </span>
                <p className="text-[11px] text-blue-700 dark:text-blue-400">
                  Ignoring solution steps; extracting true length, angles, and plane constraints.
                </p>
              </div>
            </div>
          )}

          {/* Parsed Result Breakdown */}
          {parsedResult && !isScanning && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 text-xs">
                    {normalizedModel?.categoryTitle
                      ? `${normalizedModel.category.replace(/_/g, ' ')}: ${normalizedModel.categoryTitle}`
                      : parsedResult.type === 'POINT'
                      ? `Point ${parsedResult.name}`
                      : `Line ${parsedResult.nameA}${parsedResult.nameB} (${parsedResult.orientation || 'Standard'})`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {normalizedModel && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        normalizedModel.validation_status === 'VALID'
                          ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200'
                          : normalizedModel.validation_status === 'INCONSISTENT_CONSTRAINTS'
                          ? 'bg-red-200 text-red-900 dark:bg-red-900/80 dark:text-red-200'
                          : normalizedModel.validation_status === 'UNDERDETERMINED'
                          ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200'
                          : 'bg-purple-200 text-purple-900 dark:bg-purple-900/80 dark:text-purple-200'
                      }`}
                    >
                      {normalizedModel.validation_status}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                    {ocrEngine || 'master-solver'}
                  </span>
                </div>
              </div>

              {/* Validation Warnings / Contradictions */}
              {normalizedModel && normalizedModel.validation_messages.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex flex-col gap-1 text-[11px] text-amber-900 dark:text-amber-300">
                  {normalizedModel.validation_messages.map((msg, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {parsedResult.type === 'POINT' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Elevation relative to HP</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {parsedResult.distanceHp} mm {parsedResult.hpRelation}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Plan relative to VP</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {parsedResult.distanceVp} mm {parsedResult.vpRelation}
                    </span>
                  </div>
                </div>
              )}

              {parsedResult.type === 'LINE' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-[10px] text-slate-400 block">Line &amp; True Length</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {parsedResult.nameA}{parsedResult.nameB} = {parsedResult.trueLength} mm
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-[10px] text-slate-400 block">True Inclinations</span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        θ (HP) = {parsedResult.thetaDeg}°, φ (VP) = {parsedResult.phiDeg}°
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-[10px] text-slate-400 block">Start Point {parsedResult.nameA}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {parsedResult.endA.distanceHp}mm {parsedResult.endA.hpRelation}, {parsedResult.endA.distanceVp}mm {parsedResult.endA.vpRelation}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-[10px] text-slate-400 block">End Point {parsedResult.nameB}</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {parsedResult.endB?.distanceHp}mm {parsedResult.endB?.hpRelation}, {parsedResult.endB?.distanceVp}mm {parsedResult.endB?.vpRelation}
                      </span>
                    </div>
                  </div>

                  {/* Exact Extracted Schema Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                    {parsedResult.orientation === 'PERPENDICULAR_HP' && (
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        Perpendicular to HP • θ = 90°
                      </span>
                    )}
                    {parsedResult.orientation === 'PERPENDICULAR_VP' && (
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        Perpendicular to VP • φ = 90°
                      </span>
                    )}
                    {parsedResult.frontViewLength !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Elevation: {parsedResult.frontViewLength} mm
                      </span>
                    )}
                    {parsedResult.topViewLength !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Plan: {parsedResult.topViewLength} mm
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      DEP: {parsedResult.dep !== undefined ? `${parsedResult.dep} mm` : '0 mm'}
                    </span>
                  </div>
                </>
              )}

              {parsedResult.explanation && (
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 font-mono bg-white/60 dark:bg-slate-900/60 p-2 rounded border border-emerald-200/50 dark:border-emerald-900/40 leading-relaxed">
                  💡 {parsedResult.explanation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            First-Angle Projection • BIS SP 46:2003
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!parsedResult || isScanning}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {appliedNotification ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Applied &amp; Plotted!</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Apply &amp; Plot Solution ➔</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
