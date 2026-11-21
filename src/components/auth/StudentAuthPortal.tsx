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
  Send,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  type DispatchQueueItem,
  type StudentProfileSummary,
  type VerificationEmailMessage,
  type FirebaseRegistrationInput,
  type FieldErrors,
  isValidEdrawId,
  isValidEmail,
  isValidVerificationCode,
  normalizeEdrawId,
  normalizeEmail,
  normalizeVerificationCode,
  validateFirebaseRegistrationInput,
} from '../../utils/studentAuthValidation';
import {
  OFFICIAL_SENDER_GMAIL,
  applyFirebaseVerificationCode,
  auth,
  getGmailAccessToken,
  initGmailAuth,
  registerStudentWithFirebase,
  reloadFirebaseUserAndGetToken,
  signInGmailSender,
  signInStudentWithFirebase,
  signOutGmailSender,
} from '../../firebase';
import { syncVerifiedStudentToFirestore } from '../../utils/firestoreStudentSync';
import {
  GmailConfirmModal,
  type PendingGmailConfirmation,
} from './GmailConfirmModal';
import { GmailDispatcherPanel } from './GmailDispatcherPanel';

type AuthScreen =
  | 'login'
  | 'register'
  | 'check_email'
  | 'verifying'
  | 'verify_failed'
  | 'success'
  | 'verify';

export interface FirebaseVerifyRouteParams {
  mode: string | null;
  oobCode: string | null;
  verifyFlow: string | null;
  registrationSuccess: string | null;
}

interface StudentAuthPortalProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onLoginSuccess: (student: StudentProfileSummary, sessionToken: string) => void;
  initialVerifyToken?: string | null;
  onConsumedVerifyToken?: () => void;
  initialFirebaseVerify?: FirebaseVerifyRouteParams | null;
  onConsumedFirebaseVerify?: () => void;
}

const RESEND_COOLDOWN_SECONDS = 45;

