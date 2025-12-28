import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  adminGetWebAuthnConfig,
  adminUpdateWebAuthnConfig,
} from "../controllers/admin.config.webauthn.controller.js";

export const adminConfigRouter = Router();

adminConfigRouter.use(requireAdmin);

adminConfigRouter.get("/webauthn", adminGetWebAuthnConfig);
adminConfigRouter.put("/webauthn", adminUpdateWebAuthnConfig);
