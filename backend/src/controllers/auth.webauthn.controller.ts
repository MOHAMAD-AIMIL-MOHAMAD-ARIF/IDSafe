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
  const credentials = await prisma.webauthnCredential.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      credentialId: true,
      externalCredentialId: true,
      aaguid: true,
      attestationFormat: true,
      signCount: true,
      createdAt: true,
      lastUsedAt: true,
      isActive: true,
    },
  });

  return res.json({ credentials });
}

/**
 * DELETE /auth/webauthn/credentials/:credentialId (requires requireAuth)
 *
 * Recommended: "soft delete" by setting isActive=false (keeps auditability).
 */
export async function deleteCredential(req: Request, res: Response) {
  const userId = req.session.userId!;
  const credentialId = Number(req.params.credentialId);

  if (!Number.isInteger(credentialId) || credentialId <= 0) {
    return res.status(400).json({ error: "Invalid credentialId" });
  }

  const existing = await prisma.webauthnCredential.findFirst({
    where: { credentialId, userId, isActive: true },
    select: { credentialId: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "Credential not found" });
  }

  await prisma.webauthnCredential.update({
    where: { credentialId },
    data: { isActive: false },
  });

  return res.json({ ok: true, credentialId });
}
