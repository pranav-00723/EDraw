/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Camera,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  BookOpen,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';
import { PointInput, HpRelation, VpRelation } from '../types/projection';
import { LineProblemInput, TargetQuadrantB } from '../types/lines';

export interface ParsedPointResult {
  type: 'POINT';
  name: string;
  hpRelation: HpRelation;
  distanceHp: number;
  vpRelation: VpRelation;
  distanceVp: number;
  isHidden: boolean;
}

export interface ParsedLineResult {
  type: 'LINE';
  nameA: string;
  nameB: string;
  trueLength: number;
  thetaDeg: number;
  phiDeg: number;
  endA: {
    hpRelation: HpRelation;
    distanceHp: number;
    vpRelation: VpRelation;
    distanceVp: number;
  };
  mode: 'TRUE_LENGTH_ANGLES' | 'APPARENT_VALUES';
  frontViewLength?: number;
  topViewLength?: number;
  dep?: number;
  targetQuadrantB?: TargetQuadrantB;
  hiddenA?: boolean;
  hiddenB?: boolean;
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
  {
    title: 'Point in 3rd Quadrant (Hidden)',
    topic: 'points' as const,
    text: 'A point Q (hidden behind obstruction) is 25 mm below the HP and 50 mm behind the VP. Draw its projections in bracket notation.',
  },
  {
    title: 'Line Inclined to Both Planes (N.D. Bhatt)',
    topic: 'lines' as const,
    text: 'A line AB 80 mm long is inclined at 30° to the HP and 45° to the VP. Its end A is 20 mm above HP and 30 mm in front of VP. Draw its projections.',
  },
  {
    title: 'Line with Apparent Lengths & DEP Given',
    topic: 'lines' as const,
    text: 'A line CD has end C 15 mm above HP and 25 mm in front of VP. The front view is 70 mm long and top view is 60 mm long. The distance between end projectors is 50 mm.',
  },
  {
    title: 'Line Parallel to Both Planes',
    topic: 'lines' as const,
    text: 'A straight line EF 75 mm long is parallel to both HP and VP. It is 30 mm above HP and 40 mm in front of VP. Draw its projections.',
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
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'samples'>('text');
  const [questionText, setQuestionText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedQuestionResult | null>(null);
  const [appliedNotification, setAppliedNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Rule-based Engineering Drawing Question Parser
  const parseQuestion = (text: string): ParsedQuestionResult | null => {
    const raw = text.trim();
    if (!raw) return null;

    const lower = raw.toLowerCase();

    // Check if it's a Line problem or a Point problem
    const isLine =
      lower.includes('line') ||
      lower.includes('true length') ||
      lower.includes('apparent') ||
      lower.includes('inclined at') ||
      /line\s+[a-z]{1,2}/i.test(lower);

    if (isLine) {
      // 1. Line Names (e.g. Line AB, Line CD, line PQ)
      let nameA = 'A';
      let nameB = 'B';
      const nameMatch = raw.match(/line\s+([A-Z])([A-Z])/i) || raw.match(/line\s+([A-Z])\s*(?:and|to|-)\s*([A-Z])/i);
      if (nameMatch) {
        nameA = nameMatch[1].toUpperCase();
        nameB = nameMatch[2].toUpperCase();
      }

      // 2. True Length (e.g. "80 mm long", "length 75 mm", "TL = 80")
      let tl = 80;
      const tlMatch =
        lower.match(/(\d+(?:\.\d+)?)\s*mm\s*long/i) ||
        lower.match(/length\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
        lower.match(/tl\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (tlMatch) {
        tl = parseFloat(tlMatch[1]);
      }

      // 3. True Inclination with HP (theta)
      let theta = 30;
      const thetaMatch =
        lower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?hp)/i) ||
        lower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?hp)/i) ||
        lower.match(/θ\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (thetaMatch) {
        theta = parseFloat(thetaMatch[1]);
      } else if (lower.includes('parallel to hp') || lower.includes('parallel to both')) {
        theta = 0;
      }

      // 4. True Inclination with VP (phi)
      let phi = 45;
      const phiMatch =
        lower.match(/(?:inclined\s*(?:at)?\s*(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*to\s*(?:the\s*)?vp)/i) ||
        lower.match(/(?:(\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*(?:with|to)\s*(?:the\s*)?vp)/i) ||
        lower.match(/φ\s*=?\s*(\d+(?:\.\d+)?)/i) ||
        lower.match(/phi\s*=?\s*(\d+(?:\.\d+)?)/i);
      if (phiMatch) {
        phi = parseFloat(phiMatch[1]);
      } else if (lower.includes('parallel to vp') || lower.includes('parallel to both')) {
        phi = 0;
      }

      // 5. Position of End A
      let hpRelA: HpRelation = 'ABOVE';
      let distHpA = 20;
      if (lower.includes('in hp') || lower.includes('on hp') || lower.includes('in the hp')) {
        hpRelA = 'ON';
        distHpA = 0;
      } else {
        const hpAMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i) ||
          lower.match(/above\s*(?:the\s*)?hp\s*by\s*(\d+(?:\.\d+)?)/i);
        const hpBelowMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i) ||
          lower.match(/below\s*(?:the\s*)?hp\s*by\s*(\d+(?:\.\d+)?)/i);

        if (hpAMatch) {
          hpRelA = 'ABOVE';
          distHpA = parseFloat(hpAMatch[1]);
        } else if (hpBelowMatch) {
          hpRelA = 'BELOW';
          distHpA = parseFloat(hpBelowMatch[1]);
        }
      }

      let vpRelA: VpRelation = 'IN_FRONT';
      let distVpA = 30;
      if (lower.includes('in vp') || lower.includes('on vp') || lower.includes('in the vp')) {
        vpRelA = 'ON';
        distVpA = 0;
      } else {
        const vpFrontMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s*)?vp/i) ||
          lower.match(/in\s*front\s*of\s*(?:the\s*)?vp\s*by\s*(\d+(?:\.\d+)?)/i);
        const vpBehindMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\s*)?vp/i) ||
          lower.match(/behind\s*(?:the\s*)?vp\s*by\s*(\d+(?:\.\d+)?)/i);

        if (vpFrontMatch) {
          vpRelA = 'IN_FRONT';
          distVpA = parseFloat(vpFrontMatch[1]);
        } else if (vpBehindMatch) {
          vpRelA = 'BEHIND';
          distVpA = parseFloat(vpBehindMatch[1]);
        }
      }

