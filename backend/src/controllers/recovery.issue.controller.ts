// src/controllers/recovery.issue.controller.ts
import type { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { sendRecoveryEmail } from "../services/email.js";

const requestSchema = z.object({
  email: z.email(),
});

const TOKEN_TYPE = "RECOVERY" as const;

const PEPPER = process.env.RECOVERY_TOKEN_PEPPER ?? "";
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";
const RECOVERY_TOKEN_TTL_MS = Number(process.env.RECOVERY_TOKEN_TTL_MS ?? 15 * 60 * 1000);

// base64url token, safe for URLs
function generateRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken + PEPPER, "utf8").digest("hex");
}

/**
 * POST /recovery/request
 *
 * - Accepts email
 * - If user exists, create RecoveryToken row (tokenHash, tokenType="RECOVERY", expiresAt, usedAt=null)
 * - Emails magic link to backend verify endpoint:
 *      GET /recovery/verify?token=RAW
 *
 * Security: returns ok even if email not found (prevents user enumeration).
 */
export async function requestRecoveryMagicLink(req: Request, res: Response) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, status: true, role: true },
  });

  // User enumeration protection: always respond ok
  if (!user) {
    return res.json({ ok: true });
  }

  // Block recovery for locked/deactivated accounts (still return ok)
  if (user.status !== "ACTIVE") {
    return res.json({ ok: true });
  }

  //If admins should not recover via public email link, add:
  if (user.role !== "END_USER") {
    return res.json({ ok: true });
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RECOVERY_TOKEN_TTL_MS);

  // (Optional but recommended) Invalidate any previously-issued unused recovery tokens
  await prisma.recoveryToken.updateMany({
    where: {
      userId: user.userId,
      tokenType: TOKEN_TYPE,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  // Create new token row
  const created = await prisma.recoveryToken.create({
    data: {
      userId: user.userId,
      tokenHash,
      tokenType: TOKEN_TYPE,
      expiresAt,
      usedAt: null,
    },
    select: { tokenId: true },
  });

  const verifyUrl = `${BACKEND_ORIGIN}/recovery/verify?token=${encodeURIComponent(rawToken)}`;
  // PM2 logs (temporary for demo) purposes
  console.log(`[DEV_RECOVERY] email=${email} verifyUrl=${verifyUrl}`);

  try {
    await sendRecoveryEmail(email, verifyUrl);
  } catch (e) {
    // If email send fails, invalidate the token so it can't hang around
    await prisma.recoveryToken.update({
      where: { tokenId: created.tokenId },
      data: { usedAt: new Date() },
    });

    // Still avoid enumeration. Log server-side if you want.
    return res.json({ ok: true });
  }

  return res.json({ ok: true });
}
