"use client";

import { useCallback, useMemo, useState } from "react";
import { fetchAdminHealth } from "@/lib/api/admin";
import type { AdminHealthOverview } from "@/types/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminHealthStatus = "idle" | "loading" | "ready" | "error";

export function useAdminHealth() {
  const [overview, setOverview] = useState<AdminHealthOverview | null>(null);
  const [status, setStatus] = useState<AdminHealthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetchAdminHealth();
      setOverview(response);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, []);

  const value = useMemo(
    () => ({ overview, status, errorMessage, loadHealth }),
    [overview, status, errorMessage, loadHealth],
  );

  return value;
}
