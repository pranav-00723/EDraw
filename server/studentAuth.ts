/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import {
  isValidEdrawId,
  normalizeEdrawId,
  normalizeGmail,
  validateRegistrationInput,
  type StudentProfileSummary,
  type VerificationEmailMessage,
} from '../src/utils/studentAuthValidation.ts';

export interface StoredStudentRecord {
  edrawId: string;
  name: string;
  gmail: string;
  college: string;
  passwordHash: string;
  verified: boolean;
  verificationTokenHash: string | null;
  verificationExpiresAt: number | null;
  createdAt: string;
  verifiedAt: string | null;
}

interface StudentDatabaseFile {
  students: StoredStudentRecord[];
}

export interface SessionPayload {
  edrawId: string;
  gmail: string;
  exp: number;
}

export type EmailDeliveryMode = 'smtp' | 'preview';

export interface RegistrationResponsePayload {
  success: true;
  deliveryMode: EmailDeliveryMode;
  gmail: string;
  studentName: string;
  college: string;
  message: string;
  previewEmail?: VerificationEmailMessage;
}

export interface VerificationResponsePayload {
  success: true;
  deliveryMode: EmailDeliveryMode;
  student: StudentProfileSummary;
  message: string;
  confirmationEmail?: VerificationEmailMessage;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateUniqueEdrawId(existingIds: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const num = crypto.randomInt(1000, 10000);
    const candidate = `EDID-${num}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  for (let n = 1000; n <= 9999; n++) {
    const candidate = `EDID-${n}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  throw new Error('No available EDID-XXXX identifiers remain.');
}

export function createSessionToken(student: Pick<StoredStudentRecord, 'edrawId' | 'gmail'>): string {
  const payload: SessionPayload = {
    edrawId: student.edrawId,
    gmail: student.gmail,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.edrawId !== 'string' ||
      typeof parsed.gmail !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function toPublicProfile(record: StoredStudentRecord): StudentProfileSummary {
  return {
    edrawId: record.edrawId,
    name: record.name,
    gmail: record.gmail,
    college: record.college,
    verified: record.verified,
    createdAt: record.createdAt,
  };
}

function getSmtpTransporter() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!user || !pass) return null;

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== 'false';

  return {
    from: (process.env.SMTP_FROM || `EDraw Engineering Graphics <${user}>`).trim(),
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
  };
}

export class StudentAuthService {
  private readonly storePath: string;
  private readonly revokedTokens = new Set<string>();

  constructor(storePath?: string) {
    this.storePath =
      storePath || path.resolve(process.cwd(), '.edraw-data', 'students.json');
  }

  private readDb(): StudentDatabaseFile {
    try {
      if (!fs.existsSync(this.storePath)) {
        return { students: [] };
      }
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as StudentDatabaseFile;
      if (!parsed || !Array.isArray(parsed.students)) {
        return { students: [] };
      }
      return parsed;
    } catch {
      return { students: [] };
    }
  }

  private writeDb(db: StudentDatabaseFile): void {
    const dir = path.dirname(this.storePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, this.storePath);
  }

