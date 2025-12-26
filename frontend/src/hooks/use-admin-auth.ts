"use client";

import { useCallback, useMemo, useState } from "react";
import { adminLoginStart, adminLoginVerifyOtp } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminAuthStatus =
  | "idle"
  | "loading"
  | "otp-sent"
  | "authenticated"
  | "error";

export function useAdminAuth() {
  const [status, setStatus] = useState<AdminAuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startLogin = useCallback(async (email: string, password: string) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      await adminLoginStart({ email, password });
      setStatus("otp-sent");
      return true;
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
      return false;
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      await adminLoginVerifyOtp({ otp });
      setStatus("authenticated");
      return true;
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({ status, errorMessage, startLogin, verifyOtp }),
    [status, errorMessage, startLogin, verifyOtp],
  );

  return value;
}
