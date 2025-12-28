// src/controllers/admin.users.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { pool, prisma } from "../db.js";

const userStatusSchema = z.enum(["ACTIVE", "LOCKED", "DEACTIVATED"]);

const userQuerySchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
});

function parseUserId(raw: string | undefined) {
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }
  return userId;
}

/**
 * GET /admin/users
 * Returns non-sensitive metadata for all users.
 */
export async function adminListUsers(_req: Request, res: Response) {
  const parsed = userQuerySchema.safeParse(_req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { query, status } = parsed.data;
  const normalizedStatus = status?.toUpperCase();
  const mappedStatus =
    normalizedStatus === "SUSPENDED" ? "DEACTIVATED" : normalizedStatus;
  const statusValue = userStatusSchema.safeParse(mappedStatus);

  if (status && !statusValue.success) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const search = query?.trim();
  const userId = search && Number.isInteger(Number(search)) ? Number(search) : undefined;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    where: {
      ...(statusValue.success ? { status: statusValue.data } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              ...(userId ? [{ userId }] : []),
            ],
          }
        : {}),
    },
    select: {
      userId: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
      status: true,
    },
  });

  const credentialCounts = await prisma.webauthnCredential.groupBy({
    by: ["userId"],
    where: { isActive: true },
    _count: { _all: true },
  });

  const countByUserId = new Map(
    credentialCounts.map((row) => [row.userId, row._count._all]),
  );

  const payload = users.map((user) => ({
    userId: user.userId,
    email: user.email,
    registrationDate: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    status: user.status,
    activeCredentialCount: countByUserId.get(user.userId) ?? 0,
  }));

  return res.json({ users: payload });
}

const updateStatusSchema = z.object({
  status: userStatusSchema,
});

/**
 * PATCH /admin/users/:userId/status
 * Update user status (ACTIVE, LOCKED, DEACTIVATED).
 */
export async function adminUpdateUserStatus(req: Request, res: Response) {
  const userId = parseUserId(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updated = await prisma.user.update({
    where: { userId },
    data: { status: parsed.data.status },
    select: {
      userId: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });

  return res.json({ user: updated });
}

/**
 * POST /admin/users/:userId/sessions/invalidate
 * Invalidate all sessions for a user.
 */
export async function adminInvalidateUserSessions(req: Request, res: Response) {
  const userId = parseUserId(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const result = await pool.query(
    'DELETE FROM "session" WHERE sess->>\'userId\' = $1',
    [String(userId)],
  );

  return res.json({ userId, invalidatedSessions: result.rowCount });
}