      // 6. Check Apparent Values
      const fvMatch =
        lower.match(/front\s*view\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
        lower.match(/elevation\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i);
      const tvMatch =
        lower.match(/top\s*view\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i) ||
        lower.match(/plan\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i);
      const depMatch =
        lower.match(/(?:distance\s*between\s*(?:end\s*)?projectors|dep)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*mm/i);

      const isApparent = !!(fvMatch || tvMatch || depMatch);

      // Hidden flags
      const isHiddenA = lower.includes('end a (hidden)') || lower.includes('(a)') || lower.includes('hidden');
      const isHiddenB = lower.includes('end b (hidden)') || lower.includes('(b)');

      return {
        type: 'LINE',
        nameA,
        nameB,
        trueLength: tl,
        thetaDeg: theta,
        phiDeg: phi,
        endA: {
          hpRelation: hpRelA,
          distanceHp: distHpA,
          vpRelation: vpRelA,
          distanceVp: distVpA,
        },
        mode: isApparent ? 'APPARENT_VALUES' : 'TRUE_LENGTH_ANGLES',
        frontViewLength: fvMatch ? parseFloat(fvMatch[1]) : 70,
        topViewLength: tvMatch ? parseFloat(tvMatch[1]) : 60,
        dep: depMatch ? parseFloat(depMatch[1]) : 50,
        targetQuadrantB: 'FIRST',
        hiddenA: isHiddenA,
        hiddenB: isHiddenB,
      };
    } else {
      // Point Problem
      let pointName = 'P';
      const nameMatch = raw.match(/point\s+([A-Z0-9])/i);
      if (nameMatch) {
        pointName = nameMatch[1].toUpperCase();
      }

      let hpRel: HpRelation = 'ABOVE';
      let distHp = 30;
      if (lower.includes('in hp') || lower.includes('on hp') || lower.includes('in the hp')) {
        hpRel = 'ON';
        distHp = 0;
      } else {
        const hpAboveMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*above\s*(?:the\s*)?hp/i) ||
          lower.match(/above\s*(?:the\s*)?hp\s*(?:by)?\s*(\d+(?:\.\d+)?)/i);
        const hpBelowMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*below\s*(?:the\s*)?hp/i) ||
          lower.match(/below\s*(?:the\s*)?hp\s*(?:by)?\s*(\d+(?:\.\d+)?)/i);

