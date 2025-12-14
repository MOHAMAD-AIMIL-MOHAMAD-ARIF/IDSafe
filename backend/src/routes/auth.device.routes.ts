// src/routes/auth.device.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

export const authDeviceRouter = Router();

// Protect the whole router
authDeviceRouter.use(requireAuth);

/**
 * Device-binding (DEK per device)
 * POST   /auth/device/bind
 * GET    /auth/device/list
 * DELETE /auth/device/:deviceId
 */

// POST /auth/device/bind
authDeviceRouter.post("/bind", async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: device bind" });
});

// GET /auth/device/list
authDeviceRouter.get("/list", async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: device list" });
});

// DELETE /auth/device/:deviceId
authDeviceRouter.delete("/:deviceId", async (_req, res) => {
  return res.status(501).json({ error: "Not implemented: device delete" });
});
