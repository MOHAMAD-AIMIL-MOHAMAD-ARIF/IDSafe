export type AdminSummary = {
  userCount: number;
  lockedAccounts: number;
  recoveryEvents24h: number;
  errorRate: number;
};

export type AdminRecoveryEvent = {
  id: string;
  userEmail: string;
  status: "success" | "failed" | "pending";
  method: string;
  occurredAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  status: "active" | "locked" | "suspended";
  lastActiveAt?: string | null;
  createdAt?: string | null;
  recoveryEnabled?: boolean;
};

export type AdminLogEntry = {
  id: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  service: string;
  message: string;
  correlationId?: string;
};

export type AdminKdfPolicy = {
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
  saltSize: number;
};

export type AdminWebAuthnPolicy = {
  rpId: string;
  userVerification: "required" | "preferred" | "discouraged";
  attestation: "none" | "direct" | "indirect" | "enterprise";
  residentKey: "required" | "preferred" | "discouraged";
  timeoutMs: number;
};

export type AdminSessionPolicy = {
  idleTimeoutMinutes: number;
  maxSessionHours: number;
  mfaRequired: boolean;
  sessionRotationMinutes: number;
};

export type AdminServiceStatus = {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number | null;
};

export type AdminMetric = {
  name: string;
  value: string | number;
  unit?: string | null;
};

export type AdminHealthOverview = {
  status: "healthy" | "degraded" | "down";
  updatedAt: string;
  services: AdminServiceStatus[];
  metrics: AdminMetric[];
};

export type AdminLoginStartResponse = {
  ok: true;
};

export type AdminLoginVerifyResponse = {
  ok: true;
  admin?: {
    name?: string;
    email?: string;
  };
};
