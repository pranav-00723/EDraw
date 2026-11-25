/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  parseTextToNormalizedModel,
  solveNormalizedModel,
  normalizeMasterOcrText,
} from './src/utils/straightLineMasterSolver.ts';
import { StudentAuthService } from './server/studentAuth.ts';
import { RegistrationService } from './server/registrationService.ts';
import { FirebaseAuthProxyService } from './server/firebaseAuthProxy.ts';
import {
  getPipelineCapabilities,
  runEngineeringDrawingPipeline,
} from './server/pipeline/orchestrator.ts';
import { runStage1Ocr, type OcrEnginePreference } from './server/pipeline/ocrService.ts';
import {
  buildInitialProblemJson,
  resolvePipelineFilePath,
} from './server/pipeline/initialJsonBuilder.ts';
import { runStage3PythonSolver } from './server/pipeline/pythonSolverBridge.ts';
import { updateAndValidateProblemJson } from './server/pipeline/jsonUpdaterValidator.ts';
import { runStage5SvgRenderer } from './server/pipeline/svgRenderer.ts';
import { generateQuestionJsExecution } from './server/pipeline/jsGenerator.ts';
import { listRegisteredModules } from './src/pipeline/moduleRegistry.ts';
import { getMeasurementValue, validateCanonicalProblem } from './src/pipeline/schema.ts';
import { isStudioTtsAvailable, synthesizeNarrationSpeech } from './server/ttsService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const distDir = path.resolve(__dirname, 'dist');
const distIndexHtml = path.join(distDir, 'index.html');
const isProduction =
  (process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start') &&
  fs.existsSync(distIndexHtml);

// Support JSON payload up to 25MB for high-res textbook photo uploads & camera snapshots
app.use(express.json({ limit: '25mb' }));

/**
 * Standard Engineering Graphics Output Schema
 */
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

/**
 * POST /api/scan-question
 * Multi-module OCR + Semantic Interpretation + Deterministic Python Solving.
 * Routes Projection of Points, Projection of Straight Lines, and Unsupported/Ambiguous topics
 * honestly without fabricating default measurements.
 */
app.post('/api/scan-question', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    const text = typeof body.text === 'string' ? body.text : undefined;

    if (!imageBase64 && (!text || !text.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either imageBase64 or question text.',
      });
    }

    const stage1 = await runStage1Ocr({
      imageBase64,
      mimeType,
      text,
      engine: parseOcrEnginePreference(body.ocrEngine),
    });

    if (!stage1.ok) {
      return res.status(422).json({
        success: false,
        error: stage1.error,
        configuration_hint: stage1.configuration_hint,
      });
    }

    const recognizedText = stage1.raw_text;
    const sourceEngine = stage1.engine_used;
    const pipeRes = await runEngineeringDrawingPipeline({
      text: recognizedText,
      persist: false,
    });

    const validated = pipeRes.validated_json || pipeRes.initial_json;
    const moduleId = validated?.module?.id ?? 'unknown_module';
    const moduleTitle = validated?.module?.name ?? 'Unknown Engineering Module';

    if (moduleId === 'projection_of_points') {
      const pts = pipeRes.point_inputs || [];
      const primary = pts[0] || null;
      const parsedPoint = primary
        ? {
            type: 'POINT' as const,
            name: primary.name,
            hpRelation: primary.hpRelation,
            distanceHp: primary.distanceHp,
            vpRelation: primary.vpRelation,
            distanceVp: primary.distanceVp,
            isHidden: Boolean(primary.isHidden),
            explanation:
              pipeRes.derivation.map((d) => `${d.explanation} (${d.result || d.formula})`).join(' | ') ||
              validated?.module?.selection_reason ||
              validated?.task.description ||
              '',
          }
        : null;

      return res.json({
        success: true,
        module: moduleId,
        moduleTitle,
        rawText: recognizedText,
        source: sourceEngine,
        blocked: !pipeRes.ok,
        error: pipeRes.error,
        validated_json: pipeRes.validated_json,
        missing_requirements: pipeRes.missing_requirements,
        points: pts,
        parsed: pipeRes.ok ? parsedPoint : null,
      });
    }

    if (moduleId === 'projection_of_straight_lines') {
      const cleanText = normalizeMasterOcrText(recognizedText);
      const normalizedModel = parseTextToNormalizedModel(
        cleanText,
        stage1.input_type === 'image' ? 'OCR' : 'CLIPBOARD'
      );
      const solution = solveNormalizedModel(normalizedModel);
      const v = pipeRes.validated_json;

      let parsedLine: any = null;
      if (pipeRes.ok && pipeRes.line_input && v && v.geometry.entity_type === 'straight_line') {
        const li = pipeRes.line_input;
        parsedLine = {
          type: 'LINE',
          nameA: li.nameA,
          nameB: li.nameB,
          trueLength: li.trueLength,
          thetaDeg: li.thetaDeg,
          phiDeg: li.phiDeg,
          orientation: solution.candidate_solutions[0]?.orientation || 'INCLINED_BOTH',
          endA: li.endA,
          endB: li.endB,
          mode: li.mode,
          dep: li.dep,
          frontViewLength: getMeasurementValue(v, 'front_view_length') ?? li.frontViewLength,
          topViewLength: getMeasurementValue(v, 'top_view_length') ?? li.topViewLength,
          explanation:
            pipeRes.derivation.map((d) => `${d.explanation} (${d.result || d.formula})`).join(' | ') ||
            solution.candidate_solutions[0]?.orientationDesc ||
            v.task.description,
        };
      }

      return res.json({
        success: true,
        module: moduleId,
        moduleTitle,
        rawText: recognizedText,
        source: sourceEngine,
        blocked: !pipeRes.ok,
        error: pipeRes.error,
        validated_json: pipeRes.validated_json,
        missing_requirements: pipeRes.missing_requirements,
        normalizedModel,
        solution,
        parsed: parsedLine,
      });
    }

    // Unsupported or Clarification-Needed Modules — honest routing, never force straight lines
    return res.json({
      success: true,
      module: moduleId,
      moduleTitle,
      unsupported: validated?.validation.solver_status === 'unsupported',
      blocked: true,
      rawText: recognizedText,
      source: sourceEngine,
      error:
        pipeRes.error ||
        validated?.drawing_instructions.blocked_reason ||
        `Module "${moduleTitle}" is recognized cleanly but cannot be plotted automatically yet.`,
      validated_json: pipeRes.validated_json,
      missing_requirements: pipeRes.missing_requirements,
      parsed: null,
    });
  } catch (err: any) {
    console.error('Error in /api/scan-question:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to process question scan.',
    });
  }
});

