// src/routes/recovery.routes.ts
import { Router } from "express";
import { recoveryLimiter } from "../middleware/rateLimiters.js";
import { verifyRecoveryMagicLink, getRecoveryParams, postRecoveryData as postRecoveryDeviceBind } from "../controllers/recovery.controller.js";
import { requestRecoveryMagicLink } from "../controllers/recovery.issue.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { postRecoveryData as postRecoveryMetadata } from "../controllers/recovery.data.controller.js";

export const recoveryRouter = Router();

// POST /recovery/request  (send email)
recoveryRouter.post("/request", recoveryLimiter, requestRecoveryMagicLink);

// GET /recovery/verify?token=...
recoveryRouter.get("/verify", recoveryLimiter, verifyRecoveryMagicLink);

// GET /recovery/params (requires recovery session)
recoveryRouter.get("/params", recoveryLimiter, getRecoveryParams);

// POST /recovery/data (requires normal login)
recoveryRouter.post("/data", recoveryLimiter, requireAuth, postRecoveryMetadata);

// POST /recovery/bind (requires recovery session)
recoveryRouter.post("/bind", recoveryLimiter, postRecoveryDeviceBind);
