// frontend/src/crypto/deviceBinding.ts

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
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
    new Uint8Array(dekBytes).buffer,
  );
  return bytesToB64(new Uint8Array(wrapped));
}
