import { apiClient } from "@/lib/api";
import type { AuthSession } from "@/types/auth";
import type {
  AdminHealthOverview,
  AdminKdfPolicy,
  AdminLoginStartResponse,
  AdminLoginVerifyResponse,
  AdminRecoveryEvent,
  AdminSessionPolicy,
  AdminSummary,
  AdminUser,
  AdminWebAuthnPolicy,
  AdminLogEntry,
} from "@/types/admin";

export type AdminLoginStartPayload = {
  email: string;
  password: string;
};

export type AdminLoginVerifyPayload = {
  otp: string;
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

export async function adminLoginStart(
  payload: AdminLoginStartPayload,
): Promise<AdminLoginStartResponse> {
  return apiClient.post<AdminLoginStartResponse>("/admin/auth/login/start", payload);
}

export async function adminLoginVerifyOtp(
  payload: AdminLoginVerifyPayload,
): Promise<AdminLoginVerifyResponse> {
  return apiClient.post<AdminLoginVerifyResponse>("/admin/auth/login/verify-otp", payload);
}

export async function adminLogout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>("/admin/auth/logout");
}

export async function fetchAdminSession(): Promise<AuthSession> {
  return apiClient.get<AuthSession>("/admin/auth/session", { cache: "no-store" });
}

export async function fetchAdminSummary(): Promise<AdminSummary> {
  return apiClient.get<AdminSummary>("/admin/summary");
}

export async function fetchAdminRecoveryEvents(): Promise<{ events: AdminRecoveryEvent[] }> {
  return apiClient.get<{ events: AdminRecoveryEvent[] }>("/admin/recovery-events");
}

type ApiUserStatus = "ACTIVE" | "LOCKED" | "DEACTIVATED";

type AdminUserApiResponse = {
  userId: number;
  email: string;
  status: ApiUserStatus;
  registrationDate?: string | null;
  lastLoginAt?: string | null;
  activeCredentialCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const statusToApi: Record<AdminUser["status"], ApiUserStatus> = {
  active: "ACTIVE",
  locked: "LOCKED",
  suspended: "DEACTIVATED",
};

const statusFromApi: Record<ApiUserStatus, AdminUser["status"]> = {
  ACTIVE: "active",
  LOCKED: "locked",
  DEACTIVATED: "suspended",
};

function mapAdminUserFromApi(payload: AdminUserApiResponse): AdminUser {
  return {
    id: String(payload.userId),
    email: payload.email,
    status: statusFromApi[payload.status],
    createdAt: payload.registrationDate ?? payload.createdAt ?? undefined,
    lastActiveAt: payload.lastLoginAt ?? undefined,
    recoveryEnabled:
      payload.activeCredentialCount === null || payload.activeCredentialCount === undefined
        ? undefined
        : payload.activeCredentialCount > 0,
  };
}

export async function listAdminUsers(params: AdminUserQuery = {}): Promise<{ users: AdminUser[] }> {
  const query = toQueryString({ query: params.query, status: params.status });
  const response = await apiClient.get<{ users: AdminUserApiResponse[] }>(`/admin/users${query}`);
  return { users: response.users.map(mapAdminUserFromApi) };
}

export async function updateAdminUserStatus(
  userId: string,
  status: AdminUser["status"],
): Promise<AdminUser> {
  const response = await apiClient.patch<{ user: AdminUserApiResponse }>(
    `/admin/users/${userId}/status`,
    { status: statusToApi[status] },
  );
  return mapAdminUserFromApi(response.user);
}

export async function fetchAdminLogs(filters: AdminLogFilters = {}): Promise<{ logs: AdminLogEntry[] }> {
  const query = toQueryString({
    level: filters.level,
    service: filters.service,
    from: filters.from,
    to: filters.to,
    query: filters.query,
  });
  return apiClient.get<{ logs: AdminLogEntry[] }>(`/admin/audit-logs${query}`);
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
