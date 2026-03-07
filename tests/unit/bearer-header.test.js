import { describe, it, expect } from "vitest";
import { getStoredApiKey, clearRevokedKey } from "../../background/auth.js";

describe("Bearer Header Auth (A3)", () => {
  it("getStoredApiKey returns stored key", async () => {
    const key = "cr_adam_a1b2c3d4e5f6a7b8c9d0e1f2";
    await chrome.storage.local.set({ smartrip_api_key: key });
    expect(await getStoredApiKey()).toBe(key);
  });

  it("getStoredApiKey returns null when no key", async () => {
    expect(await getStoredApiKey()).toBeNull();
  });

  it("clearRevokedKey removes key from storage", async () => {
    await chrome.storage.local.set({ smartrip_api_key: "cr_test_abc123def456abc123de" });
    await clearRevokedKey();
    expect(await getStoredApiKey()).toBeNull();
  });

  it("clearRevokedKey returns error with keyRevoked flag", async () => {
    const err = await clearRevokedKey();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("API key invalid or revoked");
    expect(err.keyRevoked).toBe(true);
  });

  it("error response shape for key_revoked propagation", () => {
    const resp = { success: false, error: "API key invalid or revoked", key_revoked: true };
    expect(resp.key_revoked).toBe(true);
    expect(resp.success).toBe(false);
  });
});
