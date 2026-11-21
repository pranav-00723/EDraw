/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import type { DispatchQueueItem, GmailDispatchKind } from '../../utils/studentAuthValidation';
import { OFFICIAL_SENDER_GMAIL } from '../../firebase';

interface GmailDispatcherPanelProps {
  connectedEmail: string | null;
  hasToken: boolean;
  isSigningIn: boolean;
  isLoadingQueue: boolean;
  isResettingDatabase?: boolean;
  smtpConfigured: boolean;
  adminSenderEmail: string;
  queue: DispatchQueueItem[];
  dispatchError: string | null;
  dispatchNotice: string | null;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onRefreshQueue: () => void;
  onRequestSend: (item: DispatchQueueItem, kind: GmailDispatchKind) => void;
  onRequestResetDatabase?: () => void;
}

export const GoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="gsi-material-button inline-flex items-center gap-2.5 h-10 px-4 rounded-xl bg-white dark:bg-slate-900 border border-[#DADCE0] dark:border-slate-700 hover:bg-[#F8FAFF] dark:hover:bg-slate-800 text-[#1F1F1F] dark:text-slate-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
  >
    <span className="w-4 h-4 shrink-0" aria-hidden="true">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
    <span>{label}</span>
  </button>
);

export const GmailDispatcherPanel: React.FC<GmailDispatcherPanelProps> = ({
  connectedEmail,
  hasToken,
  isSigningIn,
  isLoadingQueue,
  isResettingDatabase = false,
  smtpConfigured,
  adminSenderEmail,
  queue,
  dispatchError,
  dispatchNotice,
  onSignInGoogle,
  onSignOutGoogle,
  onRefreshQueue,
  onRequestSend,
  onRequestResetDatabase,
}) => {
  const targetEmail = adminSenderEmail || OFFICIAL_SENDER_GMAIL;
  const isAuthorizedSender =
    Boolean(connectedEmail) && connectedEmail!.toLowerCase() === targetEmail.toLowerCase();

  return (
    <div className="rounded-2xl border border-[#E4DCF7] dark:border-slate-800 bg-[#FAF9FE] dark:bg-slate-950 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EFE8FF] dark:bg-purple-950/70 text-[#6B32E4] dark:text-purple-300 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#202044] dark:text-slate-100 truncate">
              Official Mail Sender · {targetEmail}
            </div>
            <div className="text-[11px] text-[#6E6C84] dark:text-slate-400">
              {hasToken && isAuthorizedSender
                ? smtpConfigured
                  ? 'Connected via Gmail & automatic background mail is active'
                  : 'Connected via Gmail — session stays active during student registration'
                : smtpConfigured
                ? 'Automatic server mail delivery is active for every registration'
                : `Sign in with ${targetEmail} to send codes, or configure server SMTP_USER / SMTP_PASS for silent auto-send`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hasToken ? (
            <GoogleSignInButton
              onClick={onSignInGoogle}
              disabled={isSigningIn}
              label={isSigningIn ? 'Connecting...' : 'Sign in with Google'}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={onRefreshQueue}
                disabled={isLoadingQueue || isResettingDatabase}
                className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-[#E2DBF2] dark:border-slate-700 text-xs font-semibold text-[#202044] dark:text-slate-200 hover:bg-[#F3EEFF] dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Refresh student queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              {isAuthorizedSender && onRequestResetDatabase && (
                <button
                  type="button"
                  onClick={onRequestResetDatabase}
                  disabled={isResettingDatabase || isLoadingQueue}
                  className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-white dark:bg-slate-900 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Reset server student registration database to empty"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isResettingDatabase ? 'Resetting...' : 'Reset DB'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSignOutGoogle}
                disabled={isResettingDatabase}
                className="h-9 px-3 rounded-xl border border-[#E2DBF2] dark:border-slate-700 text-xs font-semibold text-[#6E6C84] dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          )}
        </div>
      </div>

      {dispatchNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{dispatchNotice}</span>
        </div>
      )}

      {dispatchError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <p>{dispatchError}</p>
            {hasToken && !isAuthorizedSender && (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="font-semibold underline underline-offset-2 text-[#6B32E4] dark:text-purple-300 cursor-pointer"
              >
                Switch to {targetEmail}
              </button>
            )}
          </div>
        </div>
      )}

      {hasToken && isAuthorizedSender && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#6E6C84] dark:text-slate-400">
            <span>Registered Students ({queue.length})</span>
            <span className="font-mono">Dispatch via {connectedEmail}</span>
          </div>

          {queue.length === 0 ? (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[#ECE7F8] dark:border-slate-800 text-xs text-[#6E6C84] dark:text-slate-400 text-center">
              No student registrations yet. Once a student registers, they will appear here to receive their verification link and eDraw ID.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-[#ECE7F8] dark:divide-slate-800 rounded-xl border border-[#ECE7F8] dark:border-slate-800 bg-white dark:bg-slate-900">
              {queue.map((item) => (
                <div
                  key={`${item.gmail}-${item.edrawId || 'pending'}`}
                  className="p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#202044] dark:text-slate-100 truncate">
                        {item.name}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#6B32E4] dark:text-purple-300">
                        {item.edrawId || 'EDID Pending'}
                      </span>
                      {item.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          Pending Code
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#6E6C84] dark:text-slate-400 truncate mt-0.5">
                      {item.gmail} · {item.college}
                    </div>
                  </div>

                  <div>
                    {!item.verified ? (
                      <button
                        type="button"
                        onClick={() => onRequestSend(item, 'verification_code')}
                        className="h-8 px-3 rounded-lg bg-[#6B32E4] hover:bg-[#5923CC] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Send className="w-3 h-3" />
                        <span>
                          {item.verificationEmailSentAt ? 'Resend Code' : 'Send Verification Code'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRequestSend(item, 'verified_edraw_id')}
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Send className="w-3 h-3" />
                        <span>
                          {item.edrawIdEmailSentAt ? 'Resend ED ID' : 'Send ED ID'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
