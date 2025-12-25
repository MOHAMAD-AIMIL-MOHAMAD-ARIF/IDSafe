"use client";

import { useCallback, useMemo, useState } from "react";
import { fetchAdminLogs } from "@/lib/api/admin";
import type { AdminLogEntry } from "@/types/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminLogsStatus = "idle" | "loading" | "ready" | "error";

export type AdminLogFiltersState = {
  level?: string;
  service?: string;
  from?: string;
  to?: string;
  query?: string;
};

export function useAdminLogs() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [status, setStatus] = useState<AdminLogsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async (filters: AdminLogFiltersState = {}) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetchAdminLogs(filters);
      setLogs(response.logs);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, []);

  const value = useMemo(
    () => ({ logs, status, errorMessage, loadLogs }),
    [logs, status, errorMessage, loadLogs],
  );

  return value;
}