const studentAuth = new StudentAuthService();
const registrationService = new RegistrationService();
const firebaseAuthProxy = new FirebaseAuthProxyService();

function resolveSafeBaseUrl(req: express.Request): string {
  const configured = (process.env.APP_URL || '').trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Fall through to validated request host
    }
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto === 'https' || req.protocol === 'https' ? 'https' : 'http';
  const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const safeHost = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(rawHost) ? rawHost : `localhost:${PORT}`;
  return `${proto}://${safeHost}`;
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await studentAuth.registerStudent({
      name: typeof body.name === 'string' ? body.name : '',
      email: typeof body.email === 'string' ? body.email : undefined,
      gmail: typeof body.gmail === 'string' ? body.gmail : undefined,
      college: typeof body.college === 'string' ? body.college : '',
      studentDetails: typeof body.studentDetails === 'string' ? body.studentDetails : '',
      password: typeof body.password === 'string' ? body.password : '',
      confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
    });

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
        fieldErrors: result.fieldErrors,
      });
    }

    return res.status(201).json(result);
  } catch (err) {
    console.error('Error in /api/auth/register:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to complete registration right now. Please try again.',
    });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = studentAuth.loginStudent({
      identifier: typeof body.identifier === 'string' ? body.identifier : undefined,
      edrawId: typeof body.edrawId === 'string' ? body.edrawId : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      password: typeof body.password === 'string' ? body.password : '',
    });

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('Error in /api/auth/login:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to sign in right now. Please try again.',
    });
  }
});

app.get('/api/auth/me', (req, res) => {
  const student = studentAuth.getAuthenticatedStudent(req.headers.authorization);
  if (!student) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return res.json({ success: true, student });
});

app.post('/api/auth/logout', (req, res) => {
  studentAuth.logoutToken(req.headers.authorization);
  return res.json({ success: true });
});

app.post('/api/auth/firebase/signup', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const result = await firebaseAuthProxy.signUpWithEmailPassword({
    email: body.email,
    password: body.password,
    displayName: body.displayName,
  });
  if (!result.success) {
    return res.status(result.status).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/auth/firebase/signin', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const result = await firebaseAuthProxy.signInWithEmailPassword({
    email: body.email,
    password: body.password,
  });
  if (!result.success) {
    return res.status(result.status).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/auth/firebase/google-idp', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const result = await firebaseAuthProxy.signInWithGoogleAccessToken({
    accessToken: body.accessToken,
    requestUri: resolveSafeBaseUrl(req),
  });
  if (!result.success) {
    return res.status(result.status).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/auth/firebase/refresh', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const result = await firebaseAuthProxy.refreshIdToken({
    refreshToken: body.refreshToken,
  });
  if (!result.success) {
    return res.status(result.status).json(result);
  }
  return res.status(200).json(result);
});

