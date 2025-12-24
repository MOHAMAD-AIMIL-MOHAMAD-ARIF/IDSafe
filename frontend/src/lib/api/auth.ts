import { apiClient } from "./index";
import type { AuthSession } from "@/types/auth";

export type AuthSessionResponse = AuthSession;

export async function fetchSession(): Promise<AuthSessionResponse> {
  return apiClient.get<AuthSessionResponse>("/auth/session", { cache: "no-store" });
}

export async function logout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>("/auth/logout");
}
