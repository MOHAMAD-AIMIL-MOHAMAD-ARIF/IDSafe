// src/controllers/auth.account.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

/**
 * GET /auth/account/profile (requires requireAuth)
 */
export async function getAccountProfile(req: Request, res: Response) {
  const userId = req.session.userId!;

  if (req.session.role !== "END_USER") {
    return res.status(403).json({ error: "End-user profile only" });
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    profile: {
      userId: user.userId,
      email: user.email,
      registrationDate: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
}
