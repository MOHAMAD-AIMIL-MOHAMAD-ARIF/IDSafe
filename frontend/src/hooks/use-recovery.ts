"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { deriveKek256 } from "@/crypto/kdfService.client";
import { unwrapVaultKeyBytes } from "@/crypto/recoveryUnwrap";
import {
  exportPrivateKeyJwk,
  exportPublicKeyJwk,
  generateDeviceKeyPair,
  wrapDekForDevice,
} from "@/crypto/deviceBinding";
import {
  fetchRecoveryParams,
  submitRecoveryDeviceBinding,
  verifyRecoveryMagicLink,
  type RecoveryParamsResponse,
} from "@/api/recovery";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/config/routes";
import {
  finishRecoveryPasskeyRegistration,
  startRecoveryPasskeyRegistration,
} from "@/lib/api/auth";
import { storeDeviceId, storeDevicePrivateKeyJwk } from "@/lib/storageService.client";

export type RecoveryPhase = "loading" | "form" | "recovering" | "passkey" | "complete" | "error";

export type RecoveryStepStatus = "pending" | "in_progress" | "completed" | "error";

export type RecoveryStep = {
  id:
    | "deriveKek"
    | "unwrapVaultKey"
    | "generateDeviceKey"
    | "wrapVaultKey"
    | "storeDeviceKey"
    | "registerPasskey";
  label: string;
  status: RecoveryStepStatus;
};

function createDefaultSteps(): RecoveryStep[] {
  return [
    { id: "deriveKek", label: "Derive KEK with Argon2id", status: "pending" },
    { id: "unwrapVaultKey", label: "Decrypt vault key with KEK", status: "pending" },
    { id: "generateDeviceKey", label: "Generate new device keypair", status: "pending" },
    { id: "wrapVaultKey", label: "Re-wrap vault key for this device", status: "pending" },
    { id: "storeDeviceKey", label: "Store new device binding in IDSafe", status: "pending" },
    { id: "registerPasskey", label: "Register a new passkey", status: "pending" },
  ];
}

function isPasskeyCancelError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return name === "NotAllowedError" || message.toLowerCase().includes("not allowed");
}

export function useRecoveryFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [phase, setPhase] = useState<RecoveryPhase>("loading");
  const [recoveryParams, setRecoveryParams] = useState<RecoveryParamsResponse | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [steps, setSteps] = useState<RecoveryStep[]>(() => createDefaultSteps());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [isRecoveryCompleted, setIsRecoveryCompleted] = useState(false);

  const updateStepStatus = useCallback((id: RecoveryStep["id"], status: RecoveryStepStatus) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status } : step)),
    );
  }, []);

  const resetSteps = useCallback(() => {
    setSteps(createDefaultSteps());
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadParams = async () => {
      try {
        if (token) {
          await verifyRecoveryMagicLink(token);
          router.replace(routes.recovery);
        }
        const response = await fetchRecoveryParams();
        if (!isActive) return;
        setRecoveryParams(response);
        setPhase("form");
      } catch (error) {
        if (!isActive) return;
        setPhase("error");
        if (error instanceof ApiError) {
          setParamsError(error.message);
        } else {
          setParamsError("We couldn't verify your recovery session. Try requesting a new link.");
        }
      }
    };

    void loadParams();
    return () => {
      isActive = false;
    };
  }, [router, token]);

  const registerPasskey = useCallback(async () => {
    updateStepStatus("registerPasskey", "in_progress");
    setIsPasskeyModalOpen(true);
    setErrorMessage(null);

    try {
      const { options } = await startRecoveryPasskeyRegistration();
      const credential = await startRegistration(options as Parameters<typeof startRegistration>[0]);
      await finishRecoveryPasskeyRegistration(credential);
      updateStepStatus("registerPasskey", "completed");
      setPhase("complete");
    } catch (error) {
      updateStepStatus("registerPasskey", "error");
      setPhase("passkey");
      if (isPasskeyCancelError(error)) {
        setErrorMessage("Passkey registration was cancelled. Try again when you're ready.");
      } else if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "Passkey registration failed. Try again.",
        );
      }
    } finally {
      setIsPasskeyModalOpen(false);
    }
  }, [updateStepStatus]);

  const submitRecovery = useCallback(
    async (passphrase: string) => {
      if (!recoveryParams) return;
      setIsSubmitting(true);
      setErrorMessage(null);
      setParamsError(null);
      resetSteps();
      setPhase("recovering");

      try {
        updateStepStatus("deriveKek", "in_progress");
        const kdfStart = performance.now();
        const kekBytes = await deriveKek256(passphrase, {
          saltB64: recoveryParams.salt,
          timeCost: recoveryParams.timeCost,
          memoryCostKiB: recoveryParams.memoryCostKiB,
          parallelism: recoveryParams.parallelism,
          hashLenBytes: 32,
        });
        const kdfMs = Math.round(performance.now() - kdfStart);
        updateStepStatus("deriveKek", "completed");

        updateStepStatus("unwrapVaultKey", "in_progress");
        const vaultKeyBytes = await unwrapVaultKeyBytes(kekBytes, recoveryParams.wrappedVaultKey);
        updateStepStatus("unwrapVaultKey", "completed");

        updateStepStatus("generateDeviceKey", "in_progress");
        const deviceKeyPair = await generateDeviceKeyPair();
        const devicePublicKey = await exportPublicKeyJwk(deviceKeyPair.publicKey);
        const devicePrivateKey = await exportPrivateKeyJwk(deviceKeyPair.privateKey);
        updateStepStatus("generateDeviceKey", "completed");

        updateStepStatus("wrapVaultKey", "in_progress");
        const wrappedDEK = await wrapDekForDevice({
          dekBytes: vaultKeyBytes,
          devicePublicKey: deviceKeyPair.publicKey,
        });
        updateStepStatus("wrapVaultKey", "completed");

        updateStepStatus("storeDeviceKey", "in_progress");
        const response = await submitRecoveryDeviceBinding({
          kdfVerified: true,
          kdfMs,
          devicePublicKey: JSON.stringify(devicePublicKey),
          deviceLabel: "Recovered device",
          wrappedDEK,
        });
        await storeDeviceId(response.deviceId);
        await storeDevicePrivateKeyJwk(devicePrivateKey);
        updateStepStatus("storeDeviceKey", "completed");

        setIsRecoveryCompleted(true);
        setPhase("passkey");
        await registerPasskey();
      } catch (error) {
        setSteps((prev) =>
          prev.map((step) =>
            step.status === "in_progress" ? { ...step, status: "error" } : step,
          ),
        );
        setPhase("form");
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(
            error instanceof Error ? error.message : "Recovery failed. Please try again.",
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [recoveryParams, registerPasskey, resetSteps, updateStepStatus],
  );

  const retryPasskey = useCallback(async () => {
    if (!isRecoveryCompleted) return;
    setPhase("passkey");
    await registerPasskey();
  }, [isRecoveryCompleted, registerPasskey]);

  const value = useMemo(
    () => ({
      phase,
      recoveryParams,
      paramsError,
      steps,
      errorMessage,
      isSubmitting,
      isPasskeyModalOpen,
      isRecoveryCompleted,
      submitRecovery,
      retryPasskey,
    }),
    [
      errorMessage,
      isPasskeyModalOpen,
      isRecoveryCompleted,
      isSubmitting,
      paramsError,
      phase,
      recoveryParams,
      retryPasskey,
      steps,
      submitRecovery,
    ],
  );

  return value;
}
