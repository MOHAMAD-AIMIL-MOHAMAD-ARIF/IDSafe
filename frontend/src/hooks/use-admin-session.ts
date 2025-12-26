"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthSession } from "@/types/auth";
import { fetchSession } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export type AdminSessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AdminSessionState = {
  status: AdminSessionStatus;
  session: AuthSession | null;
  error: string | null;
};

export function useAdminSession(): AdminSessionState {
  const [status, setStatus] = useState<AdminSessionStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      setStatus("loading");
      setError(null);

      try {
        const response = await fetchSession();
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
        if (err instanceof ApiError && err.status === 401) {
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
  }, [pathname]);

  return { status, session, error };
}
