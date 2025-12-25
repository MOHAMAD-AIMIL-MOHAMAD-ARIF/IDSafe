"use client";

import { useCallback, useMemo, useState } from "react";
import { fetchAdminRecoveryEvents, fetchAdminSummary } from "@/lib/api/admin";
import type { AdminRecoveryEvent, AdminSummary } from "@/types/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminSummaryStatus = "idle" | "loading" | "ready" | "error";

export function useAdminSummary() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [events, setEvents] = useState<AdminRecoveryEvent[]>([]);
  const [status, setStatus] = useState<AdminSummaryStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const [summaryResponse, eventsResponse] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminRecoveryEvents(),
      ]);
      setSummary(summaryResponse);
      setEvents(eventsResponse.events);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, []);

  const value = useMemo(
    () => ({ summary, events, status, errorMessage, loadSummary }),
    [summary, events, status, errorMessage, loadSummary],
  );

  return value;
}
