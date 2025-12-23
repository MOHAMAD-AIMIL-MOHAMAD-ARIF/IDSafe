// src/controllers/auth.webauthn.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { auditFromReq } from "../services/auditLogService.js";
import { bufToB64url } from "../utils/base64url.js";
import { Buffer } from "node:buffer";

const registerStartSchema = z.object({
  email: z.email(),
});

const registerFinishSchema = z.object({
  // This is the JSON body returned from `startRegistration(...)` in the browser
  credential: z.unknown(),
});

const loginStartSchema = z.object({
  email: z.email(),
});

const loginFinishSchema = z.object({
  // The browser sends AuthenticationResponseJSON here.
  // Keep runtime validation light; @simplewebauthn/server will validate structure.
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

// -------------------- base64url helpers --------------------
// Stores in DB as base64url strings; convert to Uint8Array<ArrayBuffer> for @simplewebauthn/server.
function b64urlToU8(b64url: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(b64url, "base64url");
  // Slice to a standalone ArrayBuffer region (avoids ArrayBufferLike / SharedArrayBuffer typing issues)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Uint8Array(ab);
}

function u8ToB64url(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64url");
}

// -------------------- session helper (fixation-safe) --------------------
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
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
    select: { userId: true, email: true, status: true, role: true },
  });

  if (user.role !== "END_USER") {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.REGISTER.START.FAIL",
      detailsJson: { success: false, reason: "ROLE_NOT_END_USER" },
    });
    return res.status(403).json({ error: "End-user registration is not allowed for this account" });
  }

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

  if (!user || user.role !== "END_USER" || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: reg.userId,
      actorId: reg.userId,
      eventType: "WEBAUTHN.REGISTER.FAIL",
      detailsJson: {
        reason: !user
          ? "USER_NOT_FOUND"
          : user.role !== "END_USER"
            ? "ROLE_NOT_END_USER"
            : "USER_NOT_ACTIVE",
      },
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

    function credentialIdToString(id: string | Uint8Array): string {
        return typeof id === "string" ? id : u8ToB64url(id);
    }
    const externalCredentialId = credentialIdToString(cred.id as any);

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

// =====================================================
// POST /auth/webauthn/login/start
// Body: { email }
// =====================================================
export async function loginStart(req: Request, res: Response) {
  const body = loginStartSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid payload", issues: body.error.issues });
  }

  const { rpID } = getWebAuthnEnv();
  const email = body.data.email;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.role !== "END_USER" || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: user?.userId ?? null,
      actorId: user?.userId ?? null,
      eventType: "WEBAUTHN.LOGIN.START.FAIL",
      detailsJson: {
        reason: !user
          ? "USER_NOT_FOUND"
          : user.role !== "END_USER"
            ? "ROLE_NOT_END_USER"
            : "USER_NOT_ACTIVE",
      },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  const creds = await prisma.webauthnCredential.findMany({
    where: { userId: user.userId, isActive: true },
    select: { externalCredentialId: true },
  });

  if (creds.length === 0) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.LOGIN.START.FAIL",
      detailsJson: { reason: "NO_ACTIVE_CREDENTIALS" },
    });
    return res.status(400).json({ error: "No active credentials for this account" });
  }

  const allowCredentials = creds.map((c) => ({
    id: c.externalCredentialId, // string (base64url)
    type: "public-key" as const,
    // transports: ["internal"] as const, // optional
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
    // timeout: 60000, // optional
  });

  // Save challenge + userId for finish
  req.session.webauthnLogin = {
    challenge: options.challenge,
    userId: user.userId,
    createdAtMs: Date.now(),
  };

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "WEBAUTHN.LOGIN.START.OK",
    detailsJson: { allowCredentialsCount: allowCredentials.length },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, options });
}

