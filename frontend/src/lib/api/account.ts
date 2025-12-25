import { apiClient } from "./index";
import type { AccountProfile, DeviceBinding, WebauthnCredential } from "@/types/account";

export type AccountProfileResponse = {
  profile: AccountProfile;
};

export type CredentialListResponse = {
  credentials: WebauthnCredential[];
};

export type DeviceListResponse = {
  devices: DeviceBinding[];
};

export async function fetchAccountProfile(): Promise<AccountProfileResponse> {
  return apiClient.get<AccountProfileResponse>("/auth/account/profile", { cache: "no-store" });
}

export async function listWebauthnCredentials(): Promise<CredentialListResponse> {
  return apiClient.get<CredentialListResponse>("/auth/webauthn/credentials", { cache: "no-store" });
}

export async function deleteWebauthnCredential(credentialId: number) {
  return apiClient.delete<{ ok: true; credentialId: number }>(
    `/auth/webauthn/credentials/${credentialId}`,
  );
}

export async function listDeviceBindings(): Promise<DeviceListResponse> {
  return apiClient.get<DeviceListResponse>("/auth/device/list", { cache: "no-store" });
}

export async function deleteDeviceBinding(deviceId: number) {
  return apiClient.delete<{ ok: true; deviceId: number }>(`/auth/device/${deviceId}`);
}

export async function updateRecoveryData(payload: {
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
