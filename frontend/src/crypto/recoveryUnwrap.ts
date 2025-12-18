// frontend/src/crypto/recoveryUnwrap.ts
import { deriveKek256 } from "./kdfService.client";
import type { RecoveryParamsResponse } from "@/api/recovery";

type WrappedKeyEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  ivB64: string; // base64 (or base64url)
  ctB64: string; // base64 (or base64url) of ciphertext+tag (WebCrypto format)
};

// ---------- base64 helpers (supports base64url too) ----------
function normalizeB64(b64: string): string {
  // convert base64url -> base64
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  while (s.length % 4 !== 0) s += "=";
  return s;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(normalizeB64(b64));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- envelope parsing ----------
function parseWrappedVaultKey(input: string): { iv: Uint8Array; ct: Uint8Array } {
  // Canonical recommended format: JSON string
  // {"v":1,"alg":"A256GCM","ivB64":"...","ctB64":"..."}
  try {
    const obj = JSON.parse(input) as Partial<WrappedKeyEnvelopeV1>;
    if (obj?.v === 1 && obj.alg === "A256GCM" && obj.ivB64 && obj.ctB64) {
      return { iv: b64ToBytes(obj.ivB64), ct: b64ToBytes(obj.ctB64) };
    }
  } catch {
    // ignore
  }

  // Alternate format: base64/base64url of JSON
  try {
    const decoded = new TextDecoder().decode(b64ToBytes(input));
    const obj = JSON.parse(decoded) as Partial<WrappedKeyEnvelopeV1>;
    if (obj?.v === 1 && obj.alg === "A256GCM" && obj.ivB64 && obj.ctB64) {
      return { iv: b64ToBytes(obj.ivB64), ct: b64ToBytes(obj.ctB64) };
    }
  } catch {
    // ignore
  }

  // Alternate minimal format: "ivB64:ctB64"
  if (input.includes(":")) {
    const [ivB64, ctB64] = input.split(":");
    if (ivB64 && ctB64) return { iv: b64ToBytes(ivB64), ct: b64ToBytes(ctB64) };
  }

  throw new Error("Unsupported wrappedVaultKey format");
}

// ---------- WebCrypto helpers ----------
async function importAesGcmKeyRaw(keyBytes: Uint8Array): Promise<CryptoKey> {
  // Copy bytes into a real ArrayBuffer (avoids SharedArrayBuffer typing issues)
  const raw = new Uint8Array(keyBytes).buffer; // ArrayBuffer

  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Decrypt wrappedVaultKey using KEK (AES-256-GCM).
 * Returns the raw vault key bytes.
 */
export async function unwrapVaultKeyBytes(
  kekBytes: Uint8Array,
  wrappedVaultKey: string,
): Promise<Uint8Array> {
  const { iv, ct } = parseWrappedVaultKey(wrappedVaultKey);
  // Normalize to plain Uint8Array backed by ArrayBuffer (fixes TS BufferSource typing issues)
  const ivBuf = new Uint8Array(iv);
  const ctBuf = new Uint8Array(ct);

  const kekKey = await importAesGcmKeyRaw(kekBytes);
  
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf },
    kekKey,
    ctBuf,
  );

  return new Uint8Array(plaintext);
}

/**
 * Full recovery flow:
 * 1) derive KEK (256-bit) from passphrase + KDF params
 * 2) unwrap vault key with AES-GCM
 * 3) optionally import vault key as a CryptoKey (AES-GCM)
 */
export async function deriveKekAndUnwrapVaultKey(args: {
  passphrase: string;
  recoveryParams: RecoveryParamsResponse;
}): Promise<{ vaultKeyBytes: Uint8Array; vaultKey: CryptoKey }> {
  const { passphrase, recoveryParams } = args;

  // 1) derive KEK (32 bytes)
  const kekBytes = await deriveKek256(passphrase, {
    saltB64: recoveryParams.salt,
    timeCost: recoveryParams.timeCost,
    memoryCostKiB: recoveryParams.memoryCostKiB,
    parallelism: recoveryParams.parallelism,
    hashLenBytes: 32,
  });

  // 2) unwrap vault key bytes (plaintext vault key)
  const vaultKeyBytes = await unwrapVaultKeyBytes(
    kekBytes,
    recoveryParams.wrappedVaultKey,
  );

  // 3) import vault key for AES-GCM usage (encrypt/decrypt vault entries)
  const vaultKey = await importAesGcmKeyRaw(vaultKeyBytes);

  return { vaultKeyBytes, vaultKey };
}
