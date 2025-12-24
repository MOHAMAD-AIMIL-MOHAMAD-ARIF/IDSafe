import { apiClient } from "./index";

export type RegisterStartResponse = {
  ok: true;
  options: unknown;
};

export type RegisterFinishResponse = {
  ok: true;
  credentialId: number;
};

export type RecoveryDataRequest = {
  wrappedVaultKey: string;
  salt: string;
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
};

export type RecoveryDataResponse = {
  ok: true;
  recoveryId: number;
  updatedAt: string;
};

export type DeviceBindRequest = {
  devicePublicKey: string;
  deviceLabel?: string;
  wrappedDEK: string;
};

export type DeviceBindResponse = {
  ok: true;
  device: {
    deviceId: number;
    deviceLabel: string | null;
  };
};

export async function startPasskeyRegistration(email: string): Promise<RegisterStartResponse> {
  return apiClient.post<RegisterStartResponse>("/auth/webauthn/register/start", { email });
}

export async function finishPasskeyRegistration(credential: unknown): Promise<RegisterFinishResponse> {
  return apiClient.post<RegisterFinishResponse>("/auth/webauthn/register/finish", { credential });
}

export async function uploadRecoveryData(payload: RecoveryDataRequest): Promise<RecoveryDataResponse> {
  return apiClient.post<RecoveryDataResponse>("/recovery/data", payload);
}

export async function bindDevice(payload: DeviceBindRequest): Promise<DeviceBindResponse> {
  return apiClient.post<DeviceBindResponse>("/auth/device/bind", payload);
}
