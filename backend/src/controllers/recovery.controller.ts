// src/controllers/recovery.controller.ts
import type { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../db.js";

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

/**
 * GET /recovery/verify?token=...
 *
 * Verifies and consumes a recovery magic link token, then mints a tightly-scoped
 * recovery session:
 *   req.session.recovery = { userId, tokenId, verifiedAt }
 *
 * Responds with a redirect to the frontend recovery UI (recommended),
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
