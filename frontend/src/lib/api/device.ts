import { apiClient } from "./index";

export type DeviceWrappedDekResponse = {
  ok: true;
  wrappedDEK: string;
};

export async function fetchDeviceWrappedDek(deviceId: number): Promise<DeviceWrappedDekResponse> {
  return apiClient.get<DeviceWrappedDekResponse>(`/auth/device/${deviceId}/wrapped-dek`, {
    cache: "no-store",
  });
}
