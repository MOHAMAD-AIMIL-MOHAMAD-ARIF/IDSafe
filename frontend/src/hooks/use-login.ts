"use client";

import { useCallback, useMemo, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useAuthContext } from "@/components/auth/auth-provider";
import { finishWebauthnLogin, startWebauthnLogin } from "@/lib/api/auth";
import { fetchDeviceWrappedDek } from "@/lib/api/device";
import { loadDeviceId, loadDevicePrivateKeyJwk, storeDekBytes } from "@/lib/storageService.client";
import { importDevicePrivateKey, unwrapDekForDevice } from "@/crypto/deviceBinding";
import { routes } from "@/lib/config/routes";

export type LoginPhase = "form" | "authenticating" | "unlocking" | "locked";

function isPasskeyCancelError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return name === "NotAllowedError" || message.toLowerCase().includes("not allowed");
}

type UnlockResult = { ok: true } | { ok: false; reason: string };

async function unlockVaultOnDevice(): Promise<UnlockResult> {
  const deviceId = await loadDeviceId();
  if (!deviceId) {
    return {
      ok: false,
      reason:
        "This device does not have a bound vault key. Use account recovery to re-bind this device.",
    };
  }

  let wrappedDek: string;
  try {
    const response = await fetchDeviceWrappedDek(deviceId);
    wrappedDek = response.wrappedDEK;
  } catch {
    return {
      ok: false,
      reason:
        "We could not retrieve the device-bound vault key. Start recovery to re-bind this device.",
    };
  }

  const privateKeyJwk = await loadDevicePrivateKeyJwk();
  if (!privateKeyJwk) {
    return {
      ok: false,
      reason:
        "We could not find the device key needed to unlock your vault. Start recovery to re-bind.",
    };
  }

  try {
    const privateKey = await importDevicePrivateKey(privateKeyJwk);
    const dekBytes = await unwrapDekForDevice({ wrappedDek, devicePrivateKey: privateKey });
    await storeDekBytes(dekBytes);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason:
        "Your vault is locked on this device. Complete recovery to unwrap the vault key here.",
    };
  }
}

export function useLoginFlow() {
  const router = useRouter();
  const { refresh } = useAuthContext();
  const [phase, setPhase] = useState<LoginPhase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLogin = useCallback(
    async (email: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setLockedReason(null);
      setPhase("authenticating");

      try {
        const { options } = await startWebauthnLogin(email);
        const credential = await startAuthentication(
          options as Parameters<typeof startAuthentication>[0],
        );
        await finishWebauthnLogin(credential);

        setPhase("unlocking");
        const unlockResult = await unlockVaultOnDevice();
        if (!unlockResult.ok) {
          setLockedReason(unlockResult.reason);
          setPhase("locked");
          return;
        }

        await refresh();
        router.push(routes.vault);
      } catch (error) {
        setPhase("form");
        if (isPasskeyCancelError(error)) {
          setErrorMessage("Passkey prompt was dismissed. Try again when you're ready.");
          return;
        }
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Login failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh,router],
  );

  const value = useMemo(
    () => ({
      phase,
      errorMessage,
      lockedReason,
      isSubmitting,
      submitLogin,
    }),
    [errorMessage, isSubmitting, lockedReason, phase, submitLogin],
  );

  return value;
}
