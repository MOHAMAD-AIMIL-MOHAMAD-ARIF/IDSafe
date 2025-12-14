// src/routes/auth.webauthn.routes.ts
import { Router } from "express";
import { recoveryLimiter, webauthnLimiter } from "../middleware/rateLimiters.js";
import { requireAuth, requireRecoverySession } from "../middleware/auth.js";

export const authWebauthnRouter = Router();

/**
 * End-user WebAuthn
 * POST /auth/webauthn/register/start
 * POST /auth/webauthn/register/finish
 * POST /auth/webauthn/login/start
 * POST /auth/webauthn/login/finish
 */

// POST /auth/webauthn/register/start
authWebauthnRouter.post("/register/start", webauthnLimiter, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: register/start" });
});

// POST /auth/webauthn/register/finish
authWebauthnRouter.post("/register/finish", webauthnLimiter, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: register/finish" });
});

// POST /auth/webauthn/login/start
authWebauthnRouter.post("/login/start", webauthnLimiter, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: login/start" });
});

// POST /auth/webauthn/login/finish
authWebauthnRouter.post("/login/finish", webauthnLimiter, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: login/finish" });
});

/**
 * After recovery
 * POST /auth/webauthn/recovery/register/start
 * POST /auth/webauthn/recovery/register/finish
 *
 * These are the *re-registration* endpoints that occur after a recovery flow.
 * They are rate-limited using the recovery limiter.
 */

// POST /auth/webauthn/recovery/register/start
authWebauthnRouter.post(
  "/recovery/register/start",
  recoveryLimiter,
  requireRecoverySession({ ttlMs: 15 * 60 * 1000 /*, tokenType: "MAGIC_LINK"*/ }),
  async (_req, res) => {
    return res.status(501).json({ error: "Not implemented: recovery/register/start" });
  },
);

// POST /auth/webauthn/recovery/register/finish
authWebauthnRouter.post(
  "/recovery/register/finish",
  recoveryLimiter,
  requireRecoverySession({ ttlMs: 15 * 60 * 1000 /*, tokenType: "MAGIC_LINK"*/ }),
  async (_req, res) => {
    return res.status(501).json({ error: "Not implemented: recovery/register/finish" });
  },
);

/**
 * WebAuthn credential management
 * GET    /auth/webauthn/credentials
 * DELETE /auth/webauthn/credentials/:credentialId
 *
 * (No rate limiter by default; you can add one later if you want.)
 */

// GET /auth/webauthn/credentials
authWebauthnRouter.get("/credentials", requireAuth, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: list credentials" });
});

// DELETE /auth/webauthn/credentials/:credentialId
authWebauthnRouter.delete("/credentials/:credentialId", requireAuth, async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: delete credential" });
});
