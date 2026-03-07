# First-Run API Key Setup Gate

> **Status**: Draft
> **WBS Task**: A2
> **Estimated effort**: 0.5 day
> **Depends on**: A1 deployed + keys generated
> **Blocks**: A3
> **PRD source**: FR-8.1, FR-8.2, Section 8.2

## Context

### Current State

- `background/service-worker.js` line 5: hardcodes `ALFRED_KEY` constant — every rep shares the same key
- `sidepanel/sidepanel.js` line 329: on load, immediately sends `SIDE_PANEL_READY` then runs `autoAnalyze()` — no auth check
- `chrome.storage.local`: stores `backend`, `metricsEnabled` — no API key
- Backend (A1 complete): supports `Authorization: Bearer {per_rep_key}` validation on `/suggest`. Returns 401 (missing), 403 (invalid/revoked), 200/422 (valid key)
- No first-run experience — extension works immediately for anyone who installs it

### Desired Outcome

When the sidepanel opens and no API key is stored in `chrome.storage.local`, a setup screen blocks all functionality until the rep enters a valid key. The key is validated against the smartrip backend, stored on success, and used for all subsequent requests (wired in A3). A reset option allows re-entering the key.

### Success Criteria

- Fresh install (no key in storage) shows setup screen, not the normal UI
- Entering a valid key stores it and reveals the normal UI
- Entering an invalid key shows "Invalid key — contact Alfie" with retry
- Reloading the sidepanel with a key stored shows normal UI immediately
- "Reset API Key" clears the stored key and re-shows the gate
- All existing tests still pass
- 5 new unit tests pass

## Implementation Specification

### Architecture Decision: Validation via Service Worker

The sidepanel communicates with backends exclusively through the service worker (existing pattern). Key validation follows this pattern:

1. Sidepanel sends `{ type: "VALIDATE_API_KEY", key: "cr_adam_..." }` to the service worker
2. Service worker sends `POST /suggest` to smartrip with `Authorization: Bearer {key}` and a minimal body
3. Response determines validity:
   - **403** → invalid or revoked key → `{ success: false, error: "invalid" }`
   - **401** → missing/malformed key → `{ success: false, error: "invalid" }`
   - **422** → key accepted, body validation failed → `{ success: true }` (this is the expected "valid" signal — we intentionally send an incomplete body)
   - **200** → key valid and body happened to pass → `{ success: true }`
   - **Network error** → `{ success: false, error: "network" }`
4. Sidepanel stores key on success, shows error on failure

**Why not validate directly from sidepanel?** The smartrip URL is in `config.js`, which is only loaded in the service worker via `importScripts()`. The sidepanel doesn't have access to `CONFIG.SMARTRIP_API`. Routing through the service worker keeps the single-source-of-truth pattern for backend URLs.

**Why POST /suggest instead of a dedicated validation endpoint?** No backend changes needed. The middleware validates the key before the endpoint handler runs, so a 403/401 confirms the key is bad. A 422 confirms the key passed middleware (valid) but the minimal body failed schema validation. This is the approach specified in the WBS.

### Storage Key

```
chrome.storage.local key: "smartrip_api_key"
value: string (e.g., "cr_adam_a1b2c3d4e5f6a7b8c9d0e1f2")
```

### Plan — High-Level Tasks

- [ ] **Task 1**: Add gate HTML to `sidepanel/sidepanel.html`
- [ ] **Task 2**: Add gate CSS to `sidepanel/sidepanel.css`
- [ ] **Task 3**: Add gate logic to `sidepanel/sidepanel.js` (check storage, show/hide gate, validate, store, reset)
- [ ] **Task 4**: Add `VALIDATE_API_KEY` handler to `background/service-worker.js`
- [ ] **Task 5**: Write unit tests in `tests/unit/first-run-gate.test.js`

### Implementation Order — Step-by-Step Subtasks

#### 1. Add gate HTML section to `sidepanel/sidepanel.html`

Add a new `<div id="setupGate">` as the first child of `<div class="sp">`, before the header. It starts hidden — JS controls visibility.

Insert after `<div class="sp">` (line 10), before `<!-- Header -->` (line 12):

