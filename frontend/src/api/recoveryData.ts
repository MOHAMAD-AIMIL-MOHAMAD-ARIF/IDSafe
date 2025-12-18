// frontend/src/api/recoveryData.ts
const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:4000";

export async function postRecoveryData(payload: {
  wrappedVaultKey: string;
  salt: string;
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
}) {
  const res = await fetch(`${BACKEND_ORIGIN}/recovery/data`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Failed to save recovery data (${res.status})`);
  }

  return res.json() as Promise<{ ok: true; recoveryId: number; updatedAt: string }>;
}
