"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAdminUsers } from "@/hooks/use-admin-users";
import type { AdminUser } from "@/types/admin";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString();
}

const statusOptions: AdminUser["status"][] = ["active", "locked", "suspended"];

export default function AdminUsersPage() {
  const { users, status, errorMessage, loadUsers, updateStatus } = useAdminUsers();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredStatus = useMemo(
    () => (statusFilter === "all" ? undefined : statusFilter),
    [statusFilter],
  );

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadUsers(query, filteredStatus);
  };

  const handleStatusChange = async (userId: string, nextStatus: AdminUser["status"]) => {
    setSavingId(userId);
    try {
      await updateStatus(userId, nextStatus);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">User directory</h2>
        <p className="mt-2 text-sm text-slate-600">
          Search accounts, lock or suspend access, and review recovery enrollment.
        </p>
      </header>

      <form
        onSubmit={handleSearch}
        className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email or user id"
          className="min-w-[220px] flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Search
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
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Recovery</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {status === "loading" ? "Loading users..." : "No users found."}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{user.email}</div>
                    <div className="text-xs text-slate-500">{user.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.status}
                      onChange={(event) =>
                        void handleStatusChange(user.id, event.target.value as AdminUser["status"])
                      }
                      disabled={savingId === user.id}
                      className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.recoveryEnabled ? "Enabled" : "Not enrolled"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(user.lastActiveAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
