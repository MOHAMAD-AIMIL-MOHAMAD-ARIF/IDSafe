"use client";

import { useCallback, useMemo, useState } from "react";
import {
  fetchKdfPolicy,
  fetchSessionPolicy,
  fetchWebAuthnPolicy,
  updateKdfPolicy,
  updateSessionPolicy,
  updateWebAuthnPolicy,
} from "@/lib/api/admin";
import type { AdminKdfPolicy, AdminSessionPolicy, AdminWebAuthnPolicy } from "@/types/admin";
import { ApiError } from "@/lib/api/client";

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
}

export type AdminConfigStatus = "idle" | "loading" | "ready" | "saving" | "error";

type AdminPolicyMap = {
  kdf: AdminKdfPolicy;
  webauthn: AdminWebAuthnPolicy;
  session: AdminSessionPolicy;
};

type AdminPolicyKey = keyof AdminPolicyMap;

type AdminPolicyFetchers = {
  [K in AdminPolicyKey]: () => Promise<AdminPolicyMap[K]>;
};

type AdminPolicyUpdaters = {
  [K in AdminPolicyKey]: (payload: AdminPolicyMap[K]) => Promise<AdminPolicyMap[K]>;
};

const fetchers: AdminPolicyFetchers = {
  kdf: fetchKdfPolicy,
  webauthn: fetchWebAuthnPolicy,
  session: fetchSessionPolicy,
};

const updaters: AdminPolicyUpdaters = {
  kdf: updateKdfPolicy,
  webauthn: updateWebAuthnPolicy,
  session: updateSessionPolicy,
};

export function useAdminConfig<K extends AdminPolicyKey>(policyKey: K) {
  const [policy, setPolicy] = useState<AdminPolicyMap[K] | null>(null);
  const [status, setStatus] = useState<AdminConfigStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetchers[policyKey]();
      setPolicy(response);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatApiError(error));
    }
  }, [policyKey]);

  const savePolicy = useCallback(
    async (payload: AdminPolicyMap[K]) => {
      setStatus("saving");
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const response = await updaters[policyKey](payload);
        setPolicy(response);
        setStatus("ready");
        setSuccessMessage("Policy saved successfully.");
        return response;
      } catch (error) {
        setStatus("error");
        setErrorMessage(formatApiError(error));
        return null;
      }
    },
    [policyKey],
  );

  const value = useMemo(
    () => ({ policy, status, errorMessage, successMessage, loadPolicy, savePolicy }),
    [policy, status, errorMessage, successMessage, loadPolicy, savePolicy],
  );

  return value;
}
