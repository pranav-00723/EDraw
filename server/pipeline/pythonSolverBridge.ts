/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AmbiguityRecord,
  CanonicalEngineeringProblem,
  MissingRequirement,
  SolvedLineCoordinates,
  SolverStatus,
  ValidationCheck,
  ValidationIssue,
} from '../../src/pipeline/schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SOLVER_SCRIPT = path.resolve(__dirname, '..', '..', 'python', 'geometry_solver.py');
const DEFAULT_PYTHON_BIN = (process.env.PYTHON_BIN || 'python3').trim() || 'python3';
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
const SOLVER_TIMEOUT_MS = 10000;

export interface PythonDerivedEntry {
  property: string;
  value: number;
  unit: 'mm' | 'deg';
  dependencies: string[];
  formula: string;
}

export interface PythonSolverOutput {
  ok: true;
  stage: 'stage_3_python_solver';
  solver_status: SolverStatus;
  derived_values: Record<string, PythonDerivedEntry>;
  unresolved_unknowns: Record<string, string>;
  solved_coordinates: SolvedLineCoordinates | null;
  missing_requirements: MissingRequirement[];
  issues: ValidationIssue[];
  ambiguities: AmbiguityRecord[];
  checks: ValidationCheck[];
}

export interface PythonSolverFailure {
  ok: false;
  stage: 'stage_3_python_solver';
  solver_status: 'error';
  error: string;
}

export type Stage3PythonResult = PythonSolverOutput | PythonSolverFailure;

export function checkPythonSolverCapability(
  pythonBin: string = DEFAULT_PYTHON_BIN,
  scriptPath: string = DEFAULT_SOLVER_SCRIPT
): Promise<{ available: boolean; python_bin: string; script_exists: boolean; version?: string; error?: string }> {
  const scriptExists = fs.existsSync(scriptPath);
  return new Promise((resolve) => {
    const child = spawn(pythonBin, ['--version'], { shell: false });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        available: false,
        python_bin: pythonBin,
        script_exists: scriptExists,
        error: 'Timed out checking Python version.',
      });
    }, 3000);

    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString('utf8');
    });
    child.on('error', (spawnErr) => {
      clearTimeout(timer);
      resolve({
        available: false,
        python_bin: pythonBin,
        script_exists: scriptExists,
        error: spawnErr.message,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const version = (out || err).trim();
      resolve({
        available: code === 0 && scriptExists,
        python_bin: pythonBin,
        script_exists: scriptExists,
        version: version || undefined,
        ...(code !== 0 ? { error: `Python exited with code ${code}` } : {}),
      });
    });
  });
}

/**
 * Stage 3 Entry Point: Invoke deterministic Python geometry solver via stdio (shell: false).
 */
export function runStage3PythonSolver(
  initialProblem: CanonicalEngineeringProblem,
  options?: {
    pythonBin?: string;
    scriptPath?: string;
    timeoutMs?: number;
  }
): Promise<Stage3PythonResult> {
  const pythonBin = options?.pythonBin || DEFAULT_PYTHON_BIN;
  const scriptPath = options?.scriptPath || DEFAULT_SOLVER_SCRIPT;
  const timeoutMs = options?.timeoutMs || SOLVER_TIMEOUT_MS;

  if (!fs.existsSync(scriptPath)) {
    return Promise.resolve({
      ok: false,
      stage: 'stage_3_python_solver',
      solver_status: 'error',
      error: `Python geometry solver script not found at expected backend path.`,
    });
  }

  return new Promise((resolve) => {
    const child = spawn(pythonBin, [scriptPath], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const finish = (result: Stage3PythonResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({
        ok: false,
        stage: 'stage_3_python_solver',
        solver_status: 'error',
        error: `Python geometry solver timed out after ${timeoutMs} ms.`,
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > MAX_STDOUT_BYTES) {
        child.kill('SIGKILL');
        finish({
          ok: false,
          stage: 'stage_3_python_solver',
          solver_status: 'error',
          error: 'Python geometry solver exceeded maximum stdout buffer.',
        });
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      finish({
        ok: false,
        stage: 'stage_3_python_solver',
        solver_status: 'error',
        error: `Unable to launch Python runtime (${pythonBin}): ${err.message}`,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      if (!stdout.trim()) {
        finish({
          ok: false,
          stage: 'stage_3_python_solver',
          solver_status: 'error',
          error: `Python geometry solver exited with code ${code}: ${stderr.trim() || 'no output'}.`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        if (parsed.ok !== true) {
          finish({
            ok: false,
            stage: 'stage_3_python_solver',
            solver_status: 'error',
            error: String(parsed.error || 'Python solver returned ok: false.'),
          });
          return;
        }

        finish({
          ok: true,
          stage: 'stage_3_python_solver',
          solver_status: (parsed.solver_status as SolverStatus) || 'error',
          derived_values: (parsed.derived_values as Record<string, PythonDerivedEntry>) || {},
          unresolved_unknowns: (parsed.unresolved_unknowns as Record<string, string>) || {},
          solved_coordinates: (parsed.solved_coordinates as SolvedLineCoordinates | null) || null,
          missing_requirements: Array.isArray(parsed.missing_requirements)
            ? (parsed.missing_requirements as MissingRequirement[])
            : [],
          issues: Array.isArray(parsed.issues) ? (parsed.issues as ValidationIssue[]) : [],
          ambiguities: Array.isArray(parsed.ambiguities)
            ? (parsed.ambiguities as AmbiguityRecord[])
            : [],
          checks: Array.isArray(parsed.checks) ? (parsed.checks as ValidationCheck[]) : [],
        });
      } catch (parseErr) {
        finish({
          ok: false,
          stage: 'stage_3_python_solver',
          solver_status: 'error',
          error: `Invalid JSON returned from Python geometry solver: ${
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          }`,
        });
      }
    });

    child.stdin.on('error', () => {
      // Handled by close/error listeners
    });
    child.stdin.write(JSON.stringify(initialProblem));
    child.stdin.end();
  });
}
