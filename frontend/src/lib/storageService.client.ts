import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "idsafe";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const VAULT_METADATA_STORE = "vaultMetadata";

type KeyRecord = {
  id: "dek" | "devicePrivateKey" | "deviceId";
  value: string;
  createdAt: string;
};

export type EncryptedVaultMetadataRecord = {
  entryId: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  metadataJson?: unknown;
  updatedAt: string;
};

interface IdSafeDbSchema extends DBSchema {
  keys: {
    key: KeyRecord["id"];
    value: KeyRecord;
  };
  vaultMetadata: {
    key: EncryptedVaultMetadataRecord["entryId"];
    value: EncryptedVaultMetadataRecord;
  };
}

function assertIndexedDbAvailable() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
}

async function getDb(): Promise<IDBPDatabase<IdSafeDbSchema>> {
  assertIndexedDbAvailable();
  return openDB<IdSafeDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(VAULT_METADATA_STORE)) {
        db.createObjectStore(VAULT_METADATA_STORE, { keyPath: "entryId" });
      }
    },
  });
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function storeDekBytes(dekBytes: Uint8Array): Promise<void> {
  const db = await getDb();
  const record: KeyRecord = {
    id: "dek",
    value: bytesToB64(dekBytes),
    createdAt: new Date().toISOString(),
  };
  await db.put(KEY_STORE, record);
}

export async function loadDekBytes(): Promise<Uint8Array | null> {
  const db = await getDb();
  const record = await db.get(KEY_STORE, "dek");
  if (!record) return null;
  return b64ToBytes(record.value);
}

export async function clearDek(): Promise<void> {
  const db = await getDb();
  await db.delete(KEY_STORE, "dek");
}

export async function storeDevicePrivateKeyJwk(jwk: JsonWebKey): Promise<void> {
  const db = await getDb();
  const record: KeyRecord = {
    id: "devicePrivateKey",
    value: JSON.stringify(jwk),
    createdAt: new Date().toISOString(),
  };
  await db.put(KEY_STORE, record);
}

export async function loadDevicePrivateKeyJwk(): Promise<JsonWebKey | null> {
  const db = await getDb();
  const record = await db.get(KEY_STORE, "devicePrivateKey");
  if (!record) return null;
  return JSON.parse(record.value) as JsonWebKey;
}

export async function clearDevicePrivateKey(): Promise<void> {
  const db = await getDb();
  await db.delete(KEY_STORE, "devicePrivateKey");
}

export async function storeDeviceId(deviceId: number): Promise<void> {
  const db = await getDb();
  const record: KeyRecord = {
    id: "deviceId",
    value: String(deviceId),
    createdAt: new Date().toISOString(),
  };
  await db.put(KEY_STORE, record);
}

export async function loadDeviceId(): Promise<number | null> {
  const db = await getDb();
  const record = await db.get(KEY_STORE, "deviceId");
  if (!record) return null;
  const parsed = Number(record.value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function clearDeviceId(): Promise<void> {
  const db = await getDb();
  await db.delete(KEY_STORE, "deviceId");
}

export async function upsertEncryptedVaultMetadata(
  record: Omit<EncryptedVaultMetadataRecord, "updatedAt"> & { updatedAt?: string },
): Promise<void> {
  const db = await getDb();
  const toStore: EncryptedVaultMetadataRecord = {
    ...record,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  };
  await db.put(VAULT_METADATA_STORE, toStore);
}

export async function getEncryptedVaultMetadata(
  entryId: string,
): Promise<EncryptedVaultMetadataRecord | null> {
  const db = await getDb();
  return (await db.get(VAULT_METADATA_STORE, entryId)) ?? null;
}

export async function listEncryptedVaultMetadata(): Promise<EncryptedVaultMetadataRecord[]> {
  const db = await getDb();
  return db.getAll(VAULT_METADATA_STORE);
}

export async function removeEncryptedVaultMetadata(entryId: string): Promise<void> {
  const db = await getDb();
  await db.delete(VAULT_METADATA_STORE, entryId);
}

export async function clearEncryptedVaultMetadata(): Promise<void> {
  const db = await getDb();
  await db.clear(VAULT_METADATA_STORE);
}
