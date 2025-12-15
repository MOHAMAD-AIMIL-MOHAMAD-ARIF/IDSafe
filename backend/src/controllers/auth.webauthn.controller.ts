// src/controllers/auth.webauthn.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

/**
 * POST /auth/webauthn/register/start
 */
export async function registerStart(req: Request, res: Response) {
  // TODO:
  // - Identify user (e.g., email in body) OR create user earlier in your flow
  // - generateRegistrationOptions(...)
  // - store challenge in a temp store or session (recommended: req.session.webauthnChallenge)
  return res.status(501).json({ error: "Not implemented: /auth/webauthn/register/start" });
}

/**
 * POST /auth/webauthn/register/finish
 */
export async function registerFinish(req: Request, res: Response) {
  // TODO:
  // - verifyRegistrationResponse(...)
  // - persist credential into WebAuthnCredential table
  // - audit log success/failure
  return res.status(501).json({ error: "Not implemented: /auth/webauthn/register/finish" });
}

/**
 * POST /auth/webauthn/login/start
 */
export async function loginStart(req: Request, res: Response) {
  // TODO:
  // - look up user credentials
  // - generateAuthenticationOptions(...)
  // - store challenge in session/temp store
  return res.status(501).json({ error: "Not implemented: /auth/webauthn/login/start" });
}

/**
 * POST /auth/webauthn/login/finish
 */
export async function loginFinish(req: Request, res: Response) {
  // TODO:
  // - verifyAuthenticationResponse(...)
  // - update signCount
  // - create normal session (cookie) => req.session.userId, req.session.role
  // Example:
  // req.session.userId = user.userId;
  // req.session.role = user.role;
  return res.status(501).json({ error: "Not implemented: /auth/webauthn/login/finish" });
}

/**
 * GET /auth/webauthn/credentials  (requires requireAuth)
 */
export async function listCredentials(req: Request, res: Response) {
  const userId = req.session.userId!;
  // TODO: query WebAuthnCredential where userId = session.userId
  // const creds = await prisma.webAuthnCredential.findMany({ where: { userId } });
  // return res.json({ credentials: creds });
  return res.status(501).json({ error: "Not implemented: /auth/webauthn/credentials", userId });
}

/**
 * DELETE /auth/webauthn/credentials/:credentialId  (requires requireAuth)
 */
export async function deleteCredential(req: Request, res: Response) {
  const userId = req.session.userId!;
  const credentialIdParam = req.params.credentialId;

  // TODO:
  // - authorize: ensure credential belongs to userId
  // - delete credential row
  // - audit log
  return res.status(501).json({
    error: "Not implemented: DELETE /auth/webauthn/credentials/:credentialId",
    userId,
    credentialId: credentialIdParam,
  });
}