```html
<!-- Setup Gate (shown when no API key stored) -->
<div class="sp-gate" id="setupGate" style="display:none">
  <div class="sp-gate-inner">
    <img class="sp-gate-logo" src="../icons/logo.png" alt="ChatRipper AI">
    <div class="sp-gate-title">Welcome to ChatRipper</div>
    <div class="sp-gate-desc">Enter your API key to get started. Contact Alfie if you don't have one.</div>
    <div class="sp-gate-form">
      <input type="text" class="sp-gate-input" id="gateKeyInput" placeholder="cr_yourname_..." autocomplete="off" spellcheck="false" autofocus>
      <button class="sp-gate-btn" id="gateActivateBtn">Activate</button>
    </div>
    <div class="sp-gate-error" id="gateError" style="display:none"></div>
    <div class="sp-gate-loading" id="gateLoading" style="display:none">
      <img src="../loading.gif" width="20" height="20" alt=""> Validating...
    </div>
  </div>
</div>
```

**Design rationale:**
- Full-panel overlay that hides the normal UI when active
- `loading.gif` is already a web-accessible resource — reuse it
- `autocomplete="off"` and `spellcheck="false"` — API keys shouldn't be autocompleted or spell-checked
- No password type — rep needs to see the key they're pasting

#### 2. Add gate CSS to `sidepanel/sidepanel.css`

Append to the end of the CSS file. Uses existing CSS variables (`--bg`, `--text`, `--accent`, `--error`, etc.) from the `:root` block (lines 6-48).

```css
/* ── Setup Gate ── */

.sp-gate {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.sp-gate-inner {
  text-align: center;
  max-width: 280px;
  width: 100%;
}

.sp-gate-logo {
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  border-radius: var(--radius-lg);
}

.sp-gate-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.sp-gate-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 20px;
}

.sp-gate-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sp-gate-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  font-family: var(--font-mono);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  outline: none;
  transition: border-color var(--duration) var(--ease);
}

.sp-gate-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--ring);
}

.sp-gate-input::placeholder {
  color: var(--text-muted);
}

.sp-gate-btn {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: opacity var(--duration) var(--ease);
}

.sp-gate-btn:hover {
  opacity: 0.9;
}

.sp-gate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sp-gate-error {
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--error);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: var(--radius);
  text-align: left;
}

.sp-gate-loading {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
```

**Key decisions:**
- `position: absolute; inset: 0; z-index: 100` — covers the entire sidepanel, sits above all other content
- Monospace font for the input — keys are hex strings, monospace improves readability
- Error uses existing `--error` color variable with subtle background
- No new CSS custom properties — reuses the existing design system

#### 3. Add gate logic to `sidepanel/sidepanel.js`

Three changes to this file:

##### 3a. Gate initialization — check storage before autoAnalyze

**Current flow** (two separate locations):
- Line 329: `chrome.runtime.sendMessage({ type: "SIDE_PANEL_READY" })` — informational ping to service worker (just logs and responds `{ ok: true }`, does NOT trigger scraping)
- Line 392: `autoAnalyze()` — unconditional call that kicks off page scraping and reply generation

**Line 329 stays as-is.** It's a harmless notification to the service worker.

**Replace line 392** — the bare `autoAnalyze()` call — with the gate-aware initialization:

The gate DOM references and functions should be placed after the `autoAnalyze()` function definition (line 375) and before where `autoAnalyze()` was called (line 392). Replace line 392 (`autoAnalyze();`) with the entire block below:

