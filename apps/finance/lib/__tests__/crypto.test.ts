import { describe, it, expect, vi } from "vitest";

// The ENCRYPTION_KEY env var is set via vitest.config.ts

describe("encrypt / decrypt round-trip", () => {
  it("decrypts to the original plaintext", async () => {
    const { encryptToString, decryptFromString } = await import("../crypto");
    const original = "belvo-link-token-abc123";
    expect(decryptFromString(encryptToString(original))).toBe(original);
  });

  it("handles empty string", async () => {
    const { encryptToString, decryptFromString } = await import("../crypto");
    expect(decryptFromString(encryptToString(""))).toBe("");
  });

  it("handles unicode and special characters", async () => {
    const { encryptToString, decryptFromString } = await import("../crypto");
    const original = "¡Bienvenido! 🇨🇴 €100";
    expect(decryptFromString(encryptToString(original))).toBe(original);
  });
});

describe("non-deterministic encryption", () => {
  it("produces different ciphertext for the same plaintext (fest IV each call)", async () => {
    const { encryptToString } = await import("../crypto");
    const a = encryptToString("same-input");
    const b = encryptToString("same-input");
    expect(a).not.toBe(b);
  });
});

describe("tamper detection", () => {
  it("throws CryptoError when ciphertext is modified", async () => {
    const { encrypt, decrypt, CryptoError } = await import("../crypto");
    const payload = encrypt("sensitive-data");
    const tampered = {
      ...payload,
      ciphertext: payload.ciphertext.slice(0, -2) + "ff",
    };
    expect(() => decrypt(tampered)).toThrowError(CryptoError);
  });

  it("throws CryptoError when auth tag is modified", async () => {
    const { encrypt, decrypt, CryptoError } = await import("../crypto");
    const payload = encrypt("sensitive-data");
    const tampered = {
      ...payload,
      tag: payload.tag.slice(0, -2) + "ff",
    };
    expect(() => decrypt(tampered)).toThrowError(CryptoError);
  });

  it("throws CryptoError when IV is modified", async () => {
    const { encrypt, decrypt, CryptoError } = await import("../crypto");
    const payload = encrypt("sensitive-data");
    const tampered = {
      ...payload,
      iv: payload.iv.slice(0, -2) + "ff",
    };
    expect(() => decrypt(tampered)).toThrowError(CryptoError);
  });
});

describe("fail-fast key validation", () => {
  it("throws at module load when ENCRYPTION_KEY is missing", async () => {
    vi.resetModules();
    vi.stubEnv("ENCRYPTION_KEY", "");
    await expect(import("../crypto")).rejects.toThrow("ENCRYPTION_KEY");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws at module load when ENCRYPTION_KEY is wrong length", async () => {
    vi.resetModules();
    vi.stubEnv("ENCRYPTION_KEY", "tooshort");
    await expect(import("../crypto")).rejects.toThrow("ENCRYPTION_KEY");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
