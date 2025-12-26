// src/controllers/admin.auth.password.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import argon2 from "argon2";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import { auditFromReq } from "../services/auditLogService.js";
import { sendAdminOtpEmail } from "../services/email.js";

const loginStartSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
});

function nowIso() {
  return new Date().toISOString();
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(userId: number, otpCode: string): string {
  const payload = `${userId}:${otpCode}`;
  return crypto.createHmac("sha256", env.ADMIN_OTP_PEPPER).update(payload, "utf8").digest("hex");
}

async function incrementFailedAttempts(adminCredentialId: number, now: Date) {
  const credential = await prisma.adminCredential.update({
    where: { adminCredentialId },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  });

  if (credential.failedAttempts >= env.ADMIN_LOGIN_MAX_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + env.ADMIN_LOGIN_LOCK_MINUTES * 60 * 1000);
    await prisma.adminCredential.update({
      where: { adminCredentialId },
      data: { lockedUntil },
    });
  }
}

/**
 * POST /admin/auth/login/start
 * Body: { email, password }
 */
export async function adminPasswordLoginStart(req: Request, res: Response) {
  const parsed = loginStartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      userId: true,
      email: true,
      role: true,
      status: true,
      adminCredential: {
        select: {
          adminCredentialId: true,
          passwordHash: true,
          passwordAlgo: true,
          failedAttempts: true,
          lockedUntil: true,
        },
      },
    },
  });

  if (!user || user.role !== "ADMIN") {
    await auditFromReq(prisma, req, {
      userId: user?.userId ?? null,
      actorId: user?.userId ?? null,
      eventType: "ADMIN.LOGIN.START.FAIL",
      detailsJson: { reason: "NOT_ADMIN" },
    });
    return res.status(403).json({ error: "Admin access required" });
  }

  if (user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.LOGIN.START.FAIL",
      detailsJson: { reason: "USER_NOT_ACTIVE" },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  const credential = user.adminCredential;
  if (!credential) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.LOGIN.START.FAIL",
      detailsJson: { reason: "NO_CREDENTIAL" },
    });
    return res.status(403).json({ error: "Admin credentials unavailable" });
  }

  if (credential.lockedUntil && credential.lockedUntil > now) {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.LOGIN.START.FAIL",
      detailsJson: { reason: "LOCKED_OUT", lockedUntil: credential.lockedUntil.toISOString() },
    });
    return res.status(423).json({ error: "Account temporarily locked" });
  }

  if (credential.passwordAlgo !== "argon2id") {
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.LOGIN.START.FAIL",
      detailsJson: { reason: "UNSUPPORTED_PASSWORD_ALGO", algo: credential.passwordAlgo },
    });
    return res.status(400).json({ error: "Unsupported password algorithm" });
  }

  const passwordOk = await argon2.verify(credential.passwordHash, parsed.data.password);
  if (!passwordOk) {
    await incrementFailedAttempts(credential.adminCredentialId, now);
    await auditFromReq(prisma, req, {
      userId: user.userId,
      actorId: user.userId,
      eventType: "ADMIN.LOGIN.START.FAIL",
      detailsJson: { reason: "BAD_PASSWORD" },
    });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const otpCode = generateOtpCode();
  const tokenHash = hashOtp(user.userId, otpCode);
  const expiresAt = new Date(now.getTime() + env.ADMIN_OTP_TTL_MS);

  await prisma.recoveryToken.create({
    data: {
      userId: user.userId,
      tokenHash,
      tokenType: "ADMIN_EMAIL_OTP",
      expiresAt,
    },
  });

  await sendAdminOtpEmail(user.email, otpCode);

  await regenerateSession(req);
  delete req.session.userId;
  delete req.session.role;

  req.session.adminOtpLogin = {
    userId: user.userId,
    stage: "OTP_REQUIRED",
    createdAt: nowIso(),
  };

  await auditFromReq(prisma, req, {
    userId: user.userId,
    actorId: user.userId,
    eventType: "ADMIN.LOGIN.START.OK",
    detailsJson: { otpExpiresAt: expiresAt.toISOString() },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true });
}

