"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useAdminConfig } from "@/hooks/use-admin-config";

export default function AdminKdfConfigPage() {
  const { policy, status, errorMessage, successMessage, loadPolicy, savePolicy } =
    useAdminConfig("kdf");
  const [timeCost, setTimeCost] = useState(3);
  const [memoryCostKiB, setMemoryCostKiB] = useState(65536);
  const [parallelism, setParallelism] = useState(1);
  const [saltSize, setSaltSize] = useState(16);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    if (!policy) return;
    setTimeCost(policy.timeCost);
    setMemoryCostKiB(policy.memoryCostKiB);
    setParallelism(policy.parallelism);
    setSaltSize(policy.saltSize);
  }, [policy]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await savePolicy({ timeCost, memoryCostKiB, parallelism, saltSize });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">KDF policy</h2>
        <p className="mt-2 text-sm text-slate-600">
          Configure Argon2 parameters used to derive recovery keys.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Time cost
            <input
              type="number"
              min={1}
              value={timeCost}
              onChange={(event) => setTimeCost(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Memory cost (KiB)
            <input
              type="number"
              min={1024}
              value={memoryCostKiB}
              onChange={(event) => setMemoryCostKiB(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Parallelism
            <input
              type="number"
              min={1}
              value={parallelism}
              onChange={(event) => setParallelism(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Salt size (bytes)
            <input
              type="number"
              min={8}
              value={saltSize}
              onChange={(event) => setSaltSize(Number(event.target.value))}
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
