// src/controllers/recovery.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { auditFromReq } from "../services/auditLogService.js";
import { requireRecoverySession } from "../middleware/auth.js";

const RECOVERY_SESSION_TTL_MS = Number(process.env.RECOVERY_SESSION_TTL_MS ?? 15 * 60 * 1000);

// Optional: lock tokenType to a specific string you use for magic links
const EXPECTED_TOKEN_TYPE = process.env.RECOVERY_TOKEN_TYPE ?? "RECOVERY";

// Where to send the user after verification
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const FRONTEND_RECOVERY_PATH = process.env.FRONTEND_RECOVERY_PATH ?? "/recovery";

function hashToken(rawToken: string): string {
  // Important: do NOT log rawToken
  // Pepper is optional but recommended
  const pepper = process.env.RECOVERY_TOKEN_PEPPER ?? "";
  return crypto.createHash("sha256").update(rawToken + pepper, "utf8").digest("hex");
}

export function zodIssuesToPrismaJson(issues: z.core.$ZodIssue[]): Prisma.InputJsonValue {
  // Return an array of plain objects (JSON-safe)
  return issues.map((i) => ({
    code: i.code,
    message: i.message,
    // PropertyKey[] -> string[]
    path: i.path.map((p) => String(p)),
  }));
}

/**
 * GET /recovery/verify?token=...
 *
 * Verifies and consumes a recovery magic link token, then mints a tightly-scoped
 * recovery session:
 *   req.session.recovery = { userId, tokenId, verifiedAt }
 *
 * Responds with a redirect to the frontend recovery UI,
 * or JSON if the request indicates API usage.
 */
export async function verifyRecoveryMagicLink(req: Request, res: Response) {
  const rawToken = typeof req.query.token === "string" ? req.query.token : "";
  if (!rawToken) return res.status(400).json({ error: "Missing token" });

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  // 1) Atomically "consume" the token (single-use + expiry check)
  const consumeResult = await prisma.recoveryToken.updateMany({
    where: {
      tokenHash,
      tokenType: EXPECTED_TOKEN_TYPE,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  if (consumeResult.count !== 1) {
    // invalid / expired / already used / wrong type
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // 2) Fetch the token row we just consumed to get userId + tokenId
  const tokenRow = await prisma.recoveryToken.findUnique({
    where: { tokenHash },
    select: { tokenId: true, userId: true, usedAt: true, expiresAt: true, tokenType: true },
  });

  if (!tokenRow || !tokenRow.usedAt) {
    return res.status(401).json({ error: "Invalid token state" });
  }

  // 3) Rotate session ID (anti-fixation) and mint recovery-only session state
  return req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Failed to initialize recovery session" });

    // Important: do NOT grant normal login yet
    delete req.session.userId;
    delete req.session.role;

    req.session.recovery = {
      userId: tokenRow.userId,
      tokenId: tokenRow.tokenId,
      verifiedAt: now.toISOString(),
    };

    // Short TTL just for recovery
    req.session.cookie.maxAge = RECOVERY_SESSION_TTL_MS;

    // Avoid caching this response
    res.setHeader("Cache-Control", "no-store");

    // If you prefer redirect UX (most common for magic links):
    const redirectUrl = `${FRONTEND_ORIGIN}${FRONTEND_RECOVERY_PATH}`;
    return res.redirect(302, redirectUrl);

    // If you prefer JSON instead, replace the redirect with:
    // return res.json({ ok: true });
  });
}

/**
 * GET /recovery/params
 * Requires: requireRecoverySession
 * Returns: { wrappedVaultKey, salt, timeCost, memoryCostKiB, parallelism }
 */
export const getRecoveryParams = [
  requireRecoverySession,
  async (req: Request, res: Response) => {
    const recovery = req.session.recovery!;
    const userId = recovery.userId;

    const rd = await prisma.recoveryData.findUnique({
      where: { userId },
      select: {
        wrappedVaultKey: true,
        kdfSalt: true,
        kdfAlgorithm: true,
        kdfTimeCost: true,
        kdfMemoryCost: true,
        kdfParallelism: true,
        updatedAt: true,
      },
    });

    if (!rd) {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "RECOVERY.PARAMS.FAIL",
        detailsJson: { reason: "RECOVERY_DATA_NOT_FOUND" },
      });
      return res.status(404).json({ error: "Recovery data not found" });
    }

    // If you only support argon2id for now, you can enforce it:
    if (rd.kdfAlgorithm !== "argon2id") {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "RECOVERY.PARAMS.FAIL",
        detailsJson: { reason: "UNSUPPORTED_KDF", kdfAlgorithm: rd.kdfAlgorithm },
      });
      return res.status(400).json({ error: "Unsupported KDF algorithm" });
    }

    await auditFromReq(prisma, req, {
      userId,
      actorId: userId,
      eventType: "RECOVERY.PARAMS.OK",
      detailsJson: {
        kdfAlgorithm: rd.kdfAlgorithm,
        timeCost: rd.kdfTimeCost,
        memoryCostKiB: rd.kdfMemoryCost,
        parallelism: rd.kdfParallelism,
      },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.json({
      ok: true,
      wrappedVaultKey: rd.wrappedVaultKey,
      salt: rd.kdfSalt,
      timeCost: rd.kdfTimeCost,
      memoryCostKiB: rd.kdfMemoryCost,
      parallelism: rd.kdfParallelism,
    });
  },
];

