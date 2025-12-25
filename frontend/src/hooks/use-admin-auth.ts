"use client";

import { useCallback, useMemo, useState } from "react";
import { adminLogin } from "@/lib/api/admin";
import type { AdminLoginResponse } from "@/types/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminAuthStatus = "idle" | "loading" | "authenticated" | "error";

export function useAdminAuth() {
  const [status, setStatus] = useState<AdminAuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminLoginResponse["admin"] | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await adminLogin({ email, password });
      setProfile(response.admin);
      setStatus("authenticated");
      return response;
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ status, errorMessage, profile, login }),
    [status, errorMessage, profile, login],
  );

  return value;
}
