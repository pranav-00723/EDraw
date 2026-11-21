/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const EDRAW_ID_PATTERN = /^EDID-[0-9]{4}$/;
export const OTP_CODE_PATTERN = /^\d{6}$/;
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
export const GMAIL_PATTERN = /^[a-zA-Z0-9._%+\-]+@(gmail|googlemail)\.com$/i;
export const NAME_MIN_LEN = 2;
export const NAME_MAX_LEN = 80;
export const COLLEGE_MIN_LEN = 2;
export const COLLEGE_MAX_LEN = 120;
export const STUDENT_DETAILS_MAX_LEN = 120;
export const GMAIL_MAX_LEN = 120;
export const EMAIL_MIN_LEN = 5;
export const EMAIL_MAX_LEN = 120;
export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 128;

export type RegistrationStatus = 'pending_verification' | 'verified';

export interface StudentProfileSummary {
  uid?: string;
  edrawId: string;
  name: string;
  gmail: string;
  college: string;
  studentDetails?: string;
  registrationStatus?: RegistrationStatus;
  verified: boolean;
  emailVerifiedAt?: string | null;
  createdAt: string;
}

export type GmailDispatchKind = 'verification_code' | 'verification_link' | 'verified_edraw_id';

export interface VerificationEmailMessage {
  id: string;
  kind: GmailDispatchKind;
  to: string;
  from: string;
  subject: string;
  sentAt: string;
  studentName: string;
  college: string;
  verificationUrl?: string;
  verificationToken?: string;
  edrawId?: string;
}

export interface DispatchQueueItem {
  edrawId: string;
  name: string;
  gmail: string;
  college: string;
  verified: boolean;
  createdAt: string;
  verifiedAt: string | null;
  verificationEmailSentAt: string | null;
  edrawIdEmailSentAt: string | null;
}

export interface RegistrationFormInput {
  name: string;
  gmail: string;
  college: string;
  studentDetails?: string;
  password: string;
  confirmPassword: string;
}

export interface FirebaseRegistrationInput {
  name: string;
  email: string;
  college: string;
  studentDetails: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormInput {
  edrawId: string;
  password: string;
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function normalizeEdrawId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeVerificationCode(raw: string): string {
  return raw.replace(/\D+/g, '').slice(0, 6);
}

export function isValidVerificationCode(raw: string): boolean {
  return OTP_CODE_PATTERN.test(raw.trim());
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeGmail(raw: string): string {
  return normalizeEmail(raw);
}

export function isValidEdrawId(raw: string): boolean {
  return EDRAW_ID_PATTERN.test(normalizeEdrawId(raw));
}

export function isValidEmail(raw: string): boolean {
  const normalized = normalizeEmail(raw);
  return (
    normalized.length >= EMAIL_MIN_LEN &&
    normalized.length <= EMAIL_MAX_LEN &&
    EMAIL_PATTERN.test(normalized)
  );
}

export function isValidGmail(raw: string): boolean {
  const normalized = normalizeGmail(raw);
  return normalized.length <= GMAIL_MAX_LEN && GMAIL_PATTERN.test(normalized);
}

export function validateFirebaseRegistrationInput(
  input: FirebaseRegistrationInput
): FieldErrors<FirebaseRegistrationInput> {
  const errors: FieldErrors<FirebaseRegistrationInput> = {};
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const college = input.college.trim();
  const studentDetails = input.studentDetails.trim();
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (name.length < NAME_MIN_LEN) {
    errors.name = `Enter your full name (at least ${NAME_MIN_LEN} characters).`;
  } else if (name.length > NAME_MAX_LEN) {
    errors.name = `Name must be ${NAME_MAX_LEN} characters or fewer.`;
  }

  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (college.length < COLLEGE_MIN_LEN) {
    errors.college = `Enter your college name (at least ${COLLEGE_MIN_LEN} characters).`;
  } else if (college.length > COLLEGE_MAX_LEN) {
    errors.college = `College name must be ${COLLEGE_MAX_LEN} characters or fewer.`;
  }

  if (studentDetails.length > STUDENT_DETAILS_MAX_LEN) {
    errors.studentDetails = `Student details must be ${STUDENT_DETAILS_MAX_LEN} characters or fewer.`;
  }

  if (password.length < PASSWORD_MIN_LEN) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LEN} characters long.`;
  } else if (password.length > PASSWORD_MAX_LEN) {
    errors.password = `Password must be ${PASSWORD_MAX_LEN} characters or fewer.`;
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Include at least one letter and one number in your password.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateRegistrationInput(
  input: RegistrationFormInput
): FieldErrors<RegistrationFormInput> {
  const errors: FieldErrors<RegistrationFormInput> = {};
  const name = input.name.trim();
  const gmail = normalizeGmail(input.gmail);
  const college = input.college.trim();
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (name.length < NAME_MIN_LEN) {
    errors.name = `Enter your full name (at least ${NAME_MIN_LEN} characters).`;
  } else if (name.length > NAME_MAX_LEN) {
    errors.name = `Name must be ${NAME_MAX_LEN} characters or fewer.`;
  }

  if (!gmail) {
    errors.gmail = 'Google Mail ID is required.';
  } else if (!isValidGmail(gmail)) {
    errors.gmail = 'Please enter a valid Google Mail ID ending with @gmail.com.';
  }

  if (college.length < COLLEGE_MIN_LEN) {
    errors.college = `Enter your college name (at least ${COLLEGE_MIN_LEN} characters).`;
  } else if (college.length > COLLEGE_MAX_LEN) {
    errors.college = `College name must be ${COLLEGE_MAX_LEN} characters or fewer.`;
  }

  if (password.length < PASSWORD_MIN_LEN) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LEN} characters long.`;
  } else if (password.length > PASSWORD_MAX_LEN) {
    errors.password = `Password must be ${PASSWORD_MAX_LEN} characters or fewer.`;
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Include at least one letter and one number in your password.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateLoginInput(input: LoginFormInput): FieldErrors<LoginFormInput> {
  const errors: FieldErrors<LoginFormInput> = {};
  const edrawId = normalizeEdrawId(input.edrawId);

  if (!edrawId) {
    errors.edrawId = 'Enter your eDraw ID (format: EDID-XXXX).';
  } else if (!isValidEdrawId(edrawId)) {
    errors.edrawId = 'eDraw ID must follow the format EDID-XXXX (4 digits).';
  }

  if (!input.password) {
    errors.password = 'Enter your password.';
  }

  return errors;
}
