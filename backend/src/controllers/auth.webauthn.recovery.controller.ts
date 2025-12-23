// src/controllers/auth.webauthn.recovery.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { auditFromReq } from "../services/auditLogService.js";
import { requireRecoverySession } from "../middleware/auth.js";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";

// Avoid forcing @simplewebauthn/types install: accept unknown and validate shape at runtime
type RegistrationResponseJSON = any;

function getWebAuthnEnv() {
  const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
  const expectedOrigin = process.env.WEBAUTHN_EXPECTED_ORIGIN ?? "http://localhost:3000";
  const rpName = process.env.WEBAUTHN_RP_NAME ?? "IDSafe";
  return { rpID, expectedOrigin, rpName };
}

function userIdToUserHandle(userId: number): Uint8Array<ArrayBuffer> {
  // Create a REAL ArrayBuffer (not SharedArrayBuffer / ArrayBufferLike)
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, userId, false);
  return new Uint8Array(buf) as Uint8Array<ArrayBuffer>;
}

const finishSchema = z.object({
  credential: z.custom<RegistrationResponseJSON>(),
});

function ensureRecoveryCompleted(req: Request, res: Response): boolean {
  const r = req.session.recovery!;
  if (!r.completedAt) {
    res.status(409).json({ error: "Recovery not completed yet. Call POST /recovery/data first." });
    return false;
  }
  return true;
}

export function zodIssuesToPrismaJson(issues: z.core.$ZodIssue[]): Prisma.InputJsonValue {
  // Return an array of plain objects (JSON-safe)
  return issues.map((i) => ({
    code: i.code,
    message: i.message,
    // PropertyKey[] -> string[]
    path: i.path.map((p) => String(p)),
  }));
}

/**
 * POST /auth/webauthn/recovery/register/start
 * Requires: requireRecoverySession
 *
 * Also requires: req.session.recovery.completedAt (set by POST /recovery/data)
 */
export const recoveryRegisterStart = [
  requireRecoverySession,
  async (req: Request, res: Response) => {
    const recovery = req.session.recovery!;
    const userId = recovery.userId;

    if (!ensureRecoveryCompleted(req, res)) return;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, email: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "WEBAUTHN.RECOVERY.REGISTER.START.FAIL",
        detailsJson: { reason: !user ? "USER_NOT_FOUND" : "USER_NOT_ACTIVE" },
      });
      return res.status(403).json({ error: "Account is not active" });
    }

    const { rpID, rpName } = getWebAuthnEnv();

    // Exclude active credentials (should be 0 if you deactivated them on recovery)
    const existingCreds = await prisma.webauthnCredential.findMany({
      where: { userId, isActive: true },
      select: { externalCredentialId: true },
    });

    const excludeCredentials = existingCreds.map((c) => ({
      id: c.externalCredentialId, // keep as base64url string (matches your DB)
      type: "public-key" as const,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdToUserHandle(user.userId),
      userName: user.email,
      userDisplayName: user.email,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // store challenge inside recovery session
    req.session.recovery = {
      ...recovery,
      webauthnChallenge: options.challenge,
    } as any;

    await auditFromReq(prisma, req, {
      userId,
      actorId: userId,
      eventType: "WEBAUTHN.RECOVERY.REGISTER.START.OK",
      detailsJson: { excludeCount: excludeCredentials.length },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, options });
  },
];

/**
 * POST /auth/webauthn/recovery/register/finish
 * Requires: requireRecoverySession
 *
 * On success:
 * - verifyRegistrationResponse(...)
 * - create WebauthnCredential row (active)
 * - promote recovery session -> normal session (req.session.regenerate)
 */
export const recoveryRegisterFinish = [
  requireRecoverySession,
  async (req: Request, res: Response) => {
    const recovery = req.session.recovery!;
    const userId = recovery.userId;

    if (!ensureRecoveryCompleted(req, res)) return;

    const challenge = (recovery as any).webauthnChallenge as string | undefined;
    if (!challenge) return res.status(400).json({ error: "No pending recovery WebAuthn registration" });

    const parsed = finishSchema.safeParse(req.body);
    if (!parsed.success) {
        const detailsJson: Prisma.InputJsonValue = {
            reason: "INVALID_PAYLOAD",
            issues: zodIssuesToPrismaJson(parsed.error.issues),
        };
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "WEBAUTHN.RECOVERY.REGISTER.FINISH.FAIL",
        detailsJson,
      });
      return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, email: true, status: true, role: true },
    });

    if (!user || user.status !== "ACTIVE") {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "WEBAUTHN.RECOVERY.REGISTER.FINISH.FAIL",
        detailsJson: { reason: !user ? "USER_NOT_FOUND" : "USER_NOT_ACTIVE" },
      });
      return res.status(403).json({ error: "Account is not active" });
    }

    const { rpID, expectedOrigin } = getWebAuthnEnv();

    let verification: any;
    try {
      verification = await verifyRegistrationResponse({
        response: parsed.data.credential,
        expectedChallenge: challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "WEBAUTHN.RECOVERY.REGISTER.FINISH.FAIL",
        detailsJson: { reason: "VERIFY_THROW" },
      });
      return res.status(400).json({ error: "Registration verification failed" });
    }

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "WEBAUTHN.RECOVERY.REGISTER.FINISH.FAIL",
        detailsJson: { reason: "NOT_VERIFIED" },
      });
      return res.status(400).json({ error: "Registration not verified" });
    }

    // In your @simplewebauthn/server version, these are strings (base64url)
    const cred = registrationInfo.credential;
    const externalCredentialId: string = cred.id;
    const publicKey: string = cred.publicKey;
    const signCount: number = cred.counter ?? 0;

    // aaguid/fmt can vary by version - keep safe fallbacks
    const aaguid: string = (registrationInfo as any).aaguid ?? (cred as any).aaguid ?? "unknown";
    const attestationFormat: string =
      (registrationInfo as any).fmt ?? (registrationInfo as any).attestationFormat ?? "unknown";

    const now = new Date();

    try {
      await prisma.webauthnCredential.create({
        data: {
          userId,
          externalCredentialId,
          publicKey,
          aaguid,
          attestationFormat,
          signCount,
          isActive: true,
          createdAt: now,
          lastUsedAt: null,
        },
      });
    } catch {
      await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "WEBAUTHN.RECOVERY.REGISTER.FINISH.FAIL",
        detailsJson: { reason: "DB_INSERT_FAILED" },
      });
      return res.status(409).json({ error: "Credential already exists" });
    }

    await auditFromReq(prisma, req, {
      userId,
      actorId: userId,
      eventType: "WEBAUTHN.RECOVERY.REGISTER.FINISH.OK",
      detailsJson: {
        aaguid,
        attestationFormat,
        signCount,
        credentialIdPrefix: externalCredentialId.slice(0, 12), // safe to log prefix only
      },
    });

    // Promote recovery session -> normal login session (anti-fixation)
    return req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Failed to rotate session" });

      req.session.userId = userId;
      req.session.role = "END_USER";

      // Ensure recovery state is removed
      delete (req.session as any).recovery;

      res.setHeader("Cache-Control", "no-store");
      return res.json({ ok: true, userId });
    });
  },
];
