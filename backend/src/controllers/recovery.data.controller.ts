// backend/src/controllers/recovery.data.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { upsertRecoveryData } from "../services/kdfService.server.js";

const bodySchema = z.object({
  wrappedVaultKey: z.string().min(10), // JSON envelope string
  salt: z.string().min(8), // base64/base64url salt
  timeCost: z.number().int().min(1).max(10),
  memoryCostKiB: z.number().int().min(8 * 1024).max(512 * 1024),
  parallelism: z.number().int().min(1).max(8),
});

/**
 * POST /recovery/data (requires normal login)
 * 
 * Stores/updates the recovery data for the logged-in user.
 */

export async function postRecoveryData(req: Request, res: Response) {
  // Must be logged in normally (not recovery session)
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  // Optional: block locked/deactivated users from changing recovery data
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { status: true, role: true },
  });

  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (user.status !== "ACTIVE") return res.status(403).json({ error: "Account not active" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { wrappedVaultKey, salt, timeCost, memoryCostKiB, parallelism } = parsed.data;

  // Store the RecoveryData row (server stores metadata + wrapped key only)
  const result = await upsertRecoveryData(prisma, {
    userId,
    wrappedVaultKey,
    kdf: {
      algorithm: "argon2id",
      saltB64: salt,
      timeCost,
      memoryCostKiB,
      parallelism,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, recoveryId: result.recoveryId, updatedAt: result.updatedAt });
}
