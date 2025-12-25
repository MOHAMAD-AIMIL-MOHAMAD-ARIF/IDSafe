"use client";

import { useCallback, useMemo, useState } from "react";
import { listAdminUsers, updateAdminUserStatus } from "@/lib/api/admin";
import type { AdminUser } from "@/types/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminUsersStatus = "idle" | "loading" | "ready" | "error";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<AdminUsersStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async (query?: string, statusFilter?: string) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await listAdminUsers({ query, status: statusFilter });
      setUsers(response.users);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, []);

  const updateStatus = useCallback(async (userId: string, statusValue: AdminUser["status"]) => {
    setErrorMessage(null);
    const updated = await updateAdminUserStatus(userId, statusValue);
    setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));
    return updated;
  }, []);

  const value = useMemo(
    () => ({ users, status, errorMessage, loadUsers, updateStatus }),
    [users, status, errorMessage, loadUsers, updateStatus],
  );

  return value;
}
