"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useAdminConfig } from "@/hooks/use-admin-config";

export default function AdminSessionConfigPage() {
  const { policy, status, errorMessage, successMessage, loadPolicy, savePolicy } = useAdminConfig("session");
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(15);
  //const [maxSessionHours, setMaxSessionHours] = useState(12);
  //const [mfaRequired, setMfaRequired] = useState(false);
  const [sessionRotationMinutes, setSessionRotationMinutes] = useState(30);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    if (!policy) return;
    setIdleTimeoutMinutes(policy.idleTimeoutMinutes);
    //setMaxSessionHours(policy.maxSessionHours);
    //setMfaRequired(policy.mfaRequired);
    setSessionRotationMinutes(policy.sessionRotationMinutes);
  }, [policy]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await savePolicy({
      idleTimeoutMinutes,
      //maxSessionHours,
      //mfaRequired,
      sessionRotationMinutes,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Session policy</h2>
        <p className="mt-2 text-sm text-slate-600">
          Define session rotation cadence.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* <label className="text-sm font-semibold text-slate-700">
            Idle timeout (minutes)
            <input
              type="number"
              min={5}
              value={idleTimeoutMinutes}
              onChange={(event) => setIdleTimeoutMinutes(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label> */}
          {/* <label className="text-sm font-semibold text-slate-700">
            Max session length (hours)
            <input
              type="number"
              min={1}
              value={maxSessionHours}
              onChange={(event) => setMaxSessionHours(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label> */}
          <label className="text-sm font-semibold text-slate-700">
            Session rotation (minutes)
            <input
              type="number"
              min={5}
              value={sessionRotationMinutes}
              onChange={(event) => setSessionRotationMinutes(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
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