// =====================================================
// POST /auth/webauthn/login/finish
// Body: { credential }
// =====================================================
export async function loginFinish(req: Request, res: Response) {
  const body = loginFinishSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid payload", issues: body.error.issues });
  }

  const pending = req.session.webauthnLogin;
  if (!pending?.challenge || !pending.userId) {
    return res.status(400).json({ error: "No pending WebAuthn login (missing challenge)" });
  }

  const { rpID, expectedOrigin } = getWebAuthnEnv();

  const user = await prisma.user.findUnique({
    where: { userId: pending.userId },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.role !== "END_USER" || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: pending.userId,
      actorId: pending.userId,
      eventType: "WEBAUTHN.LOGIN.FAIL",
      detailsJson: {
        reason: !user
          ? "USER_NOT_FOUND"
          : user.role !== "END_USER"
            ? "ROLE_NOT_END_USER"
            : "USER_NOT_ACTIVE",
      },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  // Cast because the incoming type is a WebAuthn JSON payload.
  // @simplewebauthn/server performs its own structural checks.
  const credential = body.data.credential as any;

  // Find the credential row by the WebAuthn credential ID (base64url string)
  // Browser JSON typically includes `id` as base64url.
  const credRow = await prisma.webauthnCredential.findFirst({
    where: {
      userId: user.userId,
      isActive: true,
      externalCredentialId: String(credential?.id ?? ""),
    },
    select: {
      credentialId: true,
      externalCredentialId: true,
      publicKey: true,
      signCount: true,
    },
  });

  if (!credRow) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.LOGIN.FAIL",
      detailsJson: { reason: "CREDENTIAL_NOT_FOUND" },
    });
    return res.status(401).json({ error: "Invalid credential" });
  }

  let verification: any;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential, // AuthenticationResponseJSON
      expectedChallenge: pending.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: credRow.externalCredentialId,          // Uint8Array
        publicKey: b64urlToU8(credRow.publicKey),              // Uint8Array
        counter: credRow.signCount ?? 0,
        //transports: [],                                        // optional
      },
      requireUserVerification: false,
    });
  } catch (e: any) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.LOGIN.FAIL",
      detailsJson: { reason: "VERIFY_THROW", message: String(e?.message ?? e) },
    });
    return res.status(401).json({ error: "Authentication failed" });
  } finally {
    // One-time use challenge
    delete req.session.webauthnLogin;
  }

  const { verified, authenticationInfo } = verification ?? {};
  if (!verified || !authenticationInfo) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "WEBAUTHN.LOGIN.FAIL",
      detailsJson: { reason: "NOT_VERIFIED" },
    });
    return res.status(401).json({ error: "Authentication failed" });
  }

  const now = new Date();
  const newCounter: number | undefined = authenticationInfo.newCounter;

  await prisma.$transaction([
    prisma.webauthnCredential.update({
      where: { credentialId: credRow.credentialId },
      data: {
        signCount: typeof newCounter === "number" ? newCounter : credRow.signCount,
        lastUsedAt: now,
      },
    }),
    prisma.user.update({
      where: { userId: user.userId },
      data: { lastLoginAt: now },
    }),
  ]);

  // Create a fresh session (prevents session fixation)
  await regenerateSession(req);
  req.session.userId = user.userId;
  req.session.role = user.role;

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "WEBAUTHN.LOGIN.OK",
    detailsJson: {
      credentialId: credRow.credentialId,
      // Do NOT log vault plaintext, passphrases, or keys.
      // Also avoid logging raw signature/authenticatorData.
      signCount: typeof newCounter === "number" ? newCounter : credRow.signCount,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true });
}

/**
 * GET /auth/webauthn/credentials  (requires requireAuth)
 */
export async function listCredentials(req: Request, res: Response) {
  const userId = req.session.userId!;
  if (req.session.role !== "END_USER") {
    return res.status(403).json({ error: "End-user credentials only" });
  }
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
  if (req.session.role !== "END_USER") {
    return res.status(403).json({ error: "End-user credentials only" });
  }
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
