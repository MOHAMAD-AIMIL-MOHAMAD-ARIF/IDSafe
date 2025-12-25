"use client";

import { useCallback, useMemo, useState } from "react";
import {
  createVaultEntry as apiCreateVaultEntry,
  deleteVaultEntry as apiDeleteVaultEntry,
  listVaultEntries,
  updateVaultEntry as apiUpdateVaultEntry,
} from "@/lib/api/vault";
import { ApiError } from "@/lib/api/client";
import {
  decryptVaultEntryJsonWithDek,
  encryptVaultEntryJsonWithDek,
} from "@/crypto/cryptoService.client";
import { loadDekBytes } from "@/lib/storageService.client";
import type { VaultEntryForm, VaultEntryRecord, VaultEntryView } from "@/types/vault";

type VaultStatus = "idle" | "loading" | "ready" | "error";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

function toPlainEntry(record: VaultEntryRecord, decrypted: VaultEntryForm): VaultEntryView {
  return {
    ...decrypted,
    entryId: record.entryId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function useVaultEntries() {
  const [entries, setEntries] = useState<VaultEntryView[]>([]);
  const [status, setStatus] = useState<VaultStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    setWarningMessage(null);

    const dekBytes = await loadDekBytes();
    if (!dekBytes) {
      setStatus("error");
      setWarningMessage(
        "Vault key not found on this device. Sign in again or complete recovery to unlock entries.",
      );
      setEntries([]);
      return;
    }

    try {
      const response = await listVaultEntries();
      const decryptedEntries: VaultEntryView[] = [];
      for (const record of response.entries) {
        try {
          const decrypted = await decryptVaultEntryJsonWithDek<VaultEntryForm>({
            dek: dekBytes,
            fields: {
              ciphertextBlob: record.ciphertextBlob,
              iv: record.iv,
              authTag: record.authTag,
            },
          });
          decryptedEntries.push(toPlainEntry(record, decrypted));
        } catch (error) {
          setWarningMessage(
            "Some entries could not be decrypted on this device. Try logging in again or recovering your vault key.",
          );
        }
      }
      setEntries(decryptedEntries);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, []);

  const createEntry = useCallback(async (entry: VaultEntryForm) => {
    setErrorMessage(null);
    const dekBytes = await loadDekBytes();
    if (!dekBytes) {
      throw new Error(
        "Vault key not available. Sign in again or complete account recovery to create entries.",
      );
    }

    const encrypted = await encryptVaultEntryJsonWithDek({
      dek: dekBytes,
      value: entry,
    });

    const response = await apiCreateVaultEntry({
      ciphertextBlob: encrypted.ciphertextBlob,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      metadataJson: encrypted.metadataJson,
    });

    const view = toPlainEntry(response.entry, entry);
    setEntries((prev) => [view, ...prev]);
    setStatus("ready");
    return view;
  }, []);

  const updateEntry = useCallback(async (entryId: number, entry: VaultEntryForm) => {
    setErrorMessage(null);
    const dekBytes = await loadDekBytes();
    if (!dekBytes) {
      throw new Error(
        "Vault key not available. Sign in again or complete account recovery to update entries.",
      );
    }

    const encrypted = await encryptVaultEntryJsonWithDek({
      dek: dekBytes,
      value: entry,
    });

    const response = await apiUpdateVaultEntry(entryId, {
      ciphertextBlob: encrypted.ciphertextBlob,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      metadataJson: encrypted.metadataJson,
    });

    const view = toPlainEntry(response.entry, entry);
    setEntries((prev) => prev.map((item) => (item.entryId === entryId ? view : item)));
    setStatus("ready");
    return view;
  }, []);

  const deleteEntry = useCallback(async (entryId: number) => {
    setErrorMessage(null);
    await apiDeleteVaultEntry(entryId);
    setEntries((prev) => prev.filter((item) => item.entryId !== entryId));
    setStatus("ready");
  }, []);

  const value = useMemo(
    () => ({
      entries,
      status,
      errorMessage,
      warningMessage,
      loadEntries,
      createEntry,
      updateEntry,
      deleteEntry,
    }),
    [entries, status, errorMessage, warningMessage, loadEntries, createEntry, updateEntry, deleteEntry],
  );

  return value;
}
