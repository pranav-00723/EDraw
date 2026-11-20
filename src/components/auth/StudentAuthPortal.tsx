/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  User,
  AlertCircle,
  ExternalLink,
  Inbox,
} from 'lucide-react';
import {
  type StudentProfileSummary,
  type VerificationEmailMessage,
  type RegistrationFormInput,
  type LoginFormInput,
  type FieldErrors,
  normalizeEdrawId,
  validateLoginInput,
  validateRegistrationInput,
} from '../../utils/studentAuthValidation';

type AuthScreen = 'login' | 'register' | 'verify';

interface StudentAuthPortalProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onLoginSuccess: (student: StudentProfileSummary, sessionToken: string) => void;
  initialVerifyToken?: string | null;
  onConsumedVerifyToken?: () => void;
}

export const StudentAuthPortal: React.FC<StudentAuthPortalProps> = ({
  isDark,
  onToggleTheme,
  onLoginSuccess,
  initialVerifyToken,
  onConsumedVerifyToken,
}) => {
  const [screen, setScreen] = useState<AuthScreen>(initialVerifyToken ? 'verify' : 'login');

  // Login form state
  const [loginForm, setLoginForm] = useState<LoginFormInput>({
    edrawId: '',
    password: '',
  });
  const [loginFieldErrors, setLoginFieldErrors] = useState<FieldErrors<LoginFormInput>>({});
  const [loginServerError, setLoginServerError] = useState<string | null>(null);
  const [unverifiedGmail, setUnverifiedGmail] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration form state
  const [regForm, setRegForm] = useState<RegistrationFormInput>({
    name: '',
    gmail: '',
    college: '',
    password: '',
    confirmPassword: '',
  });
  const [regFieldErrors, setRegFieldErrors] = useState<FieldErrors<RegistrationFormInput>>({});
  const [regServerError, setRegServerError] = useState<string | null>(null);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Gmail verification & inbox state
  const [pendingGmail, setPendingGmail] = useState<string>('');
  const [pendingStudentName, setPendingStudentName] = useState<string>('');
  const [deliveryMode, setDeliveryMode] = useState<'smtp' | 'preview'>('preview');
  const [inboxMessages, setInboxMessages] = useState<VerificationEmailMessage[]>([]);
  const [verifyStatusMessage, setVerifyStatusMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState<StudentProfileSummary | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const verifyTokenOnServer = useCallback(
    async (token: string) => {
      setIsVerifyingToken(true);
      setVerifyError(null);
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setVerifyError(data.error || 'Unable to verify your Gmail link.');
          return;
        }

        const student = data.student as StudentProfileSummary;
        setVerifiedStudent(student);
        setPendingGmail(student.gmail);
        setPendingStudentName(student.name);
        setDeliveryMode(data.deliveryMode === 'smtp' ? 'smtp' : 'preview');
        setVerifyStatusMessage(data.message);

        if (data.confirmationEmail) {
          setInboxMessages((prev) => {
            const exists = prev.some((m) => m.kind === 'verified_edraw_id');
            if (exists) return prev;
            return [data.confirmationEmail as VerificationEmailMessage, ...prev];
          });
        }
      } catch {
        setVerifyError('Network error while verifying your Gmail link. Please try again.');
      } finally {
        setIsVerifyingToken(false);
      }
    },
    []
  );

  // Handle direct Gmail link arrival (`/?verifyToken=...`)
  useEffect(() => {
    if (!initialVerifyToken) return;
    setScreen('verify');
    void verifyTokenOnServer(initialVerifyToken);
    onConsumedVerifyToken?.();
  }, [initialVerifyToken, onConsumedVerifyToken, verifyTokenOnServer]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginServerError(null);
    setUnverifiedGmail(null);

    const normalizedId = normalizeEdrawId(loginForm.edrawId);
    const errors = validateLoginInput({ edrawId: normalizedId, password: loginForm.password });
    setLoginFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edrawId: normalizedId,
          password: loginForm.password,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginServerError(data.error || 'Invalid eDraw ID or password.');
        if (data.unverifiedGmail) {
          setUnverifiedGmail(data.unverifiedGmail);
        }
        return;
      }

      onLoginSuccess(data.student as StudentProfileSummary, String(data.token));
    } catch {
      setLoginServerError('Unable to reach the authentication server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegServerError(null);

    const errors = validateRegistrationInput(regForm);
    setRegFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsRegistering(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setRegServerError(data.error || 'Could not complete registration.');
        if (data.fieldErrors) {
          setRegFieldErrors(data.fieldErrors);
        }
        return;
      }

      setPendingGmail(data.gmail);
      setPendingStudentName(data.studentName);
      setDeliveryMode(data.deliveryMode === 'smtp' ? 'smtp' : 'preview');
      setVerifyStatusMessage(data.message);
      setVerifyError(null);
      setVerifiedStudent(null);
      setInboxMessages(data.previewEmail ? [data.previewEmail as VerificationEmailMessage] : []);
      setScreen('verify');
    } catch {
      setRegServerError('Unable to reach the registration server. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleResendVerification = async (targetGmail?: string) => {
    const email = (targetGmail || pendingGmail || '').trim();
    if (!email) return;

    setIsResending(true);
    setVerifyError(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmail: email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerifyError(data.error || 'Could not resend verification link.');
        return;
      }

      setPendingGmail(data.gmail);
      setPendingStudentName(data.studentName);
      setDeliveryMode(data.deliveryMode === 'smtp' ? 'smtp' : 'preview');
      setVerifyStatusMessage(data.message);
      setVerifiedStudent(null);
      if (data.previewEmail) {
        setInboxMessages([data.previewEmail as VerificationEmailMessage]);
      }
      setScreen('verify');
    } catch {
      setVerifyError('Network error while resending verification link.');
    } finally {
      setIsResending(false);
    }
  };

  const handleProceedToLoginWithId = (edrawId: string) => {
    setLoginForm({ edrawId, password: '' });
    setLoginFieldErrors({});
    setLoginServerError(null);
    setUnverifiedGmail(null);
    setScreen('login');
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
                  {/* Reference XY line */}
                  <line x1="20" y1="88" x2="400" y2="88" stroke="#E9E2FF" strokeWidth="1.5" />
                  <text x="12" y="92" fill="#E9E2FF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    X
                  </text>
                  <text x="404" y="92" fill="#E9E2FF" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    Y
                  </text>

                  {/* VP / HP labels */}
                  <text x="352" y="24" fill="#FCA5A5" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    VP (FV)
                  </text>
                  <text x="352" y="160" fill="#93C5FD" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    HP (TV)
                  </text>

                  {/* Locus lines */}
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

                  {/* End Projectors */}
                  <line x1="100" y1="62" x2="100" y2="116" stroke="#C4B5FD" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="258" y1="30" x2="258" y2="150" stroke="#C4B5FD" strokeWidth="1" strokeDasharray="3 3" />

                  {/* True Length Construction Lines */}
                  <line x1="100" y1="62" x2="292" y2="30" stroke="#C084FC" strokeWidth="1.4" strokeDasharray="4 3" />
                  <line x1="100" y1="116" x2="280" y2="150" stroke="#67E8F9" strokeWidth="1.4" strokeDasharray="4 3" />

                  {/* Front View a'b' & Top View ab */}
                  <line x1="100" y1="62" x2="258" y2="30" stroke="#F87171" strokeWidth="2.6" strokeLinecap="round" />
                  <line x1="100" y1="116" x2="258" y2="150" stroke="#60A5FA" strokeWidth="2.6" strokeLinecap="round" />

                  {/* Vertices */}
                  <circle cx="100" cy="62" r="3.5" fill="#F87171" />
                  <circle cx="258" cy="30" r="3.5" fill="#F87171" />
                  <circle cx="100" cy="116" r="3.5" fill="#60A5FA" />
                  <circle cx="258" cy="150" r="3.5" fill="#60A5FA" />
                  <circle cx="292" cy="30" r="3" fill="#C084FC" />
                  <circle cx="280" cy="150" r="3" fill="#67E8F9" />

                  {/* Point Labels */}
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
              <span>Verified Student Portal</span>
              <span className="font-mono text-[11px] text-white/75">
                EDID-XXXX · Gmail Verified Access
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
                    Enter your verified eDraw ID and password to open the main dashboard.
                  </p>
                </div>

                {loginServerError && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="font-medium leading-relaxed">{loginServerError}</p>
                      {unverifiedGmail && (
                        <button
                          type="button"
                          onClick={() => handleResendVerification(unverifiedGmail)}
                          disabled={isResending}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#612AD6] dark:text-purple-300 underline underline-offset-2 hover:opacity-80 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                          <span>Resend Gmail verification link to {unverifiedGmail}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} noValidate className="space-y-5">
                  {/* eDraw ID */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-edraw-id"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      eDraw ID
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-edraw-id"
                        name="edrawId"
                        type="text"
                        autoComplete="username"
                        value={loginForm.edrawId}
                        onChange={(e) => {
                          setLoginForm((prev) => ({
                            ...prev,
                            edrawId: e.target.value.toUpperCase(),
                          }));
                          setLoginFieldErrors((prev) => ({ ...prev, edrawId: undefined }));
                        }}
                        placeholder="EDID-1042"
                        maxLength={9}
                        aria-invalid={Boolean(loginFieldErrors.edrawId)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm font-mono tabular-nums tracking-wide text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          loginFieldErrors.edrawId
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {loginFieldErrors.edrawId ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {loginFieldErrors.edrawId}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#77758F] dark:text-slate-400">
                        Format: <span className="font-mono">EDID-XXXX</span> (sent to your Gmail upon verification)
                      </p>
                    )}
                  </div>

                  {/* Password */}
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
                        value={loginForm.password}
                        onChange={(e) => {
                          setLoginForm((prev) => ({ ...prev, password: e.target.value }));
                          setLoginFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        placeholder="Enter your password"
                        aria-invalid={Boolean(loginFieldErrors.password)}
                        className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          loginFieldErrors.password
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
                    {loginFieldErrors.password && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {loginFieldErrors.password}
                      </p>
                    )}
                  </div>

                  {/* Primary Submit CTA */}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <span>{isLoggingIn ? 'Signing in...' : 'Sign In to Dashboard'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Separate Link Beneath Password Form for New Student Registration */}
                <div className="mt-6 pt-5 border-t border-[#EEEAF8] dark:border-slate-800 text-center">
                  <p className="text-xs text-[#6E6C84] dark:text-slate-400 mb-2">
                    New to EDraw and need an eDraw ID?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRegServerError(null);
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

            {/* ==================== VIEW 2: REGISTER STUDENT WINDOW ==================== */}
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
                    Complete your details to receive a Gmail verification link and your unique{' '}
                    <span className="font-mono font-semibold text-[#6B32E4] dark:text-purple-300">
                      EDID-XXXX
                    </span>
                    .
                  </p>
                </div>

                {regServerError && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{regServerError}</p>
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
                  {/* 1. Student Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Name
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

                  {/* 2. Google Mail ID */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-gmail"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Google Mail ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reg-gmail"
                        name="gmail"
                        type="email"
                        autoComplete="email"
                        maxLength={120}
                        value={regForm.gmail}
                        onChange={(e) => {
                          setRegForm((prev) => ({ ...prev, gmail: e.target.value }));
                          setRegFieldErrors((prev) => ({ ...prev, gmail: undefined }));
                        }}
                        placeholder="student.name@gmail.com"
                        aria-invalid={Boolean(regFieldErrors.gmail)}
                        className={`w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:ring-2 transition-colors ${
                          regFieldErrors.gmail
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-[#E2DBF2] dark:border-slate-700 focus:border-[#7138E8] focus:ring-[#7138E8]/20'
                        }`}
                      />
                    </div>
                    {regFieldErrors.gmail && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{regFieldErrors.gmail}</p>
                    )}
                  </div>

                  {/* 3. Name of the College */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-college"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      Name of the College
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
                        placeholder="e.g. National Institute of Technology"
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

                  {/* 4. Set Password */}
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

                  {/* 5. Confirm Password */}
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
                    disabled={isRegistering}
                    className="w-full h-11 px-5 mt-2 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    <span>
                      {isRegistering
                        ? 'Sending Gmail Verification...'
                        : 'Register & Send Verification Link'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* ==================== VIEW 3: GMAIL VERIFICATION & EDID-XXXX ==================== */}
            {screen === 'verify' && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-8 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] space-y-5">
                {/* Clean Step Sequence Header */}
                <div className="flex items-center gap-2 text-xs text-[#6E6C84] dark:text-slate-400 font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    1. Registered
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      verifiedStudent
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-[#6B32E4] dark:text-purple-300 font-semibold'
                    }
                  >
                    2. Gmail Verification
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      verifiedStudent
                        ? 'text-[#6B32E4] dark:text-purple-300 font-semibold'
                        : ''
                    }
                  >
                    3. eDraw ID Ready
                  </span>
                </div>

                {verifiedStudent ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                          Gmail Verified Successfully
                        </h2>
                        <p className="text-xs text-[#6E6C84] dark:text-slate-400 mt-0.5 leading-relaxed">
                          {verifiedStudent.name} ({verifiedStudent.college}) — your account for{' '}
                          <span className="font-medium text-[#202044] dark:text-slate-200">
                            {verifiedStudent.gmail}
                          </span>{' '}
                          is now active.
                        </p>
                      </div>
                    </div>

                    {/* Assigned eDraw ID Box */}
                    <div className="p-4 rounded-2xl bg-[#F5F1FF] dark:bg-slate-800/80 border border-[#DFD4FA] dark:border-purple-800/50 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-[#6E6C84] dark:text-slate-400">
                          Your Official eDraw ID
                        </div>
                        <div
                          data-testid="verified-edraw-id"
                          className="text-2xl font-bold font-mono tabular-nums tracking-wider text-[#5923CC] dark:text-purple-300 mt-0.5"
                        >
                          {verifiedStudent.edrawId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyEdrawId(verifiedStudent.edrawId)}
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

                    <button
                      type="button"
                      onClick={() => handleProceedToLoginWithId(verifiedStudent.edrawId)}
                      className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>Proceed to Login with {verifiedStudent.edrawId}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                      Verify Your Google Mail ID
                    </h2>
                    <p className="text-sm text-[#6E6C84] dark:text-slate-400 leading-relaxed">
                      {verifyStatusMessage ||
                        `We sent a verification link to ${pendingGmail || 'your Gmail address'}. Click the link to verify your account and receive your eDraw ID (EDID-XXXX).`}
                    </p>
                  </div>
                )}

                {verifyError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{verifyError}</p>
                  </div>
                )}

                {/* Gmail Inbox Preview Panel (Shown in preview mode when SMTP is not yet configured) */}
                {deliveryMode === 'preview' && inboxMessages.length > 0 && (
                  <div className="rounded-2xl border border-[#E2DBF2] dark:border-slate-700 bg-[#FAF9FE] dark:bg-slate-950 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#E8E2F5] dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-2 min-w-0">
                        <Inbox className="w-4 h-4 text-[#6B32E4] dark:text-purple-400 shrink-0" />
                        <span className="text-xs font-semibold text-[#202044] dark:text-slate-200 truncate">
                          Gmail Inbox · {pendingGmail}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[#77758F] dark:text-slate-400 whitespace-nowrap">
                        {inboxMessages.length} {inboxMessages.length === 1 ? 'message' : 'messages'}
                      </span>
                    </div>

                    <div className="divide-y divide-[#ECE7F8] dark:divide-slate-800">
                      {inboxMessages.map((msg) => (
                        <div key={msg.id} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#202044] dark:text-slate-100">
                                {msg.subject}
                              </div>
                              <div className="text-[11px] text-[#77758F] dark:text-slate-400 truncate mt-0.5">
                                From: {msg.from} · To: {msg.to}
                              </div>
                            </div>
                          </div>

                          {msg.kind === 'verification_link' && msg.verificationToken ? (
                            <div className="space-y-2.5 text-xs text-[#4A4863] dark:text-slate-300">
                              <p className="leading-relaxed">
                                Hello {msg.studentName}, click the link below to verify your Google Mail ID
                                ({msg.college}) and generate your official eDraw ID in this inbox.
                              </p>
                              <button
                                type="button"
                                disabled={isVerifyingToken || Boolean(verifiedStudent)}
                                onClick={() => void verifyTokenOnServer(msg.verificationToken!)}
                                className="px-4 py-2 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-50 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>
                                  {verifiedStudent
                                    ? 'Gmail Link Verified'
                                    : isVerifyingToken
                                    ? 'Verifying...'
                                    : 'Click to Verify Gmail & Get eDraw ID'}
                                </span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1.5 text-xs text-[#4A4863] dark:text-slate-300">
                              <p className="leading-relaxed">
                                Verification complete for <strong>{msg.studentName}</strong>. Your verified eDraw ID is{' '}
                                <span className="font-mono font-bold text-[#5923CC] dark:text-purple-300">
                                  {msg.edrawId}
                                </span>
                                . Use it with your password to sign in to the dashboard.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Secondary Actions */}
                <div className="pt-3 border-t border-[#EEEAF8] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {!verifiedStudent && pendingGmail ? (
                    <button
                      type="button"
                      onClick={() => void handleResendVerification(pendingGmail)}
                      disabled={isResending}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#6B32E4] dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                      <span>{isResending ? 'Resending...' : 'Resend Verification Link'}</span>
                    </button>
                  ) : (
                    <span className="text-[#77758F] dark:text-slate-400">
                      {pendingStudentName ? `Registered for ${pendingStudentName}` : 'Gmail Verification'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setScreen('login')}
                    className="font-semibold text-[#6E6C84] dark:text-slate-300 hover:text-[#202044] dark:hover:text-white cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
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
