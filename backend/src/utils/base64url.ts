// backend/src/utils/base64url.ts
import crypto from "crypto";

/**
 * base64url -> Buffer
 */
export function b64urlToBuf(s: string): Buffer {
  // Convert URL-safe base64 to normal base64
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to multiple of 4
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64");
}

/**
 * Buffer -> base64url (no padding)
 */
export function bufToB64url(buf: Buffer | Uint8Array): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Uint8Array -> base64url
 */
export function u8ToB64url(u8: Uint8Array): string {
  return bufToB64url(u8);
}

/**
 * base64url -> Uint8Array
 */
export function b64urlToU8(s: string): Uint8Array {
  return new Uint8Array(b64urlToBuf(s));
}
