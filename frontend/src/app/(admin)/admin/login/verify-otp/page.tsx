"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/hooks/use-admin-auth";

function normalizeOtp(value: string) {
  return value.replace(/\s+/g, "").slice(0, 6);
}

export default function AdminLoginVerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const emailLabel = useMemo(() => {
    if (!emailParam) return "your email";
    return emailParam;
  }, [emailParam]);
  const { status, errorMessage, verifyOtp } = useAdminAuth();
  const [otp, setOtp] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await verifyOtp(otp);
    if (ok) router.push("/admin");
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Verification required
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Enter your one-time code</h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a 6-digit code to {emailLabel}. Enter it below to finish signing in.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="text-sm font-semibold text-slate-700">
          Verification code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            required
            value={otp}
            onChange={(event) => setOtp(normalizeOtp(event.target.value))}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            placeholder="123456"
          />
        </label>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading" || otp.length < 6}
          className="mt-6 w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Verifying..." : "Verify code"}
        </button>
      </form>

      <div className="text-center text-sm text-slate-500">
        Need a new code?{" "}
        <Link className="font-semibold text-brand" href="/admin/login/start">
          Return to sign in
        </Link>
        .
      </div>
    </div>
  );
}
