"use client";

import Link from "next/link";
import { useState } from "react";
import { PasskeyModal } from "@/components/registration/passkey-modal";
import { RecoveryStepper } from "@/components/recovery/recovery-stepper";
import { useRecoveryFlow } from "@/hooks/use-recovery";
import { routes } from "@/lib/config/routes";

export default function RecoveryPage() {
  const [passphrase, setPassphrase] = useState("");
  const {
    phase,
    paramsError,
    steps,
    errorMessage,
    isSubmitting,
    isPasskeyModalOpen,
    isRecoveryCompleted,
    submitRecovery,
    retryPasskey,
  } = useRecoveryFlow();

  const isBusy = phase === "recovering" || isSubmitting || phase === "loading";
  const canSubmit = passphrase.length > 0 && !isBusy && phase === "form";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Account recovery</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Re-bind a new device</h1>
          <p className="text-base text-slate-600">
            Use your recovery passphrase to unlock and re-wrap the vault key on this device. Once
            complete, you can return to passkey-only logins.
          </p>
        </header>

        {phase === "loading" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Verifying recovery link
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Checking your session…</h2>
            <p className="mt-2 text-sm text-slate-600">
              We’re validating the magic link and preparing your recovery session.
            </p>
          </section>
        )}

        {phase === "error" && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Recovery link invalid
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              We couldn’t verify this recovery session.
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              {paramsError ??
                "Your recovery link may have expired or was already used. Request a new link to continue."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={routes.recoveryRequest}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Request a new recovery link
              </Link>
              <Link href={routes.login} className="text-sm font-semibold text-brand">
                Back to login
              </Link>
            </div>
          </section>
        )}

        {phase !== "loading" && phase !== "error" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSubmit) return;
                void submitRecovery(passphrase);
              }}
            >
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Recovery checklist</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Have your recovery passphrase available.</li>
                  <li>Keep this device ready for passkey registration.</li>
                  <li>Complete the recovery steps to bind a new device key.</li>
                </ul>
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
                  placeholder="Enter your recovery passphrase"
                  required
                  disabled={isBusy || phase !== "form"}
                />
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              {phase !== "complete" && (
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {phase === "recovering" ? "Recovering vault key..." : "Unlock and re-bind device"}
                </button>
              )}

              {phase === "complete" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Recovery complete! Your new passkey is registered and this device is bound.
                </div>
              )}
            </form>
          </section>
        )}

        {phase !== "loading" && phase !== "error" && <RecoveryStepper steps={steps} />}

        {isRecoveryCompleted && phase === "passkey" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Register new passkey
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Finish recovery by creating a passkey
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Your device is now bound. Complete passkey registration to enable biometric-only
              logins again.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void retryPasskey()}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Retry passkey registration
              </button>
              <Link href={routes.login} className="text-sm font-semibold text-brand">
                Back to login
              </Link>
            </div>
          </section>
        )}

        {phase === "complete" && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Recovery complete
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Your new device is ready.
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              You can now continue with passkey-only access on this device.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={routes.vault}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Go to vault
              </Link>
              <Link href={routes.account} className="text-sm font-semibold text-brand">
                Review account settings
              </Link>
            </div>
          </section>
        )}

        <div className="flex items-center gap-4 text-sm">
          <Link href={routes.login} className="font-medium text-brand hover:text-brand/80">
            Back to login
          </Link>
          <Link href={routes.home} className="text-slate-500 hover:text-slate-700">
            Return home
          </Link>
        </div>
      </div>

      <PasskeyModal
        open={isPasskeyModalOpen}
        title="Register a new passkey"
        description="Confirm the WebAuthn prompt to finish recovery."
      />
    </div>
  );
}
