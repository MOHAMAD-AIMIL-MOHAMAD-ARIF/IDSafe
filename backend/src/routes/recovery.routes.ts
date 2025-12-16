// src/routes/recovery.routes.ts
import { Router } from "express";
import { recoveryLimiter } from "../middleware/rateLimiters.js";
import { verifyRecoveryMagicLink } from "../controllers/recovery.controller.js";

export const recoveryRouter = Router();

// GET /recovery/verify?token=...
recoveryRouter.get("/verify", recoveryLimiter, verifyRecoveryMagicLink);
