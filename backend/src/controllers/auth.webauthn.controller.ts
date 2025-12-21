// src/controllers/auth.webauthn.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { auditFromReq } from "../services/auditLogService.js";
import { u8ToB64url, bufToB64url } from "../utils/base64url.js";

const registerStartSchema = z.object({
  email: z.email(),
});

const registerFinishSchema = z.object({
  // This is the JSON body returned from `startRegistration(...)` in the browser
  credential: z.unknown(),
});

function getWebAuthnEnv() {
  const rpID = process.env.WEBAUTHN_RP_ID;
  const rpName = process.env.WEBAUTHN_RP_NAME;
  const expectedOrigin = process.env.WEBAUTHN_EXPECTED_ORIGIN;

  if (!rpID || !rpName || !expectedOrigin) {
    throw new Error("Missing WEBAUTHN_RP_ID / WEBAUTHN_RP_NAME / WEBAUTHN_EXPECTED_ORIGIN env vars");
  }

  return { rpID, rpName, expectedOrigin };
}

function nowIso() {
  return new Date().toISOString();
}

function safeCredentialIdForLogs(externalCredentialId: string): string {
  // Don’t dump entire IDs in logs; keep a short prefix
  return externalCredentialId.length <= 16 ? externalCredentialId : externalCredentialId.slice(0, 16) + "...";
}

function normalizeAaguid(aaguid: unknown): string {
  if (typeof aaguid === "string") return aaguid;
  if (aaguid instanceof Uint8Array) return bufToB64url(aaguid); // store as base64url
  return "unknown";
}

function userIdToUserHandle(userId: number): Uint8Array<ArrayBuffer> {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(userId, 0);

  // Extract a true ArrayBuffer view (not "ArrayBufferLike")
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

  return new Uint8Array(ab);
}

/**
 * POST /auth/webauthn/register/start
 * Body: { email }
 * Returns: PublicKeyCredentialCreationOptionsJSON
 */
export async function registerStart(req: Request, res: Response) {
  const parsed = registerStartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { rpID, rpName } = getWebAuthnEnv();
  const email = parsed.data.email.toLowerCase().trim();

  // Find or create user
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role: "END_USER",
      status: "ACTIVE",
    },
    update: {},
    select: { userId: true, email: true, status: true },
  });

  if (user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.REGISTER.START",
      detailsJson: { success: false, reason: "USER_NOT_ACTIVE" },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  // Exclude existing credentials for this user
  const existingCreds = await prisma.webauthnCredential.findMany({
    where: { userId: user.userId, isActive: true },
    select: { externalCredentialId: true },
  });

  const excludeCredentials = existingCreds.map((c) => ({
    id: c.externalCredentialId, // base64url
    type: "public-key" as const,
  }));
  

  // Generate WebAuthn registration options
  const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userIdToUserHandle(user.userId), // stable user handle; could also be random bytes stored on user
    userName: email,
    userDisplayName: email,
    attestationType: "none", // you can later load this from SystemConfig
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge in session (critical)
  req.session.webauthnReg = {
    userId: user.userId,
    email,
    challenge: options.challenge,
    createdAt: nowIso(),
  };

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "WEBAUTHN.REGISTER.START",
    detailsJson: {
      success: true,
      excludeCredentialCount: excludeCredentials.length,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, options });
}

/**
 * POST /auth/webauthn/register/finish
 * Body: { credential }
 * Returns: { ok: true, credentialId }
 */
export async function registerFinish(req: Request, res: Response) {
  const parsed = registerFinishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const reg = req.session.webauthnReg;
  if (!reg?.challenge || !reg.userId) {
    return res.status(400).json({ error: "No pending WebAuthn registration (missing challenge)" });
  }

  const { rpID, expectedOrigin } = getWebAuthnEnv();

  const user = await prisma.user.findUnique({
    where: { userId: reg.userId },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: reg.userId,
      actorId: reg.userId,
      eventType: "WEBAUTHN.REGISTER.FAIL",
      detailsJson: { reason: "USER_NOT_FOUND_OR_NOT_ACTIVE" },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  const credential = parsed.data.credential;

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: credential as any,
      expectedChallenge: reg.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false, // set true if you want to enforce UV
    });
  } catch (e) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.REGISTER.FAIL",
      detailsJson: {
        reason: "VERIFY_THROW",
        message: e instanceof Error ? e.message : "unknown",
      },
    });
    return res.status(400).json({ error: "Registration verification failed" });
  } finally {
    // One-time challenge use (even on failure)
    delete req.session.webauthnReg;
  }

  const { verified, registrationInfo } = verification;

  if (!verified || !registrationInfo) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.REGISTER.FAIL",
      detailsJson: { reason: "NOT_VERIFIED" },
    });
    return res.status(400).json({ error: "Registration not verified" });
  }

  // Extract credential info
  // In your @simplewebauthn/server version, registrationInfo exposes `credential`
    const cred = registrationInfo.credential;

    // In this build, `cred.id` is already a string (usually base64url)
    const externalCredentialId = cred.id;
    // `cred.publicKey` is bytes, so convert to base64url for DB storage
    const publicKey = u8ToB64url(cred.publicKey);

    // sign counter name can vary; support both
    const signCount =
    typeof (cred as any).counter === "number"
        ? (cred as any).counter
        : typeof (cred as any).signCount === "number"
        ? (cred as any).signCount
        : 0;

  // AAGUID / attestation format (fmt)
  const aaguid = registrationInfo.aaguid ?? "unknown";
  const attestationFormat = String(registrationInfo.fmt ?? "unknown");

  try {
    const created = await prisma.webauthnCredential.create({
      data: {
        userId: user.userId,
        externalCredentialId,
        publicKey,
        aaguid,
        attestationFormat,
        signCount,
        isActive: true,
        // createdAt default handled by Prisma
      },
      select: { credentialId: true },
    });

    // Optionally log the user in after successful registration
    req.session.userId = user.userId;
    req.session.role = user.role;

    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.REGISTER.SUCCESS",
      detailsJson: {
        credentialId: created.credentialId,
        externalCredentialIdShort: safeCredentialIdForLogs(externalCredentialId),
        aaguid,
        attestationFormat,
        signCount,
        // avoid logging publicKey or full raw IDs
      },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, credentialId: created.credentialId });
  } catch (e: any) {
    // Unique constraint hit (externalCredentialId)
    const isUnique = e?.code === "P2002";
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.REGISTER.FAIL",
      detailsJson: {
        reason: isUnique ? "DUPLICATE_CREDENTIAL" : "DB_ERROR",
      },
    });

    return res.status(isUnique ? 409 : 500).json({
      error: isUnique ? "Credential already registered" : "Failed to store credential",
    });
  }
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
