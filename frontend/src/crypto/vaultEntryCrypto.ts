// frontend/src/crypto/vaultEntryCrypto.ts

// --------------- base64url helpers ---------------
function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeB64(b64: string): string {
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return s;
}

function b64UrlToBytes(b64url: string): Uint8Array {
  const bin = atob(normalizeB64(b64url));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --------------- optional AAD ---------------
function toAadBytes(aad?: string | Uint8Array): Uint8Array | undefined {
  if (!aad) return undefined;

  if (typeof aad === "string") {
    // TextEncoder output is already Uint8Array, but we copy to normalize typing
    const enc = new TextEncoder().encode(aad);
    return new Uint8Array(enc);
  }
  // Copy to force a real ArrayBuffer-backed Uint8Array
  return new Uint8Array(aad);
}

// --------------- Types matching your Prisma VaultEntry ---------------
export type VaultEntryCryptoFields = {
  ciphertextBlob: string; // base64url(ciphertext)
  iv: string;             // base64url(12-byte IV)
  authTag: string;        // base64url(16-byte tag)
  metadataJson?: unknown; // optional, your model is Json?
};

// --------------- Encrypt: plaintext -> {ciphertextBlob, iv, authTag} ---------------
export async function encryptVaultEntryBytes(args: {
  vaultKey: CryptoKey;           // AES-GCM key
  plaintext: Uint8Array;         // data to encrypt
  aad?: string | Uint8Array;     // optional
  metadataJson?: unknown;        // optional (store non-sensitive info only)
}): Promise<VaultEntryCryptoFields> {
  const { vaultKey, plaintext, aad, metadataJson } = args;

  // 12-byte IV recommended for AES-GCM
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const aadBytes = toAadBytes(aad);
  const additionalData: ArrayBuffer | undefined = aadBytes
    ? new Uint8Array(aadBytes).buffer // forces real ArrayBuffer
    : undefined;

  const ptBuf = new Uint8Array(plaintext).buffer; // ArrayBuffer
  const ctPlusTagBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBytes), additionalData },
    vaultKey,
    ptBuf,
  );

  // WebCrypto returns ciphertext || tag (tag at the end)
  const ctPlusTag = new Uint8Array(ctPlusTagBuf);
  const TAG_LEN = 16; // 128-bit tag (default)

  if (ctPlusTag.length < TAG_LEN) throw new Error("Ciphertext too short");

  const ciphertext = ctPlusTag.slice(0, ctPlusTag.length - TAG_LEN);
  const authTag = ctPlusTag.slice(ctPlusTag.length - TAG_LEN);

  return {
    ciphertextBlob: bytesToB64Url(ciphertext),
    iv: bytesToB64Url(ivBytes),
    authTag: bytesToB64Url(authTag),
    ...(metadataJson !== undefined ? { metadataJson } : {}),
  };
}

// --------------- Decrypt: {ciphertextBlob, iv, authTag} -> plaintext ---------------
export async function decryptVaultEntryBytes(args: {
  vaultKey: CryptoKey;
  fields: Pick<VaultEntryCryptoFields, "ciphertextBlob" | "iv" | "authTag">;
  aad?: string | Uint8Array;
}): Promise<Uint8Array> {
  const { vaultKey, fields, aad } = args;

  const iv = new Uint8Array(b64UrlToBytes(fields.iv));
  const ciphertext = new Uint8Array(b64UrlToBytes(fields.ciphertextBlob));
  const tag = new Uint8Array(b64UrlToBytes(fields.authTag));
  const aadBytes = toAadBytes(aad);
  const additionalData: ArrayBuffer | undefined = aadBytes
    ? new Uint8Array(aadBytes).buffer
    : undefined;

  // Re-combine ciphertext || tag for WebCrypto decrypt
  const ctPlusTag = new Uint8Array(ciphertext.length + tag.length);
  ctPlusTag.set(ciphertext, 0);
  ctPlusTag.set(tag, ciphertext.length);

  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData },
    vaultKey,
    ctPlusTag,
  );

  return new Uint8Array(ptBuf);
}

// --------------- Convenience: text/json wrappers ---------------
export async function encryptVaultEntryText(args: {
  vaultKey: CryptoKey;
  plaintext: string;
  aad?: string | Uint8Array;
  metadataJson?: unknown;
}): Promise<VaultEntryCryptoFields> {
  const bytes = new TextEncoder().encode(args.plaintext);
  return encryptVaultEntryBytes({
    vaultKey: args.vaultKey,
    plaintext: bytes,
    aad: args.aad,
    metadataJson: args.metadataJson,
  });
}

export async function decryptVaultEntryText(args: {
  vaultKey: CryptoKey;
  fields: Pick<VaultEntryCryptoFields, "ciphertextBlob" | "iv" | "authTag">;
  aad?: string | Uint8Array;
}): Promise<string> {
  const bytes = await decryptVaultEntryBytes(args);
  return new TextDecoder().decode(bytes);
}

export async function encryptVaultEntryJson(args: {
  vaultKey: CryptoKey;
  value: unknown;
  aad?: string | Uint8Array;
  metadataJson?: unknown;
}): Promise<VaultEntryCryptoFields> {
  const json = JSON.stringify(args.value);
  return encryptVaultEntryText({
    vaultKey: args.vaultKey,
    plaintext: json,
    aad: args.aad,
    metadataJson: args.metadataJson,
  });
}

export async function decryptVaultEntryJson<T>(args: {
  vaultKey: CryptoKey;
  fields: Pick<VaultEntryCryptoFields, "ciphertextBlob" | "iv" | "authTag">;
  aad?: string | Uint8Array;
}): Promise<T> {
  const json = await decryptVaultEntryText(args);
  return JSON.parse(json) as T;
}
