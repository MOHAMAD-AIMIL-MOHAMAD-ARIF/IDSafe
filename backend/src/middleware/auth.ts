// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";

// If your Prisma uses enums, keep this as string union.
// Otherwise, string is fine too.
export type UserRole = "ADMIN" | "END_USER";

export type RecoverySessionState = {
  userId: number;
  tokenId: number;
  verifiedAt: string; // ISO string (serializable in session store)
};

// ---- Type augmentation for express-session ----
declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: UserRole;
    // Recovery-only session state (tightly scoped)
    recovery?: RecoverySessionState;
  }
}

// Optional helper for typed access
function getSession(req: Request) {
  // express-session adds req.session
  return req.session;
}

/**
 * Require the user to be logged in (session cookie present + server-side session has userId).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);

  if (!session || typeof session.userId !== "number") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

/**
 * Require the user to be an ADMIN.
 * Assumes you set req.session.role = "ADMIN" on successful admin login.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);

  if (!session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

type RequireRecoveryOptions = {
  ttlMs?: number; // default 15 minutes
  tokenType?: string; // optional strict check (e.g. "MAGIC_LINK")
};

/**
 * Require a valid recovery session.
 *
 * Checks:
 * - session.recovery.userId exists
 * - verifiedAt is within TTL
 * - RECOVERY_TOKEN in DB matches tokenId + userId
 * - token has been consumed (usedAt != null)
 * - token not expired (expiresAt > now)
 *
 * This ensures only a user who just proved email control via a magic link can call
 * /auth/webauthn/recovery/register/* endpoints.
 */
export function requireRecoverySession(options: RequireRecoveryOptions = {}) {
  const ttlMs = options.ttlMs ?? 15 * 60 * 1000;

  return async (req: Request, res: Response, next: NextFunction) => {
    const recovery = req.session?.recovery;
    if (!recovery?.userId || !recovery?.tokenId || !recovery?.verifiedAt) {
      return res.status(401).json({ error: "Recovery session required" });
    }

    const verifiedAt = new Date(recovery.verifiedAt);
    if (Number.isNaN(verifiedAt.getTime())) {
      // Corrupt state -> clear it
      delete req.session.recovery;
      return res.status(401).json({ error: "Invalid recovery session" });
    }

    const now = Date.now();
    if (now - verifiedAt.getTime() > ttlMs) {
      delete req.session.recovery;
      return res.status(401).json({ error: "Recovery session expired" });
    }

    // DB verification: ensure token is the same one, consumed, and still within expiry window
    const token = await prisma.recoveryToken.findUnique({
      where: { tokenId: recovery.tokenId },
      select: {
        tokenId: true,
        userId: true,
        tokenType: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!token) {
      delete req.session.recovery;
      return res.status(401).json({ error: "Invalid recovery token" });
    }

    if (token.userId !== recovery.userId) {
      delete req.session.recovery;
      return res.status(401).json({ error: "Recovery token mismatch" });
    }

    // Must have been consumed during magic-link verification
    if (!token.usedAt) {
      delete req.session.recovery;
      return res.status(401).json({ error: "Recovery token not consumed" });
    }

    // Must still be within expiry time
    if (token.expiresAt.getTime() <= now) {
      delete req.session.recovery;
      return res.status(401).json({ error: "Recovery token expired" });
    }

    // Optional strict check for tokenType (use if your model defines it)
    if (options.tokenType && token.tokenType !== options.tokenType) {
      delete req.session.recovery;
      return res.status(401).json({ error: "Wrong recovery token type" });
    }

    return next();
  };
}
