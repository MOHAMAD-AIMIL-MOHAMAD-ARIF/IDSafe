// src/routes/admin.config.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { adminGetKdfPolicy, adminUpdateKdfPolicy } from "../controllers/admin.config.controller.js";

export const adminConfigRouter = Router();

adminConfigRouter.use(requireAdmin);

/**
 * Admin config
 * GET /admin/config/kdf
 * PUT /admin/config/kdf
 */
adminConfigRouter.get("/kdf", adminGetKdfPolicy);
adminConfigRouter.put("/kdf", adminUpdateKdfPolicy);
