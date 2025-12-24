"use client";

import { useCallback, useMemo, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { deriveKek256 } from "@/crypto/kdfService.client";
import { wrapVaultKeyWithKek } from "@/crypto/recoveryWrap";
import {
  bindDevice,
  finishPasskeyRegistration,
  startPasskeyRegistration,
  uploadRecoveryData,
} from "@/lib/api/registration";
import { storeDekBytes, storeDevicePrivateKeyJwk } from "@/lib/storageService.client";
import {
  exportPrivateKeyJwk,
  exportPublicKeyJwk,
  generateDeviceKeyPair,
  wrapDekForDevice,
} from "@/crypto/deviceBinding";

export type RegistrationStepStatus = "pending" | "in_progress" | "completed" | "error";

export type RegistrationStep = {
  id:
    | "generateDek"
    | "storeDek"
    | "deriveKek"
    | "wrapDek"
    | "deviceBind";
  label: string;
  status: RegistrationStepStatus;
};

const DEFAULT_KDF_PARAMS = {
  timeCost: 3,
  memoryCostKiB: 65536,
  parallelism: 1,
  hashLenBytes: 32,
};

function createDefaultSteps(): RegistrationStep[] {
  return [
    { id: "generateDek", label: "Generate Vault Key (DEK, 256-bit)", status: "pending" },
    { id: "storeDek", label: "Store DEK locally (IndexedDB)", status: "pending" },
    {
      id: "deriveKek",
      label: "Derive KEK from recovery passphrase (Argon2id + salt + params)",
      status: "pending",
    },
    {
      id: "wrapDek",
      label:
        "Wrap the DEK with KEK + AES-256-GCM and upload recovery metadata",
      status: "pending",
    },
    {
      id: "deviceBind",
      label: "Bind this device (generate device keypair, wrap DEK, upload device key)",
      status: "pending",
    },
  ];
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

function isPasskeyCancelError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  const message = "message" in error ? String((error as { message?: string }).message) : "";
  return name === "NotAllowedError" || message.toLowerCase().includes("not allowed");
}

export type RegistrationPhase = "form" | "passkey" | "setup" | "complete";

export function useRegistrationFlow() {
  const [phase, setPhase] = useState<RegistrationPhase>("form");
  const [steps, setSteps] = useState<RegistrationStep[]>(() => createDefaultSteps());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetSteps = useCallback(() => {
    setSteps(createDefaultSteps());
  }, []);

  const updateStepStatus = useCallback((id: RegistrationStep["id"], status: RegistrationStepStatus) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status } : step)),
    );
  }, []);

  const runSetup = useCallback(
    async (passphrase: string) => {
      resetSteps();
      setSetupError(null);

      try {
        updateStepStatus("generateDek", "in_progress");
        const dekBytes = crypto.getRandomValues(new Uint8Array(32));
        updateStepStatus("generateDek", "completed");

        updateStepStatus("storeDek", "in_progress");
        await storeDekBytes(dekBytes);
        updateStepStatus("storeDek", "completed");

        const salt = generateSaltB64();
        updateStepStatus("deriveKek", "in_progress");
        const kekBytes = await deriveKek256(passphrase, {
          saltB64: salt,
          timeCost: DEFAULT_KDF_PARAMS.timeCost,
          memoryCostKiB: DEFAULT_KDF_PARAMS.memoryCostKiB,
          parallelism: DEFAULT_KDF_PARAMS.parallelism,
          hashLenBytes: DEFAULT_KDF_PARAMS.hashLenBytes,
        });
        updateStepStatus("deriveKek", "completed");

        updateStepStatus("wrapDek", "in_progress");
        const { wrappedVaultKey } = await wrapVaultKeyWithKek({
          kekBytes,
          vaultKeyBytes: dekBytes,
        });
        await uploadRecoveryData({
          wrappedVaultKey,
          salt,
          timeCost: DEFAULT_KDF_PARAMS.timeCost,
          memoryCostKiB: DEFAULT_KDF_PARAMS.memoryCostKiB,
          parallelism: DEFAULT_KDF_PARAMS.parallelism,
        });
        updateStepStatus("wrapDek", "completed");

        updateStepStatus("deviceBind", "in_progress");
        const deviceKeyPair = await generateDeviceKeyPair();
        const devicePublicKey = await exportPublicKeyJwk(deviceKeyPair.publicKey);
        const devicePrivateKey = await exportPrivateKeyJwk(deviceKeyPair.privateKey);
        const wrappedDEK = await wrapDekForDevice({
          dekBytes,
          devicePublicKey: deviceKeyPair.publicKey,
        });

        await bindDevice({
          devicePublicKey: JSON.stringify(devicePublicKey),
          deviceLabel: "This device",
          wrappedDEK,
        });

        await storeDevicePrivateKeyJwk(devicePrivateKey);
        updateStepStatus("deviceBind", "completed");

        setPhase("complete");
      } catch (error) {
        setSteps((prev) =>
          prev.map((step) =>
            step.status === "in_progress" ? { ...step, status: "error" } : step,
          ),
        );
        setSetupError(error instanceof Error ? error.message : "Setup failed. Please try again.");
      }
    },
    [resetSteps, updateStepStatus],
  );

  const submitRegistration = useCallback(
    async (email: string, passphrase: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setPasskeyRegistered(false);
      setPhase("passkey");
      setIsPasskeyModalOpen(true);

      try {
        const { options } = await startPasskeyRegistration(email);
        const credential = await startRegistration(options as Parameters<typeof startRegistration>[0]);
        await finishPasskeyRegistration(credential);

        setPasskeyRegistered(true);
        setIsPasskeyModalOpen(false);
        setPhase("setup");
        await runSetup(passphrase);
      } catch (error) {
        setIsPasskeyModalOpen(false);
        setPhase("form");
        if (isPasskeyCancelError(error)) {
          setErrorMessage("Passkey registration was cancelled. Try again.");
        } else {
          setErrorMessage(
            error instanceof Error ? error.message : "Passkey registration failed. Try again.",
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [runSetup],
  );

  const retrySetup = useCallback(
    async (passphrase: string) => {
      setPhase("setup");
      await runSetup(passphrase);
    },
    [runSetup],
  );

  const value = useMemo(
    () => ({
      phase,
      steps,
      errorMessage,
      setupError,
      isPasskeyModalOpen,
      passkeyRegistered,
      isSubmitting,
      submitRegistration,
      retrySetup,
    }),
    [
      errorMessage,
      isPasskeyModalOpen,
      isSubmitting,
      passkeyRegistered,
      phase,
      retrySetup,
      setupError,
      steps,
      submitRegistration,
    ],
  );

  return value;
}