/**
 * POST /admin/auth/login/verify-otp
 * Body: { otp }
 */
export async function adminPasswordLoginVerifyOtp(req: Request, res: Response) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const pending = req.session.adminOtpLogin;
  if (!pending?.userId || pending.stage !== "OTP_REQUIRED") {
    return res.status(400).json({ error: "No pending admin login" });
  }

  const createdAt = new Date(pending.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    delete req.session.adminOtpLogin;
    return res.status(400).json({ error: "Invalid pending session" });
  }

  if (Date.now() - createdAt.getTime() > env.ADMIN_OTP_TTL_MS) {
    delete req.session.adminOtpLogin;
    return res.status(401).json({ error: "OTP session expired" });
  }

  const user = await prisma.user.findUnique({
    where: { userId: pending.userId },
    select: {
      userId: true,
      role: true,
      status: true,
      adminCredential: { select: { adminCredentialId: true } },
    },
  });

  if (!user || user.role !== "ADMIN") {
    await auditFromReq(prisma, req, {
      userId: pending.userId,
      actorId: pending.userId,
      eventType: "ADMIN.LOGIN.OTP.FAIL",
      detailsJson: { reason: "NOT_ADMIN" },
    });
    return res.status(403).json({ error: "Admin access required" });
  }

  if (user.status !== "ACTIVE") {
    await auditFromReq(prisma, req, {
      userId: pending.userId,
      actorId: pending.userId,
      eventType: "ADMIN.LOGIN.OTP.FAIL",
      detailsJson: { reason: "USER_NOT_ACTIVE" },
    });
    return res.status(403).json({ error: "Account is not active" });
  }

  if (!user.adminCredential) {
    await auditFromReq(prisma, req, {
      userId: pending.userId,
      actorId: pending.userId,
      eventType: "ADMIN.LOGIN.OTP.FAIL",
      detailsJson: { reason: "NO_CREDENTIAL" },
    });
    return res.status(403).json({ error: "Admin credentials unavailable" });
  }

  const tokenHash = hashOtp(pending.userId, parsed.data.otp);
  const now = new Date();

  const token = await prisma.recoveryToken.findFirst({
    where: {
      userId: pending.userId,
      tokenHash,
      tokenType: "ADMIN_EMAIL_OTP",
      usedAt: null,
      expiresAt: { gt: now },
    },
    select: { tokenId: true },
  });

  if (!token) {
    await auditFromReq(prisma, req, {
      userId: pending.userId,
      actorId: pending.userId,
      eventType: "ADMIN.LOGIN.OTP.FAIL",
      detailsJson: { reason: "OTP_INVALID" },
    });
    return res.status(401).json({ error: "Invalid or expired code" });
  }

  await prisma.$transaction([
    prisma.recoveryToken.update({
      where: { tokenId: token.tokenId },
      data: { usedAt: now },
    }),
    prisma.adminCredential.update({
      where: { adminCredentialId: user.adminCredential.adminCredentialId },
      data: { failedAttempts: 0, lockedUntil: null },
    }),
    prisma.user.update({
      where: { userId: pending.userId },
      data: { lastLoginAt: now },
    }),
  ]);

  await regenerateSession(req);
  req.session.userId = pending.userId;
  req.session.role = "ADMIN";
  delete req.session.adminOtpLogin;

  await auditFromReq(prisma, req, {
    userId: pending.userId,
    actorId: pending.userId,
    eventType: "ADMIN.LOGIN.OTP.OK",
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true });
}

/**
 * POST /admin/auth/logout
 */
export async function adminLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Failed to logout" });

    res.clearCookie(env.SESSION_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
      sameSite: env.COOKIE_SAMESITE,
    });

    return res.json({ ok: true });
  });
}
