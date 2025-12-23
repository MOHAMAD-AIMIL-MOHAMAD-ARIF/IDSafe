// src/controllers/admin.system.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import { getDefaultKdfParams, KDF_CONFIG_KEYS } from "../services/kdfService.server.js";
import { getMetricsSnapshot } from "../services/metricsService.js";

const SECURITY_CONFIG_KEYS = {
  sessionTimeoutMs: "security.sessionTimeoutMs",
  maxLoginAttempts: "security.maxLoginAttempts",
  rateLimitAuthWindowMs: "security.rateLimit.auth.windowMs",
  rateLimitAuthMax: "security.rateLimit.auth.max",
  rateLimitRecoveryWindowMs: "security.rateLimit.recovery.windowMs",
  rateLimitRecoveryMax: "security.rateLimit.recovery.max",
} as const;

const WEBAUTHN_POLICY_KEYS = {
  attestationMode: "webauthn.attestation.mode",
  allowedAttestationFormats: "webauthn.allowedAttestationFormats",
  allowedAAGUIDs: "webauthn.allowedAAGUIDs",
  trustedAttestationRoots: "webauthn.trustedAttestationRoots",
} as const;

function toInt(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function tryJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const updateSystemConfigSchema = z.object({
  security: z
    .object({
      sessionTimeoutMs: z.number().int().positive().optional(),
      maxLoginAttempts: z.number().int().min(1).optional(),
      rateLimitAuthWindowMs: z.number().int().min(1000).optional(),
      rateLimitAuthMax: z.number().int().min(1).optional(),
      rateLimitRecoveryWindowMs: z.number().int().min(1000).optional(),
      rateLimitRecoveryMax: z.number().int().min(1).optional(),
    })
    .partial()
    .optional(),
  kdf: z
    .object({
      algorithm: z.enum(["argon2id"]).optional(),
      timeCost: z.number().int().min(1).max(10).optional(),
      memoryCostKiB: z.number().int().min(8 * 1024).max(512 * 1024).optional(),
      parallelism: z.number().int().min(1).max(8).optional(),
      hashLenBytes: z.number().int().min(16).max(64).optional(),
    })
    .partial()
    .optional(),
  webauthnAttestation: z
    .object({
      attestationMode: z.string().min(1).optional(),
      allowedAttestationFormats: z.array(z.string()).optional(),
      allowedAAGUIDs: z.array(z.string()).optional(),
      trustedAttestationRoots: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
});

async function upsertConfig(adminUserId: number, key: string, value: string) {
  return prisma.systemConfig.upsert({
    where: { configKey: key },
    create: {
      configKey: key,
      configValue: value,
      updatedByUserId: adminUserId,
    },
    update: {
      configValue: value,
      updatedByUserId: adminUserId,
      updatedAt: new Date(),
    },
  });
}

/**
 * GET /admin/system/config
 */
export async function adminGetSystemConfig(_req: Request, res: Response) {
  const keys = [
    ...Object.values(SECURITY_CONFIG_KEYS),
    ...Object.values(KDF_CONFIG_KEYS),
    ...Object.values(WEBAUTHN_POLICY_KEYS),
  ];

  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: keys } },
    select: { configKey: true, configValue: true },
  });

  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));

  const kdfDefaults = await getDefaultKdfParams(prisma);

  const security = {
    sessionTimeoutMs: toInt(map.get(SECURITY_CONFIG_KEYS.sessionTimeoutMs), env.SESSION_MAX_AGE_MS),
    maxLoginAttempts: toInt(map.get(SECURITY_CONFIG_KEYS.maxLoginAttempts), 5),
    rateLimitAuthWindowMs: toInt(map.get(SECURITY_CONFIG_KEYS.rateLimitAuthWindowMs), env.RL_AUTH_WINDOW_MS),
    rateLimitAuthMax: toInt(map.get(SECURITY_CONFIG_KEYS.rateLimitAuthMax), env.RL_AUTH_MAX),
    rateLimitRecoveryWindowMs: toInt(
      map.get(SECURITY_CONFIG_KEYS.rateLimitRecoveryWindowMs),
      env.RL_RECOVERY_WINDOW_MS,
    ),
    rateLimitRecoveryMax: toInt(map.get(SECURITY_CONFIG_KEYS.rateLimitRecoveryMax), env.RL_RECOVERY_MAX),
  };

  const kdf = {
    algorithm: map.get(KDF_CONFIG_KEYS.algorithm) ?? kdfDefaults.algorithm,
    timeCost: toInt(map.get(KDF_CONFIG_KEYS.timeCost), kdfDefaults.timeCost),
    memoryCostKiB: toInt(map.get(KDF_CONFIG_KEYS.memoryCostKiB), kdfDefaults.memoryCostKiB),
    parallelism: toInt(map.get(KDF_CONFIG_KEYS.parallelism), kdfDefaults.parallelism),
    hashLenBytes: toInt(map.get(KDF_CONFIG_KEYS.hashLenBytes), kdfDefaults.hashLenBytes),
  };

  const webauthnAttestation = {
    attestationMode: map.get(WEBAUTHN_POLICY_KEYS.attestationMode) ?? "direct",
    allowedAttestationFormats: tryJson<string[]>(map.get(WEBAUTHN_POLICY_KEYS.allowedAttestationFormats), []),
    allowedAAGUIDs: tryJson<string[]>(map.get(WEBAUTHN_POLICY_KEYS.allowedAAGUIDs), []),
    trustedAttestationRoots: tryJson<string[]>(map.get(WEBAUTHN_POLICY_KEYS.trustedAttestationRoots), []),
  };

  return res.json({ security, kdf, webauthnAttestation });
}

