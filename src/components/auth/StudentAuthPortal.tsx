/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import {
  type StudentProfileSummary,
  type FirebaseRegistrationInput,
  type FieldErrors,
  isValidEdrawId,
  isValidEmail,
  normalizeEdrawId,
  normalizeEmail,
  validateFirebaseRegistrationInput,
} from '../../utils/studentAuthValidation';
import { signInStudentWithGoogle } from '../../firebase';
import { syncVerifiedStudentToFirestore } from '../../utils/firestoreStudentSync';

type AuthScreen = 'login' | 'register' | 'success';

interface StudentAuthPortalProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onLoginSuccess: (student: StudentProfileSummary, sessionToken: string) => void;
}

function GoogleGIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function mapGoogleAuthError(err: any, fallback: string): string {
  const code = typeof err?.code === 'string' ? err.code : '';
  switch (code) {
    case 'auth/popup-blocked':
      return 'The Google sign-in popup was blocked by your browser. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled before completion.';
    case 'auth/unauthorized-domain':
      return 'This preview domain is not yet allowlisted in Firebase Authentication Authorized Domains.';
    case 'auth/google-script-blocked':
      return 'Could not reach accounts.google.com to open Google Sign-In. Register with Email & Password below instead.';
    case 'auth/google-oauth-failed':
      return err?.message
        ? `Google Sign-In could not complete (${err.message}). Try again or use Email & Password.`
        : 'Google Sign-In could not complete on this browser. Try again or use Email & Password.';
    case 'auth/network-request-failed':
      return 'Network error communicating with authentication services. Please check your connection and retry.';
    default:
      return fallback;
  }
}