const postRecoveryDataSchema = z.object({
  // client assertion: "I successfully derived KEK and decrypted the wrappedVaultKey"
  // server cannot verify without learning secrets, so we only record + audit.
  kdfVerified: z.boolean(),
  kdfMs: z.number().int().nonnegative().optional(),

  // New device binding artifact (no plaintext DEK)
  devicePublicKey: z.string().min(1),
  deviceLabel: z.string().min(1).max(64).optional(),
  wrappedDEK: z.string().min(1),
});

/**
 * POST /recovery/bind
 * Requires: requireRecoverySession
 *
 * Client submits:
 * - kdfVerified (+ optional kdfMs)
 * - devicePublicKey / deviceLabel / wrappedDEK (for DeviceKey table)
 *
 * Server does:
 * - create DeviceKey row
 * - update RecoveryData.updatedAt (touch)
 * - mark req.session.recovery.completedAt
 */
export const postRecoveryData = [
  requireRecoverySession,
  async (req: Request, res: Response) => {
    const recovery = req.session.recovery!;
    const userId = recovery.userId;

    const parsed = postRecoveryDataSchema.safeParse(req.body);
    if (!parsed.success) {
      const detailsJson: Prisma.InputJsonValue = {
        reason: "INVALID_PAYLOAD",
        issues: zodIssuesToPrismaJson(parsed.error.issues),
      };
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "RECOVERY.DATA.FAIL",
        detailsJson,
      });
      return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "RECOVERY.DATA.FAIL",
        detailsJson: { reason: !user ? "USER_NOT_FOUND" : "USER_NOT_ACTIVE" },
      });
      return res.status(403).json({ error: "Account is not active" });
    }

    const now = new Date();
    const { kdfVerified, kdfMs, devicePublicKey, deviceLabel, wrappedDEK } = parsed.data;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // ensure RecoveryData exists (if not, fail)
        const rd = await tx.recoveryData.findUnique({
          where: { userId },
          select: { recoveryId: true },
        });
        if (!rd) throw new Error("RECOVERY_DATA_NOT_FOUND");

        // bind new device (stores wrappedDEK only; no plaintext DEK)
        const device = await tx.deviceKey.create({
          data: {
            userId,
            devicePublicKey,
            deviceLabel: deviceLabel ?? null,
            wrappedDEK,
          },
          select: { deviceId: true },
        });

        // touch recovery data timestamp (optional, but nice for auditability)
        await tx.recoveryData.update({
          where: { userId },
          data: { updatedAt: now },
        });

        // security design choice: force recovery-authenticator registration
        // by deactivating any existing active credentials
        /*const disabled = await tx.webauthnCredential.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });*/
        const disabled = { count: 0 }; // Skipping disabling for now

        return { deviceId: device.deviceId, disabledCreds: disabled.count };
      });

      // mark recovery step completed for subsequent recovery WebAuthn registration
      req.session.recovery = {
        ...recovery,
        completedAt: now.toISOString(),
        deviceId: result.deviceId,
      };

      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "RECOVERY.DATA.OK",
        detailsJson: {
          kdfVerified,
          kdfMs: kdfMs ?? null,
          deviceId: result.deviceId,
          deviceLabel: deviceLabel ?? null,
          disabledCreds: result.disabledCreds,
          note: "No passphrase/KEK/DEK/plaintext stored",
        },
      });

      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, deviceId: result.deviceId });
    } catch (e) {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "RECOVERY.DATA.FAIL",
        detailsJson: { reason: "TX_FAILED" },
      });
      return res.status(500).json({ error: "Failed to complete recovery" });
    }
  },
];