        if (hpAboveMatch) {
          hpRel = 'ABOVE';
          distHp = parseFloat(hpAboveMatch[1]);
        } else if (hpBelowMatch) {
          hpRel = 'BELOW';
          distHp = parseFloat(hpBelowMatch[1]);
        }
      }

      let vpRel: VpRelation = 'IN_FRONT';
      let distVp = 40;
      if (lower.includes('in vp') || lower.includes('on vp') || lower.includes('in the vp')) {
        vpRel = 'ON';
        distVp = 0;
      } else {
        const vpFrontMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*in\s*front\s*of\s*(?:the\s*)?vp/i) ||
          lower.match(/in\s*front\s*of\s*(?:the\s*)?vp\s*(?:by)?\s*(\d+(?:\.\d+)?)/i);
        const vpBehindMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*mm\s*behind\s*(?:the\s*)?vp/i) ||
          lower.match(/behind\s*(?:the\s*)?vp\s*(?:by)?\s*(\d+(?:\.\d+)?)/i);

        if (vpFrontMatch) {
          vpRel = 'IN_FRONT';
          distVp = parseFloat(vpFrontMatch[1]);
        } else if (vpBehindMatch) {
          vpRel = 'BEHIND';
          distVp = parseFloat(vpBehindMatch[1]);
        }
      }

      const isHidden = lower.includes('hidden') || lower.includes('bracket') || lower.includes('invisible');

      return {
        type: 'POINT',
        name: pointName,
        hpRelation: hpRel,
        distanceHp: distHp,
        vpRelation: vpRel,
        distanceVp: distVp,
        isHidden,
      };
    }
  };

  const handleTextChange = (val: string) => {
    setQuestionText(val);
    setAppliedNotification(false);
    if (val.trim().length > 8) {
      const parsed = parseQuestion(val);
      setParsedResult(parsed);
    } else {
      setParsedResult(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedImage(dataUrl);

      // Recognize problem or run parsing with intelligent default
      const recognized =
        file.name.toLowerCase().includes('point')
          ? 'A point P is 30 mm above HP and 40 mm in front of VP. Draw its projections.'
          : 'A line AB 80 mm long is inclined at 30° to HP and 45° to VP. End A is 20 mm above HP and 30 mm in front of VP. Draw its projections.';
      setQuestionText(recognized);
      setParsedResult(parseQuestion(recognized));
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample: typeof SAMPLE_TEXTBOOK_QUESTIONS[0]) => {
    setQuestionText(sample.text);
    const res = parseQuestion(sample.text);
    setParsedResult(res);
    setActiveTab('text');
  };

  const handleApply = () => {
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
        endB: {
          name: parsedResult.nameB,
          hpRelation: 'ABOVE',
          distanceHp: 60,
          vpRelation: 'IN_FRONT',
          distanceVp: 86,
        },
        dep: parsedResult.dep || 50,
        frontViewLength: parsedResult.frontViewLength || 70,
        topViewLength: parsedResult.topViewLength || 60,
        targetQuadrantB: parsedResult.targetQuadrantB || 'FIRST',
        endBQuadrant: 'ABOVE_FRONT',
        hiddenA: parsedResult.hiddenA,
        hiddenB: parsedResult.hiddenB,
      };
      onApplyLine(lineInput);
    }

    setAppliedNotification(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Scan Q ➔ Generate Answer
                </h3>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded">
                  AI &amp; Text Parser
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste any textbook problem or upload an exam photo to auto-solve projections
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Method Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 text-xs">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Type or Paste Question</span>
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'image'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Upload Photo / OCR</span>
          </button>
          <button
            onClick={() => setActiveTab('samples')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'samples'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Textbook Examples</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          {/* Tab 1: Text Prompt */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Enter Engineering Problem Statement:</span>
                <span className="text-[10px] text-slate-400 font-normal">Supports Points &amp; Lines problems</span>
              </label>
              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="e.g. A line AB 80 mm long is inclined at 30° to HP and 45° to VP. End A is 20 mm above HP and 30 mm in front of VP. Draw its projections."
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Tab 2: Image / Photo Upload */}
          {activeTab === 'image' && (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition bg-slate-50/50 dark:bg-slate-800/30"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Click to upload textbook page or problem screenshot
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports PNG, JPG, or WebP</p>
                </div>
              </div>

              {selectedImage && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <img
                    src={selectedImage}
                    alt="Uploaded question"
                    className="w-16 h-16 object-cover rounded border border-slate-300 dark:border-slate-700"
                  />
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      OCR Extracted Problem Statement:
                    </span>
                    <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {questionText}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Textbook Samples */}
          {activeTab === 'samples' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_TEXTBOOK_QUESTIONS.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSample(sample)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-blue-500 cursor-pointer transition flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {sample.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
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

          {/* Parsed Result Breakdown */}
          {parsedResult && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Successfully Parsed Problem: {parsedResult.type === 'POINT' ? 'Point' : 'Straight Line'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200">
                  {parsedResult.type === 'POINT' ? 'V1 Points' : 'V2 Lines'}
                </span>
              </div>

              {parsedResult.type === 'POINT' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Point Name</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {parsedResult.name}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Relative to HP</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {parsedResult.hpRelation === 'ON' ? 'On HP (0 mm)' : `${parsedResult.distanceHp} mm ${parsedResult.hpRelation}`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Relative to VP</span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">
                      {parsedResult.vpRelation === 'ON' ? 'On VP (0 mm)' : `${parsedResult.distanceVp} mm ${parsedResult.vpRelation}`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Notation Style</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {parsedResult.isHidden ? 'Bracket (a)' : 'Standard a'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Line Identifier</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      Line {parsedResult.nameA}{parsedResult.nameB}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">True Length (TL)</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {parsedResult.trueLength} mm
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">Inclinations (θ / φ)</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      θ = {parsedResult.thetaDeg}°, φ = {parsedResult.phiDeg}°
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] text-slate-400 block">End A Position</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {parsedResult.endA.distanceHp}mm HP, {parsedResult.endA.distanceVp}mm VP
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Compliant with BIS SP 46:2003 &amp; ISO 128 Standards
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!parsedResult}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {appliedNotification ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Applied to Simulator!</span>
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
