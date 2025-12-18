// src/routes/recovery.routes.ts
import { Router } from "express";
import { recoveryLimiter } from "../middleware/rateLimiters.js";
import { verifyRecoveryMagicLink } from "../controllers/recovery.controller.js";
import { requestRecoveryMagicLink } from "../controllers/recovery.issue.controller.js";
import { requireRecoverySession } from "../middleware/auth.js";
import { getRecoveryParams } from "../controllers/recovery.params.controller.js";

export const recoveryRouter = Router();

// POST /recovery/request  (send email)
recoveryRouter.post("/request", recoveryLimiter, requestRecoveryMagicLink);

// GET /recovery/verify?token=...
recoveryRouter.get("/verify", recoveryLimiter, verifyRecoveryMagicLink);

// GET /recovery/params (requires recovery session)
recoveryRouter.get(
  "/params",
  recoveryLimiter,
  requireRecoverySession({ ttlMs: 15 * 60 * 1000 }),
  getRecoveryParams,
);
