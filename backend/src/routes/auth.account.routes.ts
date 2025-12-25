// src/routes/auth.account.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAccountProfile } from "../controllers/auth.account.controller.js";

export const authAccountRouter = Router();

authAccountRouter.use(requireAuth);

/**
 * Account profile
 * GET /auth/account/profile
 */
authAccountRouter.get("/profile", getAccountProfile);
