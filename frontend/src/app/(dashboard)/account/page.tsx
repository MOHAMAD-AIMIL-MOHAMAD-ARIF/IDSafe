"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "@/components/auth/auth-provider";
import { useAccount } from "@/hooks/use-account";
import { routes } from "@/lib/config/routes";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function formatIdentifier(value: string, visible = 10) {
  if (!value) return "—";
  if (value.length <= visible * 2) return value;
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}

export default function AccountPage() {
  const { status: authStatus, logout, isEndUser } = useAuthContext();
  const router = useRouter();
  const {
    profile,
    credentials,
    devices,
    status,
    errorMessage,
    loadAccount,
    removeCredential,
    removeDeviceBinding,
    changeRecoveryPassphrase,
  } = useAccount();

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [passphraseStatus, setPassphraseStatus] = useState<"idle" | "saving" | "success">(
    "idle",
  );
  const [passphraseMessage, setPassphraseMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "authenticated" && isEndUser) {
      void loadAccount();
    }
  }, [authStatus, isEndUser, loadAccount]);

  useEffect(() => {
    if (authStatus === "unauthenticated" || (authStatus === "authenticated" && !isEndUser)) {
      router.replace(routes.login);
    }
  }, [authStatus, isEndUser, router]);

  const passphraseMatch = passphrase.length > 0 && passphrase === confirmPassphrase;
  const passphraseReady = passphraseMatch && passphrase.length >= 8;

  const credentialCountLabel = useMemo(() => {
    if (credentials.length === 1) return "1 passkey";
    return `${credentials.length} passkeys`;
  }, [credentials.length]);

  const deviceCountLabel = useMemo(() => {
    if (devices.length === 1) return "1 device";
    return `${devices.length} devices`;
  }, [devices.length]);

  const handlePassphraseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passphraseReady || passphraseStatus === "saving") return;

    setPassphraseStatus("saving");
    setPassphraseMessage(null);

    try {
      await changeRecoveryPassphrase(passphrase);
      setPassphraseStatus("success");
      setPassphraseMessage("Recovery passphrase updated and vault key re-wrapped.");
      setPassphrase("");
      setConfirmPassphrase("");
    } catch (error) {
      setPassphraseStatus("idle");
      setPassphraseMessage(
        error instanceof Error ? error.message : "Unable to update recovery passphrase.",
      );
    }
  };

  const handleDeleteCredential = async (credentialId: number) => {
    const confirmed = window.confirm("Remove this passkey from your account?");
    if (!confirmed) return;
    try {
      await removeCredential(credentialId);
    } catch (error) {
      setPassphraseMessage(
        error instanceof Error ? error.message : "Unable to remove passkey.",
      );
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    const confirmed = window.confirm("Delete this device binding?");
    if (!confirmed) return;
    try {
      await removeDeviceBinding(deviceId);
    } catch (error) {
      setPassphraseMessage(
        error instanceof Error ? error.message : "Unable to remove device binding.",
      );
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push(routes.home);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Account</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Profile & security controls</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review your account profile, manage passkeys, and rotate your recovery passphrase.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={routes.vault}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              Back to vault
            </Link>
            <button
              type="button"
              onClick={() => void loadAccount()}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              Refresh data
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </header>

        {authStatus === "unauthenticated" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
            Your session has expired. Sign in again to manage your account.
            <div className="mt-3">
              <Link className="font-semibold text-amber-900" href={routes.login}>
                Return to login
              </Link>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Profile</h2>
                  <p className="text-sm text-slate-500">Basic account information</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {status === "loading" ? "Loading" : "Up to date"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {profile?.email ?? "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Registration date
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(profile?.registrationDate)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Passkeys
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{credentialCountLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Devices</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{deviceCountLabel}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">Recovery passphrase</h2>
                <p className="text-sm text-slate-600">
                  Rotate your recovery passphrase to generate a new KEK and re-wrap the vault key.
                </p>
              </div>

              <form className="mt-6 flex flex-col gap-4" onSubmit={handlePassphraseSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="passphrase">
                    New recovery passphrase
                  </label>
                  <input
                    id="passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value);
                      setPassphraseStatus("idle");
                      setPassphraseMessage(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="Enter a new passphrase"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="confirmPassphrase">
                    Confirm new passphrase
                  </label>
                  <input
                    id="confirmPassphrase"
                    type="password"
                    value={confirmPassphrase}
                    onChange={(event) => {
                      setConfirmPassphrase(event.target.value);
                      setPassphraseStatus("idle");
                      setPassphraseMessage(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="Re-enter passphrase"
                    required
                  />
                  {!passphraseMatch && confirmPassphrase.length > 0 && (
                    <span className="text-xs text-red-500">Passphrases do not match.</span>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  KEK derivation uses Argon2id with hardened parameters. Your passphrase never leaves
                  this device.
                </div>

                <button
                  type="submit"
                  disabled={!passphraseReady || passphraseStatus === "saving"}
                  className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {passphraseStatus === "saving" ? "Updating passphrase..." : "Update passphrase"}
                </button>
              </form>

              {passphraseMessage && (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    passphraseStatus === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-600"
                  }`}
                >
                  {passphraseMessage}
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Passkeys</h3>
              <p className="mt-1 text-sm text-slate-500">
                Remove unused authenticators to keep your account tidy.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                {credentials.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No active passkeys registered.
                  </div>
                )}
                {credentials.map((cred) => (
                  <div
                    key={cred.credentialId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Credential {formatIdentifier(cred.externalCredentialId)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Created {formatDate(cred.createdAt)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last used {formatDate(cred.lastUsedAt)} • Sign count {cred.signCount}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCredential(cred.credentialId)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Devices</h3>
              <p className="mt-1 text-sm text-slate-500">
                Device bindings allow passkey-only access on trusted devices.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                {devices.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No device bindings yet.
                  </div>
                )}
                {devices.map((device) => (
                  <div
                    key={device.deviceId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {device.deviceLabel ?? `Device ${device.deviceId}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Bound {formatDate(device.createdAt)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last used {formatDate(device.lastUsedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDevice(device.deviceId)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
