// frontend/src/crypto/recoveryWrap.ts
import { deriveKek256 } from "./kdfService.client";

export type WrapKdfParams = {
  saltB64: string;        // base64 (or base64url) salt
  timeCost: number;       // Argon2 iterations
  memoryCostKiB: number;  // KiB
  parallelism: number;    // lanes
};

type WrappedKeyEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  ivB64: string; // base64url
  ctB64: string; // base64url (ciphertext+tag)
};

// ---- base64url helpers ----
function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  // base64 -> base64url (no padding)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// ---- WebCrypto helper ----
async function importAesGcmKeyRaw(keyBytes: Uint8Array): Promise<CryptoKey> {
  // Copy bytes into a real ArrayBuffer (avoids SharedArrayBuffer typing issues)
  const raw = new Uint8Array(keyBytes).buffer; // ArrayBuffer

  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function wrapVaultKeyWithKek(args: {
  kekBytes: Uint8Array;
  vaultKeyBytes: Uint8Array;
}): Promise<{ wrappedVaultKey: string }> {
  const { kekBytes, vaultKeyBytes } = args;

  // 1) AES-GCM encrypt vaultKeyBytes using KEK
  const kekKey = await importAesGcmKeyRaw(kekBytes);

  // 12-byte IV is standard for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kekKey,
    new Uint8Array(vaultKeyBytes).buffer, // ArrayBuffer
  );

  const ct = new Uint8Array(ctBuf); // ciphertext+tag

  // 2) Canonical envelope
  const envelope: WrappedKeyEnvelopeV1 = {
    v: 1,
    alg: "A256GCM",
    ivB64: bytesToB64Url(iv),
    ctB64: bytesToB64Url(ct),
  };

  return {
    wrappedVaultKey: JSON.stringify(envelope),
  };
}

/**
 * Wrap (encrypt) a raw vault key using a KEK derived from recovery passphrase.
 *
 * - KEK = Argon2id(passphrase, salt, params) => 32 bytes
 * - wrappedVaultKey = AES-256-GCM(KEK, vaultKeyBytes) with random 12-byte IV
 *
 * Returns a canonical JSON string that you store in RecoveryData.wrappedVaultKey.
 */
export async function wrapVaultKeyWithPassphrase(args: {
  passphrase: string;
  vaultKeyBytes: Uint8Array; // plaintext vault key bytes (e.g., 32 bytes)
  kdf: WrapKdfParams;
}): Promise<{ wrappedVaultKey: string/*; kekBytes: Uint8Array*/ }> {
  const { passphrase, vaultKeyBytes, kdf } = args;

  // 1) Derive KEK (256-bit)
  const kekBytes = await deriveKek256(passphrase, {
    saltB64: kdf.saltB64,
    timeCost: kdf.timeCost,
    memoryCostKiB: kdf.memoryCostKiB,
    parallelism: kdf.parallelism,
    hashLenBytes: 32,
  });

  return wrapVaultKeyWithKek({ kekBytes, vaultKeyBytes });
}
