// src/routes/admin.auth.webauthn.routes.ts
import { Router } from "express";
import { webauthnLimiter } from "../middleware/rateLimiters.js";
import {
  adminRegisterStart,
  adminRegisterFinish,
  adminLoginStart,
  adminLoginFinish,
} from "../controllers/admin.auth.webauthn.controller.js";

export const adminAuthWebauthnRouter = Router();

/**
 * Admin WebAuthn authentication
 * POST /admin/auth/webauthn/register/start
 * POST /admin/auth/webauthn/register/finish
 * POST /admin/auth/webauthn/login/start
 * POST /admin/auth/webauthn/login/finish
 */
adminAuthWebauthnRouter.post("/register/start", webauthnLimiter, adminRegisterStart);
adminAuthWebauthnRouter.post("/register/finish", webauthnLimiter, adminRegisterFinish);
adminAuthWebauthnRouter.post("/login/start", webauthnLimiter, adminLoginStart);
adminAuthWebauthnRouter.post("/login/finish", webauthnLimiter, adminLoginFinish);
