// src/controllers/auth.device.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

/**
 * POST /auth/device/bind (requires requireAuth at router-level)
 */
export async function bindDevice(req: Request, res: Response) {
  const userId = req.session.userId!;

  // TODO:
  // - validate body: devicePublicKey, deviceLabel?, wrappedDEK
  // - create DeviceKey row
  // - audit log
  return res.status(501).json({ error: "Not implemented: /auth/device/bind", userId });
}

/**
 * GET /auth/device/list (requires requireAuth)
 */
export async function listDevices(req: Request, res: Response) {
  const userId = req.session.userId!;

  // TODO:
  // const devices = await prisma.deviceKey.findMany({ where: { userId } });
  return res.status(501).json({ error: "Not implemented: /auth/device/list", userId });
}

/**
 * DELETE /auth/device/:deviceId (requires requireAuth)
 */
export async function deleteDevice(req: Request, res: Response) {
  const userId = req.session.userId!;
  const deviceIdParam = req.params.deviceId;

  // TODO:
  // - authorize: ensure device belongs to userId
  // - delete/revoke device row
  // - audit log
  return res.status(501).json({
    error: "Not implemented: DELETE /auth/device/:deviceId",
    userId,
    deviceId: deviceIdParam,
  });
}
