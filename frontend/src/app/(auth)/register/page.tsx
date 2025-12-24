"use client";

import Link from "next/link";
import { useState } from "react";
import { PasskeyModal } from "@/components/registration/passkey-modal";
import { RegistrationComplete } from "@/components/registration/registration-complete";
import { RegistrationStepper } from "@/components/registration/registration-stepper";
import { useRegistrationFlow } from "@/hooks/use-registration";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");

  const {
    phase,
    steps,
    errorMessage,
    setupError,
    isPasskeyModalOpen,
    passkeyRegistered,
    isSubmitting,
    submitRegistration,
    retrySetup,
  } = useRegistrationFlow();

  const passphraseMatch = passphrase.length > 0 && passphrase === confirmPassphrase;
  const canSubmit = email.length > 0 && passphraseMatch && !isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Create your IDSafe</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Register your passkey & vault</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Set up your account with a passkey and a recovery passphrase. Your recovery passphrase is
            only used if you lose this device.
          </p>
        </header>

        {phase === "form" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <form
              className="flex flex-col gap-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSubmit) return;
                void submitRegistration(email, passphrase);
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
                />
              </div>

              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Recovery passphrase setup</p>
                  <p className="text-xs text-slate-500">
                    Used only if you lose this device. Not required for normal logins.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="passphrase">
                    Recovery passphrase
                  </label>
                  <input
                    id="passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="Create a memorable passphrase"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <label
                    className="text-sm font-semibold text-slate-700"
                    htmlFor="confirmPassphrase"
                  >
                    Confirm recovery passphrase
                  </label>
                  <input
                    id="confirmPassphrase"
                    type="password"
                    value={confirmPassphrase}
                    onChange={(event) => setConfirmPassphrase(event.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="Re-enter your passphrase"
                    required
                  />
                  {!passphraseMatch && confirmPassphrase.length > 0 && (
                    <span className="text-xs text-red-500">Passphrases do not match.</span>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "Creating account..." : "Create account & register passkey"}
              </button>

              <div className="flex items-center gap-4 text-sm">
                <Link href="/" className="font-medium text-brand hover:text-brand/80">
                  Back to home
                </Link>
                <Link href="/login" className="text-slate-500 hover:text-slate-700">
                  Already have an account?
                </Link>
              </div>
            </form>
          </section>
        )}

        {phase !== "form" && (
          <section className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Registration progress
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {phase === "passkey" && "Registering your passkey"}
                  {phase === "setup" && "Setting up your vault"}
                  {phase === "complete" && "Setup complete"}
                </h2>
                <p className="text-sm text-slate-600">
                  {phase === "passkey" && "Follow the WebAuthn prompt to finish passkey setup."}
                  {phase === "setup" && "We’re preparing your encrypted vault on this device."}
                  {phase === "complete" && "Everything is ready. Welcome to IDSafe."}
                </p>
              </div>
            </div>

            {passkeyRegistered && phase !== "complete" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Passkey registered.
              </div>
            )}

            {phase === "setup" && (
              <div className="flex flex-col gap-4">
                <RegistrationStepper steps={steps} />
                {setupError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {setupError}
                  </div>
                )}
                {setupError && (
                  <button
                    type="button"
                    onClick={() => void retrySetup(passphrase)}
                    className="inline-flex w-fit items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
                  >
                    Retry setup
                  </button>
                )}
              </div>
            )}

            {phase === "complete" && <RegistrationComplete />}
          </section>
        )}
      </div>

      <PasskeyModal open={isPasskeyModalOpen} />
    </div>
  );
}
