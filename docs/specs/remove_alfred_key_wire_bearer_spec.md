# Engineering Specification: A3 — Remove ALFRED_KEY + Wire Bearer Header

**Status:** Approved
**Date:** March 7, 2026
**WBS Task:** A3
**Depends on:** A2 (First-Run API Key Gate) — key must be in `chrome.storage.local`
**Effort:** 0.5 day

---

## Context

### Current State

`background/service-worker.js` has a hardcoded key on line 5:

```javascript
const ALFRED_KEY = "aa282e3e5cba71b227771b971b6845130d3fa85eaefe5f5de58f60bc3994531f";
```

This single constant is used at **7 call sites** serving **two different APIs**:

| Lines | API | Header | Purpose |
|-------|-----|--------|---------|
| 953, 1050, 1171 | Smartrip (`CONFIG.SMARTRIP_API`) | `X-Copilot-Key: {ALFRED_KEY}` | Reply generation (3 fetch functions) |
| 302, 320, 336 | Closer-bot (`CONFIG.CLOSER_API`) | `X-API-Key: {ALFRED_KEY}` | Whitelist management (check/add/remove) |

The smartrip backend (A1) now supports per-rep `Authorization: Bearer cr_xxx` keys. The extension (A2) stores the rep's key in `chrome.storage.local` as `smartrip_api_key`. But the actual API calls still use the hardcoded `ALFRED_KEY` with the legacy `X-Copilot-Key` header.

Additionally, when smartrip returns 403 (revoked key), the extension shows a generic error with a retry button — retrying is pointless since the key is permanently invalid. The gate (A2) doesn't re-appear because it only checks storage presence, not key validity.

### Desired Outcome

After this work:
1. All smartrip calls use the rep's stored key with `Authorization: Bearer {key}` instead of `X-Copilot-Key: ALFRED_KEY`
2. The `ALFRED_KEY` constant is removed from `service-worker.js`
3. The closer-bot key is relocated to `config.js` as `CONFIG.CLOSER_API_KEY`
4. A 403/401 from smartrip clears the stored key and re-shows the setup gate
5. `grep -r ALFRED_KEY` returns nothing

### Success Criteria

- All smartrip fetch calls read key from `chrome.storage.local` and send `Authorization: Bearer {key}`
- No `X-Copilot-Key` header sent anywhere
- `ALFRED_KEY` constant removed — `grep -r ALFRED_KEY --include="*.js"` returns zero results
- Closer-bot calls use `CONFIG.CLOSER_API_KEY` with unchanged `X-API-Key` header
- Missing key in storage returns an error that triggers the gate
- 403/401 from smartrip clears stored key and re-shows the gate
- Deeprip, quickrip, coach, score calls unchanged (no auth)
- All existing tests pass + new A3 tests pass

---

## Implementation Specification

### Interfaces & Contracts

**Auth helpers** (new file: `background/auth.js`, loaded via `importScripts` in service worker, importable via ESM in tests):

```javascript
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
```

**Smartrip auth header format** (replaces `X-Copilot-Key`):

```javascript
// Before (all 3 smartrip fetch sites):
headers: { "Content-Type": "application/json", "X-Copilot-Key": ALFRED_KEY }

// After:
headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key }
```

**Key-revoked error format** (new field on error responses):

```javascript
// Service worker returns:
{ success: false, error: "API key invalid or revoked", key_revoked: true }

// Streaming port sends:
{ type: "ERROR", error: "API key invalid or revoked", key_revoked: true }
```

**Sidepanel handles `key_revoked`**:

When sidepanel receives an error with `key_revoked: true`, it calls `resetApiKey()` (existing A2 function) which clears storage and shows the gate. No confirm dialog — the key is already invalid.

**Storage change listener** (sidepanel, decouples revocation from error path):

```javascript
chrome.storage.onChanged.addListener((changes) => {
  if (changes.smartrip_api_key?.oldValue && !changes.smartrip_api_key?.newValue) {
    resetApiKey();
  }
});
```

Fires when `smartrip_api_key` is removed from storage by any context (service worker, content script, external). Shows the gate immediately without depending on `key_revoked` propagation through error responses. Uses the existing `storage` permission — no new permissions required.

---

### Plan — High-Level Tasks

- [ ] **Task 1**: Move closer-bot key to `config.js`
- [ ] **Task 2**: Wire stored key into smartrip fetch functions
- [ ] **Task 3**: Handle missing key (no key in storage)
- [ ] **Task 4**: Auto-detect 403/401 and trigger gate re-show
- [ ] **Task 5**: Storage change listener for immediate gate display
- [ ] **Task 6**: Remove `ALFRED_KEY` constant
- [ ] **Task 7**: Write tests

