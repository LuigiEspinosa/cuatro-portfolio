import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { CipherGCM, DecipherGCM } from "crypto";

// If ENCRYPTION_KEY is lost, all stored Belvo tokens become unreadable
// Key rotation rqeuries re-encrypting all rows
const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || rawKey.length !== 64) {
  throw new Error(`
    ENCRYPTION_KEY must be a 32-byte hex string (64 hex charts).
    Got ${rawKey ? rawKey.length : 0} chars. Run: openssl rand -hex 32
  `);
}

const KEY = Buffer.from(rawKey, "hex");
const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export interface EncryptedPayload {
  iv: string; // 12-byte random IV, hex-encoded
  ciphertext: string; // hex-encoded
  tag: string; // 16-byte GCM auth tag, hex-encoded
}

export function encrypt(plaintext: string): EncryptedPayload {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, KEY, iv) as CipherGCM;
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(payload.iv, "hex"),
  ) as DecipherGCM;
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "hex")),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    // GCM auth tag mismatch
    throw new CryptoError(
      "Decryption Failed: ciphertext or auth ag has been apered with",
    );
  }
}

export function encryptToString(plaintext: string): string {
  return JSON.stringify(encrypt(plaintext));
}

export function decryptFromString(stored: string): string {
  return decrypt(JSON.parse(stored) as EncryptedPayload);
}