  private async dispatchVerificationEmail(params: {
    gmail: string;
    studentName: string;
    college: string;
    verificationUrl: string;
    verificationToken: string;
  }): Promise<{ deliveryMode: EmailDeliveryMode; previewEmail?: VerificationEmailMessage }> {
    const sentAt = new Date().toISOString();
    const subject = 'Verify your Google Mail ID to receive your EDraw Student ID';
    const smtp = getSmtpTransporter();

    if (smtp) {
      try {
        await smtp.transporter.sendMail({
          from: smtp.from,
          to: params.gmail,
          subject,
          text: [
            `Hello ${params.studentName},`,
            '',
            `Thank you for registering for EDraw Engineering Graphics (${params.college}).`,
            'Click the link below to verify your Google Mail ID and receive your official eDraw ID (EDID-XXXX):',
            params.verificationUrl,
            '',
            'This verification link expires in 24 hours.',
          ].join('\n'),
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #202044; padding: 24px;">
              <h2 style="color: #5722C9; margin-bottom: 12px;">Verify your EDraw Student Registration</h2>
              <p>Hello <strong>${escapeHtml(params.studentName)}</strong>,</p>
              <p>We received your registration from <strong>${escapeHtml(params.college)}</strong>. Click the button below to verify your Gmail address and activate your <strong>EDID-XXXX</strong> account:</p>
              <p style="margin: 24px 0;">
                <a href="${escapeHtml(params.verificationUrl)}" style="background: #612AD6; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 600; display: inline-block;">
                  Verify Gmail &amp; Activate EDraw ID
                </a>
              </p>
              <p style="font-size: 13px; color: #64748b;">Or copy this link into your browser:<br />${escapeHtml(params.verificationUrl)}</p>
              <p style="font-size: 12px; color: #94a3b8;">This link expires in 24 hours.</p>
            </div>
          `,
        });
        return { deliveryMode: 'smtp' };
      } catch (err) {
        console.warn('SMTP verification email failed, falling back to inbox preview:', err);
      }
    }

    return {
      deliveryMode: 'preview',
      previewEmail: {
        id: `msg-verify-${Date.now()}`,
        kind: 'verification_link',
        to: params.gmail,
        from: 'EDraw Verification <noreply@edraw.edu>',
        subject,
        sentAt,
        studentName: params.studentName,
        college: params.college,
        verificationUrl: params.verificationUrl,
        verificationToken: params.verificationToken,
      },
    };
  }

  private async dispatchVerifiedIdEmail(params: {
    gmail: string;
    studentName: string;
    college: string;
    edrawId: string;
  }): Promise<{ deliveryMode: EmailDeliveryMode; confirmationEmail?: VerificationEmailMessage }> {
    const sentAt = new Date().toISOString();
    const subject = `Your EDraw ID is Verified: ${params.edrawId}`;
    const smtp = getSmtpTransporter();

    if (smtp) {
      try {
        await smtp.transporter.sendMail({
          from: smtp.from,
          to: params.gmail,
          subject,
          text: [
            `Hello ${params.studentName},`,
            '',
            'Your Gmail address has been verified successfully!',
            `Your official EDraw ID is: ${params.edrawId}`,
            `College: ${params.college}`,
            '',
            'Use this eDraw ID along with your password on the EDraw login page to open your dashboard.',
          ].join('\n'),
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #202044; padding: 24px;">
              <h2 style="color: #059669; margin-bottom: 12px;">Gmail Verified — Your EDraw ID is Ready</h2>
              <p>Hello <strong>${escapeHtml(params.studentName)}</strong> (${escapeHtml(params.college)}),</p>
              <p>Your student account is now active. Use the eDraw ID below with your password to log in:</p>
              <div style="margin: 20px 0; padding: 16px 20px; border-radius: 12px; background: #F5F2FF; border: 1px solid #DDD3FA; font-family: monospace; font-size: 22px; font-weight: 700; color: #5722C9; text-align: center; letter-spacing: 2px;">
                ${escapeHtml(params.edrawId)}
              </div>
              <p style="font-size: 13px; color: #64748b;">Keep this eDraw ID saved in your Gmail inbox for future logins.</p>
            </div>
          `,
        });
        return { deliveryMode: 'smtp' };
      } catch (err) {
        console.warn('SMTP confirmed ID email failed, returning confirmation payload:', err);
      }
    }

    return {
      deliveryMode: 'preview',
      confirmationEmail: {
        id: `msg-verified-${Date.now()}`,
        kind: 'verified_edraw_id',
        to: params.gmail,
        from: 'EDraw Verification <noreply@edraw.edu>',
        subject,
        sentAt,
        studentName: params.studentName,
        college: params.college,
        edrawId: params.edrawId,
      },
    };
  }

