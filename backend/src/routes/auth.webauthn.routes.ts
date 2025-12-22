// src/routes/auth.webauthn.routes.ts
import { Router } from "express";
import { recoveryLimiter, webauthnLimiter } from "../middleware/rateLimiters.js";
import { requireAuth } from "../middleware/auth.js";

import {
  registerStart,
  registerFinish,
  loginStart,
  loginFinish,
  listCredentials,
  deleteCredential,
} from "../controllers/auth.webauthn.controller.js";

import {
  recoveryRegisterStart,
  recoveryRegisterFinish,
} from "../controllers/auth.webauthn.recovery.controller.js";

export const authWebauthnRouter = Router();

/**
 * End-user WebAuthn
 * POST /auth/webauthn/register/start
 * POST /auth/webauthn/register/finish
 * POST /auth/webauthn/login/start
 * POST /auth/webauthn/login/finish
 */

// End-user WebAuthn
authWebauthnRouter.post("/register/start", webauthnLimiter, registerStart);
authWebauthnRouter.post("/register/finish", webauthnLimiter, registerFinish);
authWebauthnRouter.post("/login/start", webauthnLimiter, loginStart);
authWebauthnRouter.post("/login/finish", webauthnLimiter, loginFinish);

/**
 * After recovery
 * POST /auth/webauthn/recovery/register/start
 * POST /auth/webauthn/recovery/register/finish
 *
 * These are the *re-registration* endpoints that occur after a recovery flow.
 * They are rate-limited using the recovery limiter.
 */

// After recovery WebAuthn (tightly scoped)
authWebauthnRouter.post(
  "/recovery/register/start",
  recoveryLimiter,
  //requireRecoverySession is implemented in controller file
  recoveryRegisterStart,
);

authWebauthnRouter.post(
  "/recovery/register/finish",
  recoveryLimiter,
  //requireRecoverySession is implemented in controller file
  recoveryRegisterFinish,
);

/**
 * WebAuthn credential management
 * GET    /auth/webauthn/credentials
 * DELETE /auth/webauthn/credentials/:credentialId
 *
 * (No rate limiter by default; you can add one later if you want.)
 */

// Credential management (requires full auth)
authWebauthnRouter.get("/credentials", requireAuth, listCredentials);
authWebauthnRouter.delete("/credentials/:credentialId", requireAuth, deleteCredential);
