"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/use-admin-auth";

export default function AdminLoginStartPage() {
  const router = useRouter();
  const { status, errorMessage, startLogin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await startLogin(email, password);
    if (ok) {
      const params = new URLSearchParams({ email });
      router.push(`/admin/login/verify-otp?${params.toString()}`);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Admin access</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in to IDSafe Ops</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your admin credentials to receive a one-time verification code.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
              placeholder="admin@idsafe.com"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
              placeholder="••••••••"
            />
          </label>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-6 w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Verifying..." : "Send verification code"}
        </button>
      </form>

      <div className="text-center text-sm text-slate-500">
        Return to <Link className="font-semibold text-brand" href="/">IDSafe home</Link>.
      </div>
    </div>
  );
}
