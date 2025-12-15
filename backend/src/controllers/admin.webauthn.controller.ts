// src/controllers/admin.webauthn.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const POLICY_KEYS = {
  attestationMode: "webauthn.attestation.mode",
  authenticatorAttachment: "webauthn.authenticatorAttachment",
  userVerification: "webauthn.userVerification",
  allowedAttestationFormats: "webauthn.allowedAttestationFormats",
  allowedAAGUIDs: "webauthn.allowedAAGUIDs",
  trustedAttestationRoots: "webauthn.trustedAttestationRoots",
} as const;

function tryJson<T>(v: string, fallback: T): T {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/**
 * GET /admin/webauthn/credentials (requires requireAdmin at router-level)
 */
export async function adminListCredentials(_req: Request, res: Response) {
  const credentials = await prisma.webauthnCredential.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      credentialId: true,
      userId: true,
      externalCredentialId: true,
      aaguid: true,
      attestationFormat: true,
      signCount: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      user: { select: { email: true } },
    },
  });

  return res.json({ credentials });
}

/**
 * GET /admin/webauthn/policy (requires requireAdmin)
 */
export async function adminGetPolicy(_req: Request, res: Response) {
  const keys = Object.values(POLICY_KEYS);

  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: keys } },
    select: { configKey: true, configValue: true, updatedAt: true, updatedByUserId: true },
  });

  const map = new Map(rows.map((r) => [r.configKey, r.configValue]));

  const policy = {
    attestationMode: map.get(POLICY_KEYS.attestationMode) ?? "direct",
    authenticatorAttachment: map.get(POLICY_KEYS.authenticatorAttachment) ?? "platform",
    userVerification: map.get(POLICY_KEYS.userVerification) ?? "required",
    allowedAttestationFormats: tryJson<string[]>(
      map.get(POLICY_KEYS.allowedAttestationFormats) ?? "[]",
      [],
    ),
    allowedAAGUIDs: tryJson<string[]>(map.get(POLICY_KEYS.allowedAAGUIDs) ?? "[]", []),
    trustedAttestationRoots: tryJson<string[]>(
      map.get(POLICY_KEYS.trustedAttestationRoots) ?? "[]",
      [],
    ),
  };

  return res.json({ policy });
}

const updatePolicySchema = z.object({
  attestationMode: z.string().min(1).optional(),
  authenticatorAttachment: z.string().min(1).optional(),
  userVerification: z.string().min(1).optional(),
  allowedAttestationFormats: z.array(z.string()).optional(),
  allowedAAGUIDs: z.array(z.string()).optional(),
  trustedAttestationRoots: z.array(z.string()).optional(),
});

/**
 * PUT /admin/webauthn/policy (requires requireAdmin)
 */
export async function adminUpdatePolicy(req: Request, res: Response) {
  const adminUserId = req.session.userId!;
  const parsed = updatePolicySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const p = parsed.data;

  const updates: Array<{ key: string; value: string }> = [];

  if (p.attestationMode !== undefined)
    updates.push({ key: POLICY_KEYS.attestationMode, value: p.attestationMode });

  if (p.authenticatorAttachment !== undefined)
    updates.push({ key: POLICY_KEYS.authenticatorAttachment, value: p.authenticatorAttachment });

  if (p.userVerification !== undefined)
    updates.push({ key: POLICY_KEYS.userVerification, value: p.userVerification });

  if (p.allowedAttestationFormats !== undefined)
    updates.push({
      key: POLICY_KEYS.allowedAttestationFormats,
      value: JSON.stringify(p.allowedAttestationFormats),
    });

  if (p.allowedAAGUIDs !== undefined)
    updates.push({ key: POLICY_KEYS.allowedAAGUIDs, value: JSON.stringify(p.allowedAAGUIDs) });

  if (p.trustedAttestationRoots !== undefined)
    updates.push({
      key: POLICY_KEYS.trustedAttestationRoots,
      value: JSON.stringify(p.trustedAttestationRoots),
    });

  // Upsert each config key
  for (const u of updates) {
    await prisma.systemConfig.upsert({
      where: { configKey: u.key },
      create: {
        configKey: u.key,
        configValue: u.value,
        updatedByUserId: adminUserId,
      },
      update: {
        configValue: u.value,
        updatedByUserId: adminUserId,
        updatedAt: new Date(),
      },
    });
  }

  // Return the latest policy
  return adminGetPolicy(req, res);
}
