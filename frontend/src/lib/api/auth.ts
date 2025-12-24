import { apiClient } from "./index";
import type { AuthSession } from "@/types/auth";

export type AuthSessionResponse = AuthSession;

export type LoginStartResponse = {
  ok: true;
  options: unknown;
};

export type LoginFinishResponse = {
  ok: true;
};

export async function fetchSession(): Promise<AuthSessionResponse> {
  return apiClient.get<AuthSessionResponse>("/auth/session", { cache: "no-store" });
}

export async function startWebauthnLogin(email: string): Promise<LoginStartResponse> {
  return apiClient.post<LoginStartResponse>("/auth/webauthn/login/start", { email });
}

export async function finishWebauthnLogin(credential: unknown): Promise<LoginFinishResponse> {
  return apiClient.post<LoginFinishResponse>("/auth/webauthn/login/finish", { credential });
}

export async function logout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>("/auth/logout");
}