app.post('/api/admin/reset-database', async (req, res) => {
  try {
    const senderCheck = await studentAuth.verifyGoogleSenderBearer(req.headers.authorization);
    if (!senderCheck.ok) {
      return res.status(senderCheck.status).json({
        success: false,
        error: senderCheck.error,
        connectedEmail: senderCheck.email,
      });
    }

    await registrationService.resetDatabase();
    studentAuth.resetDatabase();

    return res.status(200).json({
      success: true,
      message: 'Student registration database reset to empty (next ID: EDID-1000).',
    });
  } catch (err) {
    console.error('Error in /api/admin/reset-database:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to reset the registration database right now.',
    });
  }
});

app.post('/api/registration/complete', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await registrationService.completeVerifiedRegistration({
      authHeader: req.headers.authorization,
      name: body.name,
      college: body.college,
      studentDetails: body.studentDetails,
    });

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      alreadyAllocated: result.alreadyAllocated,
      student: result.student,
    });
  } catch (err) {
    console.error('Error in /api/registration/complete:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to allocate eDraw ID right now. Please retry.',
    });
  }
});

app.get('/api/registration/me', async (req, res) => {
  try {
    const result = await registrationService.getRegistrationByToken(req.headers.authorization);
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(200).json({
      success: true,
      student: result.student,
    });
  } catch (err) {
    console.error('Error in /api/registration/me:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to fetch registration status right now.',
    });
  }
});

// ============================================================================
// 5-STAGE ENGINEERING DRAWING PIPELINE API ROUTES
// Stage 1 (OCR) -> Stage 2 (Initial JSON) -> Stage 3 (Python Solver)
// -> Stage 4 (Update & Validate JSON) -> Stage 5 (Geometry Engine & SVG)
// ============================================================================

const ALLOWED_OCR_ENGINES = new Set<OcrEnginePreference>([
  'auto',
  'glm-ocr',
  'gemini-vision',
  'tesseract',
]);

function parseOcrEnginePreference(raw: unknown): OcrEnginePreference {
  if (typeof raw === 'string' && ALLOWED_OCR_ENGINES.has(raw as OcrEnginePreference)) {
    return raw as OcrEnginePreference;
  }
  return 'auto';
}

app.get('/api/pipeline/capabilities', async (_req, res) => {
  try {
    const capabilities = await getPipelineCapabilities();
    return res.json({ ok: true, modules: listRegisteredModules(), ...capabilities });
  } catch (err: any) {
    console.error('Error in /api/pipeline/capabilities:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Unable to inspect pipeline capabilities.',
    });
  }
});

app.get('/api/pipeline/modules', (_req, res) => {
  return res.json({ ok: true, modules: listRegisteredModules() });
});

app.post('/api/pipeline/ocr', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await runStage1Ocr({
      imageBase64: typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
      text: typeof body.text === 'string' ? body.text : undefined,
      engine: parseOcrEnginePreference(body.ocrEngine ?? body.engine),
    });
    if (!result.ok) {
      return res.status(422).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/pipeline/ocr:', err);
    return res.status(500).json({
      ok: false,
      stage: 'stage_1_ocr',
      error: err?.message || 'Stage 1 OCR failed unexpectedly.',
    });
  }
});

app.post('/api/pipeline/initial-json', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let ocrPayload = body.ocr;
    if (!ocrPayload && typeof body.raw_text === 'string') {
      const stage1 = await runStage1Ocr({ text: body.raw_text });
      if (!stage1.ok) {
        return res.status(422).json(stage1);
      }
      ocrPayload = stage1;
    }
    if (!ocrPayload || typeof ocrPayload.raw_text !== 'string') {
      return res.status(400).json({
        ok: false,
        stage: 'stage_2_initial_json',
        error: 'Provide a Stage 1 OCR result object or raw_text string.',
      });
    }

    const stage2 = buildInitialProblemJson(ocrPayload, {
      persist: body.persist !== false,
    });
    if (!stage2.ok) {
      return res.status(422).json(stage2);
    }
    return res.json(stage2);
  } catch (err: any) {
    console.error('Error in /api/pipeline/initial-json:', err);
    return res.status(500).json({
      ok: false,
      stage: 'stage_2_initial_json',
      error: err?.message || 'Stage 2 initial JSON generation failed.',
    });
  }
});

