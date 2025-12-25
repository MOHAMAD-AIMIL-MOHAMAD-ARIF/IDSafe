import { apiClient } from "./index";
import type { VaultEntryCiphertextPayload, VaultEntryRecord } from "@/types/vault";

type VaultEntriesResponse = {
  ok: true;
  entries: VaultEntryRecord[];
};

type VaultEntryResponse = {
  ok: true;
  entry: VaultEntryRecord;
};

export async function listVaultEntries(includeDeleted = false): Promise<VaultEntriesResponse> {
  const query = includeDeleted ? "?includeDeleted=true" : "";
  return apiClient.get<VaultEntriesResponse>(`/vault/entries${query}`, { cache: "no-store" });
}

export async function createVaultEntry(
  payload: VaultEntryCiphertextPayload,
): Promise<VaultEntryResponse> {
  return apiClient.post<VaultEntryResponse>("/vault/entries", payload);
}

export async function updateVaultEntry(
  entryId: number,
  payload: Partial<VaultEntryCiphertextPayload>,
): Promise<VaultEntryResponse> {
  return apiClient.put<VaultEntryResponse>(`/vault/entries/${entryId}`, payload);
}

export async function deleteVaultEntry(entryId: number): Promise<void> {
  await apiClient.delete(`/vault/entries/${entryId}`);
}
