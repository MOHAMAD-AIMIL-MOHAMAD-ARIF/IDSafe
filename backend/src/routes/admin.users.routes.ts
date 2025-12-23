// src/routes/admin.users.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  adminInvalidateUserSessions,
  adminListUsers,
  adminUpdateUserStatus,
} from "../controllers/admin.users.controller.js";

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAdmin);

/**
 * Admin user management
 * GET /admin/users
 * PATCH /admin/users/:userId/status
 * POST /admin/users/:userId/sessions/invalidate
 */
adminUsersRouter.get("/", adminListUsers);
adminUsersRouter.patch("/:userId/status", adminUpdateUserStatus);
adminUsersRouter.post("/:userId/sessions/invalidate", adminInvalidateUserSessions);
