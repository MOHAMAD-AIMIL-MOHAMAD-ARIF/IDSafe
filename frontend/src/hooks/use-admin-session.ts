"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@/types/auth";
import { fetchAdminSession } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

export type AdminSessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AdminSessionState = {
  status: AdminSessionStatus;
  session: AuthSession | null;
  error: string | null;
};

export function useAdminSession(refreshKey?: string | number | null): AdminSessionState {
  const [status, setStatus] = useState<AdminSessionStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      setStatus("loading");
      setError(null);

      try {
        const response = await fetchAdminSession();
        if (!isActive) return;
        if (response.role !== "ADMIN") {
          setSession(null);
          setStatus("unauthenticated");
          return;
        }

        setSession(response);
        setStatus("authenticated");
      } catch (err) {
        if (!isActive) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setSession(null);
          setStatus("unauthenticated");
          return;
        }

        setSession(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to verify admin session");
      }
    };

    void checkSession();

    return () => {
      isActive = false;
    };
  }, [refreshKey]);

  return { status, session, error };
}
