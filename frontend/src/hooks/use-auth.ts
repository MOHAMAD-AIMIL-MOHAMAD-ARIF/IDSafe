import type { AuthRole } from "@/types/auth";
import { useAuthContext } from "@/components/auth/auth-provider";

export function useAuth() {
  const auth = useAuthContext();
  return {
    ...auth,
    isAuthenticated: auth.status === "authenticated",
    isLoading: auth.status === "loading",
  };
}

export function useRequireAuth() {
  const auth = useAuth();
  return {
    ...auth,
    ready: auth.status !== "loading",
    allowed: auth.status === "authenticated",
  };
}

export function useRequireRole(role: AuthRole) {
  const auth = useAuth();
  return {
    ...auth,
    ready: auth.status !== "loading",
    allowed: auth.status === "authenticated" && auth.session?.role === role,
  };
}