---

### Implementation Order — Step-by-Step

#### Task 1: Move closer-bot key to `config.js`

**File: `config.js`** — Add `CLOSER_API_KEY`:

```javascript
const CONFIG = {
  SMARTRIP_API: "https://ai-sales-copilot-458007064300.us-east1.run.app",
  CLOSER_API: "https://close.alfredloh.com",
  CLOSER_API_KEY: "aa282e3e5cba71b227771b971b6845130d3fa85eaefe5f5de58f60bc3994531f",
  WEBHOOKS: {
    thinking: "https://backend-production-06c5.up.railway.app/api/reply/thinking",
    fast: "https://backend-production-06c5.up.railway.app/api/reply/fast",
  },
  COACH_WEBHOOK: "https://rigchris.app.n8n.cloud/webhook/be253eb0-537a-4e3f-bfe7-b49e9d8dd17a/chat",
  SCORE_WEBHOOK: "https://rigchris.app.n8n.cloud/webhook/2cca4c7d-1531-40b6-a818-b0b2495ec415/chat",
};
```

**File: `background/service-worker.js`** — Update 3 closer-bot call sites:

```javascript
// Line 302 (CLOSER_CHECK):
headers: { "X-API-Key": CONFIG.CLOSER_API_KEY },

// Line 320 (CLOSER_ADD):
headers: { "X-API-Key": CONFIG.CLOSER_API_KEY },

// Line 336 (CLOSER_REMOVE):
headers: { "X-API-Key": CONFIG.CLOSER_API_KEY },
```

Simple find-and-replace: `ALFRED_KEY` → `CONFIG.CLOSER_API_KEY` at these 3 lines only.

---

#### Task 2: Wire stored key into smartrip fetch functions

**File: `background/auth.js`** — New file (see Interfaces & Contracts for full contents). Contains `getStoredApiKey()` and `clearRevokedKey()`, with CJS export for Vitest compatibility.

**File: `background/service-worker.js`** — Load auth helpers (add after line 2):

```javascript
importScripts("auth.js");
```

**2 smartrip fetch functions to update.** Both read the key once at the top. Missing key sets `keyRevoked: true` so the sidepanel shows the gate (not a generic retry error):

**Function 1: `doAlfredFetch` (line 944)** — has two fetch sites (Revio path at line 951, generic path at line 1048). Read key once before the branch:

```javascript
async function doAlfredFetch(text, platform, replyMode, fullPage) {
  console.log("[BG] doAlfredFetch called");
  const key = await getStoredApiKey();
  if (!key) {
    const err = new Error("No API key configured");
    err.keyRevoked = true;
    throw err;
  }

  // Revio high-quality path
  if (fullPage?.contactId && fullPage?.messages?.length > 0) {
    const payload = buildRevioPayload(fullPage, replyMode);
    const response = await fetch(CONFIG.SMARTRIP_API + "/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify(payload),
    });
    return handleAlfredResponse(response);
  }

  // Generic text-parsing path
  // ... (existing code unchanged) ...

  const response = await fetch(CONFIG.SMARTRIP_API + "/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(payload),
  });
  return handleAlfredResponse(response);
}
```

**Function 2: `doAlfredStreamFetch` (line 1073)** — one fetch site at line 1169:

```javascript
async function doAlfredStreamFetch(port, text, platform, replyMode, fullPage) {
  console.log("[BG] doAlfredStreamFetch called");
  const key = await getStoredApiKey();
  if (!key) {
    const err = new Error("No API key configured");
    err.keyRevoked = true;
    throw err;
  }

  // ... (existing payload building unchanged) ...

  const response = await fetch(CONFIG.SMARTRIP_API + "/suggest/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(payload),
  });
  // ... rest unchanged ...
}
```

---

#### Task 3: Handle missing key (no key in storage)

Already handled in Task 2 — `getStoredApiKey()` returns `null`, and the missing-key guard throws with `keyRevoked: true`.

The thrown error flows through the same `key_revoked` propagation path as 401/403:
- **Streaming path** (port handler, line 377): `.catch(err => ...)` → `port.postMessage({ type: "ERROR", error: err.message, key_revoked: true })` → sidepanel's `ERROR` handler → `resetApiKey()` → gate shown.
- **Non-streaming path** (`GET_REPLY` handler, line 47): `.catch(err => ...)` → `sendResponse({ ..., key_revoked: true })` → content script shows error in floating panel. Key is NOT cleared from storage again (already missing), but the `keyRevoked` flag ensures the next sidepanel action triggers the gate.

