// src/routes/admin.webauthn.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";

import {
  adminListCredentials,
  adminGetPolicy,
  adminUpdatePolicy,
} from "../controllers/admin.webauthn.controller.js";

export const adminWebauthnRouter = Router();

// Protect the whole router
adminWebauthnRouter.use(requireAdmin);

/**
 * Admin WebAuthn config & visibility
 * GET /admin/webauthn/credentials
 * GET /admin/webauthn/policy
 * PUT /admin/webauthn/policy
 *
 * Note: You should protect these routes with an admin-only middleware at mount time
 * (see app.use() section below).
 */

adminWebauthnRouter.get("/credentials", adminListCredentials);
adminWebauthnRouter.get("/policy", adminGetPolicy);
adminWebauthnRouter.put("/policy", adminUpdatePolicy);