function mapFirebaseAuthError(err: any, fallback: string): string {
  const code = typeof err?.code === 'string' ? err.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Sign in below to check verification or view your eDraw ID.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters including letters and numbers.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts in a short time. Please wait a minute and try again.';
    case 'auth/expired-action-code':
      return 'This verification link has expired. Sign in or request a fresh verification link.';
    case 'auth/invalid-action-code':
      return 'This verification link is invalid or has already been used.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Authentication yet. Enable Email/Password in the Firebase Console.';
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
  initialVerifyToken,
  onConsumedVerifyToken,
  initialFirebaseVerify,
  onConsumedFirebaseVerify,
}) => {
  const [screen, setScreen] = useState<AuthScreen>(() => {
    if (initialVerifyToken) return 'verify';
    if (initialFirebaseVerify?.oobCode || initialFirebaseVerify?.verifyFlow === 'firebase') {
      return 'verifying';
    }
    if (initialFirebaseVerify?.registrationSuccess === '1') {
      return 'verifying';
    }
    return 'login';
  });

  // Login form state (supports Registered Email OR EDID-XXXX)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loginServerError, setLoginServerError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [unverifiedGmail, setUnverifiedGmail] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Firebase Registration form state
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
  const [regDuplicateEmail, setRegDuplicateEmail] = useState<string | null>(null);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Check-your-email & 6-digit verification code state
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [pendingStudentName, setPendingStudentName] = useState<string>('');
  const [pendingCollege, setPendingCollege] = useState<string>('');
  const [pendingStudentDetails, setPendingStudentDetails] = useState<string>('');
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>('');
  const [pendingDeliveryMode, setPendingDeliveryMode] = useState<'smtp' | 'gmail_pending'>('gmail_pending');
  const [checkEmailNotice, setCheckEmailNotice] = useState<string | null>(null);
  const [checkEmailError, setCheckEmailError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  // Verification / Failure / Success states
  const [verifyingMessage, setVerifyingMessage] = useState<string>(
    'Verifying your email and allocating your eDraw ID...'
  );
  const [verifyFailedMessage, setVerifyFailedMessage] = useState<string | null>(null);
  const [canRetryAllocation, setCanRetryAllocation] = useState<boolean>(false);
  const [activeIdToken, setActiveIdToken] = useState<string | null>(null);
  const [firestoreSynced, setFirestoreSynced] = useState<boolean>(false);
  const [firestoreSyncWarning, setFirestoreSyncWarning] = useState<string | null>(null);

  // Legacy Gmail preview / link verification state (for ?verifyToken=...)
  const [pendingGmail, setPendingGmail] = useState<string>('');
  const [deliveryMode, setDeliveryMode] = useState<'smtp' | 'preview'>('preview');
  const [inboxMessages, setInboxMessages] = useState<VerificationEmailMessage[]>([]);
  const [verifyStatusMessage, setVerifyStatusMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState<StudentProfileSummary | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Official Gmail sender (edrawmit@gmail.com) integration state
  const [adminSenderEmail, setAdminSenderEmail] = useState<string>(OFFICIAL_SENDER_GMAIL);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean>(false);
  const [gmailSenderEmail, setGmailSenderEmail] = useState<string | null>(null);
  const [hasGmailToken, setHasGmailToken] = useState<boolean>(false);
  const [isGmailSigningIn, setIsGmailSigningIn] = useState<boolean>(false);
  const [isDispatcherOpen, setIsDispatcherOpen] = useState<boolean>(false);
  const [dispatchQueue, setDispatchQueue] = useState<DispatchQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [pendingGmailSend, setPendingGmailSend] = useState<PendingGmailConfirmation | null>(null);
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);

  // Cooldown timer for Firebase verification resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const markSuccessUrlFlag = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('registrationSuccess', '1');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Ignore in sandboxed iframe environments
    }
  }, []);

  const finalizeVerifiedStudentAllocation = useCallback(
    async (
      idToken: string,
      profileHints?: { name?: string; college?: string; studentDetails?: string },
      enterDashboardImmediately = false
    ) => {
      setVerifyingMessage('Allocating your unique eDraw ID on the server...');
      setVerifyFailedMessage(null);
      setCanRetryAllocation(false);
      setFirestoreSyncWarning(null);

      try {
        const res = await fetch('/api/registration/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: profileHints?.name || pendingStudentName || regForm.name,
            college: profileHints?.college || pendingCollege || regForm.college,
            studentDetails:
              profileHints?.studentDetails ?? (pendingStudentDetails || regForm.studentDetails),
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.student?.edrawId) {
          setVerifyFailedMessage(
            data.error || 'Could not allocate your eDraw ID. Please retry.'
          );
          setCanRetryAllocation(res.status >= 500 || res.status === 403);
          setScreen('verify_failed');
          return;
        }

        const student = data.student as StudentProfileSummary;
        setActiveIdToken(idToken);
        setVerifiedStudent(student);
        setPendingEmail(student.gmail);
        setPendingStudentName(student.name);
        setPendingCollege(student.college);
        setPendingStudentDetails(student.studentDetails || '');

        // Sync verified profile to Cloud Firestore when Firebase email_verified claim is active
        const fsResult = await syncVerifiedStudentToFirestore(student);
        setFirestoreSynced(fsResult.synced);
        if (!fsResult.synced && !fsResult.skippedUnverifiedClaim && fsResult.error) {
          setFirestoreSyncWarning(
            'Your eDraw ID is active; Cloud Firestore profile sync will retry automatically when you open the workspace.'
          );
        }

        if (enterDashboardImmediately) {
          onLoginSuccess(student, idToken);
          return;
        }

        markSuccessUrlFlag();
        setScreen('success');
      } catch {
        setVerifyFailedMessage(
          'A network or database interruption occurred while finalizing your eDraw ID. No partial ID was saved—please retry.'
        );
        setCanRetryAllocation(true);
        setScreen('verify_failed');
      }
    },
    [
      markSuccessUrlFlag,
      onLoginSuccess,
      pendingCollege,
      pendingStudentDetails,
      pendingStudentName,
      regForm.college,
      regForm.name,
      regForm.studentDetails,
    ]
  );

  const loadDispatchQueue = useCallback(async (tokenOverride?: string | null) => {
    const token = tokenOverride ?? getGmailAccessToken();
    if (!token) return;
    setIsLoadingQueue(true);
    setDispatchError(null);
    try {
      const res = await fetch('/api/auth/dispatch-queue', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDispatchQueue([]);
        setDispatchError(data.error || 'Unable to load student dispatch queue.');
        return;
      }
      setDispatchQueue(Array.isArray(data.students) ? (data.students as DispatchQueueItem[]) : []);
    } catch {
      setDispatchError('Network error while loading the Gmail dispatch queue.');
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/sender-status')
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.success) return;
        if (typeof data.adminSenderEmail === 'string' && data.adminSenderEmail) {
          setAdminSenderEmail(data.adminSenderEmail);
        }
        setSmtpConfigured(Boolean(data.smtpConfigured));
      })
      .catch(() => {});

    const unsubscribeGmail = initGmailAuth(
      (user, token) => {
        if (!active) return;
        setGmailSenderEmail(user.email || null);
        setHasGmailToken(Boolean(token));
        void loadDispatchQueue(token);
      },
      () => {
        if (!active) return;
        setGmailSenderEmail(null);
        setHasGmailToken(false);
        setDispatchQueue([]);
      }
    );

    return () => {
      active = false;
      unsubscribeGmail();
    };
  }, [loadDispatchQueue]);

  // Handle Firebase verification return (?mode=verifyEmail&oobCode=..., ?verifyFlow=firebase, or ?registrationSuccess=1 refresh)
  useEffect(() => {
    if (!initialFirebaseVerify) return;
    let cancelled = false;

    const run = async () => {
      const { mode, oobCode, verifyFlow, registrationSuccess } = initialFirebaseVerify;

      if (oobCode && (mode === 'verifyEmail' || !mode)) {
        setScreen('verifying');
        setVerifyingMessage('Completing Firebase email verification...');
        try {
          await applyFirebaseVerificationCode(oobCode);
          if (cancelled) return;
          onConsumedFirebaseVerify?.();

          const reloaded = await reloadFirebaseUserAndGetToken(true);
          if (cancelled) return;
          if (reloaded && reloaded.user.emailVerified) {
            await finalizeVerifiedStudentAllocation(reloaded.idToken, {
              name: reloaded.user.displayName || undefined,
            });
            return;
          }

          // Link verified in another browser/session where user isn't signed in yet
          setLoginNotice(
            'Your email address is verified! Sign in with your email and password to view and activate your eDraw ID.'
          );
          setScreen('login');
          return;
        } catch (err: any) {
          if (cancelled) return;
          onConsumedFirebaseVerify?.();
          setVerifyFailedMessage(
            mapFirebaseAuthError(
              err,
              'This verification link could not be verified. It may be expired or already used.'
            )
          );
          setCanRetryAllocation(false);
          setScreen('verify_failed');
          return;
        }
      }

      if (verifyFlow === 'firebase' || registrationSuccess === '1') {
        setScreen('verifying');
        setVerifyingMessage('Checking your verified account and retrieving your eDraw ID...');

        // Wait briefly for Firebase Auth persistence hydration on page load/refresh
        const hydratedUser = await new Promise<typeof auth.currentUser>((resolve) => {
          if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
          }
          const timeout = window.setTimeout(() => {
            unsub();
            resolve(auth.currentUser);
          }, 2500);
          const unsub = onAuthStateChanged(auth, (u) => {
            if (u) {
              window.clearTimeout(timeout);
              unsub();
              resolve(u);
            }
          });
        });

        if (cancelled) return;
        onConsumedFirebaseVerify?.();

        if (!hydratedUser) {
          if (verifyFlow === 'firebase') {
            setLoginNotice(
              'Email verified! Sign in with your registered email and password to generate and view your official eDraw ID.'
            );
          }
          setScreen('login');
          return;
        }

        try {
          await hydratedUser.reload();
          if (cancelled) return;
          const idToken = await hydratedUser.getIdToken(true);
          if (cancelled) return;

          const meRes = await fetch('/api/registration/me', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const meData = await meRes.json();
          if (cancelled) return;

          if (meRes.ok && meData.success && meData.student?.verified && meData.student?.edrawId) {
            const student = meData.student as StudentProfileSummary;
            setActiveIdToken(idToken);
            setVerifiedStudent(student);
            setPendingEmail(student.gmail);
            setPendingStudentName(student.name);
            setPendingCollege(student.college);
            setPendingStudentDetails(student.studentDetails || '');
            const fsResult = await syncVerifiedStudentToFirestore(student);
            setFirestoreSynced(fsResult.synced);
            setScreen('success');
            return;
          }

          if (hydratedUser.emailVerified) {
            await finalizeVerifiedStudentAllocation(idToken, {
              name: hydratedUser.displayName || undefined,
            });
            return;
          }

          setActiveIdToken(idToken);
          setPendingEmail(hydratedUser.email || meData.student?.gmail || '');
          setPendingStudentName(hydratedUser.displayName || meData.student?.name || '');
          setPendingCollege(meData.student?.college || '');
          setPendingStudentDetails(meData.student?.studentDetails || '');
          setCheckEmailNotice(
            'Enter the 6-digit verification code sent to your email address to activate your eDraw ID.'
          );
          setScreen('check_email');
        } catch {
          if (cancelled) return;
          setVerifyFailedMessage(
            'Unable to confirm your verification status right now. Please retry or sign in again.'
          );
          setCanRetryAllocation(true);
          setScreen('verify_failed');
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [finalizeVerifiedStudentAllocation, initialFirebaseVerify, onConsumedFirebaseVerify]);

  const handleConnectGmailSender = async () => {
    setIsGmailSigningIn(true);
    setDispatchError(null);
    setDispatchNotice(null);
    try {
      const { user, accessToken } = await signInGmailSender();
      setGmailSenderEmail(user.email || null);
      setHasGmailToken(Boolean(accessToken));
      setIsDispatcherOpen(true);
      await loadDispatchQueue(accessToken);
    } catch (err: any) {
      setDispatchError(
        err?.message || 'Could not complete Google Sign-In for Gmail verification sending.'
      );
    } finally {
      setIsGmailSigningIn(false);
    }
  };

  const handleDisconnectGmailSender = async () => {
    await signOutGmailSender();
    setGmailSenderEmail(null);
    setHasGmailToken(false);
    setDispatchQueue([]);
    setDispatchError(null);
    setDispatchNotice(null);
  };

  const handleConfirmSendGmail = async () => {
    if (!pendingGmailSend) return;
    const token = getGmailAccessToken();
    if (!token) {
      setPendingGmailSend(null);
      setDispatchError('Your Gmail sender session expired. Please sign in with Google again.');
      return;
    }

    setIsSendingGmail(true);
    setDispatchError(null);
    setVerifyError(null);
    try {
      const res = await fetch('/api/auth/send-gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gmail: pendingGmailSend.recipientEmail,
          kind: pendingGmailSend.kind,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to send email through Gmail.';
        setDispatchError(errMsg);
        if (screen === 'verify') {
          setVerifyError(errMsg);
        }
        return;
      }

      const confirmationText =
        pendingGmailSend.kind === 'verification_code'
          ? `6-digit verification code sent from ${data.sentFrom} to ${data.sentTo}.`
          : pendingGmailSend.kind === 'verification_link'
          ? `Verification link sent from ${data.sentFrom} to ${data.sentTo}.`
          : `Official eDraw ID (${data.edrawId}) sent from ${data.sentFrom} to ${data.sentTo}.`;
      setDispatchNotice(confirmationText);
      if (screen === 'check_email' && pendingGmailSend.kind === 'verification_code') {
        setCheckEmailError(null);
        setCheckEmailNotice(
          `We sent a 6-digit verification code from ${data.sentFrom} to ${data.sentTo}. Enter the code below (valid for 1 hour).`
        );
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
      if (screen === 'verify') {
        setVerifyStatusMessage(confirmationText);
      }
      await loadDispatchQueue(token);
      setPendingGmailSend(null);
    } catch {
      const netErr = 'Network error while sending email through Gmail.';
      setDispatchError(netErr);
      if (screen === 'verify') {
        setVerifyError(netErr);
      }
    } finally {
      setIsSendingGmail(false);
    }
  };

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

  // Handle legacy Gmail link arrival (`/?verifyToken=...`)
  useEffect(() => {
    if (!initialVerifyToken) return;
    setScreen('verify');
    void verifyTokenOnServer(initialVerifyToken);
    onConsumedVerifyToken?.();
  }, [initialVerifyToken, onConsumedVerifyToken, verifyTokenOnServer]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginServerError(null);
    setLoginNotice(null);
    setUnverifiedGmail(null);

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
      // Legacy EDID-XXXX login path preserved
      if (isValidEdrawId(rawIdentifier)) {
        const normalizedId = normalizeEdrawId(rawIdentifier);
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edrawId: normalizedId,
            password: loginPassword,
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
        return;
      }

      // Firebase Email + Password Sign-In path
      const normalizedEmail = normalizeEmail(rawIdentifier);
      const user = await signInStudentWithFirebase(normalizedEmail, loginPassword);
      const idToken = await user.getIdToken(true);

      const meRes = await fetch('/api/registration/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const meData = await meRes.json();

      if (meRes.ok && meData.success && meData.student?.verified && meData.student?.edrawId) {
        const student = meData.student as StudentProfileSummary;
        await syncVerifiedStudentToFirestore(student);
        onLoginSuccess(student, idToken);
        return;
      }

      if (user.emailVerified) {
        setScreen('verifying');
        setVerifyingMessage('Loading your verified eDraw ID...');
        await finalizeVerifiedStudentAllocation(
          idToken,
          {
            name: meData.student?.name || user.displayName || undefined,
            college: meData.student?.college || undefined,
            studentDetails: meData.student?.studentDetails || undefined,
          },
          true
        );
        return;
      }

      // Pending code verification: ensure a pending record exists so they can verify via 6-digit code
      if (!meData.student) {
        await fetch('/api/registration/pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: user.displayName || normalizedEmail.split('@')[0],
            college: 'Engineering College',
            studentDetails: '',
          }),
        });
      }

      setActiveIdToken(idToken);
      setPendingEmail(normalizedEmail);
      setPendingStudentName(meData.student?.name || user.displayName || '');
      setPendingCollege(meData.student?.college || '');
      setPendingStudentDetails(meData.student?.studentDetails || '');
      setVerificationCodeInput('');
      setCheckEmailError(null);
      setCheckEmailNotice(
        'Your email is not verified yet. Enter the 6-digit verification code sent to your inbox, or resend a fresh code below.'
      );
      setScreen('check_email');
    } catch (err: any) {
      setLoginServerError(
        mapFirebaseAuthError(err, 'Unable to sign in right now. Please try again.')
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegServerError(null);
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
      const user = await registerStudentWithFirebase({
        email: normalizedEmail,
        password: cleanedForm.password,
        displayName: cleanedForm.name.trim(),
      });

      const idToken = await user.getIdToken(true);
      setActiveIdToken(idToken);

      // Persist pending registration on server with NO EDraw ID yet & generate 6-digit verification code
      const pendingRes = await fetch('/api/registration/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: cleanedForm.name.trim(),
          college: cleanedForm.college.trim(),
          studentDetails: cleanedForm.studentDetails.trim(),
        }),
      });
      const pendingData = await pendingRes.json();
      if (!pendingRes.ok || !pendingData.success) {
        setRegServerError(
          pendingData.error || 'Could not save your pending registration. Please try again.'
        );
        return;
      }

      const mode: 'smtp' | 'gmail_pending' =
        pendingData.deliveryMode === 'smtp' ? 'smtp' : 'gmail_pending';
      const cleanName = cleanedForm.name.trim();
      const cleanCollege = cleanedForm.college.trim();
      const cleanDetails = cleanedForm.studentDetails.trim();

      setPendingEmail(normalizedEmail);
      setPendingStudentName(cleanName);
      setPendingCollege(cleanCollege);
      setPendingStudentDetails(cleanDetails);
      setPendingDeliveryMode(mode);
      setVerificationCodeInput('');
      setCheckEmailError(null);

      if (mode === 'smtp') {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setCheckEmailNotice(
          `We sent a 6-digit verification code to ${normalizedEmail}. Enter the code below (valid for 1 hour).`
        );
      } else if (
        hasGmailToken &&
        gmailSenderEmail &&
        gmailSenderEmail.toLowerCase() === adminSenderEmail.toLowerCase()
      ) {
        setCheckEmailNotice(
          `Confirm sending the 6-digit verification code from ${gmailSenderEmail} to ${normalizedEmail}, then type the code below.`
        );
        setPendingGmailSend({
          senderEmail: gmailSenderEmail,
          recipientEmail: normalizedEmail,
          studentName: cleanName,
          college: cleanCollege,
          kind: 'verification_code',
        });
      } else {
        setCheckEmailNotice(
          `Registration saved for ${normalizedEmail}. Connect Official Sender Mail (${adminSenderEmail}) below to email your 6-digit verification code, then enter it here.`
        );
      }

      setScreen('check_email');
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      if (code === 'auth/email-already-in-use') {
        setRegDuplicateEmail(normalizedEmail);
      }
      setRegServerError(
        mapFirebaseAuthError(err, 'Unable to create your registration right now. Please try again.')
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckEmailError(null);

    const cleanedCode = normalizeVerificationCode(verificationCodeInput);
    if (!isValidVerificationCode(cleanedCode)) {
      setCheckEmailError('Please enter the full 6-digit numeric verification code.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const reloaded = await reloadFirebaseUserAndGetToken(true);
      const tokenToUse = reloaded?.idToken || activeIdToken;
      if (!tokenToUse) {
        setLoginNotice('Your session expired. Sign in with your registered email and password to enter your code.');
        setLoginIdentifier(pendingEmail);
        setScreen('login');
        return;
      }

      const res = await fetch('/api/registration/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify({
          code: cleanedCode,
          name: pendingStudentName || regForm.name,
          college: pendingCollege || regForm.college,
          studentDetails: pendingStudentDetails || regForm.studentDetails,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.student?.edrawId) {
        setCheckEmailError(
          data.error || 'Verification code did not match. Please check your inbox and try again.'
        );
        return;
      }

      const student = data.student as StudentProfileSummary;
      setActiveIdToken(tokenToUse);
      setVerifiedStudent(student);
      setPendingEmail(student.gmail);
      setPendingStudentName(student.name);
      setPendingCollege(student.college);
      setPendingStudentDetails(student.studentDetails || '');

      const fsResult = await syncVerifiedStudentToFirestore(student);
      setFirestoreSynced(fsResult.synced);
      if (!fsResult.synced && !fsResult.skippedUnverifiedClaim && fsResult.error) {
        setFirestoreSyncWarning(
          'Your eDraw ID is active; Cloud Firestore profile sync will retry automatically when you open the workspace.'
        );
      }

      markSuccessUrlFlag();
      setScreen('success');
    } catch {
      setCheckEmailError('Network error while verifying your code. Please try again.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendVerificationCode = async () => {
    if (resendCooldown > 0) return;
    setCheckEmailError(null);

    if (
      !smtpConfigured &&
      hasGmailToken &&
      gmailSenderEmail &&
      gmailSenderEmail.toLowerCase() === adminSenderEmail.toLowerCase()
    ) {
      setPendingGmailSend({
        senderEmail: gmailSenderEmail,
        recipientEmail: pendingEmail,
        studentName: pendingStudentName || regForm.name || 'Student',
        college: pendingCollege || regForm.college || 'Engineering College',
        kind: 'verification_code',
      });
      return;
    }

    setIsResendingCode(true);
    try {
      const reloaded = await reloadFirebaseUserAndGetToken(true);
      const tokenToUse = reloaded?.idToken || activeIdToken;
      if (!tokenToUse) {
        setLoginNotice('Sign in with your email and password so we can resend your verification code.');
        setLoginIdentifier(pendingEmail);
        setScreen('login');
        return;
      }

      const res = await fetch('/api/registration/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCheckEmailError(data.error || 'Could not issue a fresh verification code.');
        return;
      }

      setPendingDeliveryMode(data.deliveryMode === 'smtp' ? 'smtp' : 'gmail_pending');
      setVerificationCodeInput('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setCheckEmailNotice(
        data.deliveryMode === 'smtp'
          ? `A fresh 6-digit verification code has been sent to ${data.email || pendingEmail}. Check your inbox and spam folder.`
          : `A fresh verification code was generated for ${data.email || pendingEmail}. Click "Send 6-Digit Code via ${adminSenderEmail}" below to email it.`
      );
    } catch {
      setCheckEmailError('Network error while requesting a new verification code.');
    } finally {
      setIsResendingCode(false);
    }
  };

  const handleRetryAllocation = async () => {
    setScreen('verifying');
    setVerifyingMessage('Retrying eDraw ID allocation...');
    const reloaded = await reloadFirebaseUserAndGetToken(true);
    if (!reloaded || !reloaded.user.emailVerified) {
      setVerifyFailedMessage(
        'Your session could not be confirmed as email-verified. Please sign in again after verifying your link.'
      );
      setCanRetryAllocation(false);
      setScreen('verify_failed');
      return;
    }
    await finalizeVerifiedStudentAllocation(reloaded.idToken, {
      name: pendingStudentName || reloaded.user.displayName || undefined,
      college: pendingCollege || undefined,
      studentDetails: pendingStudentDetails || undefined,
    });
  };

  const handleResendLegacyVerification = async (targetGmail?: string) => {
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
              <span>Verified Student Portal</span>
              <span className="font-mono text-[11px] text-white/75">
                EDID-XXXX · Email Verified Access
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
                    Sign in with your verified email address or eDraw ID to open your dashboard.
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
                      {unverifiedGmail && (
                        <button
                          type="button"
                          onClick={() => void handleResendLegacyVerification(unverifiedGmail)}
                          disabled={isResending}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#612AD6] dark:text-purple-300 underline underline-offset-2 hover:opacity-80 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                          <span>Resend verification link to {unverifiedGmail}</span>
                        </button>
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
                        Enter your verified email address or <span className="font-mono">EDID-XXXX</span>
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
                    disabled={isLoggingIn}
                    className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isLoggingIn ? 'Signing in...' : 'Sign In to Dashboard'}</span>
                    {!isLoggingIn && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

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
                    Verify your email address to receive your unique{' '}
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
                    disabled={isRegistering}
                    className="w-full h-11 px-5 mt-2 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>
                      {isRegistering
                        ? 'Creating Account & Sending Verification...'
                        : 'Register & Send Verification Email'}
                    </span>
                    {!isRegistering && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            )}

            {/* ==================== VIEW 3: EDRAW VERIFICATION CODE BOX ==================== */}
            {screen === 'check_email' && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-8 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] space-y-5">
                <div className="flex items-center gap-2 text-xs text-[#6E6C84] dark:text-slate-400 font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    1. Registered
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#6B32E4] dark:text-purple-300 font-semibold">
                    2. Enter Verification Code
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>3. Your eDraw ID</span>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#F2EDFF] dark:bg-purple-950/60 text-[#6B32E4] dark:text-purple-300 flex items-center justify-center shrink-0">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                      Enter Verification Code
                    </h2>
                    <p className="text-sm text-[#6E6C84] dark:text-slate-400 leading-relaxed">
                      Enter the 6-digit verification code sent to{' '}
                      <span className="font-semibold text-[#202044] dark:text-slate-100">
                        {pendingEmail || 'your email address'}
                      </span>{' '}
                      to activate your <span className="font-mono font-semibold">EDID-XXXX</span>.
                    </p>
                  </div>
                </div>

                {checkEmailNotice && (
                  <div
                    role="status"
                    className="p-3.5 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border border-[#E4DCF7] dark:border-slate-800 text-xs text-[#4A4863] dark:text-slate-300 leading-relaxed"
                  >
                    {checkEmailNotice}
                  </div>
                )}

                {checkEmailError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{checkEmailError}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyCodeSubmit} noValidate className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="verification-code-input"
                      className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
                    >
                      EDraw Verification Code (6 Digits)
                    </label>
                    <input
                      id="verification-code-input"
                      name="verificationCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={verificationCodeInput}
                      onChange={(e) => {
                        setVerificationCodeInput(normalizeVerificationCode(e.target.value));
                        setCheckEmailError(null);
                      }}
                      placeholder="000000"
                      aria-describedby="verification-code-help"
                      className="w-full h-14 px-4 rounded-2xl bg-[#F8F7FC] dark:bg-slate-950 border-2 border-[#DDD3FA] dark:border-slate-700 focus:border-[#6B32E4] focus:outline-none focus:ring-2 focus:ring-[#6B32E4]/20 text-center font-mono text-2xl font-bold tracking-[0.5em] text-[#202044] dark:text-slate-100 placeholder:text-[#B9B4CC] dark:placeholder:text-slate-600 transition-colors"
                    />
                    <p
                      id="verification-code-help"
                      className="text-[11px] text-[#77758F] dark:text-slate-400 text-center"
                    >
                      Codes expire 1 hour after sending.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingCode || verificationCodeInput.length !== 6}
                    className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {isVerifyingCode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {isVerifyingCode ? 'Verifying Code...' : 'Verify Code & Get eDraw ID'}
                    </span>
                  </button>
                </form>

                <div className="space-y-2">
                  {pendingDeliveryMode !== 'smtp' &&
                    (!hasGmailToken ||
                      gmailSenderEmail?.toLowerCase() !== adminSenderEmail.toLowerCase()) && (
                      <button
                        type="button"
                        disabled={isGmailSigningIn}
                        onClick={() => void handleConnectGmailSender()}
                        className="w-full h-10 px-4 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 hover:bg-[#E7DCFF] dark:hover:bg-purple-950/80 text-xs font-semibold text-[#5923CC] dark:text-purple-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>
                          {isGmailSigningIn
                            ? 'Connecting Gmail Sender...'
                            : `Connect ${adminSenderEmail} to Send Code Email`}
                        </span>
                      </button>
                    )}

                  {pendingDeliveryMode !== 'smtp' &&
                    hasGmailToken &&
                    gmailSenderEmail?.toLowerCase() === adminSenderEmail.toLowerCase() && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingGmailSend({
                            senderEmail: gmailSenderEmail,
                            recipientEmail: pendingEmail,
                            studentName: pendingStudentName || regForm.name || 'Student',
                            college: pendingCollege || regForm.college || 'Engineering College',
                            kind: 'verification_code',
                          })
                        }
                        className="w-full h-10 px-4 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/50 hover:bg-[#E7DCFF] dark:hover:bg-purple-950/80 text-xs font-semibold text-[#5923CC] dark:text-purple-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send 6-Digit Code via {gmailSenderEmail}</span>
                      </button>
                    )}

                  <button
                    type="button"
                    disabled={isResendingCode || resendCooldown > 0}
                    onClick={() => void handleResendVerificationCode()}
                    className="w-full h-10 px-4 rounded-xl border border-[#DFD7F4] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F8F7FC] dark:hover:bg-slate-800 disabled:opacity-60 text-xs font-semibold text-[#5923CC] dark:text-purple-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResendingCode ? 'animate-spin' : ''}`} />
                    <span>
                      {isResendingCode
                        ? 'Issuing Fresh Code...'
                        : resendCooldown > 0
                        ? `Resend Verification Code (${resendCooldown}s)`
                        : 'Resend Verification Code'}
                    </span>
                  </button>
                </div>

                <div className="pt-3 border-t border-[#EEEAF8] dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-[#77758F] dark:text-slate-400">
                  <span>Didn&apos;t see it? Check Spam or Junk.</span>
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

            {/* ==================== VIEW 4: VERIFYING EMAIL ==================== */}
            {screen === 'verifying' && (
              <div
                className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-8 sm:p-10 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] text-center space-y-4"
                role="status"
                aria-live="polite"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#F2EDFF] dark:bg-purple-950/60 text-[#6B32E4] dark:text-purple-300 flex items-center justify-center mx-auto">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                    Verifying Your Email
                  </h2>
                  <p className="text-sm text-[#6E6C84] dark:text-slate-400">{verifyingMessage}</p>
                </div>
              </div>
            )}

            {/* ==================== VIEW 5: VERIFICATION FAILED ==================== */}
            {screen === 'verify_failed' && (
              <div
                className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-8 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] space-y-5"
                role="alert"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                      Verification Could Not Complete
                    </h2>
                    <p className="text-sm text-[#6E6C84] dark:text-slate-400 leading-relaxed">
                      {verifyFailedMessage ||
                        'Your verification link may have expired or already been used.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {canRetryAllocation && (
                    <button
                      type="button"
                      onClick={() => void handleRetryAllocation()}
                      className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Retry eDraw ID Allocation</span>
                    </button>
                  )}

                  {auth.currentUser && !auth.currentUser.emailVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingEmail(auth.currentUser?.email || pendingEmail);
                        setScreen('check_email');
                      }}
                      className="w-full h-10 px-4 rounded-xl border border-[#DFD7F4] dark:border-slate-700 text-xs font-semibold text-[#5923CC] dark:text-purple-300 hover:bg-[#F8F7FC] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Resend Verification Email
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setLoginServerError(null);
                      setScreen('login');
                    }}
                    className="w-full h-10 px-4 rounded-xl border border-[#E2DBF2] dark:border-slate-700 text-xs font-semibold text-[#4A4863] dark:text-slate-200 hover:bg-[#F8F7FC] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Go to Student Sign In
                  </button>
                </div>
              </div>
            )}

            {/* ==================== VIEW 6: REGISTRATION SUCCESSFUL / YOUR EDRAW ID ==================== */}
            {screen === 'success' && verifiedStudent && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-8 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] space-y-5">
                <div className="flex items-center gap-2 text-xs text-[#6E6C84] dark:text-slate-400 font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    1. Registered
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    2. Email Verified
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#6B32E4] dark:text-purple-300 font-semibold">
                    3. Your eDraw ID
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                      Registration Successful
                    </h2>
                    <p className="text-xs text-[#6E6C84] dark:text-slate-400 mt-0.5 leading-relaxed">
                      Your email{' '}
                      <span className="font-medium text-[#202044] dark:text-slate-200">
                        {verifiedStudent.gmail}
                      </span>{' '}
                      is verified and your official eDraw ID is active.
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

                {/* Verified Student Details Summary */}
                <div className="p-4 rounded-2xl bg-[#FAF9FE] dark:bg-slate-950 border border-[#ECE7F8] dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">Student Name</span>
                    <span className="font-semibold text-[#202044] dark:text-slate-100 truncate">
                      {verifiedStudent.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">College</span>
                    <span className="font-medium text-[#202044] dark:text-slate-200 truncate">
                      {verifiedStudent.college}
                    </span>
                  </div>
                  {verifiedStudent.studentDetails && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#77758F] dark:text-slate-400">Student Details</span>
                      <span className="font-medium text-[#202044] dark:text-slate-200 truncate">
                        {verifiedStudent.studentDetails}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#77758F] dark:text-slate-400">Profile Storage</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {firestoreSynced ? 'Saved to Cloud Firestore' : 'Verified on Server'}
                    </span>
                  </div>
                </div>

                {firestoreSyncWarning && (
                  <p className="text-[11px] text-[#6E6C84] dark:text-slate-400 leading-relaxed">
                    {firestoreSyncWarning}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onLoginSuccess(verifiedStudent, activeIdToken || 'firebase-verified')
                  }
                  className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <span>Enter EDraw Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ==================== VIEW 7: LEGACY TOKEN VERIFICATION ==================== */}
            {screen === 'verify' && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-7 sm:p-8 shadow-[0_18px_50px_-24px_rgba(96,53,181,0.18)] space-y-5">
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
                    2. Email Verification
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
                          Email Verified Successfully
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
                      onClick={() => {
                        setLoginIdentifier(verifiedStudent.edrawId);
                        setLoginPassword('');
                        setLoginErrors({});
                        setLoginServerError(null);
                        setUnverifiedGmail(null);
                        setScreen('login');
                      }}
                      className="w-full h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>Proceed to Login with {verifiedStudent.edrawId}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {hasGmailToken &&
                      gmailSenderEmail &&
                      gmailSenderEmail.toLowerCase() === adminSenderEmail.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingGmailSend({
                              senderEmail: gmailSenderEmail,
                              recipientEmail: verifiedStudent.gmail,
                              studentName: verifiedStudent.name,
                              college: verifiedStudent.college,
                              edrawId: verifiedStudent.edrawId,
                              kind: 'verified_edraw_id',
                            })
                          }
                          className="w-full h-10 px-4 rounded-xl border border-[#DFD4FA] dark:border-slate-700 bg-[#F8F7FC] dark:bg-slate-800/70 hover:bg-[#EFE8FF] dark:hover:bg-slate-800 text-xs font-semibold text-[#5923CC] dark:text-purple-300 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send {verifiedStudent.edrawId} via {gmailSenderEmail}</span>
                        </button>
                      )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-[#202044] dark:text-slate-100">
                      Verify Your Email Address
                    </h2>
                    <p className="text-sm text-[#6E6C84] dark:text-slate-400 leading-relaxed">
                      {verifyStatusMessage ||
                        `We sent a verification link to ${pendingGmail || 'your email address'}. Click the link to verify your account and receive your eDraw ID (EDID-XXXX).`}
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

                {deliveryMode === 'preview' && inboxMessages.length > 0 && (
                  <div className="rounded-2xl border border-[#E2DBF2] dark:border-slate-700 bg-[#FAF9FE] dark:bg-slate-950 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#E8E2F5] dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-2 min-w-0">
                        <Inbox className="w-4 h-4 text-[#6B32E4] dark:text-purple-400 shrink-0" />
                        <span className="text-xs font-semibold text-[#202044] dark:text-slate-200 truncate">
                          Inbox · {pendingGmail}
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
                                Hello {msg.studentName}, click the link below to verify your email
                                ({msg.college}) and generate your official eDraw ID.
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
                                    ? 'Link Verified'
                                    : isVerifyingToken
                                    ? 'Verifying...'
                                    : 'Click to Verify & Get eDraw ID'}
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

                <div className="pt-3 border-t border-[#EEEAF8] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {!verifiedStudent && pendingGmail ? (
                    <button
                      type="button"
                      onClick={() => void handleResendLegacyVerification(pendingGmail)}
                      disabled={isResending}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#6B32E4] dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                      <span>{isResending ? 'Resending...' : 'Resend Verification Link'}</span>
                    </button>
                  ) : (
                    <span className="text-[#77758F] dark:text-slate-400">
                      {pendingStudentName ? `Registered for ${pendingStudentName}` : 'Email Verification'}
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

            {/* Official Sender Gmail Dispatcher Accordion */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsDispatcherOpen((prev) => !prev)}
                className="w-full px-4 py-2.5 rounded-2xl border border-[#E8E2F5] dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-xs font-semibold text-[#4A4863] dark:text-slate-300 flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-[#6B32E4] dark:text-purple-400 shrink-0" />
                  <span className="truncate">
                    Official Sender Mail ({adminSenderEmail})
                    {hasGmailToken && gmailSenderEmail ? ` · Connected` : ''}
                  </span>
                </span>
                {isDispatcherOpen ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                )}
              </button>

              {isDispatcherOpen && (
                <div className="mt-2">
                  <GmailDispatcherPanel
                    connectedEmail={gmailSenderEmail}
                    hasToken={hasGmailToken}
                    isSigningIn={isGmailSigningIn}
                    isLoadingQueue={isLoadingQueue}
                    smtpConfigured={smtpConfigured}
                    adminSenderEmail={adminSenderEmail}
                    queue={dispatchQueue}
                    dispatchError={dispatchError}
                    dispatchNotice={dispatchNotice}
                    onSignInGoogle={() => void handleConnectGmailSender()}
                    onSignOutGoogle={() => void handleDisconnectGmailSender()}
                    onRefreshQueue={() => void loadDispatchQueue()}
                    onRequestSend={(item, kind) =>
                      setPendingGmailSend({
                        senderEmail: gmailSenderEmail || adminSenderEmail,
                        recipientEmail: item.gmail,
                        studentName: item.name,
                        college: item.college,
                        edrawId: item.edrawId,
                        kind,
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Quiet Footer */}
          <footer className="text-center lg:text-left text-[11px] text-[#77758F] dark:text-slate-500 font-mono">
            EDraw Engineering Graphics · BIS SP 46:2003 &amp; ISO 128 Standard
          </footer>
        </section>
      </div>

      <GmailConfirmModal
        pending={pendingGmailSend}
        isSending={isSendingGmail}
        onConfirm={() => void handleConfirmSendGmail()}
        onCancel={() => {
          if (!isSendingGmail) setPendingGmailSend(null);
        }}
      />
    </div>
  );
};
