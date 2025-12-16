// src/controllers/auth.webauthn.recovery.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

/**
 * POST /auth/webauthn/recovery/register/start
 * Requires: requireRecoverySession (so req.session.recovery exists + token validated)
 */
export async function recoveryRegisterStart(req: Request, res: Response) {
  const recovery = req.session.recovery!;
  const userId = recovery.userId;

  // TODO:
  // - load user's existing credentials if needed (for exclusion / policy decisions)
  // - generateRegistrationOptions(...) for the replacement authenticator
  // - store challenge in session/temp store (scoped to recovery)
  return res.status(501).json({
    error: "Not implemented: /auth/webauthn/recovery/register/start",
    recovery: { userId, tokenId: recovery.tokenId, verifiedAt: recovery.verifiedAt },
  });
}

/**
 * POST /auth/webauthn/recovery/register/finish
 * Requires: requireRecoverySession
 *
 * On success:
 * - verifyRegistrationResponse(...)
 * - store credential
 * - promote recovery session → normal session, and
 * - rotate session id to prevent fixation (req.session.regenerate)
 */
export async function recoveryRegisterFinish(req: Request, res: Response) {
  const recovery = req.session.recovery!;
  const recoveredUserId = recovery.userId;

  // TODO:
  // - verifyRegistrationResponse(...)
  // - persist credential for recoveredUserId
  // - audit log: recovery authenticator registered

  // Promote to normal session (anti-fixation)
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Failed to rotate session" });

    req.session.userId = recoveredUserId;
    req.session.role = "END_USER";

    // Ensure recovery state is removed
    delete req.session.recovery;

    return res.json({ ok: true, userId: recoveredUserId });
  });
}
