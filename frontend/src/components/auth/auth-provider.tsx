"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthSession, AuthRole } from "@/types/auth";
import { fetchSession, logout as apiLogout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isEndUser: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const sessionData = await fetchSession();
      setSession(sessionData);
      setStatus("authenticated");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession(null);
        setStatus("unauthenticated");
        return;
      }

      setSession(null);
      setStatus("unauthenticated");
      setError(err instanceof Error ? err.message : "Unable to verify session");
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/recovery")) {
      setSession(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const value = useMemo<AuthContextValue>(() => {
    const role: AuthRole | null = session?.role ?? null;
    return {
      status,
      session,
      error,
      refresh,
      logout,
      isAdmin: role === "ADMIN",
      isEndUser: role === "END_USER",
    };
  }, [error, refresh, session, status, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
