// src/routes/admin.webauthn.routes.ts
import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";

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

// GET /admin/webauthn/credentials
adminWebauthnRouter.get("/credentials", async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: admin list credentials" });
});

// GET /admin/webauthn/policy
adminWebauthnRouter.get("/policy", async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: admin get policy" });
});

// PUT /admin/webauthn/policy
adminWebauthnRouter.put("/policy", async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: admin update policy" });
});
