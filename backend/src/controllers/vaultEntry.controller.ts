// backend/src/controllers/vaultEntry.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import type { Prisma as PrismaTypes } from "../generated/prisma/client.js";
import { auditFromReq } from "../services/auditLogService.js";

const idParamSchema = z.object({
  entryId: z.coerce.number().int().positive(),
});

const createSchema = z.object({
  ciphertextBlob: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  metadataJson: z.unknown().optional().nullable(),
});

const updateSchema = z.object({
  ciphertextBlob: z.string().min(1).optional(),
  iv: z.string().min(1).optional(),
  authTag: z.string().min(1).optional(),
  metadataJson: z.unknown().optional().nullable(),
});

function getUserId(req: Request): number {
  const userId = req.session.userId;
  if (!userId) throw new Error("Unauthenticated"); // should be prevented by requireAuth
  return userId;
}

const selectVaultEntry = {
  entryId: true,
  userId: true,
  ciphertextBlob: true,
  iv: true,
  authTag: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  isDeleted: true,
} as const;

function safeLen(s: string): number {
  return s.length;
}

function didSet<T>(v: T | undefined): boolean {
  return v !== undefined;
}

/**
 * GET /vault/entries?includeDeleted=true|false
 */
export async function listVaultEntries(req: Request, res: Response) {
  const userId = getUserId(req);
  const includeDeleted = String(req.query.includeDeleted ?? "false") === "true";

  const rows = await prisma.vaultEntry.findMany({
    where: {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
    },
    orderBy: { updatedAt: "desc" },
    select: selectVaultEntry,
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, entries: rows });
}

/**
 * GET /vault/entries/:entryId?includeDeleted=true|false
 */
export async function getVaultEntry(req: Request, res: Response) {
  const userId = getUserId(req);

  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid entryId", issues: parsed.error.issues });
  }

  const includeDeleted = String(req.query.includeDeleted ?? "false") === "true";

  const row = await prisma.vaultEntry.findFirst({
    where: {
      entryId: parsed.data.entryId,
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
    },
    select: selectVaultEntry,
  });

  if (!row) {
    await auditFromReq(prisma, req, {
        userId,               // actor is the logged-in user
        actorId: userId,
        eventType: "VAULT.ENTRY.ACCESS.DENIED",
        detailsJson: {
        action: "GET",
        entryId: parsed.data.entryId,
        includeDeleted,
        reason: "NOT_FOUND_OR_NOT_OWNED_OR_DELETED",
        },
    });
    return res.status(404).json({ error: "VaultEntry not found" });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, entry: row });
}

/**
 * POST /vault/entries
 * Body: {ciphertextBlob, iv, authTag, metadataJson?}
 */
