// src/routes/admin.dashboard.routes.ts
import { Router } from "express";
import { adminRecoveryEvents, adminSummary } from "../controllers/admin.dashboard.controller.js";
import { requireAdmin } from "../middleware/auth.js";

export const adminDashboardRouter = Router();

adminDashboardRouter.use(requireAdmin);

/**
 * GET /admin/summary
 * GET /admin/recovery-events
 */
adminDashboardRouter.get("/summary", adminSummary);
adminDashboardRouter.get("/recovery-events", adminRecoveryEvents);
