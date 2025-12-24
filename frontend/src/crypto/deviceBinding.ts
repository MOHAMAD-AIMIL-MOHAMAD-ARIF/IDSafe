// frontend/src/crypto/deviceBinding.ts

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);

  // Force an actual ArrayBuffer (not ArrayBufferLike)
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);

  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Copy into a guaranteed ArrayBuffer
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out.buffer;
}


export async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportPublicKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function exportPrivateKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function wrapDekForDevice(args: {
  dekBytes: Uint8Array;
  devicePublicKey: CryptoKey;
}): Promise<string> {
  const { dekBytes, devicePublicKey } = args;

  const wrapped = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    devicePublicKey,
    toArrayBuffer(dekBytes), // guaranteed ArrayBuffer
  );

  return bytesToB64(new Uint8Array(wrapped));
}

export async function importDevicePrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"],
  );
}

export async function unwrapDekForDevice(args: {
  wrappedDek: string;
  devicePrivateKey: CryptoKey;
}): Promise<Uint8Array> {
  const wrappedBytes = b64ToBytes(args.wrappedDek);

  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    args.devicePrivateKey,
    toArrayBuffer(wrappedBytes), // ✅ guaranteed ArrayBuffer
  );

  return new Uint8Array(decrypted);
}



