// frontend/src/api/recovery.ts
import { apiClient } from "@/lib/api";

export type RecoveryParamsResponse = {
  ok: true;
  wrappedVaultKey: string;
  salt: string; // base64
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
};

export type RecoveryRequestResponse = {
  ok: true;
};

export type RecoveryDeviceBindRequest = {
  kdfVerified: boolean;
  kdfMs?: number;
  devicePublicKey: string;
  deviceLabel?: string;
  wrappedDEK: string;
};

export type RecoveryDeviceBindResponse = {
  ok: true;
  deviceId: number;
};

/**
 * Calls GET /recovery/params using cookie session (credentials included).
 */
export async function fetchRecoveryParams(): Promise<RecoveryParamsResponse> {
  return apiClient.get<RecoveryParamsResponse>("/recovery/params", { cache: "no-store" });
}

/**
 * Calls POST /recovery/request with email.
 */
export async function requestRecoveryMagicLink(email: string): Promise<RecoveryRequestResponse> {
  return apiClient.post<RecoveryRequestResponse>("/recovery/request", { email });
}

/**
 * Calls POST /recovery/bind during recovery session to bind a device key.
 */
export async function submitRecoveryDeviceBinding(
  payload: RecoveryDeviceBindRequest,
): Promise<RecoveryDeviceBindResponse> {
  return apiClient.post<RecoveryDeviceBindResponse>("/recovery/bind", payload);
}