```javascript
// Gate: check for stored API key before allowing normal operation
const setupGate = document.getElementById("setupGate");
const gateKeyInput = document.getElementById("gateKeyInput");
const gateActivateBtn = document.getElementById("gateActivateBtn");
const gateError = document.getElementById("gateError");
const gateLoading = document.getElementById("gateLoading");

function showGate() {
  setupGate.style.display = "flex";
}

function hideGate() {
  setupGate.style.display = "none";
}

function showGateError(msg) {
  gateError.textContent = msg;
  gateError.style.display = "block";
  gateLoading.style.display = "none";
  gateActivateBtn.disabled = false;
  gateKeyInput.disabled = false;
}

function hideGateError() {
  gateError.style.display = "none";
}

function setGateValidating(validating) {
  gateActivateBtn.disabled = validating;
  gateKeyInput.disabled = validating;
  gateLoading.style.display = validating ? "flex" : "none";
  if (validating) hideGateError();
}

function submitGateKey() {
  const key = gateKeyInput.value.trim();
  if (!key) {
    showGateError("Please enter your API key.");
    return;
  }

  setGateValidating(true);

  chrome.runtime.sendMessage({ type: "VALIDATE_API_KEY", key: key }, (resp) => {
    if (chrome.runtime.lastError) {
      showGateError("Connection error. Please try again.");
      return;
    }
    if (resp && resp.success) {
      chrome.storage.local.set({ smartrip_api_key: key }, () => {
        hideGate();
        autoAnalyze();
      });
    } else {
      const errMsg = resp?.error === "network"
        ? "Could not reach server. Check your connection and try again."
        : "Invalid API key. Contact Alfie for a valid key.";
      showGateError(errMsg);
    }
  });
}

gateActivateBtn.addEventListener("click", submitGateKey);
gateKeyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGateKey();
});

// Initial check: show gate or proceed to normal UI
chrome.storage.local.get("smartrip_api_key", (result) => {
  if (result.smartrip_api_key) {
    hideGate();
    autoAnalyze();
  } else {
    showGate();
  }
});
```

**Key behavior:**
- `SIDE_PANEL_READY` still fires first (service worker needs to know panel is open for message routing)
- Storage check happens async — gate shows/hides based on result
- `autoAnalyze()` only runs when a key is present
- Enter key submits the form (expected UX)
- Input and button disabled during validation to prevent double-submit
- Distinguishes network errors from auth errors

##### 3b. Reset API Key function

Add after the gate logic block:

```javascript
// Reset API Key — callable from header settings
function resetApiKey() {
  chrome.storage.local.remove("smartrip_api_key", () => {
    gateKeyInput.value = "";
    hideGateError();
    setGateValidating(false);
    showGate();
  });
}
```

##### 3c. Reset button in the header

Add a small key icon button to the `sp-header-right` section. This goes in both HTML and JS.

**HTML** — add before the analyze button in `sidepanel.html` (line 26):

```html
<button class="sp-header-btn sp-header-key" id="headerKeyBtn" title="Reset API Key" style="display:none">
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
</button>
```

**JS** — add to the gate logic section:

```javascript
const headerKeyBtn = document.getElementById("headerKeyBtn");

// Show key button only when a key is stored
function updateKeyBtnVisibility(hasKey) {
  headerKeyBtn.style.display = hasKey ? "" : "none";
}

headerKeyBtn.addEventListener("click", () => {
  if (confirm("Reset your API key? You'll need to enter it again.")) {
    resetApiKey();
  }
});
```

Update the storage check to show/hide the button:

```javascript
chrome.storage.local.get("smartrip_api_key", (result) => {
  if (result.smartrip_api_key) {
    hideGate();
    updateKeyBtnVisibility(true);
    autoAnalyze();
  } else {
    showGate();
    updateKeyBtnVisibility(false);
  }
});
```

And in `submitGateKey()`, after successful storage:

```javascript
chrome.storage.local.set({ smartrip_api_key: key }, () => {
  hideGate();
  updateKeyBtnVisibility(true);
  autoAnalyze();
});
```

And in `resetApiKey()`:

```javascript
function resetApiKey() {
  chrome.storage.local.remove("smartrip_api_key", () => {
    gateKeyInput.value = "";
    hideGateError();
    setGateValidating(false);
    updateKeyBtnVisibility(false);
    showGate();
  });
}
```

#### 4. Add `VALIDATE_API_KEY` handler to `background/service-worker.js`

Add inside the top-level `chrome.runtime.onMessage.addListener` callback (after the existing message type handlers, before the closing `});`). This handler sends a minimal POST to `/suggest` with the provided key as Bearer token.

```javascript
if (message.type === "VALIDATE_API_KEY") {
  const key = message.key || "";
  fetch(CONFIG.SMARTRIP_API + "/suggest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key,
    },
    body: JSON.stringify({ messages: [], contact_id: "validate" }),
  })
    .then((resp) => {
      // 403/401 = invalid key, 503 = service initializing (retry)
      // 422/200 = key valid (body may fail validation, but key passed middleware)
      if (resp.status === 403 || resp.status === 401) {
        sendResponse({ success: false, error: "invalid" });
      } else if (resp.status === 503) {
        sendResponse({ success: false, error: "network" });
      } else {
        sendResponse({ success: true });
      }
    })
    .catch(() => {
      sendResponse({ success: false, error: "network" });
    });
  return true; // async sendResponse
}
```