export const StudentAuthPortal: React.FC<StudentAuthPortalProps> = ({
  isDark,
  onToggleTheme,
  onLoginSuccess,
}) => {
  const [screen, setScreen] = useState<AuthScreen>('login');

  // Login form state (supports Registered Email OR EDID-XXXX)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loginServerError, setLoginServerError] = useState<string | null>(null);
  const [loginNetworkHelpNeeded, setLoginNetworkHelpNeeded] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false);

  // Direct Registration form state (instant DB registration, non-duplicable email)
  const [regForm, setRegForm] = useState<FirebaseRegistrationInput>({
    name: '',
    email: '',
    college: '',
    studentDetails: '',
    password: '',
    confirmPassword: '',
  });
  const [regFieldErrors, setRegFieldErrors] = useState<FieldErrors<FirebaseRegistrationInput>>({});
  const [regServerError, setRegServerError] = useState<string | null>(null);
  const [regNetworkHelpNeeded, setRegNetworkHelpNeeded] = useState(false);
  const [regDuplicateEmail, setRegDuplicateEmail] = useState<string | null>(null);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Completed registration state
  const [registeredStudent, setRegisteredStudent] = useState<StudentProfileSummary | null>(null);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [firestoreSynced, setFirestoreSynced] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginServerError(null);
    setLoginNetworkHelpNeeded(false);
    setLoginNotice(null);

    const rawIdentifier = loginIdentifier.trim();
    const nextErrors: { identifier?: string; password?: string } = {};

    if (!rawIdentifier) {
      nextErrors.identifier = 'Enter your registered email address or eDraw ID (EDID-XXXX).';
    } else if (!isValidEdrawId(rawIdentifier) && !isValidEmail(rawIdentifier)) {
      nextErrors.identifier = 'Enter a valid email address or eDraw ID (EDID-XXXX).';
    }

    if (!loginPassword) {
      nextErrors.password = 'Enter your password.';
    }

    setLoginErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoggingIn(true);
    try {
      const normalizedIdentifier = isValidEdrawId(rawIdentifier)
        ? normalizeEdrawId(rawIdentifier)
        : normalizeEmail(rawIdentifier);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: normalizedIdentifier,
          password: loginPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.student || !data.token) {
        setLoginServerError(data.error || 'Invalid email address, eDraw ID, or password.');
        return;
      }

      onLoginSuccess(data.student as StudentProfileSummary, String(data.token));
    } catch {
      setLoginServerError('Unable to reach the server right now. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegServerError(null);
    setRegNetworkHelpNeeded(false);
    setRegDuplicateEmail(null);

    const normalizedEmail = normalizeEmail(regForm.email);
    const cleanedForm: FirebaseRegistrationInput = {
      ...regForm,
      email: normalizedEmail,
    };
    setRegForm(cleanedForm);

    const errors = validateFirebaseRegistrationInput(cleanedForm);
    setRegFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsRegistering(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanedForm.name.trim(),
          email: normalizedEmail,
          college: cleanedForm.college.trim(),
          studentDetails: cleanedForm.studentDetails.trim(),
          password: cleanedForm.password,
          confirmPassword: cleanedForm.confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.student?.edrawId || !data.token) {
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
          setRegFieldErrors(data.fieldErrors as FieldErrors<FirebaseRegistrationInput>);
        }
        if (res.status === 409) {
          setRegDuplicateEmail(normalizedEmail);
        }
        setRegServerError(
          data.error || 'Unable to complete registration right now. Please try again.'
        );
        return;
      }

      setRegisteredStudent(data.student as StudentProfileSummary);
      setActiveSessionToken(String(data.token));
      setFirestoreSynced(false);
      setScreen('success');
    } catch {
      setRegServerError('Unable to reach the server right now. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleGoogleStudentAuth = async (source: 'login' | 'register') => {
    if (source === 'login') {
      setLoginServerError(null);
      setLoginNetworkHelpNeeded(false);
      setLoginNotice(null);
    } else {
      setRegServerError(null);
      setRegNetworkHelpNeeded(false);
      setRegDuplicateEmail(null);
    }

    setIsGoogleAuthLoading(true);
    try {
      const session = await signInStudentWithGoogle();
      const idToken = session.idToken;

      const meRes = await fetch('/api/registration/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const meData = await meRes.json();

      if (meRes.ok && meData.success && meData.student?.edrawId) {
        const student = meData.student as StudentProfileSummary;
        const fsResult = await syncVerifiedStudentToFirestore(student);
        setFirestoreSynced(fsResult.synced);
        if (source === 'login') {
          onLoginSuccess(student, idToken);
          return;
        }
        setRegisteredStudent(student);
        setActiveSessionToken(idToken);
        setScreen('success');
        return;
      }

      const completeRes = await fetch('/api/registration/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: regForm.name.trim() || session.displayName || undefined,
          college: regForm.college.trim() || undefined,
          studentDetails: regForm.studentDetails.trim() || undefined,
        }),
      });
      const completeData = await completeRes.json();

      if (!completeRes.ok || !completeData.success || !completeData.student?.edrawId) {
        const errMsg =
          completeData.error || 'Could not save your registration in the database. Please try again.';
        if (source === 'login') {
          setLoginServerError(errMsg);
        } else {
          if (completeRes.status === 409 && session.email) {
            setRegDuplicateEmail(normalizeEmail(session.email));
          }
          setRegServerError(errMsg);
        }
        return;
      }

      const student = completeData.student as StudentProfileSummary;
      const fsResult = await syncVerifiedStudentToFirestore(student);
      setFirestoreSynced(fsResult.synced);
      setRegisteredStudent(student);
      setActiveSessionToken(idToken);
      setScreen('success');
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      const msg = mapGoogleAuthError(
        err,
        'Unable to sign in with Google right now. Please try again.'
      );
      if (source === 'login') {
        if (code === 'auth/network-request-failed') setLoginNetworkHelpNeeded(true);
        setLoginServerError(msg);
      } else {
        if (code === 'auth/network-request-failed') setRegNetworkHelpNeeded(true);
        setRegServerError(msg);
      }
    } finally {
      setIsGoogleAuthLoading(false);
    }
  };

  const handleCopyEdrawId = (edrawId: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(edrawId);
    }
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  return (
    <div
      className={`min-h-screen font-['Space_Grotesk',sans-serif] ${
        isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-[#F8F7FC] text-[#202044]'
      } transition-colors duration-200 flex items-stretch`}
    >
      <div className="w-full max-w-[1440px] mx-auto min-h-screen grid grid-cols-1 lg:grid-cols-12">
        {/* Left Brand & Engineering Drafting Stage */}
        <section
          aria-label="EDraw Engineering Graphics Overview"
          className="hidden lg:flex lg:col-span-5 xl:col-span-6 p-5 flex-col"
        >
          <div
            className="relative flex-1 rounded-[28px] p-10 xl:p-12 text-white flex flex-col justify-between overflow-hidden shadow-[0_24px_60px_-20px_rgba(74,27,174,0.45)]"
            style={{
              background: 'linear-gradient(155deg, #6E34E8 0%, #5621CC 56%, #3E159B 100%)',
            }}
          >
            {/* Precision Blueprint Grid Pattern */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
                backgroundSize: '36px 36px',
              }}
              aria-hidden="true"
            />

            {/* Top Brand Lockup */}
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-xs flex items-center justify-center shrink-0">
                <svg viewBox="0 0 40 40" className="w-7 h-7 text-white" fill="none" aria-hidden="true">
                  <path
                    d="M9 10L20 5L31 10V24L20 30L9 24V10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 5V18M20 18L31 24M20 18L9 24"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeDasharray="2.5 2.5"
                  />
                  <circle cx="20" cy="18" r="3" fill="currentColor" />
                </svg>
              </div>
              <div>
                <div className="text-xl font-bold tracking-wider leading-none">EDRAW</div>
                <div className="text-xs text-white/80 font-medium mt-1">
                  Interactive Engineering Graphics Studio
                </div>
              </div>
            </div>

            {/* Center Editorial Copy + Orthographic Blueprint Diagram */}
            <div className="relative z-10 my-8 space-y-8">
              <div className="max-w-lg space-y-3">
                <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-[1.15] [text-wrap:balance]">
                  Master First-Angle Projections in 3D and 2D.
                </h1>
                <p className="text-sm xl:text-[15px] text-white/85 leading-relaxed">
                  Visualize points across quadrants, step through 8-stage rotating line constructions,
                  and parse textbook problems directly into BIS SP 46 orthographic sheets.
                </p>
              </div>

              {/* Clean Orthographic First-Angle Projection Technical Graphic */}
              <div className="rounded-2xl bg-[#270D66]/45 border border-white/15 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between text-[11px] font-mono text-white/75 mb-3">
                  <span>FIRST-ANGLE PROJECTION · HP / VP REFERENCE</span>
                  <span>BIS SP 46:2003</span>
                </div>
                <svg
                  viewBox="0 0 420 175"
                  className="w-full h-auto"
                  role="img"
                  aria-label="First-angle orthographic projection diagram showing XY line, front view a'b', and top view ab"
                >
                  <line x1="20" y1="88" x2="400" y2="88" stroke="#E9E2FF" strokeWidth="1.5" />
                  <text x="12" y="92" fill="#E9E2FF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    X
                  </text>
                  <text x="404" y="92" fill="#E9E2FF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    Y
                  </text>
                  <text x="352" y="24" fill="#FCA5A5" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    VP (FV)
                  </text>
                  <text x="352" y="160" fill="#93C5FD" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    HP (TV)
                  </text>
                  <line
                    x1="82"
                    y1="30"
                    x2="328"
                    y2="30"
                    stroke="#FDE68A"
                    strokeWidth="1"
                    strokeDasharray="5 4"
                    opacity="0.75"
                  />
                  <line
                    x1="82"
                    y1="150"
                    x2="328"
                    y2="150"
                    stroke="#A7F3D0"
                    strokeWidth="1"
                    strokeDasharray="5 4"
                    opacity="0.75"
                  />
                  <line x1="100" y1="62" x2="100" y2="116" stroke="#C4B5FD" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="258" y1="30" x2="258" y2="150" stroke="#C4B5FD" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="100" y1="62" x2="292" y2="30" stroke="#C084FC" strokeWidth="1.4" strokeDasharray="4 3" />
                  <line x1="100" y1="116" x2="280" y2="150" stroke="#67E8F9" strokeWidth="1.4" strokeDasharray="4 3" />
                  <line x1="100" y1="62" x2="258" y2="30" stroke="#F87171" strokeWidth="2.6" strokeLinecap="round" />
                  <line x1="100" y1="116" x2="258" y2="150" stroke="#60A5FA" strokeWidth="2.6" strokeLinecap="round" />
                  <circle cx="100" cy="62" r="3.5" fill="#F87171" />
                  <circle cx="258" cy="30" r="3.5" fill="#F87171" />
                  <circle cx="100" cy="116" r="3.5" fill="#60A5FA" />
                  <circle cx="258" cy="150" r="3.5" fill="#60A5FA" />
                  <circle cx="292" cy="30" r="3" fill="#C084FC" />
                  <circle cx="280" cy="150" r="3" fill="#67E8F9" />
                  <text x="84" y="58" fill="#FFFFFF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    a′
                  </text>
                  <text x="252" y="21" fill="#FFFFFF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    b′
                  </text>
                  <text x="296" y="26" fill="#DDD6FE" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    b₁′ (TL)
                  </text>
                  <text x="86" y="128" fill="#FFFFFF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    a
                  </text>
                  <text x="254" y="166" fill="#FFFFFF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    b
                  </text>
                  <text x="285" y="161" fill="#A5F3FC" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    b₂ (TL)
                  </text>
                </svg>
              </div>
            </div>

            {/* Bottom Quiet Curriculum Summary */}
            <div className="relative z-10 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-white/80">
              <span>Student Drafting Portal</span>
              <span className="font-mono text-[11px] text-white/75">
                EDID-XXXX · Unique Student Access
              </span>
            </div>
          </div>
        </section>

        {/* Right Interactive Authentication Stage */}
        <section className="col-span-1 lg:col-span-7 xl:col-span-6 flex flex-col justify-between px-5 py-6 sm:px-10 sm:py-8">
          {/* Top Utility Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7138E8] to-[#5722C9] text-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 40 40" className="w-5 h-5" fill="none" aria-hidden="true">
                  <path
                    d="M9 10L20 5L31 10V24L20 30L9 24V10Z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <circle cx="20" cy="18" r="3" fill="currentColor" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-wider text-[#202044] dark:text-slate-100">
                EDRAW
              </span>
            </div>
            <div className="hidden lg:block text-xs text-[#77758F] dark:text-slate-400">
              Engineering Drawing Simulator · Student Access
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="w-9 h-9 rounded-xl bg-[#F1EBFF] dark:bg-slate-800 hover:bg-[#E6DAFF] dark:hover:bg-slate-700 text-[#7138E8] dark:text-amber-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Toggle color theme"
              title={isDark ? 'Switch to Light Studio' : 'Switch to CAD Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Centered Auth Card */}
          <div className="w-full max-w-[480px] mx-auto my-auto py-8">
            {/* ==================== VIEW 1: STUDENT LOGIN ==================== */}
            {screen === 'login' && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-9 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)]">
                <div className="space-y-1.5 mb-7">
                  <h2 className="text-2xl font-bold tracking-tight text-[#202044] dark:text-slate-100">
                    Student Sign In
                  </h2>
                  <p className="text-sm text-[#6E6C84] dark:text-slate-400">
                    Sign in with your registered email address or eDraw ID to open your dashboard.
                  </p>
                </div>

                {loginNotice && (
                  <div
                    role="status"
                    className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{loginNotice}</p>
                  </div>
                )}

                {loginServerError && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="font-medium leading-relaxed">{loginServerError}</p>
                      {loginNetworkHelpNeeded && (
                        <div className="space-y-1.5 pt-1 border-t border-rose-200/80 dark:border-rose-800/60">
                          <p className="text-[11px] leading-relaxed">
                            Your browser could not reach Google authentication services (check
                            connectivity or pause content blockers blocking{' '}
                            <span className="font-mono">googleapis.com</span> /{' '}
                            <span className="font-mono">accounts.google.com</span>).
                          </p>
                          {typeof window !== 'undefined' && window.self !== window.top && (
                            <a
                              href={window.location.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#612AD6] dark:text-purple-300 underline underline-offset-2 hover:opacity-80"
                            >
                              <span>Open EDraw in New Tab</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} noValidate className="space-y-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-identifier"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Registered Email or eDraw ID
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-identifier"
                        name="identifier"
                        type="text"
                        autoComplete="username"
                        value={loginIdentifier}
                        onChange={(e) => {
                          setLoginIdentifier(e.target.value);
                          setLoginErrors((prev) => ({ ...prev, identifier: undefined }));
                        }}
                        placeholder="student@college.edu or EDID-1000"
                        maxLength={120}
                        aria-invalid={Boolean(loginErrors.identifier)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          loginErrors.identifier
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {loginErrors.identifier ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {loginErrors.identifier}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#77758F] dark:text-slate-400">
                        Enter your registered email address or <span className="font-mono">EDID-XXXX</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        name="password"
                        type={showLoginPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          setLoginErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        placeholder="Enter your password"
                        aria-invalid={Boolean(loginErrors.password)}
                        className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          loginErrors.password
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#77758F] hover:text-[#202044] dark:hover:text-slate-200 cursor-pointer"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {loginErrors.password}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || isGoogleAuthLoading}
                    className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isLoggingIn ? 'Signing in...' : 'Sign In to Dashboard'}</span>
                    {!isLoggingIn && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                <div className="relative my-5 flex items-center">
                  <div className="flex-1 border-t border-[#EEEAF8] dark:border-slate-800" />
                  <span className="px-3 text-[11px] font-medium text-[#77758F] dark:text-slate-400">
                    or
                  </span>
                  <div className="flex-1 border-t border-[#EEEAF8] dark:border-slate-800" />
                </div>

                <button
                  type="button"
                  disabled={isGoogleAuthLoading || isLoggingIn}
                  onClick={() => void handleGoogleStudentAuth('login')}
                  className="w-full h-11 px-5 rounded-xl border border-[#DFD7F4] dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-[#F8F7FC] dark:hover:bg-slate-800 disabled:opacity-60 text-sm font-semibold text-[#202044] dark:text-slate-100 transition-colors flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
                >
                  {isGoogleAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#6B32E4]" />
                  ) : (
                    <GoogleGIcon />
                  )}
                  <span>
                    {isGoogleAuthLoading ? 'Signing in with Google...' : 'Continue with Google'}
                  </span>
                </button>

                <div className="mt-6 pt-5 border-t border-[#EEEAF8] dark:border-slate-800 text-center">
                  <p className="text-xs text-[#6E6C84] dark:text-slate-400 mb-2">
                    New to EDraw and need an eDraw ID?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRegServerError(null);
                      setRegDuplicateEmail(null);
                      setRegFieldErrors({});
                      setScreen('register');
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B32E4] dark:text-purple-400 hover:text-[#4F1EC0] dark:hover:text-purple-300 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                  >
                    <span>Register as a New Student</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ==================== VIEW 2: REGISTER STUDENT ==================== */}
            {screen === 'register' && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-9 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)]">
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setScreen('login')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6C84] dark:text-slate-400 hover:text-[#202044] dark:hover:text-slate-100 mb-4 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>

                  <h2 className="text-2xl font-bold tracking-tight text-[#202044] dark:text-slate-100">
                    Register Student
                  </h2>
                  <p className="text-sm text-[#6E6C84] dark:text-slate-400 mt-1">
                    Register your email once to save your account immediately and receive your unique{' '}
                    <span className="font-mono font-semibold text-[#6B32E4] dark:text-purple-300">
                      EDID-XXXX
                    </span>{' '}
                    student identifier.
                  </p>
                </div>

                {regServerError && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="font-medium leading-relaxed">{regServerError}</p>
                      {regNetworkHelpNeeded && (
                        <div className="space-y-1.5 pt-1 border-t border-rose-200/80 dark:border-rose-800/60">
                          <p className="text-[11px] leading-relaxed">
                            Your browser could not reach Google authentication services. You can
                            register directly with Email &amp; Password below.
                          </p>
                          {typeof window !== 'undefined' && window.self !== window.top && (
                            <a
                              href={window.location.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#612AD6] dark:text-purple-300 underline underline-offset-2 hover:opacity-80"
                            >
                              <span>Open EDraw in New Tab</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                      {regDuplicateEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setLoginIdentifier(regDuplicateEmail);
                            setLoginPassword('');
                            setLoginServerError(null);
                            setLoginNotice('Sign in below with your existing account password.');
                            setScreen('login');
                          }}
                          className="font-semibold text-[#6B32E4] dark:text-purple-300 underline underline-offset-2 cursor-pointer"
                        >
                          Go to Sign In with {regDuplicateEmail}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
                  {/* 1. Full Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        maxLength={80}
                        value={regForm.name}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, name: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        placeholder="e.g. Arjun Menon"
                        aria-invalid={Boolean(regFieldErrors.name)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.name
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {regFieldErrors.name && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{regFieldErrors.name}</p>
                    )}
                  </div>

                  {/* 2. Email Address */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={120}
                        value={regForm.email}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, email: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, email: undefined }));
                          setRegDuplicateEmail(null);
                        }}
                        onBlur={() =>
                          setRegForm((prev) => ({ ...prev, email: normalizeEmail(prev.email) }))
                        }
                        placeholder="student@college.edu or name@gmail.com"
                        aria-invalid={Boolean(regFieldErrors.email)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.email
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {regFieldErrors.email && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{regFieldErrors.email}</p>
                    )}
                  </div>

                  {/* 3. College Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-college"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      College / Institution
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-college"
                        name="college"
                        type="text"
                        autoComplete="organization"
                        maxLength={120}
                        value={regForm.college}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, college: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, college: undefined }));
                        }}
                        placeholder="e.g. Madras Institute of Technology"
                        aria-invalid={Boolean(regFieldErrors.college)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.college
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {regFieldErrors.college && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {regFieldErrors.college}
                      </p>
                    )}
                  </div>

                  {/* 4. Student Details */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-student-details"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Student Details <span className="font-normal text-[#77758F]">(Department / Roll No.)</span>
                    </label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-student-details"
                        name="studentDetails"
                        type="text"
                        maxLength={120}
                        value={regForm.studentDetails}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, studentDetails: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, studentDetails: undefined }));
                        }}
                        placeholder="e.g. Mechanical Engineering · Roll 24ME108"
                        aria-invalid={Boolean(regFieldErrors.studentDetails)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.studentDetails
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {regFieldErrors.studentDetails && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {regFieldErrors.studentDetails}
                      </p>
                    )}
                  </div>

                  {/* 5. Set Password */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Set Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-password"
                        name="password"
                        type={showRegPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        maxLength={128}
                        value={regForm.password}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, password: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        placeholder="Minimum 8 characters with letters & numbers"
                        aria-invalid={Boolean(regFieldErrors.password)}
                        className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.password
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#77758F] hover:text-[#202044] dark:hover:text-slate-200 cursor-pointer"
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {regFieldErrors.password && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {regFieldErrors.password}
                      </p>
                    )}
                  </div>

                  {/* 6. Confirm Password */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-confirm-password"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-confirm-password"
                        name="confirmPassword"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        maxLength={128}
                        value={regForm.confirmPassword}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }}
                        placeholder="Re-enter your password"
                        aria-invalid={Boolean(regFieldErrors.confirmPassword)}
                        className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.confirmPassword
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#77758F] hover:text-[#202044] dark:hover:text-slate-200 cursor-pointer"
                        aria-label={showRegConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showRegConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {regFieldErrors.confirmPassword && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {regFieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isRegistering || isGoogleAuthLoading}
                    className="w-full h-11 px-5 mt-2 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {isRegistering ? 'Registering Account...' : 'Register & Get eDraw ID'}
                    </span>
                    {!isRegistering && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                <div className="relative my-5 flex items-center">
                  <div className="flex-1 border-t border-[#EEEAF8] dark:border-slate-800" />
                  <span className="px-3 text-[11px] font-medium text-[#77758F] dark:text-slate-400">
                    or register with Google
                  </span>
                  <div className="flex-1 border-t border-[#EEEAF8] dark:border-slate-800" />
                </div>

                <button
                  type="button"
                  disabled={isGoogleAuthLoading || isRegistering}
                  onClick={() => void handleGoogleStudentAuth('register')}
                  className="w-full h-11 px-5 rounded-xl border border-[#DFD7F4] dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-[#F8F7FC] dark:hover:bg-slate-800 disabled:opacity-60 text-sm font-semibold text-[#202044] dark:text-slate-100 transition-colors flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
                >
                  {isGoogleAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#6B32E4]" />
                  ) : (
                    <GoogleGIcon />
                  )}
                  <span>
                    {isGoogleAuthLoading
                      ? 'Completing Google Registration...'
                      : 'Continue with Google (Instant eDraw ID)'}
                  </span>
                </button>
              </div>
            )}

            {/* ==================== VIEW 3: REGISTRATION SUCCESSFUL / YOUR EDRAW ID ==================== */}
            {screen === 'success' && registeredStudent && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-8 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                      Registration Successful
                    </h2>
                    <p className="text-xs text-[#6E6C84] dark:text-slate-400 mt-0.5 leading-relaxed">
                      <span className="font-medium text-[#202044] dark:text-slate-200">
                        {registeredStudent.gmail}
                      </span>{' '}
                      has been added to the database and your unique eDraw ID is ready.
                    </p>
                  </div>
                </div>

                {/* Official Allocated eDraw ID Box */}
                <div className="p-4 rounded-2xl bg-[#F5F1FF] dark:bg-slate-800/80 border border-[#DFD4FA] dark:border-purple-800/50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[#6E6C84] dark:text-slate-400">
                      Your Official eDraw ID
                    </div>
                    <div
                      data-testid="verified-edraw-id"
                      className="text-2xl font-bold font-mono tabular-nums tracking-wider text-[#5923CC] dark:text-purple-300 mt-0.5"
                    >
                      {registeredStudent.edrawId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyEdrawId(registeredStudent.edrawId)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#DFD4FA] dark:border-slate-700 text-xs font-semibold text-[#202044] dark:text-slate-200 hover:bg-[#EFE8FF] dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Registered Student Details Summary */}
                <div className="p-4 rounded-2xl bg-[#FAF9FE] dark:bg-slate-950 border border-[#ECE7F8] dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">Student Name</span>
                    <span className="font-semibold text-[#202044] dark:text-slate-100 truncate">
                      {registeredStudent.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">Email</span>
                    <span className="font-medium text-[#202044] dark:text-slate-200 truncate">
                      {registeredStudent.gmail}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">College</span>
                    <span className="font-medium text-[#202044] dark:text-slate-200 truncate">
                      {registeredStudent.college}
                    </span>
                  </div>
                  {registeredStudent.studentDetails && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#77758F] dark:text-slate-400">Student Details</span>
                      <span className="font-medium text-[#202044] dark:text-slate-200 truncate">
                        {registeredStudent.studentDetails}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">Database Status</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {firestoreSynced ? 'Saved to Cloud Firestore' : 'Saved to Database (Unique)'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onLoginSuccess(registeredStudent, activeSessionToken || '')
                  }
                  className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <span>Enter EDraw Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Quiet Footer */}
          <footer className="text-center lg:text-left text-[11px] text-[#77758F] dark:text-slate-500 font-mono">
            EDraw Engineering Graphics · BIS SP 46:2003 &amp; ISO 128 Standard
          </footer>
        </section>
      </div>
    </div>
  );
};
