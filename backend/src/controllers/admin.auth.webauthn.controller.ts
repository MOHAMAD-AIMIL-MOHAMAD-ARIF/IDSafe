// src/controllers/admin.auth.webauthn.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { Buffer } from "node:buffer";
import { prisma } from "../db.js";
import { auditFromReq } from "../services/auditLogService.js";
import { bufToB64url } from "../utils/base64url.js";
import { getWebAuthnPolicy } from "../services/webauthnPolicyService.js";

const registerStartSchema = z.object({
  email: z.email(),
});

const registerFinishSchema = z.object({
  credential: z.unknown(),
});

const loginStartSchema = z.object({
  email: z.email(),
});

const loginFinishSchema = z.object({
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
  return externalCredentialId.length <= 16 ? externalCredentialId : externalCredentialId.slice(0, 16) + "...";
}

function normalizeAaguid(aaguid: unknown): string {
  if (typeof aaguid === "string") return aaguid;
  if (aaguid instanceof Uint8Array) return bufToB64url(aaguid);
  return "unknown";
}

function userIdToUserHandle(userId: number): Uint8Array<ArrayBuffer> {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(userId, 0);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  return new Uint8Array(ab);
}

function b64urlToU8(b64url: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(b64url, "base64url");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Uint8Array(ab);
}

function u8ToB64url(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64url");
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * POST /admin/auth/webauthn/register/start
 * Body: { email }
 */
export async function adminRegisterStart(req: Request, res: Response) {
  const parsed = registerStartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { rpName } = getWebAuthnEnv();
  const policy = await getWebAuthnPolicy(prisma);
  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.role !== "ADMIN") {
    await auditFromReq(prisma, req, {
      userId: user?.userId ?? null,
      actorId: user?.userId ?? null,
      eventType: "ADMIN.WEBAUTHN.REGISTER.START.FAIL",
      detailsJson: { reason: "NOT_ADMIN" },
    });
    return res.status(403).json({ error: "Admin registration is restricted" });
  }

  if (user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.REGISTER.START.FAIL",
      detailsJson: { reason: "USER_NOT_ACTIVE" },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  const existingCreds = await prisma.webauthnCredential.findMany({
    where: { userId: user.userId, isActive: true },
    select: { externalCredentialId: true },
  });

  const excludeCredentials = existingCreds.map((c) => ({
    id: c.externalCredentialId,
    type: "public-key" as const,
  }));

  const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
    rpName,
    rpID: policy.rpId,
    userID: userIdToUserHandle(user.userId),
    userName: email,
    userDisplayName: email,
    attestationType: policy.attestation,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: policy.residentKey,
      userVerification: policy.userVerification,
    },
    timeout: policy.timeoutMs,
  });

  req.session.adminWebauthnReg = {
    userId: user.userId,
    email,
    challenge: options.challenge,
    createdAt: nowIso(),
  };

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "ADMIN.WEBAUTHN.REGISTER.START.OK",
    detailsJson: { excludeCredentialCount: excludeCredentials.length },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, options });
}

/**
 * POST /admin/auth/webauthn/register/finish
 * Body: { credential }
 */
export async function adminRegisterFinish(req: Request, res: Response) {
  const parsed = registerFinishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const reg = req.session.adminWebauthnReg;
  if (!reg?.challenge || !reg.userId) {
    return res.status(400).json({ error: "No pending admin WebAuthn registration" });
  }

  const { expectedOrigin } = getWebAuthnEnv();
  const policy = await getWebAuthnPolicy(prisma);

  const user = await prisma.user.findUnique({
    where: { userId: reg.userId },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: reg.userId,
      actorId: reg.userId,
      eventType: "ADMIN.WEBAUTHN.REGISTER.FAIL",
      detailsJson: {
        reason: !user ? "USER_NOT_FOUND" : user.role !== "ADMIN" ? "ROLE_NOT_ADMIN" : "USER_NOT_ACTIVE",
      },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.credential as any,
      expectedChallenge: reg.challenge,
      expectedOrigin,
      expectedRPID: policy.rpId,
      requireUserVerification: false,
    });
  } catch (e) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.REGISTER.FAIL",
      detailsJson: { reason: "VERIFY_THROW", message: e instanceof Error ? e.message : "unknown" },
    });
    return res.status(400).json({ error: "Registration verification failed" });
  } finally {
    delete req.session.adminWebauthnReg;
  }

  const { verified, registrationInfo } = verification;
  if (!verified || !registrationInfo) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.REGISTER.FAIL",
      detailsJson: { reason: "NOT_VERIFIED" },
    });
    return res.status(400).json({ error: "Registration not verified" });
  }

  const cred = registrationInfo.credential;
  const externalCredentialId = typeof cred.id === "string" ? cred.id : u8ToB64url(cred.id as Uint8Array);
  const publicKey = u8ToB64url(cred.publicKey);
  const signCount =
    typeof (cred as any).counter === "number"
      ? (cred as any).counter
      : typeof (cred as any).signCount === "number"
        ? (cred as any).signCount
        : 0;
  const aaguid = normalizeAaguid(registrationInfo.aaguid ?? "unknown");
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
      },
      select: { credentialId: true },
    });

    req.session.userId = user.userId;
    req.session.role = user.role;

    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.REGISTER.SUCCESS",
      detailsJson: {
        credentialId: created.credentialId,
        externalCredentialIdShort: safeCredentialIdForLogs(externalCredentialId),
        aaguid,
        attestationFormat,
        signCount,
      },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, credentialId: created.credentialId });
  } catch (e: any) {
    const isUnique = e?.code === "P2002";
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.REGISTER.FAIL",
      detailsJson: { reason: isUnique ? "DUPLICATE_CREDENTIAL" : "DB_ERROR" },
    });
    return res.status(isUnique ? 409 : 500).json({
      error: isUnique ? "Credential already registered" : "Failed to store credential",
    });
  }
}

