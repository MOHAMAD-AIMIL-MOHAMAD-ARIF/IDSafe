// backend/src/controllers/recovery.params.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

/**
 * GET /recovery/params
 *
 * Requires: requireRecoverySession (so req.session.recovery exists + token validated)
 *
 * Returns the KDF metadata + wrapped vault key needed by the client to derive KEK and unwrap vault key.
 * NEVER returns passphrase/KEK/DEK (client-only).
 */
export async function getRecoveryParams(req: Request, res: Response) {
  const recovery = req.session.recovery!;
  const userId = recovery.userId;

  const rd = await prisma.recoveryData.findUnique({
    where: { userId },
    select: {
      wrappedVaultKey: true,
      kdfSalt: true,
      kdfTimeCost: true,
      kdfMemoryCost: true, // stored as KiB in your design
      kdfParallelism: true,
      kdfAlgorithm: true,
    },
  });

  // Prevent caching of sensitive metadata
  res.setHeader("Cache-Control", "no-store");

  if (!rd) {
    return res.status(404).json({ error: "Recovery data not found" });
  }

  if (rd.kdfAlgorithm !== "argon2id") {
    return res.status(500).json({ error: "Unsupported KDF algorithm" });
  }

  return res.json({
    wrappedVaultKey: rd.wrappedVaultKey,
    salt: rd.kdfSalt,
    timeCost: rd.kdfTimeCost,
    memoryCostKiB: rd.kdfMemoryCost,
    parallelism: rd.kdfParallelism,
  });
}
