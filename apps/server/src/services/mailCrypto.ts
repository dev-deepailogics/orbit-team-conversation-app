import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const envKey = process.env.MAIL_ENCRYPTION_KEY?.trim();
  if (envKey) {
    // If provided as a 64-char hex string, convert to 32 bytes Buffer
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    // If provided as base64 or utf-8, ensure 32 bytes
    const buf = Buffer.from(envKey, "base64");
    if (buf.length === 32) {
      return buf;
    }
    const utf8Buf = Buffer.from(envKey, "utf-8");
    if (utf8Buf.length >= 32) {
      return utf8Buf.subarray(0, 32);
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MAIL_ENCRYPTION_KEY is required in production. Must be a 32-byte key (64 hex characters)."
    );
  }

  // Consistent dev fallback key based on server secret if available, or static dev key
  const fallback = process.env.JWT_SECRET || "orbit_default_mail_dev_secret_key_32_bytes!!";
  return Buffer.from(fallback.padEnd(32, "0").slice(0, 32), "utf-8");
}

/**
 * Encrypts an object or string into an opaque base64 string formatted as iv:authTag:ciphertext
 */
export function encryptCredentials(data: unknown): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = typeof data === "string" ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/**
 * Decrypts the opaque string back into the original parsed data
 */
export function decryptCredentials<T = any>(encryptedString: string): T {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credentials format");
  }

  const [ivStr, tagStr, cipherStr] = parts;
  const iv = Buffer.from(ivStr, "base64url");
  const authTag = Buffer.from(tagStr, "base64url");
  const ciphertext = Buffer.from(cipherStr, "base64url");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Malformed encrypted credentials payload");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const str = decrypted.toString("utf8");
  try {
    return JSON.parse(str) as T;
  } catch {
    return str as unknown as T;
  }
}
