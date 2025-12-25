// src/routes/auth.device.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

import {
  bindDevice,
  listDevices,
  deleteDevice,
  getDeviceWrappedDek,
} from "../controllers/auth.device.controller.js";

export const authDeviceRouter = Router();

// Protect the whole router
authDeviceRouter.use(requireAuth);

/**
 * Device-binding (DEK per device)
 * POST   /auth/device/bind
 * GET    /auth/device/list
 * DELETE /auth/device/:deviceId
 */

authDeviceRouter.post("/bind", bindDevice);
authDeviceRouter.get("/list", listDevices);
authDeviceRouter.get("/:deviceId/wrapped-dek", getDeviceWrappedDek);
authDeviceRouter.delete("/:deviceId", deleteDevice);