/**
 * PUT /admin/system/config
 */
export async function adminUpdateSystemConfig(req: Request, res: Response) {
  const adminUserId = req.session.userId!;
  const parsed = updateSystemConfigSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const updates: Array<Promise<unknown>> = [];

  if (parsed.data.security) {
    const security = parsed.data.security;
    if (security.sessionTimeoutMs !== undefined) {
      updates.push(upsertConfig(adminUserId, SECURITY_CONFIG_KEYS.sessionTimeoutMs, String(security.sessionTimeoutMs)));
    }
    if (security.maxLoginAttempts !== undefined) {
      updates.push(upsertConfig(adminUserId, SECURITY_CONFIG_KEYS.maxLoginAttempts, String(security.maxLoginAttempts)));
    }
    if (security.rateLimitAuthWindowMs !== undefined) {
      updates.push(
        upsertConfig(adminUserId, SECURITY_CONFIG_KEYS.rateLimitAuthWindowMs, String(security.rateLimitAuthWindowMs)),
      );
    }
    if (security.rateLimitAuthMax !== undefined) {
      updates.push(upsertConfig(adminUserId, SECURITY_CONFIG_KEYS.rateLimitAuthMax, String(security.rateLimitAuthMax)));
    }
    if (security.rateLimitRecoveryWindowMs !== undefined) {
      updates.push(
        upsertConfig(
          adminUserId,
          SECURITY_CONFIG_KEYS.rateLimitRecoveryWindowMs,
          String(security.rateLimitRecoveryWindowMs),
        ),
      );
    }
    if (security.rateLimitRecoveryMax !== undefined) {
      updates.push(
        upsertConfig(adminUserId, SECURITY_CONFIG_KEYS.rateLimitRecoveryMax, String(security.rateLimitRecoveryMax)),
      );
    }
  }

  if (parsed.data.kdf) {
    const kdf = parsed.data.kdf;
    if (kdf.algorithm !== undefined) {
      updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.algorithm, kdf.algorithm));
    }
    if (kdf.timeCost !== undefined) {
      updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.timeCost, String(kdf.timeCost)));
    }
    if (kdf.memoryCostKiB !== undefined) {
      updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.memoryCostKiB, String(kdf.memoryCostKiB)));
    }
    if (kdf.parallelism !== undefined) {
      updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.parallelism, String(kdf.parallelism)));
    }
    if (kdf.hashLenBytes !== undefined) {
      updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.hashLenBytes, String(kdf.hashLenBytes)));
    }
  }

  if (parsed.data.webauthnAttestation) {
    const policy = parsed.data.webauthnAttestation;
    if (policy.attestationMode !== undefined) {
      updates.push(upsertConfig(adminUserId, WEBAUTHN_POLICY_KEYS.attestationMode, policy.attestationMode));
    }
    if (policy.allowedAttestationFormats !== undefined) {
      updates.push(
        upsertConfig(
          adminUserId,
          WEBAUTHN_POLICY_KEYS.allowedAttestationFormats,
          JSON.stringify(policy.allowedAttestationFormats),
        ),
      );
    }
    if (policy.allowedAAGUIDs !== undefined) {
      updates.push(
        upsertConfig(adminUserId, WEBAUTHN_POLICY_KEYS.allowedAAGUIDs, JSON.stringify(policy.allowedAAGUIDs)),
      );
    }
    if (policy.trustedAttestationRoots !== undefined) {
      updates.push(
        upsertConfig(
          adminUserId,
          WEBAUTHN_POLICY_KEYS.trustedAttestationRoots,
          JSON.stringify(policy.trustedAttestationRoots),
        ),
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  return adminGetSystemConfig(req, res);
}

/**
 * GET /admin/system/health
 */
export async function adminHealthMetrics(_req: Request, res: Response) {
  const metrics = getMetricsSnapshot();

  let dbOk = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  let counts = {
    users: 0,
    auditLogs: 0,
  };

  if (dbOk) {
    const [users, auditLogs] = await prisma.$transaction([
      prisma.user.count(),
      prisma.auditLog.count(),
    ]);
    counts = { users, auditLogs };
  }

  const status = dbOk ? 200 : 503;

  return res.status(status).json({
    status: dbOk ? "ok" : "degraded",
    database: dbOk ? "ok" : "error",
    metrics,
    counts,
  });
}
