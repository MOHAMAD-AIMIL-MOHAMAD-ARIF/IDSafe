"use client";

import { useCallback, useMemo, useState } from "react";
import {
  deleteDeviceBinding,
  deleteWebauthnCredential,
  fetchAccountProfile,
  listDeviceBindings,
  listWebauthnCredentials,
  updateRecoveryData,
} from "@/lib/api/account";
import type { AccountProfile, DeviceBinding, WebauthnCredential } from "@/types/account";
import { ApiError } from "@/lib/api/client";
import { loadDekBytes } from "@/lib/storageService.client";
import { wrapVaultKeyWithPassphrase } from "@/crypto/recoveryWrap";

const DEFAULT_KDF_PARAMS = {
  timeCost: 3,
  memoryCostKiB: 65536,
  parallelism: 1,
};

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function generateSaltB64(size = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return bytesToB64(bytes);
}

export type AccountStatus = "idle" | "loading" | "ready" | "error";

export function useAccount() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [credentials, setCredentials] = useState<WebauthnCredential[]>([]);
  const [devices, setDevices] = useState<DeviceBinding[]>([]);
  const [status, setStatus] = useState<AccountStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const [profileResponse, credentialResponse, deviceResponse] = await Promise.all([
        fetchAccountProfile(),
        listWebauthnCredentials(),
        listDeviceBindings(),
      ]);

      setProfile(profileResponse.profile);
      setCredentials(credentialResponse.credentials);
      setDevices(deviceResponse.devices);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, []);

  const removeCredential = useCallback(async (credentialId: number) => {
    setErrorMessage(null);
    await deleteWebauthnCredential(credentialId);
    setCredentials((prev) => prev.filter((cred) => cred.credentialId !== credentialId));
  }, []);

  const removeDeviceBinding = useCallback(async (deviceId: number) => {
    setErrorMessage(null);
    await deleteDeviceBinding(deviceId);
    setDevices((prev) => prev.filter((device) => device.deviceId !== deviceId));
  }, []);

  const changeRecoveryPassphrase = useCallback(async (passphrase: string) => {
    setErrorMessage(null);

    const dekBytes = await loadDekBytes();
    if (!dekBytes) {
      throw new Error(
        "Vault key not found on this device. Sign in again or complete recovery before changing your passphrase.",
      );
    }

    const salt = generateSaltB64();
    const { wrappedVaultKey } = await wrapVaultKeyWithPassphrase({
      passphrase,
      vaultKeyBytes: dekBytes,
      kdf: {
        saltB64: salt,
        timeCost: DEFAULT_KDF_PARAMS.timeCost,
        memoryCostKiB: DEFAULT_KDF_PARAMS.memoryCostKiB,
        parallelism: DEFAULT_KDF_PARAMS.parallelism,
      },
    });

    await updateRecoveryData({
      wrappedVaultKey,
      salt,
      timeCost: DEFAULT_KDF_PARAMS.timeCost,
      memoryCostKiB: DEFAULT_KDF_PARAMS.memoryCostKiB,
      parallelism: DEFAULT_KDF_PARAMS.parallelism,
    });
  }, []);

  const value = useMemo(
    () => ({
      profile,
      credentials,
      devices,
      status,
      errorMessage,
      loadAccount,
      removeCredential,
      removeDeviceBinding,
      changeRecoveryPassphrase,
    }),
    [
      profile,
      credentials,
      devices,
      status,
      errorMessage,
      loadAccount,
      removeCredential,
      removeDeviceBinding,
      changeRecoveryPassphrase,
    ],
  );

  return value;
}
