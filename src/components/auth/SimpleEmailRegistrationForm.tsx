/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';

const APPS_SCRIPT_EXEC_URL =
  'https://script.google.com/macros/s/AKfycby8IxlIeFeriNGd4PX5_Mj2SzpF42RowC9o8vuMg0PNy0AD-Yw2JsZRC_rAEqDawf0r/exec';

export const SimpleEmailRegistrationForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your email address.');
      setConfirmationMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setConfirmationMessage(null);

    try {
      await fetch(APPS_SCRIPT_EXEC_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: targetEmail }),
      });

      setEmail('');
      setConfirmationMessage('Verification email sent! Please check your inbox.');
    } catch {
      setErrorMessage('Unable to send verification request right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 p-6 sm:p-7 shadow-[0_14px_40px_-24px_rgba(96,53,181,0.16)]">
      <div className="space-y-1 mb-4">
        <h3 className="text-base font-bold tracking-tight text-[#202044] dark:text-slate-100">
          Email Verification Registration
        </h3>
        <p className="text-xs text-[#6E6C84] dark:text-slate-400">
          Enter your email address to receive an instant verification email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="simple-reg-email"
            className="block text-xs font-semibold text-[#202044] dark:text-slate-200"
          >
            Email Address
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="simple-reg-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="student@example.com"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-950 border border-[#E2DBF2] dark:border-slate-700 text-sm text-[#202044] dark:text-slate-100 placeholder:text-[#9896AD] focus:outline-none focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/20 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 px-5 rounded-xl bg-[#6B32E4] hover:bg-[#5923CC] disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-xs shrink-0"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? 'Sending...' : 'Register'}</span>
            </button>
          </div>
        </div>

        {confirmationMessage && (
          <div
            role="status"
            className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{confirmationMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
};
