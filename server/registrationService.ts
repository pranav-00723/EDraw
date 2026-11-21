/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  COLLEGE_MAX_LEN,
  COLLEGE_MIN_LEN,
  NAME_MAX_LEN,
  NAME_MIN_LEN,
  STUDENT_DETAILS_MAX_LEN,
  isValidEmail,
  isValidVerificationCode,
  normalizeEmail,
  type DispatchQueueItem,
  type RegistrationStatus,
  type StudentProfileSummary,
} from '../src/utils/studentAuthValidation.ts';
import {
  buildMimeRawEmail,
  buildVerificationCodeEmailContent,
  buildVerifiedIdEmailContent,
  getSmtpTransporter,
} from './studentAuth.ts';

export interface VerifiedFirebaseCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export type TokenVerifier = (idToken: string) => Promise<VerifiedFirebaseCaller>;

export type GoogleSenderVerifier = (authHeader: string | undefined) => Promise<
  | { ok: true; email: string; accessToken: string }
  | { ok: false; status: number; error: string; email?: string }
>;

export type OtpEmailSender = (params: {
  to: string;
  studentName: string;
  college: string;
  code: string;
}) => Promise<boolean>;

export interface ServerRegistrationRecord {
  uid: string;
  name: string;
  email: string;
  college: string;
  studentDetails: string;
  edrawId: string | null;
  registrationStatus: RegistrationStatus;
  verified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  verificationCodeHash?: string | null;
  verificationCodeExpiresAt?: number | null;
  verificationCodeAttempts?: number;
  verificationEmailSentAt?: string | null;
  edrawIdEmailSentAt?: string | null;
}

interface RegistrationDatabaseFile {
  nextCounter: number;
  records: Record<string, ServerRegistrationRecord>;
}

export type CodeDeliveryMode = 'smtp' | 'gmail_pending';

const INITIAL_EDID_COUNTER = 1000;
const MAX_EDID_COUNTER = 9999;
const VERIFICATION_CODE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CODE_ATTEMPTS = 5;

function loadProjectId(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed?.projectId) return parsed.projectId;
  } catch {
    // Fallback to environment variable if config file is unavailable
  }
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
}

function getFirebaseAdminAuth() {
  const projectId = loadProjectId();
  const adminApp = getApps().length
    ? getApp()
    : initializeApp(projectId ? { projectId } : undefined);
  return getAuth(adminApp);
}

export const defaultFirebaseTokenVerifier: TokenVerifier = async (idToken: string) => {
  const adminAuth = getFirebaseAdminAuth();
  const decoded = await adminAuth.verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: normalizeEmail(decoded.email || ''),
    emailVerified: decoded.email_verified === true,
  };
};

