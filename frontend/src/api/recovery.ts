// frontend/src/api/recovery.ts
export type RecoveryParamsResponse = {
  wrappedVaultKey: string;
  salt: string; // base64
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
};

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:4000";

/**
 * Calls GET /recovery/params using cookie session (credentials included).
 */
export async function fetchRecoveryParams(): Promise<RecoveryParamsResponse> {
  const res = await fetch(`${BACKEND_ORIGIN}/recovery/params`, {
    method: "GET",
    credentials: "include", // IMPORTANT: send cookies
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `Failed to fetch recovery params (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }

  return (await res.json()) as RecoveryParamsResponse;
}
