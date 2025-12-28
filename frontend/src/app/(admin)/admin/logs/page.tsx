"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useAdminLogs } from "@/hooks/use-admin-logs";

export default function AdminLogsPage() {
  const { logs, status, errorMessage, loadLogs } = useAdminLogs();
  const [level, setLevel] = useState("all");
  const [service, setService] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleFilter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadLogs({
      level: level === "all" ? undefined : level,
      service: service || undefined,
      from: from || undefined,
      to: to || undefined,
      query: query || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Audit log viewer</h2>
        <p className="mt-2 text-sm text-slate-600">
          Filter authentication, recovery, and policy events across the admin platform.
        </p>
      </header>

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-6"
      >
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input
          value={service}
          onChange={(event) => setService(event.target.value)}
          placeholder="Service"
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          type="datetime-local"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search text"
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Apply filters
        </button>
      </form>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Correlation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {status === "loading" ? "Loading logs..." : "No log entries found."}
                </td>
              </tr>
            ) : (
              logs.map((entry, index) => (
                <tr
                  key={
                    entry.id ??
                    `${entry.timestamp}-${entry.service}-${entry.level}-${index}`
                  }
                >
                  <td className="px-4 py-3 text-slate-600">{entry.timestamp}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {entry.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{entry.service}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.message}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {entry.correlationId ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
