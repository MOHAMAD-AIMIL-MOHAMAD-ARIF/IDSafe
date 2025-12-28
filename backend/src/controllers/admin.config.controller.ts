// src/controllers/admin.config.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  getDefaultKdfParams,
  getDefaultKdfSaltSize,
  KDF_CONFIG_KEYS,
  KDF_SALT_SIZE_CONFIG_KEY,
} from "../services/kdfService.server.js";

function toInt(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const kdfPolicySchema = z.object({
  timeCost: z.number().int().min(1).max(10).optional(),
  memoryCostKiB: z.number().int().min(8 * 1024).max(512 * 1024).optional(),
  parallelism: z.number().int().min(1).max(8).optional(),
  saltSize: z.number().int().min(8).max(64).optional(),
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
 * GET /admin/config/kdf
 */
export async function adminGetKdfPolicy(_req: Request, res: Response) {
  const keys = [
    KDF_CONFIG_KEYS.timeCost,
    KDF_CONFIG_KEYS.memoryCostKiB,
    KDF_CONFIG_KEYS.parallelism,
    KDF_SALT_SIZE_CONFIG_KEY,
  ];

  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: keys } },
    select: { configKey: true, configValue: true },
  });

  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
  const defaults = await getDefaultKdfParams(prisma);
  const saltSizeDefault = await getDefaultKdfSaltSize(prisma);

  return res.json({
    timeCost: toInt(map.get(KDF_CONFIG_KEYS.timeCost), defaults.timeCost),
    memoryCostKiB: toInt(map.get(KDF_CONFIG_KEYS.memoryCostKiB), defaults.memoryCostKiB),
    parallelism: toInt(map.get(KDF_CONFIG_KEYS.parallelism), defaults.parallelism),
    saltSize: toInt(map.get(KDF_SALT_SIZE_CONFIG_KEY), saltSizeDefault),
  });
}

/**
 * PUT /admin/config/kdf
 */
export async function adminUpdateKdfPolicy(req: Request, res: Response) {
  const adminUserId = req.session.userId!;
  const parsed = kdfPolicySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const updates: Array<Promise<unknown>> = [];

  if (parsed.data.timeCost !== undefined) {
    updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.timeCost, String(parsed.data.timeCost)));
  }
  if (parsed.data.memoryCostKiB !== undefined) {
    updates.push(
      upsertConfig(adminUserId, KDF_CONFIG_KEYS.memoryCostKiB, String(parsed.data.memoryCostKiB)),
    );
  }
  if (parsed.data.parallelism !== undefined) {
    updates.push(upsertConfig(adminUserId, KDF_CONFIG_KEYS.parallelism, String(parsed.data.parallelism)));
  }
  if (parsed.data.saltSize !== undefined) {
    updates.push(upsertConfig(adminUserId, KDF_SALT_SIZE_CONFIG_KEY, String(parsed.data.saltSize)));
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  return adminGetKdfPolicy(req, res);
}
