import { apiClient } from "@/lib/api";
import type { AuthSession } from "@/types/auth";
import type {
  AdminHealthApiResponse,
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

function resolveApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  );
}

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

type AdminAuditLogApiEntry = {
  logId: number | string;
  eventType: string;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  detailsJson?: unknown;
  subject?: { email?: string | null } | null;
  actor?: { email?: string | null } | null;
};

type AdminAuditLogApiResponse = {
  logs: AdminAuditLogApiEntry[];
};

function deriveLogLevel(eventType: string): AdminLogEntry["level"] {
  if (eventType.endsWith(".FAIL") || eventType.endsWith(".FAILURE") || eventType.endsWith(".DENIED")) {
    return "error";
  }
  if (eventType.endsWith(".SUCCESS") || eventType.endsWith(".OK")) {
    return "info";
  }
  return "warn";
}

function deriveService(eventType: string): string {
  const [service] = eventType.split(".");
  return service ?? "SYSTEM";
}

function describeDetails(details: AdminAuditLogApiEntry["detailsJson"]): string | null {
  if (!details || typeof details !== "object") return null;
  const record = details as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : null;
  const reason = typeof record.reason === "string" ? record.reason : null;
  if (message && reason) return `${message} (${reason})`;
  return message ?? reason ?? JSON.stringify(record);
}

function mapAuditLogEntry(entry: AdminAuditLogApiEntry): AdminLogEntry {
  const detailsSummary = describeDetails(entry.detailsJson);
  return {
    id: String(entry.logId),
    timestamp: new Date(entry.createdAt).toISOString(),
    level: deriveLogLevel(entry.eventType),
    service: deriveService(entry.eventType),
    message: detailsSummary ? `${entry.eventType} — ${detailsSummary}` : entry.eventType,
    correlationId: String(entry.logId),
  };
}

export async function fetchAdminLogs(filters: AdminLogFilters = {}): Promise<{ logs: AdminLogEntry[] }> {
  const query = toQueryString({
    level: filters.level,
    service: filters.service,
    from: filters.from,
    to: filters.to,
    query: filters.query,
  });
  const response = await apiClient.get<AdminAuditLogApiResponse>(`/admin/audit-logs${query}`);
  return { logs: response.logs.map(mapAuditLogEntry) };
}

export async function exportAdminAuditLogsCsv(): Promise<Blob> {
  const response = await fetch(`${resolveApiBaseUrl()}/admin/audit-logs/export`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Export failed (${response.status}). ${message}`.trim());
  }

  return response.blob();
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
  const response = await apiClient.get<AdminHealthApiResponse>("/admin/system/health");

  const status: AdminHealthOverview["status"] = response.status === "ok" ? "healthy" : "degraded";
  const databaseStatus: AdminHealthOverview["status"] =
    response.database === "ok" ? "healthy" : "down";

  return {
    status,
    updatedAt: new Date().toLocaleString(),
    services: [
      { name: "API", status, latencyMs: null },
      { name: "Database", status: databaseStatus, latencyMs: null },
    ],
    metrics: [
      { name: "Uptime", value: response.metrics.uptimeSeconds, unit: "s" },
      { name: "Requests", value: response.metrics.requestCount },
      { name: "Errors", value: response.metrics.errorCount },
      { name: "Error rate", value: Number((response.metrics.errorRate * 100).toFixed(2)), unit: "%" },
      { name: "Users", value: response.counts.users },
      { name: "Audit logs", value: response.counts.auditLogs },
      { name: "2xx responses", value: response.metrics.statusBuckets["2xx"] },
      { name: "4xx responses", value: response.metrics.statusBuckets["4xx"] },
      { name: "5xx responses", value: response.metrics.statusBuckets["5xx"] },
    ],
  };
}