export function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashVerificationCode(uid: string, email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${uid}:${normalizeEmail(email)}:${code.trim()}`)
    .digest('hex');
}

function verifyCodeHash(uid: string, email: string, code: string, storedHash: string): boolean {
  const expectedHex = hashVerificationCode(uid, email, code);
  const actualBuf = Buffer.from(expectedHex, 'hex');
  const expectedBuf = Buffer.from(storedHash, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

const defaultSmtpOtpSender: OtpEmailSender = async (params) => {
  const smtp = getSmtpTransporter();
  if (!smtp) return false;
  const content = buildVerificationCodeEmailContent({
    studentName: params.studentName,
    college: params.college,
    code: params.code,
  });
  await smtp.transporter.sendMail({
    from: smtp.from,
    to: params.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return true;
};

export function toRegistrationProfileSummary(
  record: ServerRegistrationRecord
): StudentProfileSummary {
  return {
    uid: record.uid,
    edrawId: record.edrawId || '',
    name: record.name,
    gmail: record.email,
    college: record.college,
    studentDetails: record.studentDetails,
    registrationStatus: record.registrationStatus,
    verified: record.verified,
    emailVerifiedAt: record.emailVerifiedAt,
    createdAt: record.createdAt,
  };
}

export class RegistrationService {
  private readonly storePath: string;
  private readonly legacyStudentsPath: string;
  private readonly verifyToken: TokenVerifier;
  private readonly codeGenerator: () => string;
  private readonly otpEmailSender: OtpEmailSender;
  private readonly nowProvider: () => number;
  private lockChain: Promise<unknown> = Promise.resolve();

  constructor(options?: {
    storePath?: string;
    legacyStudentsPath?: string;
    verifyToken?: TokenVerifier;
    codeGenerator?: () => string;
    otpEmailSender?: OtpEmailSender;
    nowProvider?: () => number;
  }) {
    this.storePath =
      options?.storePath || path.resolve(process.cwd(), '.edraw-data', 'registrations.json');
    this.legacyStudentsPath =
      options?.legacyStudentsPath || path.resolve(process.cwd(), '.edraw-data', 'students.json');
    this.verifyToken = options?.verifyToken || defaultFirebaseTokenVerifier;
    this.codeGenerator = options?.codeGenerator || generateSixDigitCode;
    this.otpEmailSender = options?.otpEmailSender || defaultSmtpOtpSender;
    this.nowProvider = options?.nowProvider || (() => Date.now());
  }

  private withLock<T>(task: () => Promise<T> | T): Promise<T> {
    const run = this.lockChain.then(() => task());
    this.lockChain = run.catch(() => undefined);
    return run;
  }

  private readDb(): RegistrationDatabaseFile {
    try {
      if (!fs.existsSync(this.storePath)) {
        return { nextCounter: INITIAL_EDID_COUNTER, records: {} };
      }
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RegistrationDatabaseFile>;
      return {
        nextCounter:
          typeof parsed.nextCounter === 'number' && parsed.nextCounter >= INITIAL_EDID_COUNTER
            ? parsed.nextCounter
            : INITIAL_EDID_COUNTER,
        records:
          parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
      };
    } catch {
      return { nextCounter: INITIAL_EDID_COUNTER, records: {} };
    }
  }

  private readLegacyUsedIds(): Set<string> {
    const ids = new Set<string>();
    try {
      if (!fs.existsSync(this.legacyStudentsPath)) return ids;
      const raw = fs.readFileSync(this.legacyStudentsPath, 'utf8');
      const parsed = JSON.parse(raw) as { students?: Array<{ edrawId?: string }> };
      if (Array.isArray(parsed.students)) {
        for (const s of parsed.students) {
          if (typeof s.edrawId === 'string' && s.edrawId) {
            ids.add(s.edrawId);
          }
        }
      }
    } catch {
      // Ignore unreadable legacy file
    }
    return ids;
  }

  private writeDb(db: RegistrationDatabaseFile): void {
    const dir = path.dirname(this.storePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.storePath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 8)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, this.storePath);
  }

  private allocateNextEdrawId(db: RegistrationDatabaseFile): { edrawId: string; nextCounter: number } {
    const used = this.readLegacyUsedIds();
    for (const rec of Object.values(db.records)) {
      if (rec.edrawId) {
        used.add(rec.edrawId);
      }
    }

    let candidateNum = Math.max(INITIAL_EDID_COUNTER, db.nextCounter);
    while (candidateNum <= MAX_EDID_COUNTER) {
      const candidate = `EDID-${candidateNum}`;
      if (!used.has(candidate)) {
        return { edrawId: candidate, nextCounter: candidateNum + 1 };
      }
      candidateNum += 1;
    }

    for (let fallback = INITIAL_EDID_COUNTER; fallback <= MAX_EDID_COUNTER; fallback++) {
      const candidate = `EDID-${fallback}`;
      if (!used.has(candidate)) {
        return { edrawId: candidate, nextCounter: db.nextCounter };
      }
    }

    throw new Error('No available EDID-XXXX identifiers remain.');
  }

  private async authenticateRequest(authHeader: string | undefined): Promise<
    | { ok: true; caller: VerifiedFirebaseCaller }
    | { ok: false; status: number; error: string }
  > {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { ok: false, status: 401, error: 'Authentication required. Please sign in.' };
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return { ok: false, status: 401, error: 'Authentication token is missing.' };
    }

    try {
      const caller = await this.verifyToken(token);
      if (!caller.uid || !isValidEmail(caller.email)) {
        return {
          ok: false,
          status: 401,
          error: 'Authenticated account does not contain a valid email address.',
        };
      }
      return {
        ok: true,
        caller: {
          uid: caller.uid,
          email: normalizeEmail(caller.email),
          emailVerified: caller.emailVerified === true,
        },
      };
    } catch {
      return {
        ok: false,
        status: 401,
        error: 'Session expired or invalid authentication token. Please sign in again.',
      };
    }
  }

  private validateProfileFields(input: {
    name?: unknown;
    college?: unknown;
    studentDetails?: unknown;
  }):
    | { ok: true; name: string; college: string; studentDetails: string }
    | { ok: false; status: number; error: string } {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const college = typeof input.college === 'string' ? input.college.trim() : '';
    const studentDetails =
      typeof input.studentDetails === 'string' ? input.studentDetails.trim() : '';

    if (name.length < NAME_MIN_LEN || name.length > NAME_MAX_LEN) {
      return {
        ok: false,
        status: 400,
        error: `Student name must be between ${NAME_MIN_LEN} and ${NAME_MAX_LEN} characters.`,
      };
    }

    if (college.length < COLLEGE_MIN_LEN || college.length > COLLEGE_MAX_LEN) {
      return {
        ok: false,
        status: 400,
        error: `College name must be between ${COLLEGE_MIN_LEN} and ${COLLEGE_MAX_LEN} characters.`,
      };
    }

    if (studentDetails.length > STUDENT_DETAILS_MAX_LEN) {
      return {
        ok: false,
        status: 400,
        error: `Student details must be ${STUDENT_DETAILS_MAX_LEN} characters or fewer.`,
      };
    }

    return { ok: true, name, college, studentDetails };
  }

  hasRecordByEmail(emailInput: string): boolean {
    const email = normalizeEmail(emailInput || '');
    if (!email) return false;
    const db = this.readDb();
    return Object.values(db.records).some((r) => r.email === email);
  }

  getDispatchQueueItems(): DispatchQueueItem[] {
    const db = this.readDb();
    return Object.values(db.records)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        edrawId: r.edrawId || '',
        name: r.name,
        gmail: r.email,
        college: r.college,
        verified: r.verified,
        createdAt: r.createdAt,
        verifiedAt: r.emailVerifiedAt,
        verificationEmailSentAt: r.verificationEmailSentAt ?? null,
        edrawIdEmailSentAt: r.edrawIdEmailSentAt ?? null,
      }));
  }

  async upsertPendingRegistration(params: {
    authHeader: string | undefined;
    name: unknown;
    college: unknown;
    studentDetails?: unknown;
  }): Promise<
    | {
        success: true;
        deliveryMode: CodeDeliveryMode;
        record: ServerRegistrationRecord;
        student: StudentProfileSummary;
      }
    | { success: false; status: number; error: string }
  > {
    const authResult = await this.authenticateRequest(params.authHeader);
    if (!authResult.ok) {
      return { success: false, status: authResult.status, error: authResult.error };
    }

    const fieldsResult = this.validateProfileFields({
      name: params.name,
      college: params.college,
      studentDetails: params.studentDetails,
    });
    if (!fieldsResult.ok) {
      return { success: false, status: fieldsResult.status, error: fieldsResult.error };
    }

    const lockResult = await this.withLock(() => {
      const db = this.readDb();
      const { uid, email } = authResult.caller;

      const duplicate = Object.values(db.records).find(
        (r) => r.email === email && r.uid !== uid && r.verified
      );
      if (duplicate) {
        return {
          ok: false as const,
          status: 409,
          error: 'An account with this email address is already registered and verified.',
        };
      }

      const existing = db.records[uid];
      const nowMs = this.nowProvider();
      const nowIso = new Date(nowMs).toISOString();

      if (existing && existing.edrawId) {
        return {
          ok: true as const,
          alreadyVerified: true,
          rawCode: null as string | null,
          record: existing,
        };
      }

      const rawCode = this.codeGenerator();
      const updated: ServerRegistrationRecord = {
        uid,
        name: fieldsResult.name,
        email,
        college: fieldsResult.college,
        studentDetails: fieldsResult.studentDetails,
        edrawId: null,
        registrationStatus: 'pending_verification',
        verified: false,
        emailVerifiedAt: null,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
        verificationCodeHash: hashVerificationCode(uid, email, rawCode),
        verificationCodeExpiresAt: nowMs + VERIFICATION_CODE_TTL_MS,
        verificationCodeAttempts: 0,
        verificationEmailSentAt: existing?.verificationEmailSentAt ?? null,
        edrawIdEmailSentAt: existing?.edrawIdEmailSentAt ?? null,
      };

      db.records[uid] = updated;
      try {
        this.writeDb(db);
      } catch {
        return {
          ok: false as const,
          status: 500,
          error: 'Unable to save pending registration right now. Please retry.',
        };
      }

      return {
        ok: true as const,
        alreadyVerified: false,
        rawCode,
        record: updated,
      };
    });

    if (!lockResult.ok) {
      return { success: false, status: lockResult.status, error: lockResult.error };
    }

    let deliveryMode: CodeDeliveryMode = 'gmail_pending';
    if (!lockResult.alreadyVerified && lockResult.rawCode) {
      try {
        const sentViaSmtp = await this.otpEmailSender({
          to: lockResult.record.email,
          studentName: lockResult.record.name,
          college: lockResult.record.college,
          code: lockResult.rawCode,
        });
        if (sentViaSmtp) {
          deliveryMode = 'smtp';
          await this.withLock(() => {
            const db = this.readDb();
            const rec = db.records[lockResult.record.uid];
            if (rec) {
              rec.verificationEmailSentAt = new Date(this.nowProvider()).toISOString();
              this.writeDb(db);
            }
          });
        }
      } catch (err) {
        console.warn('SMTP verification code email failed:', err);
      }
    }

    return {
      success: true,
      deliveryMode,
      record: lockResult.record,
      student: toRegistrationProfileSummary(lockResult.record),
    };
  }

  async resendVerificationCode(params: {
    authHeader: string | undefined;
  }): Promise<
    | {
        success: true;
        deliveryMode: CodeDeliveryMode;
        email: string;
        student: StudentProfileSummary;
      }
    | { success: false; status: number; error: string }
  > {
    const authResult = await this.authenticateRequest(params.authHeader);
    if (!authResult.ok) {
      return { success: false, status: authResult.status, error: authResult.error };
    }

    const { uid, email } = authResult.caller;
    const lockResult = await this.withLock(() => {
      const db = this.readDb();
      const existing = db.records[uid];
      if (!existing) {
        return {
          ok: false as const,
          status: 404,
          error: 'No pending registration found for this account. Please register first.',
        };
      }
      if (existing.edrawId && existing.verified) {
        return {
          ok: false as const,
          status: 409,
          error: 'This email address is already verified and has an active eDraw ID.',
        };
      }

      const nowMs = this.nowProvider();
      const rawCode = this.codeGenerator();
      existing.verificationCodeHash = hashVerificationCode(uid, email, rawCode);
      existing.verificationCodeExpiresAt = nowMs + VERIFICATION_CODE_TTL_MS;
      existing.verificationCodeAttempts = 0;
      existing.updatedAt = new Date(nowMs).toISOString();
      db.records[uid] = existing;

      try {
        this.writeDb(db);
      } catch {
        return {
          ok: false as const,
          status: 500,
          error: 'Could not issue a fresh verification code right now. Please retry.',
        };
      }

      return { ok: true as const, rawCode, record: existing };
    });

    if (!lockResult.ok) {
      return { success: false, status: lockResult.status, error: lockResult.error };
    }

    let deliveryMode: CodeDeliveryMode = 'gmail_pending';
    try {
      const sentViaSmtp = await this.otpEmailSender({
        to: lockResult.record.email,
        studentName: lockResult.record.name,
        college: lockResult.record.college,
        code: lockResult.rawCode,
      });
      if (sentViaSmtp) {
        deliveryMode = 'smtp';
        await this.withLock(() => {
          const db = this.readDb();
          const rec = db.records[uid];
          if (rec) {
            rec.verificationEmailSentAt = new Date(this.nowProvider()).toISOString();
            this.writeDb(db);
          }
        });
      }
    } catch (err) {
      console.warn('SMTP resend verification code failed:', err);
    }

    return {
      success: true,
      deliveryMode,
      email: lockResult.record.email,
      student: toRegistrationProfileSummary(lockResult.record),
    };
  }

  async verifyEmailCode(params: {
    authHeader: string | undefined;
    code: unknown;
    name?: unknown;
    college?: unknown;
    studentDetails?: unknown;
  }): Promise<
    | {
        success: true;
        alreadyAllocated: boolean;
        record: ServerRegistrationRecord;
        student: StudentProfileSummary;
      }
    | { success: false; status: number; error: string }
  > {
    const authResult = await this.authenticateRequest(params.authHeader);
    if (!authResult.ok) {
      return { success: false, status: authResult.status, error: authResult.error };
    }

    const rawCode = typeof params.code === 'string' ? params.code.trim() : '';
    if (!isValidVerificationCode(rawCode)) {
      return {
        success: false,
        status: 400,
        error: 'Enter the 6-digit numeric verification code sent to your email.',
      };
    }

    const { uid, email } = authResult.caller;

    return this.withLock(() => {
      const db = this.readDb();
      const existing = db.records[uid];

      if (existing && existing.edrawId && existing.verified) {
        return {
          success: true,
          alreadyAllocated: true,
          record: existing,
          student: toRegistrationProfileSummary(existing),
        };
      }

      if (!existing || !existing.verificationCodeHash) {
        return {
          success: false,
          status: 404,
          error: 'No active verification code was found. Please request a fresh verification code.',
        };
      }

      const nowMs = this.nowProvider();
      if (existing.verificationCodeExpiresAt && existing.verificationCodeExpiresAt < nowMs) {
        return {
          success: false,
          status: 410,
          error: 'This verification code has expired (valid for 1 hour). Please request a new code.',
        };
      }

      const currentAttempts = existing.verificationCodeAttempts || 0;
      if (currentAttempts >= MAX_CODE_ATTEMPTS) {
        existing.verificationCodeHash = null;
        existing.verificationCodeExpiresAt = null;
        this.writeDb(db);
        return {
          success: false,
          status: 429,
          error: 'Too many incorrect code attempts. Please request a fresh verification code.',
        };
      }

      const matches = verifyCodeHash(uid, email, rawCode, existing.verificationCodeHash);
      if (!matches) {
        const nextAttempts = currentAttempts + 1;
        existing.verificationCodeAttempts = nextAttempts;
        existing.updatedAt = new Date(nowMs).toISOString();
        if (nextAttempts >= MAX_CODE_ATTEMPTS) {
          existing.verificationCodeHash = null;
          existing.verificationCodeExpiresAt = null;
        }
        this.writeDb(db);

        const remaining = MAX_CODE_ATTEMPTS - nextAttempts;
        return {
          success: false,
          status: remaining <= 0 ? 429 : 400,
          error:
            remaining <= 0
              ? 'Too many incorrect attempts. Please request a new verification code.'
              : `Invalid verification code. ${remaining} ${
                  remaining === 1 ? 'attempt' : 'attempts'
                } remaining.`,
        };
      }

      const duplicateByEmail = Object.values(db.records).find(
        (r) => r.email === email && r.uid !== uid && r.edrawId
      );
      if (duplicateByEmail) {
        return {
          success: false,
          status: 409,
          error:
            'This email address already has an active eDraw ID. Please sign in with your existing account.',
        };
      }

      const allocation = this.allocateNextEdrawId(db);
      const nowIso = new Date(nowMs).toISOString();

      const resolvedName =
        typeof params.name === 'string' && params.name.trim().length >= NAME_MIN_LEN
          ? params.name.trim().slice(0, NAME_MAX_LEN)
          : existing.name;
      const resolvedCollege =
        typeof params.college === 'string' && params.college.trim().length >= COLLEGE_MIN_LEN
          ? params.college.trim().slice(0, COLLEGE_MAX_LEN)
          : existing.college;
      const resolvedDetails =
        typeof params.studentDetails === 'string'
          ? params.studentDetails.trim().slice(0, STUDENT_DETAILS_MAX_LEN)
          : existing.studentDetails;

      const completed: ServerRegistrationRecord = {
        ...existing,
        name: resolvedName,
        college: resolvedCollege,
        studentDetails: resolvedDetails,
        edrawId: allocation.edrawId,
        registrationStatus: 'verified',
        verified: true,
        emailVerifiedAt: nowIso,
        updatedAt: nowIso,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        verificationCodeAttempts: 0,
      };

      db.nextCounter = allocation.nextCounter;
      db.records[uid] = completed;

      try {
        this.writeDb(db);
      } catch {
        return {
          success: false,
          status: 500,
          error:
            'Could not persist your allocated eDraw ID due to a temporary storage error. Please retry.',
        };
      }

      return {
        success: true,
        alreadyAllocated: false,
        record: completed,
        student: toRegistrationProfileSummary(completed),
      };
    });
  }

  async sendCodeViaGmailApi(params: {
    gmailAuthHeader: string | undefined;
    targetEmail: string;
    verifySender: GoogleSenderVerifier;
    fetchImpl?: typeof fetch;
  }): Promise<
    | {
        success: true;
        sentFrom: string;
        sentTo: string;
        edrawId: string;
        kind: 'verification_code';
        messageId: string;
        sentAt: string;
      }
    | { success: false; status: number; error: string }
  > {
    const senderCheck = await params.verifySender(params.gmailAuthHeader);
    if (!senderCheck.ok) {
      return { success: false, status: senderCheck.status, error: senderCheck.error };
    }

    const normalizedEmail = normalizeEmail(params.targetEmail || '');
    if (!isValidEmail(normalizedEmail)) {
      return { success: false, status: 400, error: 'A valid registered student email is required.' };
    }

    const prep = await this.withLock(() => {
      const db = this.readDb();
      const record = Object.values(db.records).find((r) => r.email === normalizedEmail);
      if (!record) {
        return {
          ok: false as const,
          status: 404,
          error: 'No student registration found for this email address.',
        };
      }
      if (record.verified && record.edrawId) {
        return {
          ok: false as const,
          status: 409,
          error: `${record.email} is already verified (${record.edrawId}).`,
        };
      }

      const nowMs = this.nowProvider();
      const rawCode = this.codeGenerator();
      record.verificationCodeHash = hashVerificationCode(record.uid, record.email, rawCode);
      record.verificationCodeExpiresAt = nowMs + VERIFICATION_CODE_TTL_MS;
      record.verificationCodeAttempts = 0;
      record.updatedAt = new Date(nowMs).toISOString();
      db.records[record.uid] = record;
      this.writeDb(db);

      return { ok: true as const, record, rawCode };
    });

    if (!prep.ok) {
      return { success: false, status: prep.status, error: prep.error };
    }

    const emailContent = buildVerificationCodeEmailContent({
      studentName: prep.record.name,
      college: prep.record.college,
      code: prep.rawCode,
    });
    const rawMime = buildMimeRawEmail({
      from: senderCheck.email,
      to: prep.record.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    const fetcher = params.fetchImpl || fetch;
    const gmailRes = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderCheck.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMime }),
    });

    if (!gmailRes.ok) {
      return {
        success: false,
        status: gmailRes.status === 401 || gmailRes.status === 403 ? gmailRes.status : 502,
        error:
          'Gmail API could not send the verification code email. Please verify your Gmail send permission and try again.',
      };
    }

    const sentPayload = (await gmailRes.json()) as { id?: string };
    const sentAt = new Date(this.nowProvider()).toISOString();

    await this.withLock(() => {
      const db = this.readDb();
      const rec = db.records[prep.record.uid];
      if (rec) {
        rec.verificationEmailSentAt = sentAt;
        this.writeDb(db);
      }
    });

    return {
      success: true,
      sentFrom: senderCheck.email,
      sentTo: prep.record.email,
      edrawId: prep.record.edrawId || '',
      kind: 'verification_code',
      messageId: sentPayload.id || `gmail-${Date.now()}`,
      sentAt,
    };
  }

  async sendVerifiedIdViaGmailApi(params: {
    gmailAuthHeader: string | undefined;
    targetEmail: string;
    verifySender: GoogleSenderVerifier;
    fetchImpl?: typeof fetch;
  }): Promise<
    | {
        success: true;
        sentFrom: string;
        sentTo: string;
        edrawId: string;
        kind: 'verified_edraw_id';
        messageId: string;
        sentAt: string;
      }
    | { success: false; status: number; error: string }
  > {
    const senderCheck = await params.verifySender(params.gmailAuthHeader);
    if (!senderCheck.ok) {
      return { success: false, status: senderCheck.status, error: senderCheck.error };
    }

    const normalizedEmail = normalizeEmail(params.targetEmail || '');
    const db = this.readDb();
    const record = Object.values(db.records).find((r) => r.email === normalizedEmail);
    if (!record) {
      return { success: false, status: 404, error: 'Student registration not found.' };
    }
    if (!record.verified || !record.edrawId) {
      return {
        success: false,
        status: 409,
        error: `${record.email} has not verified their email code yet.`,
      };
    }

    const emailContent = buildVerifiedIdEmailContent({
      studentName: record.name,
      college: record.college,
      edrawId: record.edrawId,
    });
    const rawMime = buildMimeRawEmail({
      from: senderCheck.email,
      to: record.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    const fetcher = params.fetchImpl || fetch;
    const gmailRes = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderCheck.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMime }),
    });

    if (!gmailRes.ok) {
      return {
        success: false,
        status: gmailRes.status === 401 || gmailRes.status === 403 ? gmailRes.status : 502,
        error: 'Gmail API could not send the eDraw ID email right now.',
      };
    }

    const sentPayload = (await gmailRes.json()) as { id?: string };
    const sentAt = new Date(this.nowProvider()).toISOString();

    await this.withLock(() => {
      const latest = this.readDb();
      const rec = latest.records[record.uid];
      if (rec) {
        rec.edrawIdEmailSentAt = sentAt;
        this.writeDb(latest);
      }
    });

    return {
      success: true,
      sentFrom: senderCheck.email,
      sentTo: record.email,
      edrawId: record.edrawId,
      kind: 'verified_edraw_id',
      messageId: sentPayload.id || `gmail-${Date.now()}`,
      sentAt,
    };
  }

  async completeVerifiedRegistration(params: {
    authHeader: string | undefined;
    name?: unknown;
    college?: unknown;
    studentDetails?: unknown;
  }): Promise<
    | {
        success: true;
        alreadyAllocated: boolean;
        record: ServerRegistrationRecord;
        student: StudentProfileSummary;
      }
    | { success: false; status: number; error: string }
  > {
    const authResult = await this.authenticateRequest(params.authHeader);
    if (!authResult.ok) {
      return { success: false, status: authResult.status, error: authResult.error };
    }

    const { uid, email, emailVerified } = authResult.caller;
    if (!emailVerified) {
      return {
        success: false,
        status: 403,
        error:
          'Your email address is not verified yet. Please enter the 6-digit verification code sent to your email.',
      };
    }

    return this.withLock(() => {
      const db = this.readDb();
      const existing = db.records[uid];

      // Strict idempotency: never overwrite or re-allocate an existing student's EDID-XXXX
      if (existing && existing.edrawId) {
        return {
          success: true,
          alreadyAllocated: true,
          record: existing,
          student: toRegistrationProfileSummary(existing),
        };
      }

      // Prevent duplicate verified registrations for the same email across UIDs
      const duplicateByEmail = Object.values(db.records).find(
        (r) => r.email === email && r.uid !== uid && r.edrawId
      );
      if (duplicateByEmail) {
        return {
          success: false,
          status: 409,
          error:
            'This email address already has an active eDraw ID. Please sign in with your existing account.',
        };
      }

      const fallbackName =
        typeof params.name === 'string' && params.name.trim().length >= NAME_MIN_LEN
          ? params.name.trim().slice(0, NAME_MAX_LEN)
          : existing?.name || email.split('@')[0].slice(0, NAME_MAX_LEN) || 'EDraw Student';

      const fallbackCollege =
        typeof params.college === 'string' && params.college.trim().length >= COLLEGE_MIN_LEN
          ? params.college.trim().slice(0, COLLEGE_MAX_LEN)
          : existing?.college || 'Engineering College';

      const fallbackDetails =
        typeof params.studentDetails === 'string'
          ? params.studentDetails.trim().slice(0, STUDENT_DETAILS_MAX_LEN)
          : existing?.studentDetails || '';

      const allocation = this.allocateNextEdrawId(db);
      const now = new Date(this.nowProvider()).toISOString();

      const completed: ServerRegistrationRecord = {
        uid,
        name: fallbackName,
        email,
        college: fallbackCollege,
        studentDetails: fallbackDetails,
        edrawId: allocation.edrawId,
        registrationStatus: 'verified',
        verified: true,
        emailVerifiedAt: now,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        verificationCodeAttempts: 0,
      };

      db.nextCounter = allocation.nextCounter;
      db.records[uid] = completed;

      try {
        this.writeDb(db);
      } catch {
        return {
          success: false,
          status: 500,
          error: 'Could not persist your allocated eDraw ID due to a temporary storage error. Please retry.',
        };
      }

      return {
        success: true,
        alreadyAllocated: false,
        record: completed,
        student: toRegistrationProfileSummary(completed),
      };
    });
  }

  async getRegistrationByToken(authHeader: string | undefined): Promise<
    | {
        success: true;
        record: ServerRegistrationRecord | null;
        student: StudentProfileSummary | null;
      }
    | { success: false; status: number; error: string }
  > {
    const authResult = await this.authenticateRequest(authHeader);
    if (!authResult.ok) {
      return { success: false, status: authResult.status, error: authResult.error };
    }

    const db = this.readDb();
    const existing = db.records[authResult.caller.uid] || null;

    return {
      success: true,
      record: existing,
      student: existing ? toRegistrationProfileSummary(existing) : null,
    };
  }
}
