"use client";

import { useEffect } from "react";
import { useAdminHealth } from "@/hooks/use-admin-health";

function statusBadge(status?: string) {
  if (!status) return "bg-slate-100 text-slate-600";
  if (status === "healthy") return "bg-emerald-100 text-emerald-700";
  if (status === "degraded") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function AdminHealthPage() {
  const { overview, status, errorMessage, loadHealth } = useAdminHealth();

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Health & metrics</h2>
            <p className="mt-2 text-sm text-slate-600">
              Track service uptime, latency, and security signal metrics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
          >
            Refresh
          </button>
        </div>
        {overview && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(overview.status)}`}>
              {overview.status}
            </span>
            <span>Last updated: {overview.updatedAt}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Service health</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {overview?.services?.length ? (
            overview.services.map((service) => (
              <div
                key={service.name}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                    <p className="text-xs text-slate-500">Latency: {service.latencyMs ?? "—"} ms</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(
                      service.status,
                    )}`}
                  >
                    {service.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">
              {status === "loading" ? "Loading services..." : "No service health data."}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Key metrics</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {overview?.metrics?.length ? (
            overview.metrics.map((metric) => (
              <div
                key={metric.name}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {metric.name}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {metric.value}
                  {metric.unit ? <span className="text-sm text-slate-500"> {metric.unit}</span> : null}
                </p>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">
              {status === "loading" ? "Loading metrics..." : "No metric data available."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
