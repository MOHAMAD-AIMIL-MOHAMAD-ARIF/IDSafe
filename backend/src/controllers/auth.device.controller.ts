// src/controllers/auth.device.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const bindSchema = z.object({
  devicePublicKey: z.string().min(1),
  deviceLabel: z.string().min(1).max(64).optional(),
  wrappedDEK: z.string().min(1),
});

/**
 * POST /auth/device/bind (requires requireAuth at router-level)
 */
export async function bindDevice(req: Request, res: Response) {
  const userId = req.session.userId!;
  const parsed = bindSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { devicePublicKey, deviceLabel, wrappedDEK } = parsed.data;

  const device = await prisma.deviceKey.create({
    data: {
      userId,
      devicePublicKey,
      deviceLabel: deviceLabel ?? null,
      wrappedDEK,
    },
    select: {
      deviceId: true,
      createdAt: true,
      lastUsedAt: true,
      deviceLabel: true,
    },
  });

  return res.status(201).json({ ok: true, device });
}

/**
 * GET /auth/device/list (requires requireAuth)
 */
export async function listDevices(req: Request, res: Response) {
  const userId = req.session.userId!;
  const devices = await prisma.deviceKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      deviceId: true,
      deviceLabel: true,
      createdAt: true,
      lastUsedAt: true,
      // do NOT return devicePublicKey or wrappedDEK unless you explicitly need it
    },
  });

  return res.json({ devices });
}

/**
 * DELETE /auth/device/:deviceId (requires requireAuth)
 */
export async function deleteDevice(req: Request, res: Response) {
  const userId = req.session.userId!;
  const deviceId = Number(req.params.deviceId);

  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    return res.status(400).json({ error: "Invalid deviceId" });
  }

  const existing = await prisma.deviceKey.findFirst({
    where: { deviceId, userId },
    select: { deviceId: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "Device not found" });
  }

  await prisma.deviceKey.delete({ where: { deviceId } });

  return res.json({ ok: true, deviceId });
}
