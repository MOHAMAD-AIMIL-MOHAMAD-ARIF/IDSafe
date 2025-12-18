// frontend/src/crypto/kdfService.client.ts
export type Argon2idParams = {
  saltB64: string;
  timeCost: number;
  memoryCostKiB: number;
  parallelism: number;
  hashLenBytes?: number; // default 32
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Derive a 256-bit KEK (32 bytes) using Argon2id.
 *
 * IMPORTANT: call this only in the browser/client. Do not send passphrase to server.
 */
export async function deriveKek256(passphrase: string, params: Argon2idParams): Promise<Uint8Array> {
  const salt = base64ToBytes(params.saltB64);
  const pass = new TextEncoder().encode(passphrase);
  const hashLen = params.hashLenBytes ?? 32;

  // dynamic import keeps it client-only in Next.js
  const argon2 = await import("argon2-browser");

  // argon2-browser uses mem in KiB, time iterations, parallelism lanes
  const result = await argon2.hash({
    pass,
    salt,
    time: params.timeCost,
    mem: params.memoryCostKiB,
    parallelism: params.parallelism,
    hashLen,
    type: argon2.ArgonType.Argon2id,
  });

  // result.hash is Uint8Array
  return result.hash;
}
