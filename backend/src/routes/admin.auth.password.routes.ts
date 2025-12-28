// src/routes/admin.auth.password.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { webauthnLimiter } from "../middleware/rateLimiters.js";
import {
  adminPasswordLoginStart,
  adminPasswordLoginVerifyOtp,
  adminLogout,
  adminSessionStatus,
} from "../controllers/admin.auth.password.controller.js";

export const adminAuthPasswordRouter = Router();

/**
 * Admin password + OTP authentication
 * POST /admin/auth/login/start
 * POST /admin/auth/login/verify-otp
 * POST /admin/auth/logout
 */
adminAuthPasswordRouter.post("/login/start", webauthnLimiter, adminPasswordLoginStart);
adminAuthPasswordRouter.post("/login/verify-otp", webauthnLimiter, adminPasswordLoginVerifyOtp);
adminAuthPasswordRouter.post("/logout", adminLogout);
adminAuthPasswordRouter.get("/session", requireAdmin, adminSessionStatus);
