import { deriveKek256, type Argon2idParams } from "./kdfService.client";
import {
  decryptVaultEntryBytes,
  decryptVaultEntryJson,
  decryptVaultEntryText,
  encryptVaultEntryBytes,
  encryptVaultEntryJson,
  encryptVaultEntryText,
  type VaultEntryCryptoFields,
} from "./vaultEntryCrypto";

export type { Argon2idParams, VaultEntryCryptoFields };

export async function generateDekBytes(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function importDekKey(dekBytes: Uint8Array): Promise<CryptoKey> {
  const raw = new Uint8Array(dekBytes).buffer;
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function exportDekBytes(dekKey: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", dekKey);
  return new Uint8Array(raw);
}

async function ensureDekKey(dek: CryptoKey | Uint8Array): Promise<CryptoKey> {
  if (dek instanceof CryptoKey) return dek;
  return importDekKey(dek);
}

export async function deriveKekFromPassphrase(
  passphrase: string,
  params: Argon2idParams,
): Promise<Uint8Array> {
  return deriveKek256(passphrase, params);
}

export async function encryptVaultEntryBytesWithDek(args: {
  dek: CryptoKey | Uint8Array;
  plaintext: Uint8Array;
  metadataJson?: unknown;
}): Promise<VaultEntryCryptoFields> {
  const vaultKey = await ensureDekKey(args.dek);
  return encryptVaultEntryBytes({
    vaultKey,
    plaintext: args.plaintext,
    metadataJson: args.metadataJson,
  });
}

export async function decryptVaultEntryBytesWithDek(args: {
  dek: CryptoKey | Uint8Array;
  fields: Pick<VaultEntryCryptoFields, "ciphertextBlob" | "iv" | "authTag">;
}): Promise<Uint8Array> {
  const vaultKey = await ensureDekKey(args.dek);
  return decryptVaultEntryBytes({ vaultKey, fields: args.fields });
}

export async function encryptVaultEntryTextWithDek(args: {
  dek: CryptoKey | Uint8Array;
  plaintext: string;
  metadataJson?: unknown;
}): Promise<VaultEntryCryptoFields> {
  const vaultKey = await ensureDekKey(args.dek);
  return encryptVaultEntryText({
    vaultKey,
    plaintext: args.plaintext,
    metadataJson: args.metadataJson,
  });
}

export async function decryptVaultEntryTextWithDek(args: {
  dek: CryptoKey | Uint8Array;
  fields: Pick<VaultEntryCryptoFields, "ciphertextBlob" | "iv" | "authTag">;
}): Promise<string> {
  const vaultKey = await ensureDekKey(args.dek);
  return decryptVaultEntryText({ vaultKey, fields: args.fields });
}

export async function encryptVaultEntryJsonWithDek(args: {
  dek: CryptoKey | Uint8Array;
  value: unknown;
  metadataJson?: unknown;
}): Promise<VaultEntryCryptoFields> {
  const vaultKey = await ensureDekKey(args.dek);
  return encryptVaultEntryJson({
    vaultKey,
    value: args.value,
    metadataJson: args.metadataJson,
  });
}

export async function decryptVaultEntryJsonWithDek<T>(args: {
  dek: CryptoKey | Uint8Array;
  fields: Pick<VaultEntryCryptoFields, "ciphertextBlob" | "iv" | "authTag">;
}): Promise<T> {
  const vaultKey = await ensureDekKey(args.dek);
  return decryptVaultEntryJson<T>({ vaultKey, fields: args.fields });
}
