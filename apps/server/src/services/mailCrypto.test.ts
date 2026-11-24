import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptCredentials, decryptCredentials } from "./mailCrypto.js";

describe("Mail Crypto Service", () => {
  it("encrypts and decrypts string credentials accurately", () => {
    const secret = "my-super-secret-password-123!";
    const encrypted = encryptCredentials(secret);

    assert.notEqual(encrypted, secret);
    assert.match(encrypted, /^[^:]+:[^:]+:[^:]+$/); // iv:tag:ciphertext

    const decrypted = decryptCredentials<string>(encrypted);
    assert.equal(decrypted, secret);
  });

  it("encrypts and decrypts structured OAuth token objects accurately", () => {
    const payload = {
      accessToken: "ya29.a0AfH6SM...",
      refreshToken: "1//04D...",
      expiresAt: 1729837200000,
      scope: "https://mail.google.com/",
    };

    const encrypted = encryptCredentials(payload);
    const decrypted = decryptCredentials<typeof payload>(encrypted);

    assert.deepEqual(decrypted, payload);
  });

  it("fails to decrypt tampered cipher payload", () => {
    const secret = "correct-password";
    const encrypted = encryptCredentials(secret);
    const parts = encrypted.split(":");
    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}AA`;

    assert.throws(() => {
      decryptCredentials(tampered);
    });
  });

  it("rejects malformed encrypted strings", () => {
    assert.throws(() => {
      decryptCredentials("not-a-valid-encrypted-string");
    });
  });
});
