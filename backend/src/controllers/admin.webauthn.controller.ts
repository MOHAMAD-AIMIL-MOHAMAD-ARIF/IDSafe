// src/controllers/admin.webauthn.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

/**
 * GET /admin/webauthn/credentials (requires requireAdmin at router-level)
 */
export async function adminListCredentials(_req: Request, res: Response) {
  // TODO:
  // - list credentials across users with safe metadata only
  // const creds = await prisma.webAuthnCredential.findMany({ ... });
  return res.status(501).json({ error: "Not implemented: GET /admin/webauthn/credentials" });
}

/**
 * GET /admin/webauthn/policy (requires requireAdmin)
 */
export async function adminGetPolicy(_req: Request, res: Response) {
  // TODO:
  // - read SYSTEM_CONFIG keys used for WebAuthn policy
  // - return structured policy object
  return res.status(501).json({ error: "Not implemented: GET /admin/webauthn/policy" });
}

/**
 * PUT /admin/webauthn/policy (requires requireAdmin)
 */
export async function adminUpdatePolicy(req: Request, res: Response) {
  // TODO:
  // - validate request body
  // - update SYSTEM_CONFIG rows (and audit log)
  // - return updated policy
  return res.status(501).json({ error: "Not implemented: PUT /admin/webauthn/policy" });
}