  async registerStudent(
    input: {
      name: string;
      gmail: string;
      college: string;
      password: string;
      confirmPassword: string;
    },
    baseUrl: string
  ): Promise<
    | RegistrationResponsePayload
    | { success: false; status: number; error: string; fieldErrors?: Record<string, string> }
  > {
    const fieldErrors = validateRegistrationInput(input);
    if (Object.keys(fieldErrors).length > 0) {
      return {
        success: false,
        status: 400,
        error: 'Please correct the highlighted registration fields.',
        fieldErrors: fieldErrors as Record<string, string>,
      };
    }

    const name = input.name.trim();
    const gmail = normalizeGmail(input.gmail);
    const college = input.college.trim();

    const db = this.readDb();
    const existingByGmail = db.students.find((s) => s.gmail === gmail);

    if (existingByGmail && existingByGmail.verified) {
      return {
        success: false,
        status: 409,
        error: 'An account with this Google Mail ID is already registered and verified. Please sign in with your eDraw ID.',
        fieldErrors: { gmail: 'This Google Mail ID is already registered.' },
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = Date.now() + VERIFICATION_TTL_MS;
    const passwordHash = hashPassword(input.password);

    let record: StoredStudentRecord;
    if (existingByGmail && !existingByGmail.verified) {
      // Update pending unverified registration cleanly
      existingByGmail.name = name;
      existingByGmail.college = college;
      existingByGmail.passwordHash = passwordHash;
      existingByGmail.verificationTokenHash = tokenHash;
      existingByGmail.verificationExpiresAt = expiresAt;
      record = existingByGmail;
    } else {
      const existingIds = new Set(db.students.map((s) => s.edrawId));
      const edrawId = generateUniqueEdrawId(existingIds);
      record = {
        edrawId,
        name,
        gmail,
        college,
        passwordHash,
        verified: false,
        verificationTokenHash: tokenHash,
        verificationExpiresAt: expiresAt,
        createdAt: new Date().toISOString(),
        verifiedAt: null,
      };
      db.students.push(record);
    }

    this.writeDb(db);

    const safeBase = baseUrl.replace(/\/+$/, '');
    const verificationUrl = `${safeBase}/?verifyToken=${rawToken}`;

    const mailResult = await this.dispatchVerificationEmail({
      gmail: record.gmail,
      studentName: record.name,
      college: record.college,
      verificationUrl,
      verificationToken: rawToken,
    });

    return {
      success: true,
      deliveryMode: mailResult.deliveryMode,
      gmail: record.gmail,
      studentName: record.name,
      college: record.college,
      message:
        mailResult.deliveryMode === 'smtp'
          ? `A verification link has been sent to ${record.gmail}. Open your Gmail inbox and click the link to verify your account and receive your eDraw ID.`
          : `Verification link generated for ${record.gmail}. Click the link in the Gmail inbox preview below to verify your account and receive your eDraw ID.`,
      previewEmail: mailResult.previewEmail,
    };
  }

  async resendVerification(
    gmailInput: string,
    baseUrl: string
  ): Promise<
    | RegistrationResponsePayload
    | { success: false; status: number; error: string }
  > {
    const gmail = normalizeGmail(gmailInput || '');
    if (!gmail) {
      return { success: false, status: 400, error: 'Google Mail ID is required.' };
    }

    const db = this.readDb();
    const record = db.students.find((s) => s.gmail === gmail);
    if (!record) {
      return { success: false, status: 404, error: 'No registration found for this Google Mail ID.' };
    }
    if (record.verified) {
      return {
        success: false,
        status: 409,
        error: 'This Google Mail ID is already verified. Please sign in with your eDraw ID.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    record.verificationTokenHash = hashToken(rawToken);
    record.verificationExpiresAt = Date.now() + VERIFICATION_TTL_MS;
    this.writeDb(db);

    const safeBase = baseUrl.replace(/\/+$/, '');
    const verificationUrl = `${safeBase}/?verifyToken=${rawToken}`;
    const mailResult = await this.dispatchVerificationEmail({
      gmail: record.gmail,
      studentName: record.name,
      college: record.college,
      verificationUrl,
      verificationToken: rawToken,
    });

    return {
      success: true,
      deliveryMode: mailResult.deliveryMode,
      gmail: record.gmail,
      studentName: record.name,
      college: record.college,
      message:
        mailResult.deliveryMode === 'smtp'
          ? `A fresh verification link has been sent to ${record.gmail}.`
          : `A fresh verification link is ready for ${record.gmail} in the Gmail inbox preview.`,
      previewEmail: mailResult.previewEmail,
    };
  }

  async verifyEmailToken(
    rawToken: string
  ): Promise<
    | VerificationResponsePayload
    | { success: false; status: number; error: string }
  > {
    const trimmed = (rawToken || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(trimmed)) {
      return { success: false, status: 400, error: 'Invalid or malformed verification link.' };
    }

    const targetHash = hashToken(trimmed);
    const db = this.readDb();
    const record = db.students.find((s) => s.verificationTokenHash === targetHash);

    if (!record) {
      return {
        success: false,
        status: 404,
        error: 'This verification link is invalid or has already been used.',
      };
    }

    if (record.verificationExpiresAt && record.verificationExpiresAt < Date.now()) {
      return {
        success: false,
        status: 410,
        error: 'This verification link has expired. Please request a new verification link.',
      };
    }

    record.verified = true;
    record.verifiedAt = new Date().toISOString();
    record.verificationTokenHash = null;
    record.verificationExpiresAt = null;
    this.writeDb(db);

    const mailResult = await this.dispatchVerifiedIdEmail({
      gmail: record.gmail,
      studentName: record.name,
      college: record.college,
      edrawId: record.edrawId,
    });

    return {
      success: true,
      deliveryMode: mailResult.deliveryMode,
      student: toPublicProfile(record),
      message: `Your Gmail (${record.gmail}) is verified! Your official eDraw ID is ${record.edrawId}.`,
      confirmationEmail: mailResult.confirmationEmail,
    };
  }

  loginStudent(input: {
    edrawId: string;
    password: string;
  }):
    | { success: true; token: string; student: StudentProfileSummary }
    | { success: false; status: number; error: string; unverifiedGmail?: string } {
    const edrawId = normalizeEdrawId(input.edrawId || '');
    const password = typeof input.password === 'string' ? input.password : '';

    if (!isValidEdrawId(edrawId) || !password) {
      return {
        success: false,
        status: 400,
        error: 'Enter a valid eDraw ID (EDID-XXXX) and password.',
      };
    }

    const db = this.readDb();
    const record = db.students.find((s) => s.edrawId === edrawId);

    if (!record || !verifyPassword(password, record.passwordHash)) {
      return {
        success: false,
        status: 401,
        error: 'Invalid eDraw ID or password.',
      };
    }

    if (!record.verified) {
      return {
        success: false,
        status: 403,
        error: 'Your Google Mail ID is not verified yet. Please click the verification link sent to your Gmail inbox first.',
        unverifiedGmail: record.gmail,
      };
    }

    const token = createSessionToken(record);
    return {
      success: true,
      token,
      student: toPublicProfile(record),
    };
  }

  getAuthenticatedStudent(authHeader: string | undefined): StudentProfileSummary | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token || this.revokedTokens.has(token)) return null;

    const payload = verifySessionToken(token);
    if (!payload) return null;

    const db = this.readDb();
    const record = db.students.find((s) => s.edrawId === payload.edrawId && s.verified);
    if (!record) return null;

    return toPublicProfile(record);
  }

  logoutToken(authHeader: string | undefined): void {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return;
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      this.revokedTokens.add(token);
    }
  }
}
