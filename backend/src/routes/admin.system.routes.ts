// src/routes/admin.system.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  adminGetSystemConfig,
  adminHealthMetrics,
  adminUpdateSystemConfig,
} from "../controllers/admin.system.controller.js";

export const adminSystemRouter = Router();

adminSystemRouter.use(requireAdmin);

/**
 * Admin system configuration + health
 * GET /admin/system/config
 * PUT /admin/system/config
 * GET /admin/system/health
 */
adminSystemRouter.get("/config", adminGetSystemConfig);
adminSystemRouter.put("/config", adminUpdateSystemConfig);
adminSystemRouter.get("/health", adminHealthMetrics);
