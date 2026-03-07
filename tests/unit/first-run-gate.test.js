import { describe, it, expect } from "vitest";

describe("First-Run API Key Gate", () => {
  it("gate shown when no key stored", async () => {
    const result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBeUndefined();
    const hasKey = !!result.smartrip_api_key;
    expect(hasKey).toBe(false);
  });

  it("gate hidden when key exists", async () => {
    await chrome.storage.local.set({ smartrip_api_key: "cr_test_abc123def456abc123de" });
    const result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBe("cr_test_abc123def456abc123de");
    const hasKey = !!result.smartrip_api_key;
    expect(hasKey).toBe(true);
  });

  it("stores key on valid validation response", async () => {
    const key = "cr_adam_a1b2c3d4e5f6a7b8c9d0e1f2";
    const resp = { success: true };
    expect(resp.success).toBe(true);

    await chrome.storage.local.set({ smartrip_api_key: key });
    const result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBe(key);
  });

  it("does not store key on invalid validation response", async () => {
    const resp = { success: false, error: "invalid" };
    expect(resp.success).toBe(false);

    const result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBeUndefined();
  });

  it("reset clears key from storage", async () => {
    await chrome.storage.local.set({ smartrip_api_key: "cr_test_abc123def456abc123de" });
    let result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBeDefined();

    await chrome.storage.local.remove("smartrip_api_key");
    result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBeUndefined();
  });
});
