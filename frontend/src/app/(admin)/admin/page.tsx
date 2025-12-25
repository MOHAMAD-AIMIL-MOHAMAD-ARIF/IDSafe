"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAdminSummary } from "@/hooks/use-admin-summary";

function formatPercent(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

export default function AdminDashboardPage() {
  const { summary, events, status, errorMessage, loadSummary } = useAdminSummary();

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Overview</p>
            <h2 className="text-2xl font-semibold">Security operations dashboard</h2>
            <p className="mt-2 text-sm text-slate-600">
              Monitor user activity, recovery health, and platform stability in real time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSummary()}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              Refresh
            </button>
            <Link
              href="/admin/health"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              View health
            </Link>
          </div>
        </div>
        {status === "loading" && (
          <p className="mt-4 text-sm text-slate-500">Loading live metrics...</p>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total users</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {summary?.userCount ?? "—"}
          </p>
          <p className="mt-2 text-sm text-slate-500">Active registrations</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Locked accounts
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {summary?.lockedAccounts ?? "—"}
          </p>
          <p className="mt-2 text-sm text-slate-500">Needs review</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recovery events (24h)
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {summary?.recoveryEvents24h ?? "—"}
          </p>
          <p className="mt-2 text-sm text-slate-500">Completed flows</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Error rate
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatPercent(summary?.errorRate)}
          </p>
          <p className="mt-2 text-sm text-slate-500">Auth + recovery</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Recent recovery events</h3>
            <p className="text-sm text-slate-500">Latest account recovery requests and outcomes.</p>
          </div>
          <Link href="/admin/logs" className="text-sm font-semibold text-brand">
            View logs
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Occurred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No recent recovery events.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{event.userEmail}</td>
                    <td className="px-4 py-3 text-slate-600">{event.method}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(event.occurredAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
