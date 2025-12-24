// frontend/src/api/recoveryData.ts
import { apiClient } from "@/lib/api";

export async function postRecoveryData(payload: {
  wrappedVaultKey: string;
  salt: string;
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
}) {
  return apiClient.post<{ ok: true; recoveryId: number; updatedAt: string }>(
    "/recovery/data",
    payload,
  );
}
