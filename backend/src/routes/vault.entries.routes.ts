// backend/src/routes/vault.entries.routes.ts
import { Router } from "express";
import {
  listVaultEntries,
  getVaultEntry,
  createVaultEntry,
  updateVaultEntry,
  softDeleteVaultEntry,
} from "../controllers/vaultEntry.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const vaultEntriesRouter = Router();

// Protect the whole router
vaultEntriesRouter.use(requireAuth);

// /vault/entries
vaultEntriesRouter.get("/", listVaultEntries);
vaultEntriesRouter.post("/", createVaultEntry);

// /vault/entries/:entryId
vaultEntriesRouter.get("/:entryId", getVaultEntry);
vaultEntriesRouter.put("/:entryId", updateVaultEntry);
vaultEntriesRouter.delete("/:entryId", softDeleteVaultEntry);