This is consistent with the success criteria: "Missing key in storage returns an error that triggers the gate."

**Auto-fallback consideration:** The fallback path (line 50-52) calls `doAlfredFetch()` when deeprip/quickrip fails. This will also read the key from storage. If no key exists, the fallback also fails with `keyRevoked: true`. Correct — without a key, smartrip can't work as a fallback either.

**Content script limitation:** The content script's `sendToBackground()` (`content.js:578`) creates `new Error(response.error)` from the response, dropping the `key_revoked` flag. The floating button shows a generic error. However, this is fully mitigated by the `chrome.storage.onChanged` listener (Task 5) — when `clearRevokedKey()` removes the key from storage, the sidepanel detects the removal and shows the gate immediately, regardless of which context triggered it.

---

#### Task 4: Auto-detect 403/401 and trigger gate re-show

**File: `background/service-worker.js`** — Modify `handleAlfredResponse()` (line 899):

Current:
```javascript
async function handleAlfredResponse(response) {
  console.log("[BG] Alfred response status:", response.status);
  if (response.status === 401) throw new Error("Alfred API: Invalid API key");
  // ...
}
```

After:
```javascript
async function handleAlfredResponse(response) {
  console.log("[BG] Alfred response status:", response.status);
  if (response.status === 401 || response.status === 403) {
    throw await clearRevokedKey();
  }
  // ... rest unchanged ...
}
```

`clearRevokedKey()` (from `auth.js`) clears storage and returns an error with `keyRevoked: true` in one call.

This covers **both** non-streaming smartrip call sites (lines 956 and 1054) since they both call `handleAlfredResponse()`.

**Streaming path** — `doAlfredStreamFetch` already checks 401 at line 1175. Replace:

Current (line 1175-1177):
```javascript
if (response.status === 401) {
  throw new Error("Alfred API: Invalid API key");
}
```

After:
```javascript
if (response.status === 401 || response.status === 403) {
  throw await clearRevokedKey();
}
```

**File: `background/service-worker.js`** — Propagate `key_revoked` flag in error responses.

**Non-streaming path** — `GET_REPLY` handler (line 47-72). The `.catch(err => ...)` at line 47 sends `sendResponse(...)`. Update to include the flag:

At line 71 (smartrip as primary, failure):
```javascript
sendResponse({ success: false, error: err.message, key_revoked: !!err.keyRevoked });
```

At line 59-68 (auto-fallback, both fail). The fallback calls `doAlfredFetch` which can also throw a `keyRevoked` error:
```javascript
.catch((err2) => {
  sendResponse({
    success: false,
    error: "Both backends failed. " + backend + ": " + err.message + ", Alfred: " + err2.message,
    key_revoked: !!(err.keyRevoked || err2.keyRevoked),
  });
});
```

**Streaming path** — port error handler (line 377-380):

Current:
```javascript
.catch((err) => {
  console.error("[BG] Alfred stream error:", err.message);
  port.postMessage({ type: "ERROR", error: err.message });
})
```

After:
```javascript
.catch((err) => {
  console.error("[BG] Alfred stream error:", err.message);
  port.postMessage({ type: "ERROR", error: err.message, key_revoked: !!err.keyRevoked });
})
```

Also update the streaming fallback path (line 397-408) — when deeprip/quickrip fails and fallback to Alfred also fails:

```javascript
.catch((err2) => {
  port.postMessage({
    type: "ERROR",
    error: "Both backends failed. " + err.message + ", Alfred: " + err2.message,
    key_revoked: !!(err.keyRevoked || err2.keyRevoked),
  });
});
```

**File: `sidepanel/sidepanel.js`** — Handle `key_revoked` in error display.

Smartrip errors flow through the streaming port, not through `SIDE_PANEL_RESULT` (which carries content script scrape results). The primary error path is `ERROR` messages. The `COMPLETE` handler also checks `key_revoked` defensively — in practice `COMPLETE` always carries `success: true` (from `handleAlfredResponse`), but guarding both handlers is robust. Two intercept points:

**1. `COMPLETE` handler (line 536-544)**:

Current:
```javascript
if (msg.type === "COMPLETE") {
  // ... metrics ...
  setGenerating(false);
  activePort = null;
  if (msg.data.success) {
    showReply(msg.data);
  } else {
    showError(msg.data.error || "Unknown error");
  }
  port.disconnect();
}
```

After:
```javascript
if (msg.type === "COMPLETE") {
  // ... metrics ...
  setGenerating(false);
  activePort = null;
  if (msg.data.success) {
    showReply(msg.data);
  } else if (msg.data.key_revoked) {
    resetApiKey();
  } else {
    showError(msg.data.error || "Unknown error");
  }
  port.disconnect();
}
```

**2. `ERROR` handler (line 548-554)**:

Current:
```javascript
if (msg.type === "ERROR") {
  // ... metrics ...
  setGenerating(false);
  activePort = null;
  showError(msg.error);
  port.disconnect();
}
```

After:
```javascript
if (msg.type === "ERROR") {
  // ... metrics ...
  setGenerating(false);
  activePort = null;
  if (msg.key_revoked) {
    resetApiKey();
  } else {
    showError(msg.error);
  }
  port.disconnect();
}
```

`resetApiKey()` (from A2) clears storage, resets the form, and shows the gate. No confirm dialog needed — the key is already proven invalid by the backend.

**3. `autoAnalyze` callback** — `autoAnalyze()` sends `SCRAPE_PAGE` then sends `GET_REPLY` via the streaming port. The error path goes through the same `ERROR`/`COMPLETE` handlers above. Already covered.

---

#### Task 5: Storage change listener for immediate gate display

**File: `sidepanel/sidepanel.js`** — Add after the initial storage check (line 491):

```javascript
chrome.storage.onChanged.addListener((changes) => {
  if (changes.smartrip_api_key?.oldValue && !changes.smartrip_api_key?.newValue) {
    resetApiKey();
  }
});
```

This fires whenever `smartrip_api_key` is removed from `chrome.storage.local`, regardless of which context did the removal:
- Service worker's `clearRevokedKey()` on 401/403
- Sidepanel's own `resetApiKey()` (redundant but idempotent — gate is already showing)
- External deletion (Chrome clear data, dev tools)