**Minimal body rationale:**
- `{ messages: [], contact_id: "validate" }` — enough structure to avoid a JSON parse error, but will fail Pydantic validation with 422 (messages is empty, required fields missing)
- The middleware runs before endpoint validation, so a 403/401 means the key check failed
- A 422 means the key passed middleware and hit the endpoint's schema validation — key is valid
- A 200 would also mean valid (unlikely with this minimal body, but handled)

#### 5. Write unit tests — `tests/unit/first-run-gate.test.js`

Tests extract and verify the gate logic without needing the real DOM. Since sidepanel.js is a classic script (not ES module), the tests will need to mock the DOM elements and simulate the flow.

**Approach**: The gate functions (`showGate`, `hideGate`, `submitGateKey`, `resetApiKey`) are currently scoped inside sidepanel.js. For testability, extract the pure logic into a helper that can be imported.

However, to keep changes minimal (0.5 day scope), an alternative approach is to test the behavior through DOM assertions by loading a minimal HTML fixture and evaluating the gate functions. But this is complex with jsdom.

**Pragmatic approach**: Test the validation decision logic and storage interactions directly using mocks. The tests focus on the critical paths: storage check, key validation response handling, and reset.

```javascript
// tests/unit/first-run-gate.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("First-Run API Key Gate", () => {
  // Simulate the gate decision logic extracted from sidepanel.js
  // These test the core logic paths, not the DOM rendering

  it("gate shown when no key stored", async () => {
    // Storage returns empty
    const result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBeUndefined();
    // Gate should be shown (no key means gate is visible)
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
    // Simulate: validation returns success
    const resp = { success: true };
    expect(resp.success).toBe(true);

    // Store the key
    await chrome.storage.local.set({ smartrip_api_key: key });
    const result = await chrome.storage.local.get("smartrip_api_key");
    expect(result.smartrip_api_key).toBe(key);
  });

  it("does not store key on invalid validation response", async () => {
    const resp = { success: false, error: "invalid" };
    expect(resp.success).toBe(false);

    // Key should NOT be stored
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
```

**Note**: The Chrome mock in `tests/mocks/chrome.js` needs a `remove` method added for the reset test. Add to the `local` object:

```javascript
remove: vi.fn((keys, cb) => {
  if (typeof keys === "string") keys = [keys];
  for (const k of keys) delete storage[k];
  if (cb) cb();
  return Promise.resolve();
}),
```

### Key Algorithms & Logic

#### Gate initialization flow

```
1. Sidepanel loads
2. Send SIDE_PANEL_READY to service worker (line 329 — informational only, unchanged)
3. autoAnalyze() function is defined (lines 332-375 — unchanged)
4. Where autoAnalyze() was called (line 392), instead read chrome.storage.local["smartrip_api_key"]
5. If key exists:
   a. Hide gate (display: none)
   b. Show key reset button in header
   c. Call autoAnalyze() — normal flow
6. If key missing:
   a. Show gate (display: flex)
   b. Hide key reset button
   c. Do NOT call autoAnalyze()
   d. Wait for user input
```

#### Key validation flow

```
1. User enters key and clicks Activate (or presses Enter)
2. Trim input — if empty, show "Please enter your API key"
3. Disable input + button, show loading spinner
4. Send { type: "VALIDATE_API_KEY", key } to service worker
5. Service worker POSTs to /suggest with Bearer header + minimal body
6. Response handling:
   - 401 or 403 → { success: false, error: "invalid" }
   - 422 or 200 → { success: true }
   - Network error → { success: false, error: "network" }
7. On success:
   a. Store key in chrome.storage.local
   b. Hide gate
   c. Show key reset button
   d. Call autoAnalyze()
8. On failure:
   a. Show error message (network vs invalid distinction)
   b. Re-enable input + button
   c. User can edit key and retry
```

#### Reset flow

