// src/routes/admin.audit.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { adminExportAuditLogs, adminListAuditLogs } from "../controllers/admin.audit.controller.js";

export const adminAuditRouter = Router();

adminAuditRouter.use(requireAdmin);

/**
 * Admin audit log access
 * GET /admin/audit-logs
 * GET /admin/audit-logs/export
 */
adminAuditRouter.get("/", adminListAuditLogs);
adminAuditRouter.get("/export", adminExportAuditLogs);
