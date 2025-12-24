// frontend/src/api/recovery.ts
import { apiClient } from "@/lib/api";

export type RecoveryParamsResponse = {
  wrappedVaultKey: string;
  salt: string; // base64
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
};

/**
 * Calls GET /recovery/params using cookie session (credentials included).
 */
export async function fetchRecoveryParams(): Promise<RecoveryParamsResponse> {
  return apiClient.get<RecoveryParamsResponse>("/recovery/params", { cache: "no-store" });
}
