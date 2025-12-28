import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

export type WebAuthnPolicy = {
  rpId: string;
  timeoutMs: number;
  userVerification: "required" | "preferred" | "discouraged";
  attestation: "none" | "direct" | "indirect" | "enterprise";
  residentKey: "required" | "preferred" | "discouraged";
};

const POLICY_KEYS = {
  rpId: "webauthn.rpId",
  timeoutMs: "webauthn.timeoutMs",
  userVerification: "webauthn.userVerification",
  attestation: "webauthn.attestation",
  residentKey: "webauthn.residentKey",
} as const;

const DEFAULT_POLICY: WebAuthnPolicy = {
  rpId: env.WEBAUTHN_RP_ID,
  timeoutMs: 60000,
  userVerification: "preferred",
  attestation: "none",
  residentKey: "preferred",
};

function readNumber(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function readString<T extends string>(value: string | null | undefined, fallback: T): T {
  return value && value.length > 0 ? (value as T) : fallback;
}

export async function getWebAuthnPolicy(prisma: PrismaClient): Promise<WebAuthnPolicy> {
  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: Object.values(POLICY_KEYS) } },
    select: { configKey: true, configValue: true },
  });

  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));

  return {
    rpId: readString(map.get(POLICY_KEYS.rpId), DEFAULT_POLICY.rpId),
    timeoutMs: readNumber(map.get(POLICY_KEYS.timeoutMs), DEFAULT_POLICY.timeoutMs),
    userVerification: readString(map.get(POLICY_KEYS.userVerification), DEFAULT_POLICY.userVerification),
    attestation: readString(map.get(POLICY_KEYS.attestation), DEFAULT_POLICY.attestation),
    residentKey: readString(map.get(POLICY_KEYS.residentKey), DEFAULT_POLICY.residentKey),
  };
}

export async function updateWebAuthnPolicy(
  prisma: PrismaClient,
  adminUserId: number,
  policy: Partial<WebAuthnPolicy>,
): Promise<void> {
  const updates: Array<{ key: string; value: string }> = [];

  if (policy.rpId !== undefined) updates.push({ key: POLICY_KEYS.rpId, value: policy.rpId });
  if (policy.timeoutMs !== undefined)
    updates.push({ key: POLICY_KEYS.timeoutMs, value: String(policy.timeoutMs) });
  if (policy.userVerification !== undefined)
    updates.push({ key: POLICY_KEYS.userVerification, value: policy.userVerification });
  if (policy.attestation !== undefined)
    updates.push({ key: POLICY_KEYS.attestation, value: policy.attestation });
  if (policy.residentKey !== undefined)
    updates.push({ key: POLICY_KEYS.residentKey, value: policy.residentKey });

  for (const update of updates) {
    await prisma.systemConfig.upsert({
      where: { configKey: update.key },
      create: {
        configKey: update.key,
        configValue: update.value,
        updatedByUserId: adminUserId,
      },
      update: {
        configValue: update.value,
        updatedByUserId: adminUserId,
        updatedAt: new Date(),
      },
    });
  }
}
