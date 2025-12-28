"use client";

import Link from "next/link";
import { useState } from "react";
import { requestRecoveryMagicLink } from "@/api/recovery";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/config/routes";

export default function RecoveryRequestPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const canSubmit = email.length > 0 && !isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Account recovery</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Request a recovery link</h1>
          <p className="text-base text-slate-600">
            Enter your email to receive a magic link that unlocks the recovery flow.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              setIsSubmitting(true);
              setErrorMessage(null);
              void requestRecoveryMagicLink(email)
                .then(() => {
                  setIsComplete(true);
                })
                .catch((error: unknown) => {
                  if (error instanceof ApiError) {
                    setErrorMessage(error.message);
                  } else {
                    setErrorMessage(
                      error instanceof Error
                        ? error.message
                        : "We couldn't send the recovery link. Try again.",
                    );
                  }
                })
                .finally(() => {
                  setIsSubmitting(false);
                });
            }}
          >
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder="you@example.com"
                required
                disabled={isSubmitting || isComplete}
              />
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            {isComplete ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                If that email matches an active account, a recovery link is on the way. Check your
                inbox and spam folder.
              </div>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold shadow-sm transition enabled:text-slate-700 enabled:hover:text-slate-800 hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "Sending link..." : "Email recovery link"}
              </button>
            )}
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">What happens next?</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Open the magic link from your email on the device you want to recover.</li>
            <li>Enter your recovery passphrase to unwrap the vault key.</li>
            <li>Register a fresh passkey to restore biometric-only sign-in.</li>
          </ul>
        </section>

        <div className="flex items-center gap-4 text-sm">
          <Link href={routes.login} className="font-medium text-brand hover:text-brand/80">
            Back to login
          </Link>
          <Link href={routes.home} className="text-slate-500 hover:text-slate-700">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
