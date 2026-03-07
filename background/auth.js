async function getStoredApiKey() {
  const result = await chrome.storage.local.get("smartrip_api_key");
  return result.smartrip_api_key || null;
}

async function clearRevokedKey() {
  await chrome.storage.local.remove("smartrip_api_key");
  const err = new Error("API key invalid or revoked");
  err.keyRevoked = true;
  return err;
}

// CJS export for Vitest (no-op in service worker importScripts context)
if (typeof module !== "undefined") {
  module.exports = { getStoredApiKey, clearRevokedKey };
}
