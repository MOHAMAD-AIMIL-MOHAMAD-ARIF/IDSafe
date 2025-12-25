import { apiClient } from "@/lib/api";
import type {
  AdminHealthOverview,
  AdminKdfPolicy,
  AdminLoginResponse,
  AdminRecoveryEvent,
  AdminSessionPolicy,
  AdminSummary,
  AdminUser,
  AdminWebAuthnPolicy,
  AdminLogEntry,
} from "@/types/admin";

export type AdminLoginPayload = {
  email: string;
  password: string;
};

export type AdminUserQuery = {
  query?: string;
  status?: string;
};

export type AdminLogFilters = {
  level?: string;
  service?: string;
  from?: string;
  to?: string;
  query?: string;
};

function toQueryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function adminLogin(payload: AdminLoginPayload): Promise<AdminLoginResponse> {
  return apiClient.post<AdminLoginResponse>("/admin/login", payload);
}

export async function fetchAdminSummary(): Promise<AdminSummary> {
  return apiClient.get<AdminSummary>("/admin/summary");
}

export async function fetchAdminRecoveryEvents(): Promise<{ events: AdminRecoveryEvent[] }> {
  return apiClient.get<{ events: AdminRecoveryEvent[] }>("/admin/recovery-events");
}

export async function listAdminUsers(params: AdminUserQuery = {}): Promise<{ users: AdminUser[] }> {
  const query = toQueryString({ query: params.query, status: params.status });
  return apiClient.get<{ users: AdminUser[] }>(`/admin/users${query}`);
}

export async function updateAdminUserStatus(
  userId: string,
  status: AdminUser["status"],
): Promise<AdminUser> {
  return apiClient.patch<AdminUser>(`/admin/users/${userId}`, { status });
}

export async function fetchAdminLogs(filters: AdminLogFilters = {}): Promise<{ logs: AdminLogEntry[] }> {
  const query = toQueryString({
    level: filters.level,
    service: filters.service,
    from: filters.from,
    to: filters.to,
    query: filters.query,
  });
  return apiClient.get<{ logs: AdminLogEntry[] }>(`/admin/logs${query}`);
}

export async function fetchKdfPolicy(): Promise<AdminKdfPolicy> {
  return apiClient.get<AdminKdfPolicy>("/admin/config/kdf");
}

export async function updateKdfPolicy(payload: AdminKdfPolicy): Promise<AdminKdfPolicy> {
  return apiClient.put<AdminKdfPolicy>("/admin/config/kdf", payload);
}

export async function fetchWebAuthnPolicy(): Promise<AdminWebAuthnPolicy> {
  return apiClient.get<AdminWebAuthnPolicy>("/admin/config/webauthn");
}

export async function updateWebAuthnPolicy(
  payload: AdminWebAuthnPolicy,
): Promise<AdminWebAuthnPolicy> {
  return apiClient.put<AdminWebAuthnPolicy>("/admin/config/webauthn", payload);
}

export async function fetchSessionPolicy(): Promise<AdminSessionPolicy> {
  return apiClient.get<AdminSessionPolicy>("/admin/config/session");
}

export async function updateSessionPolicy(
  payload: AdminSessionPolicy,
): Promise<AdminSessionPolicy> {
  return apiClient.put<AdminSessionPolicy>("/admin/config/session", payload);
}

export async function fetchAdminHealth(): Promise<AdminHealthOverview> {
  return apiClient.get<AdminHealthOverview>("/admin/health");
}