export async function createVaultEntry(req: Request, res: Response) {
  const userId = getUserId(req);

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const meta = parsed.data.metadataJson; // unknown | null | undefined
  const metadataValue: PrismaTypes.VaultEntryCreateInput["metadataJson"] | undefined =
  meta === undefined ? undefined
  : meta === null ? Prisma.DbNull
  : (meta as PrismaTypes.InputJsonValue);

  const now = new Date();

  const created = await prisma.vaultEntry.create({
    data: {
      userId,
      ciphertextBlob: parsed.data.ciphertextBlob,
      iv: parsed.data.iv,
      authTag: parsed.data.authTag,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
      ...(metadataValue !== undefined ? { metadataJson: metadataValue } : {}),
    },
    select: selectVaultEntry,
  });

  await auditFromReq(prisma, req, {
    userId,
    actorId: userId,
    eventType: "VAULT.ENTRY.CREATE",
    detailsJson: {
        entryId: created.entryId,
        // Do NOT log ciphertext / iv / authTag content
        ciphertextLen: safeLen(parsed.data.ciphertextBlob),
        ivLen: safeLen(parsed.data.iv),
        authTagLen: safeLen(parsed.data.authTag),
        hasMetadata: meta !== undefined && meta !== null,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(201).json({ ok: true, entry: created });
}

/**
 * PUT /vault/entries/:entryId
 * Body: partial update of {ciphertextBlob, iv, authTag, metadataJson}
 *
 * By default we do NOT allow editing deleted entries.
 */
export async function updateVaultEntry(req: Request, res: Response) {
  const userId = getUserId(req);

  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json({ error: "Invalid entryId", issues: idParsed.error.issues });
  }

  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: bodyParsed.error.issues });
  }

  // Ensure ownership + not deleted
  const existing = await prisma.vaultEntry.findFirst({
    where: { entryId: idParsed.data.entryId, userId: userId, isDeleted: false },
    select: { entryId: true },
  });

  if (!existing) {
    await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "VAULT.ENTRY.ACCESS.DENIED",
        detailsJson: {
        action: "UPDATE",
        entryId: idParsed.data.entryId,
        reason: "NOT_FOUND_OR_NOT_OWNED_OR_DELETED",
        },
    });
    return res.status(404).json({ error: "VaultEntry not found" });
  }

  const now = new Date();

  // Build Prisma update data without any `undefined` properties
  const data: Prisma.VaultEntryUpdateInput = {
    updatedAt: now,
  };

  if (bodyParsed.data.ciphertextBlob !== undefined) data.ciphertextBlob = bodyParsed.data.ciphertextBlob;
  if (bodyParsed.data.iv !== undefined) data.iv = bodyParsed.data.iv;
  if (bodyParsed.data.authTag !== undefined) data.authTag = bodyParsed.data.authTag;
  if (bodyParsed.data.metadataJson !== undefined) {
    data.metadataJson =
      bodyParsed.data.metadataJson === null
        ? Prisma.DbNull
        : (bodyParsed.data.metadataJson as Prisma.InputJsonValue);
  }

  const updated = await prisma.vaultEntry.update({
    where: { entryId: idParsed.data.entryId },
    data,
    select: selectVaultEntry,
  });

  const changedFields = [
    ...(didSet(bodyParsed.data.ciphertextBlob) ? ["ciphertextBlob"] : []),
    ...(didSet(bodyParsed.data.iv) ? ["iv"] : []),
    ...(didSet(bodyParsed.data.authTag) ? ["authTag"] : []),
    ...(bodyParsed.data.metadataJson !== undefined ? ["metadataJson"] : []),
  ];

    await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "VAULT.ENTRY.UPDATE",
        detailsJson: {
            entryId: updated.entryId,
            changedFields,
            // lengths only (never values)
            ciphertextLen: bodyParsed.data.ciphertextBlob ? safeLen(bodyParsed.data.ciphertextBlob) : undefined,
            ivLen: bodyParsed.data.iv ? safeLen(bodyParsed.data.iv) : undefined,
            authTagLen: bodyParsed.data.authTag ? safeLen(bodyParsed.data.authTag) : undefined,
            metadataSet:
            bodyParsed.data.metadataJson === undefined
                ? "unchanged"
                : bodyParsed.data.metadataJson === null
                ? "cleared"
                : "updated",
        },
    });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, entry: updated });
}

/**
 * DELETE /vault/entries/:entryId
 * Soft delete: isDeleted=true, deletedAt=now
 */
export async function softDeleteVaultEntry(req: Request, res: Response) {
  const userId = getUserId(req);

  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid entryId", issues: parsed.error.issues });
  }

  // Ensure ownership + not already deleted
  const existing = await prisma.vaultEntry.findFirst({
    where: { entryId: parsed.data.entryId, userId, isDeleted: false },
    select: { entryId: true },
  });

  if (!existing) {
    await auditFromReq(prisma, req, {
        userId,
        actorId: userId,
        eventType: "VAULT.ENTRY.ACCESS.DENIED",
        detailsJson: {
            action: "DELETE",
            entryId: parsed.data.entryId,
            reason: "NOT_FOUND_OR_NOT_OWNED_OR_ALREADY_DELETED",
        },
    });

    return res.status(404).json({ error: "VaultEntry not found" });
  }

  const now = new Date();

  const updated = await prisma.vaultEntry.update({
    where: { entryId: parsed.data.entryId },
    data: {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    },
    select: selectVaultEntry,
  });

  await auditFromReq(prisma, req, {
    userId,
    actorId: userId,
    eventType: "VAULT.ENTRY.DELETE",
    detailsJson: {
        entryId: updated.entryId,
        softDelete: true,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ ok: true, entry: updated });
}