app.post('/api/pipeline/solve', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const checked = validateCanonicalProblem(body.problem ?? body);
    if (!checked.ok) {
      return res.status(400).json({
        ok: false,
        stage: 'stage_3_python_solver',
        error: `Invalid canonical initial JSON: ${checked.errors.join('; ')}`,
        schema_errors: checked.errors,
      });
    }

    const stage3 = await runStage3PythonSolver(checked.data);
    if (!stage3.ok) {
      return res.status(500).json(stage3);
    }

    const stage4 = updateAndValidateProblemJson(checked.data, stage3, {
      persist: body.persist !== false,
    });
    if (!stage4.ok) {
      return res.status(422).json(stage4);
    }

    const jsExec = generateQuestionJsExecution(stage4.updated_problem);

    return res.json({
      ok: true,
      stage3,
      stage4,
      validated_json: stage4.updated_problem,
      missing_requirements: stage4.updated_problem.validation.missing_requirements,
      ready_for_render: stage4.ready_for_render,
      generated_js_module: jsExec.generated_js_module,
      visualization_config: jsExec.visualization_config,
      js_validation: jsExec.js_validation,
    });
  } catch (err: any) {
    console.error('Error in /api/pipeline/solve:', err);
    return res.status(500).json({
      ok: false,
      stage: 'stage_3_python_solver',
      error: err?.message || 'Stage 3/4 solve and validation failed.',
    });
  }
});

app.post('/api/pipeline/render', (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const stage5 = runStage5SvgRenderer(body.problem ?? body, {
      isDark: Boolean(body.isDark),
    });
    if (!stage5.ok) {
      return res.status(422).json(stage5);
    }
    return res.json(stage5);
  } catch (err: any) {
    console.error('Error in /api/pipeline/render:', err);
    return res.status(500).json({
      ok: false,
      stage: 'stage_5_render_svg',
      error: err?.message || 'Stage 5 SVG rendering failed.',
    });
  }
});

app.post('/api/pipeline/run', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await runEngineeringDrawingPipeline({
      imageBase64: typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
      text: typeof body.text === 'string' ? body.text : undefined,
      ocrEngine: parseOcrEnginePreference(body.ocrEngine),
      editedInitialJson: body.editedInitialJson,
      isDark: Boolean(body.isDark),
      persist: body.persist !== false,
    });

    const status = result.ok
      ? 200
      : result.failed_stage === 'stage_3_python_solver' && !result.validated_json
      ? 500
      : 422;
    return res.status(status).json(result);
  } catch (err: any) {
    console.error('Error in /api/pipeline/run:', err);
    return res.status(500).json({
      ok: false,
      failed_stage: 'stage_1_ocr',
      error: err?.message || 'Unexpected pipeline execution error.',
      stages: [],
      raw_ocr_text: null,
      ocr_engine_used: null,
      initial_json: null,
      validated_json: null,
      missing_requirements: [],
      derivation: [],
      svg: null,
      drawing_geometry: null,
      point_geometry: null,
      line_input: null,
      point_inputs: null,
      visualization_config: null,
      generated_js_module: null,
      js_validation: null,
    });
  }
});

app.get('/api/pipeline/problems/:problemId', (req, res) => {
  try {
    const problemId = String(req.params.problemId || '');
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(problemId)) {
      return res.status(400).json({ ok: false, error: 'Invalid problem_id format.' });
    }
    const initialPath = resolvePipelineFilePath(problemId, 'initial.json');
    const solvedPath = resolvePipelineFilePath(problemId, 'solved.json');
    const initialJson = fs.existsSync(initialPath)
      ? JSON.parse(fs.readFileSync(initialPath, 'utf8'))
      : null;
    const solvedJson = fs.existsSync(solvedPath)
      ? JSON.parse(fs.readFileSync(solvedPath, 'utf8'))
      : null;

    if (!initialJson && !solvedJson) {
      return res.status(404).json({ ok: false, error: 'Problem record not found.' });
    }
    return res.json({
      ok: true,
      problem_id: problemId,
      initial_json: initialJson,
      validated_json: solvedJson,
    });
  } catch (err: any) {
    console.error('Error in /api/pipeline/problems/:problemId:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Unable to load persisted problem JSON.',
    });
  }
});

// ============================================================================
// HUMAN-LIKE STUDIO NARRATION TTS ROUTES (Gemini 3.8 Flash Lite TTS)
// ============================================================================

app.get('/api/tts/status', (_req, res) => {
  return res.json({
    ok: true,
    studioVoiceAvailable: isStudioTtsAvailable(),
  });
});

app.post('/api/tts/narrate', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await synthesizeNarrationSpeech({
      text: typeof body.text === 'string' ? body.text : '',
      voicePreset: body.voicePreset,
    });
    if (!result.ok) {
      return res.status(result.status).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/tts/narrate:', err);
    return res.status(500).json({
      ok: false,
      code: 'TTS_FAILED',
      error: err?.message || 'Unable to synthesize speech narration.',
    });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
