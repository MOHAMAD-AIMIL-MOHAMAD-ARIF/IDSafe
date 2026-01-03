"use client";

import Link from "next/link";
import { useState } from "react";
import { useLoginFlow } from "@/hooks/use-login";
import { routes } from "@/lib/config/routes";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const { phase, errorMessage, lockedReason, isSubmitting, submitLogin } = useLoginFlow();

  const isBusy = phase === "authenticating" || phase === "unlocking" || isSubmitting;
  const canSubmit = email.length > 0 && !isBusy;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Welcome back</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Unlock IDSafe with your passkey</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Sign in with a single biometric or device unlock. No passwords or daily passphrases are
            required.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              void submitLogin(email);
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
                disabled={isBusy}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Your passkey prompt will appear immediately after you continue. Keep your device
              unlocked and ready for biometrics.
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold shadow-sm transition enabled:text-slate-700 enabled:hover:text-slate-800 hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {phase === "authenticating" && "Checking passkey..."}
              {phase === "unlocking" && "Unlocking vault..."}
              {phase === "form" && "Continue with passkey"}
              {phase === "locked" && "Try passkey again"}
            </button>

            <div className="flex items-center gap-4 text-sm">
              <Link href={routes.home} className="font-medium text-brand hover:text-brand/80">
                Back to home
              </Link>
              <Link href={routes.register} className="text-slate-500 hover:text-slate-700">
                Create an account
              </Link>
              <Link href={routes.recoveryRequest} className="text-slate-500 hover:text-slate-700">
                Recover your account
              </Link>
            </div>
          </form>
        </section>

        {(phase === "authenticating" || phase === "unlocking") && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Login progress
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {phase === "authenticating" ? "Verifying your passkey" : "Unlocking your vault"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {phase === "authenticating"
                ? "Complete the biometric prompt on your device to finish sign-in."
                : "We’re unwrapping your vault key using this device’s binding."}
            </p>
          </section>
        )}

        {phase === "locked" && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Vault locked on this device
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Sign-in succeeded, but the vault is still locked.
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              {lockedReason ??
                "This device cannot unwrap your vault key. You may be on a new device or have cleared local storage."}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p className="font-semibold">Next steps</p>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                <li>Start account recovery with your recovery passphrase.</li>
                <li>Re-bind this device to create a new device key pair.</li>
                <li>Return here to unlock with a passkey-only login.</li>
              </ul>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={routes.recoveryRequest}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Start account recovery
              </Link>
              <Link href={routes.register} className="text-sm font-semibold text-brand">
                Register a new passkey after recovery
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