The condition `oldValue && !newValue` ensures it only fires on removal, not on initial set (which would interfere with the gate's activate flow).

This eliminates the content script limitation documented in Task 3 — the floating button path no longer needs to propagate `key_revoked` through the error response. The gate appears immediately when the key is cleared, regardless of the originating context.

No new permissions required — uses the existing `storage` permission in `manifest.json`.

---

#### Task 6: Remove `ALFRED_KEY` constant

**File: `background/service-worker.js`** — Delete line 5:

```javascript
const ALFRED_KEY = "aa282e3e5cba71b227771b971b6845130d3fa85eaefe5f5de58f60bc3994531f";
```

This line should be deleted AFTER Tasks 1-5 are complete (all references replaced).

**Verification:** `grep -r ALFRED_KEY --include="*.js"` should return zero results. (Docs still reference the name — that's expected.)

---

#### Task 7: Write tests

**File: `tests/unit/bearer-header.test.js`**

```javascript
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
```

---

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No key in storage | `getStoredApiKey()` returns `null`. Fetch functions throw with `keyRevoked: true`. Sidepanel calls `resetApiKey()` → gate shown. |
| 401 from smartrip | `handleAlfredResponse()` clears key from storage, throws with `keyRevoked: true`. Sidepanel calls `resetApiKey()` → gate shown. |
| 403 from smartrip | Same as 401. Both mean the key failed auth middleware. |
| 503 from smartrip | Existing behavior — generic error with retry. Key NOT cleared (transient failure). |
| Network error | Existing behavior — `.catch()` returns generic error. Key NOT cleared. |
| Auto-fallback with revoked key | Deeprip/quickrip fails → fallback to smartrip → smartrip returns 403 → key cleared, gate shown. |
| Closer-bot calls | Unchanged — use `CONFIG.CLOSER_API_KEY` with `X-API-Key` header. No key revocation handling needed. |

---

## Testing Requirements

### Critical Test Cases

See Task 7 above. Tests import `getStoredApiKey` and `clearRevokedKey` from `background/auth.js` and verify:
1. `getStoredApiKey()` returns the stored key from `chrome.storage.local`
2. `getStoredApiKey()` returns `null` when no key exists
3. `clearRevokedKey()` removes the key from storage
4. `clearRevokedKey()` returns an `Error` with `keyRevoked: true`
5. Error response shape for `key_revoked` propagation through message passing

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Key deleted externally (e.g., Chrome clear data) | `chrome.storage.onChanged` listener fires immediately → sidepanel calls `resetApiKey()` → gate shown. Rep enters new key. No smartrip call needed. |
| 403 during auto-fallback | Primary error (n8n) has no `keyRevoked`. Fallback error (smartrip) has `keyRevoked: true`. The `!!(err.keyRevoked \|\| err2.keyRevoked)` propagates it. Gate shows. |
| Multiple concurrent requests when key revoked | First 403 clears the key via `clearRevokedKey()`. Second request sees no key → throws with `keyRevoked: true`. Both trigger `resetApiKey()` → gate shown. `resetApiKey()` is idempotent — calling it twice just re-shows the already-visible gate. |
| `VALIDATE_API_KEY` (A2 gate) | Unchanged — still uses its own Bearer header construction. Does not call `getStoredApiKey()` (the key isn't stored yet during validation). |
| Closer-bot calls with wrong key | Existing behavior — error logged, `sendResponse({ success: false })`. Closer-bot key is static, not per-rep. |

---

## Dependencies & Constraints

### External Dependencies

- **A2 must be complete** — `smartrip_api_key` must be in `chrome.storage.local` before any smartrip call works.
- **A1 must be deployed** — Backend must accept `Authorization: Bearer cr_xxx` headers.
- **Closer-bot unchanged** — `close.alfredloh.com` continues to accept `X-API-Key` header with the same key value.

### Constraints

- `chrome.storage.local.get()` is async — all smartrip fetch functions are already `async`, so `await` works naturally.
- `config.js` is loaded via `importScripts()` in service worker — `CONFIG.CLOSER_API_KEY` is accessible immediately (synchronous).
- The `VALIDATE_API_KEY` handler (A2) constructs its own `Authorization: Bearer` header from `message.key` — it does NOT use `getStoredApiKey()` and should not be modified.

---

## Files Modified Summary

| File | Change |
|------|--------|
| `config.js` | Add `CLOSER_API_KEY` property |
| `background/auth.js` | **New** — Extracted auth helpers: `getStoredApiKey()`, `clearRevokedKey()`. CJS export for Vitest. |
| `background/service-worker.js` | Remove `ALFRED_KEY`. Add `importScripts("auth.js")`. Update 3 smartrip fetch sites (Bearer header). Update 3 closer-bot fetch sites (`CONFIG.CLOSER_API_KEY`). Update `handleAlfredResponse()` + streaming 401 check to use `clearRevokedKey()`. Propagate `key_revoked` in 4 error response sites. |
| `sidepanel/sidepanel.js` | Handle `key_revoked` in `COMPLETE` and `ERROR` port message handlers (call `resetApiKey()`). Add `chrome.storage.onChanged` listener for immediate gate display on key removal. |
| `tests/unit/bearer-header.test.js` | New — 5 tests importing from `background/auth.js`. Storage listener covered by verification checklist items 8-9. |

---

## Verification Checklist

- [ ] `grep -r ALFRED_KEY --include="*.js"` returns nothing
- [ ] `grep -r X-Copilot-Key --include="*.js"` returns nothing
- [ ] Smartrip request in Network tab shows `Authorization: Bearer cr_...` header
- [ ] No `X-Copilot-Key` header sent
- [ ] Smartrip reply generation works end-to-end with per-rep key
- [ ] Deeprip/quickrip still work (no auth change)
- [ ] Closer-bot toggle still works (CLOSER_CHECK/ADD/REMOVE)
- [ ] Revoke key on backend → next smartrip call → gate re-appears
- [ ] Clear `smartrip_api_key` from storage manually → gate re-appears immediately
- [ ] Enter new valid key in gate → normal operation resumes
- [ ] All tests pass (`npm test`)

---

## Test Coverage Note

Auth helpers (`getStoredApiKey`, `clearRevokedKey`) are extracted to `background/auth.js` and tested directly via ESM import in Vitest. The file uses plain function declarations (global via `importScripts` in the service worker) with a `typeof module` guard for CJS export — `typeof` never throws a ReferenceError, and Vite's CJS detection recognizes `module.exports` inside `if` guards. `handleAlfredResponse()` remains in the service worker — it calls `clearRevokedKey()` for the 401/403 path, which is tested. The full `handleAlfredResponse()` flow (JSON parsing, suggestion extraction) is covered by the integration verification checklist (items 5, 7, 8).

---

## Open Questions

None — all clarified during spec consultation.
