// backend/src/services/kdfService.server.ts
import crypto from "crypto";
import type { PrismaClient } from "../generated/prisma/client.js";

export type KdfAlgorithm = "argon2id";

export type Argon2idParams = {
  algorithm: KdfAlgorithm;     // "argon2id"
  saltB64: string;             // base64 (or base64url) encoded salt
  timeCost: number;            // iterations
  memoryCostKiB: number;       // KiB
  parallelism: number;         // lanes/threads
  hashLenBytes: number;        // 32 for 256-bit
};

export const KDF_CONFIG_KEYS = {
  algorithm: "kdf.algorithm.default",
  timeCost: "kdf.argon2id.timeCost.default",
  memoryCostKiB: "kdf.argon2id.memoryCostKiB.default",
  parallelism: "kdf.argon2id.parallelism.default",
  hashLenBytes: "kdf.argon2id.hashLenBytes.default",
} as const;

export const KDF_SALT_SIZE_CONFIG_KEY = "kdf.argon2id.saltSizeBytes.default";

function toInt(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getConfigValue(prisma: PrismaClient, key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({
    where: { configKey: key },
    select: { configValue: true },
  });
  return row?.configValue ?? null;
}

function assertParamsSafe(p: Argon2idParams) {
  // basic guardrails; tune as you like
  if (p.algorithm !== "argon2id") throw new Error("Unsupported KDF algorithm");
  if (p.hashLenBytes !== 32) throw new Error("KEK must be 256-bit (32 bytes)");
  if (p.timeCost < 1 || p.timeCost > 10) throw new Error("timeCost out of range");
  if (p.memoryCostKiB < 8 * 1024 || p.memoryCostKiB > 512 * 1024) {
    throw new Error("memoryCostKiB out of range");
  }
  if (p.parallelism < 1 || p.parallelism > 8) throw new Error("parallelism out of range");
  if (!p.saltB64 || p.saltB64.length < 8) throw new Error("salt missing/too short");
}

/**
 * Reads *system default* Argon2id params from SystemConfig.
 * (Used for initial setup and as fallback.)
 */
export async function getDefaultKdfParams(prisma: PrismaClient): Promise<Omit<Argon2idParams, "saltB64">> {
  const algorithmRaw = (await getConfigValue(prisma, KDF_CONFIG_KEYS.algorithm)) ?? "argon2id";

  const timeCost = toInt(await getConfigValue(prisma, KDF_CONFIG_KEYS.timeCost), 3);
  const memoryCostKiB = toInt(await getConfigValue(prisma, KDF_CONFIG_KEYS.memoryCostKiB), 65536); // 64 MiB
  const parallelism = toInt(await getConfigValue(prisma, KDF_CONFIG_KEYS.parallelism), 1);
  const hashLenBytes = toInt(await getConfigValue(prisma, KDF_CONFIG_KEYS.hashLenBytes), 32);

  // Only argon2id in your design
  const algorithm: KdfAlgorithm = algorithmRaw === "argon2id" ? "argon2id" : "argon2id";

  return { algorithm, timeCost, memoryCostKiB, parallelism, hashLenBytes };
}

export async function getDefaultKdfSaltSize(prisma: PrismaClient): Promise<number> {
  return toInt(await getConfigValue(prisma, KDF_SALT_SIZE_CONFIG_KEY), 16);
}

/**
 * Returns the *effective* KDF params for a user:
 * - defaults from SystemConfig
 * - overridden by per-user RecoveryData (kdf* fields + salt)
 *
 * This is the metadata the client uses to derive KEK locally (no passphrase sent).
 */
export async function getEffectiveUserKdfParams(
  prisma: PrismaClient,
  userId: number,
): Promise<Argon2idParams> {
  const defaults = await getDefaultKdfParams(prisma);
  const saltSize = await getDefaultKdfSaltSize(prisma);

  const rd = await prisma.recoveryData.findUnique({
    where: { userId },
    select: {
      kdfAlgorithm: true,
      kdfSalt: true,
      kdfTimeCost: true,
      kdfMemoryCost: true,
      kdfParallelism: true,
    },
  });

  // If user doesn't have RecoveryData yet, generate a new salt + defaults.
  if (!rd) {
    const saltB64 = generateSaltB64(saltSize);
    const params: Argon2idParams = { ...defaults, saltB64 };
    assertParamsSafe(params);
    return params;
  }

  const algorithm: KdfAlgorithm = rd.kdfAlgorithm === "argon2id" ? "argon2id" : "argon2id";

  const params: Argon2idParams = {
    algorithm,
    saltB64: rd.kdfSalt,
    timeCost: rd.kdfTimeCost,
    memoryCostKiB: rd.kdfMemoryCost,     // interpret as KiB
    parallelism: rd.kdfParallelism,
    hashLenBytes: defaults.hashLenBytes, // keep 32 unless you store per-user
  };

  assertParamsSafe(params);
  return params;
}

/**
 * Generates a random salt to store in RecoveryData.kdfSalt.
 * 16 bytes is typical; you can increase to 32.
 */
export function generateSaltB64(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("base64");
}

/**
 * Upsert RecoveryData when client completes setup or changes passphrase.
 *
 * Server stores only:
 * - wrappedVaultKey (AES-GCM wrapped using KEK)
 * - salt + Argon2id params (for future derivation)
 *
 * Passphrase/KEK/plaintext vault key never stored server-side. :contentReference[oaicite:10]{index=10}
 */
export async function upsertRecoveryData(
  prisma: PrismaClient,
  args: {
    userId: number;
    wrappedVaultKey: string;
    kdf: Omit<Argon2idParams, "hashLenBytes"> & { hashLenBytes?: number }; // allow optional
  },
) {
  const { userId, wrappedVaultKey, kdf } = args;

  const kdfToStore = {
    kdfAlgorithm: "argon2id",
    kdfSalt: kdf.saltB64,
    kdfTimeCost: kdf.timeCost,
    kdfMemoryCost: kdf.memoryCostKiB,
    kdfParallelism: kdf.parallelism,
  };

  // Basic sanity check (hashLenBytes defaults to 32)
  assertParamsSafe({
    algorithm: "argon2id",
    saltB64: kdfToStore.kdfSalt,
    timeCost: kdfToStore.kdfTimeCost,
    memoryCostKiB: kdfToStore.kdfMemoryCost,
    parallelism: kdfToStore.kdfParallelism,
    hashLenBytes: kdf.hashLenBytes ?? 32,
  });

  return prisma.recoveryData.upsert({
    where: { userId },
    create: {
      userId,
      wrappedVaultKey,
      ...kdfToStore,
    },
    update: {
      wrappedVaultKey,
      ...kdfToStore,
      updatedAt: new Date(),
    },
    select: {
      recoveryId: true,
      userId: true,
      updatedAt: true,
    },
  });
}
