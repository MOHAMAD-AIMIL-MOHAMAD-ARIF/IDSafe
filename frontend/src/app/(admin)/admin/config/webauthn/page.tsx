"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useAdminConfig } from "@/hooks/use-admin-config";
import type { AdminWebAuthnPolicy } from "@/types/admin";

const verificationOptions: AdminWebAuthnPolicy["userVerification"][] = [
  "required",
  "preferred",
  "discouraged",
];
const attestationOptions: AdminWebAuthnPolicy["attestation"][] = [
  "none",
  "direct",
  "indirect",
  "enterprise",
];
const residentKeyOptions: AdminWebAuthnPolicy["residentKey"][] = [
  "required",
  "preferred",
  "discouraged",
];

export default function AdminWebAuthnConfigPage() {
  const { policy, status, errorMessage, successMessage, loadPolicy, savePolicy } =
    useAdminConfig("webauthn");
  const [rpId, setRpId] = useState("");
  const [userVerification, setUserVerification] =
    useState<AdminWebAuthnPolicy["userVerification"]>("preferred");
  const [attestation, setAttestation] =
    useState<AdminWebAuthnPolicy["attestation"]>("none");
  const [residentKey, setResidentKey] =
    useState<AdminWebAuthnPolicy["residentKey"]>("preferred");
  const [timeoutMs, setTimeoutMs] = useState(60000);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    if (!policy) return;
    setRpId(policy.rpId);
    setUserVerification(policy.userVerification);
    setAttestation(policy.attestation);
    setResidentKey(policy.residentKey);
    setTimeoutMs(policy.timeoutMs);
  }, [policy]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await savePolicy({ rpId, userVerification, attestation, residentKey, timeoutMs });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">WebAuthn policy</h2>
        <p className="mt-2 text-sm text-slate-600">
          Control passkey attestation requirements and authentication timeouts.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            RP ID
            <input
              value={rpId}
              onChange={(event) => setRpId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="idsafe.example.com"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Timeout (ms)
            <input
              type="number"
              min={10000}
              value={timeoutMs}
              onChange={(event) => setTimeoutMs(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            User verification
            <select
              value={userVerification}
              onChange={(event) =>
                setUserVerification(event.target.value as AdminWebAuthnPolicy["userVerification"])
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              {verificationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Attestation
            <select
              value={attestation}
              onChange={(event) =>
                setAttestation(event.target.value as AdminWebAuthnPolicy["attestation"])
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              {attestationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Resident key
            <select
              value={residentKey}
              onChange={(event) =>
                setResidentKey(event.target.value as AdminWebAuthnPolicy["residentKey"])
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              {residentKeyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="mt-6 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "saving" ? "Saving..." : "Save policy"}
        </button>
      </form>
    </div>
  );
}