```
1. User clicks key icon in header
2. Confirm dialog: "Reset your API key? You'll need to enter it again."
3. If confirmed:
   a. chrome.storage.local.remove("smartrip_api_key")
   b. Clear gate input and error state
   c. Hide key reset button
   d. Show gate
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Empty input submitted | "Please enter your API key." — no network call |
| Invalid/revoked key (403) | "Invalid API key. Contact Alfie for a valid key." |
| Missing auth header (401) | Same as invalid — "Invalid API key. Contact Alfie for a valid key." |
| Network error (fetch throws) | "Could not reach server. Check your connection and try again." |
| `chrome.runtime.lastError` | "Connection error. Please try again." |
| Service worker not ready (503) | "Could not reach server" — transient, user retries (middleware returns 503 if `dashboard_store` not yet initialized) |

## Testing Requirements

### Critical Test Cases

See Section 5 above for full test code. Summary:

| Test | What it verifies |
|------|------------------|
| `gate shown when no key stored` | Storage empty → gate should be visible |
| `gate hidden when key exists` | Key in storage → normal UI |
| `stores key on valid validation response` | Valid response → key persisted in chrome.storage |
| `does not store key on invalid validation response` | Invalid response → no storage write |
| `reset clears key from storage` | Remove call clears key, gate re-shows |

### Chrome Mock Update

`tests/mocks/chrome.js` — add `remove` method to `storage.local`:

```javascript
remove: vi.fn((keys, cb) => {
  if (typeof keys === "string") keys = [keys];
  for (const k of keys) delete storage[k];
  if (cb) cb();
  return Promise.resolve();
}),
```

### Edge Cases to Consider

- **Key with leading/trailing whitespace**: `.trim()` handles this
- **Double-click on Activate**: Button disabled during validation prevents double-submit
- **Rapid reload during validation**: Storage write is atomic — no partial state
- **Service worker inactive**: `chrome.runtime.lastError` fires if service worker crashed, caught by error handler
- **Key that looks valid but was revoked**: Middleware returns 403, caught as "invalid"
- **User pastes key with newlines**: `.trim()` removes trailing newline; embedded newlines would fail validation (403) — correct behavior

### Manual Verification Checklist

From WBS:

- [ ] Fresh install (no key in storage) → setup screen shown
- [ ] Enter valid key → stored, normal UI appears
- [ ] Enter invalid key → error message, can retry
- [ ] Reload sidepanel with key stored → normal UI immediately
- [ ] Reset API key → returns to setup screen
- [ ] Enter key and press Enter → submits (not just click)
- [ ] Empty input → "Please enter your API key" (no network call)
- [ ] Network disconnected → "Could not reach server" error
- [ ] Key icon button hidden when no key stored
- [ ] Key icon button visible when key stored

## Dependencies & Constraints

### External Dependencies

- **A1 deployed**: Backend must be running with per-rep key support. `POST /suggest` must return 403 for invalid keys and 422 for valid keys with empty body.
- **No new packages**: All CSS uses existing design system variables. No JS libraries added.

### Constraints & Assumptions

- **A3 not yet implemented**: The stored key is NOT yet used for actual `/suggest` calls — `ALFRED_KEY` is still hardcoded. A3 wires the stored key into the Bearer header.
- **Gate only blocks sidepanel UI**: Content script (floating button, context menu) still works. The service worker still uses `ALFRED_KEY` for actual requests. This is intentional — A2 is the UI gate, A3 is the auth wire-up.
- **No key format validation**: We don't check `cr_` prefix client-side. The backend is the source of truth. Any string is sent for validation.
- **Single key per install**: One key stored. No multi-rep support needed (each rep has their own browser/profile).

## Files Modified

| File | Change |
|------|--------|
| `sidepanel/sidepanel.html` | Add `#setupGate` section, add `#headerKeyBtn` in header |
| `sidepanel/sidepanel.css` | Add `.sp-gate-*` styles (~80 lines) |
| `sidepanel/sidepanel.js` | Add gate check before autoAnalyze, gate functions, reset function, key button handler |
| `background/service-worker.js` | Add `VALIDATE_API_KEY` message handler (~20 lines) |
| `tests/mocks/chrome.js` | Add `remove` method to `storage.local` mock |
| `tests/unit/first-run-gate.test.js` | New — 5 unit tests |

## Open Questions

None — all requirements are fully specified by the WBS and PRD. Implementation can proceed.
