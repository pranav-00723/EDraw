/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, Send, X, ShieldCheck } from 'lucide-react';
import type { GmailDispatchKind } from '../../utils/studentAuthValidation';

export interface PendingGmailConfirmation {
  senderEmail: string;
  recipientEmail: string;
  studentName: string;
  college: string;
  edrawId?: string;
  kind: GmailDispatchKind;
}

interface GmailConfirmModalProps {
  pending: PendingGmailConfirmation | null;
  isSending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const GmailConfirmModal: React.FC<GmailConfirmModalProps> = ({
  pending,
  isSending,
  onConfirm,
  onCancel,
}) => {
  if (!pending) return null;

  const isVerificationCode = pending.kind === 'verification_code';
  const isVerificationLink = pending.kind === 'verification_link';
  const subject = isVerificationCode
    ? 'Verify your email address'
    : isVerificationLink
    ? 'Verify your Google Mail ID to receive your EDraw Student ID'
    : `Your EDraw ID is Verified: ${pending.edrawId || 'EDID-XXXX'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#202033]/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-confirm-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0ECF9] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F2EDFF] dark:bg-purple-950/60 text-[#6B32E4] dark:text-purple-300 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="gmail-confirm-title"
                className="text-sm font-bold text-[#202044] dark:text-slate-100"
              >
                {isVerificationCode
                  ? 'Confirm Sending 6-Digit Verification Code'
                  : isVerificationLink
                  ? 'Confirm Sending Verification Link'
                  : 'Confirm Sending Official eDraw ID'}
              </h3>
              <p className="text-[11px] text-[#77758F] dark:text-slate-400">
                Sending through your connected Gmail account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#77758F] hover:text-[#202044] dark:hover:text-slate-100 hover:bg-[#F2EDFF] dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cancel email send"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-[#4A4863] dark:text-slate-300 leading-relaxed">
            {isVerificationCode
              ? `Are you sure you want to send a 6-digit email verification code from ${pending.senderEmail} to ${pending.recipientEmail}? The student will type this code in the EDraw verification box (expires in 1 hour).`
              : isVerificationLink
              ? `Are you sure you want to send a Gmail verification link from ${pending.senderEmail} to ${pending.recipientEmail}? Once clicked, the student will verify their email and receive their eDraw ID.`
              : `Are you sure you want to send the verified eDraw ID (${pending.edrawId}) from ${pending.senderEmail} to ${pending.recipientEmail}?`}
          </p>

          <div className="rounded-2xl bg-[#F8F7FC] dark:bg-slate-950 border border-[#E8E2F5] dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#77758F] dark:text-slate-400">From</span>
              <span className="font-semibold text-[#202044] dark:text-slate-100 truncate">
                {pending.senderEmail}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#77758F] dark:text-slate-400">To</span>
              <span className="font-semibold text-[#6B32E4] dark:text-purple-300 truncate">
                {pending.recipientEmail}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#77758F] dark:text-slate-400">Student</span>
              <span className="font-medium text-[#202044] dark:text-slate-200 truncate">
                {pending.studentName} · {pending.college}
              </span>
            </div>
            <div className="pt-2 border-t border-[#ECE8F8] dark:border-slate-800">
              <div className="text-[11px] text-[#77758F] dark:text-slate-400">Subject</div>
              <div className="font-semibold text-[#202044] dark:text-slate-100 mt-0.5">
                {subject}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Email is dispatched directly via your authorized Gmail sender account.</span>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#FAF9FE] dark:bg-slate-950 border-t border-[#F0ECF9] dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="h-10 px-4 rounded-xl border border-[#DFD7F4] dark:border-slate-700 text-xs font-semibold text-[#4A4863] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSending}
            className="h-10 px-4 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Sending via Gmail...' : 'Confirm & Send Email'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