/**
 * POST /admin/auth/webauthn/login/start
 * Body: { email }
 */
export async function adminLoginStart(req: Request, res: Response) {
  const parsed = loginStartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const policy = await getWebAuthnPolicy(prisma);
  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: user?.userId ?? null,
      actorId: user?.userId ?? null,
      eventType: "ADMIN.WEBAUTHN.LOGIN.START.FAIL",
      detailsJson: {
        reason: !user ? "USER_NOT_FOUND" : user.role !== "ADMIN" ? "ROLE_NOT_ADMIN" : "USER_NOT_ACTIVE",
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
      eventType: "ADMIN.WEBAUTHN.LOGIN.START.FAIL",
      detailsJson: { reason: "NO_ACTIVE_CREDENTIALS" },
    });
    return res.status(400).json({ error: "No active credentials for this account" });
  }

  const allowCredentials = creds.map((c) => ({
    id: c.externalCredentialId,
    type: "public-key" as const,
  }));

  const options = await generateAuthenticationOptions({
    rpID: policy.rpId,
    allowCredentials,
    userVerification: policy.userVerification,
    timeout: policy.timeoutMs,
  });

  req.session.adminWebauthnLogin = {
    challenge: options.challenge,
    userId: user.userId,
    createdAtMs: Date.now(),
  };

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "ADMIN.WEBAUTHN.LOGIN.START.OK",
    detailsJson: { allowCredentialsCount: allowCredentials.length },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, options });
}

/**
 * POST /admin/auth/webauthn/login/finish
 * Body: { credential }
 */
export async function adminLoginFinish(req: Request, res: Response) {
  const parsed = loginFinishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const pending = req.session.adminWebauthnLogin;
  if (!pending?.challenge || !pending.userId) {
    return res.status(400).json({ error: "No pending admin WebAuthn login" });
  }

  const { expectedOrigin } = getWebAuthnEnv();
  const policy = await getWebAuthnPolicy(prisma);

  const user = await prisma.user.findUnique({
    where: { userId: pending.userId },
    select: { userId: true, email: true, status: true, role: true },
  });

  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: pending.userId,
      actorId: pending.userId,
      eventType: "ADMIN.WEBAUTHN.LOGIN.FAIL",
      detailsJson: {
        reason: !user ? "USER_NOT_FOUND" : user.role !== "ADMIN" ? "ROLE_NOT_ADMIN" : "USER_NOT_ACTIVE",
      },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  const credential = parsed.data.credential as any;

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
      eventType: "ADMIN.WEBAUTHN.LOGIN.FAIL",
      detailsJson: { reason: "CREDENTIAL_NOT_FOUND" },
    });
    return res.status(401).json({ error: "Invalid credential" });
  }

  let verification: any;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin,
      expectedRPID: policy.rpId,
      credential: {
        id: credRow.externalCredentialId,
        publicKey: b64urlToU8(credRow.publicKey),
        counter: credRow.signCount ?? 0,
      },
      requireUserVerification: false,
    });
  } catch (e: any) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.LOGIN.FAIL",
      detailsJson: { reason: "VERIFY_THROW", message: String(e?.message ?? e) },
    });
    return res.status(401).json({ error: "Authentication failed" });
  } finally {
    delete req.session.adminWebauthnLogin;
  }

  const { verified, authenticationInfo } = verification ?? {};
  if (!verified || !authenticationInfo) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.WEBAUTHN.LOGIN.FAIL",
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

  await regenerateSession(req);
  req.session.userId = user.userId;
  req.session.role = user.role;

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "ADMIN.WEBAUTHN.LOGIN.OK",
    detailsJson: {
      credentialId: credRow.credentialId,
      signCount: typeof newCounter === "number" ? newCounter : credRow.signCount,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true });
}
