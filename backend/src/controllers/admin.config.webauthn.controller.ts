import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { getWebAuthnPolicy, updateWebAuthnPolicy } from "../services/webauthnPolicyService.js";

const webAuthnPolicySchema = z.object({
  rpId: z.string().min(1),
  timeoutMs: z.number().int().min(10000),
  userVerification: z.enum(["required", "preferred", "discouraged"]),
  attestation: z.enum(["none", "direct", "indirect", "enterprise"]),
  residentKey: z.enum(["required", "preferred", "discouraged"]),
});

const webAuthnPolicyPatchSchema = webAuthnPolicySchema.partial();

/**
 * GET /admin/config/webauthn
 */
export async function adminGetWebAuthnConfig(_req: Request, res: Response) {
  const policy = await getWebAuthnPolicy(prisma);
  return res.json(policy);
}

/**
 * PUT /admin/config/webauthn
 */
export async function adminUpdateWebAuthnConfig(req: Request, res: Response) {
  const adminUserId = req.session.userId!;
  const parsed = webAuthnPolicyPatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  await updateWebAuthnPolicy(prisma, adminUserId, parsed.data);

  const policy = await getWebAuthnPolicy(prisma);
  return res.json(policy);
}
