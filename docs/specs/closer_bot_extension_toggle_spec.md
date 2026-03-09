# Engineering Specification: B3 — Closer-Bot Extension Toggle & Bearer Auth

**Status:** Draft
**Date:** March 8, 2026
**WBS Task:** B3 (chat-ripper portion)
**Depends on:** Closer-bot dual auth (see `closer-bot/docs/specs/shared_api_keys_scope_enforcement_spec.md`)
**Effort:** 1 day

---

## Context

### Current State

The ChatRipper extension toggles closer-bot on/off for Revio contacts using a shared static key hardcoded in `config.js`:

```javascript
// config.js:4
CLOSER_API_KEY: "aa282e3e5cba71b227771b971b6845130d3fa85eaefe5f5de58f60bc3994531f"
```

The service worker (`background/service-worker.js:298-345`) sends this key as `X-API-Key` for all three closer config API calls (`CLOSER_CHECK`, `CLOSER_ADD`, `CLOSER_REMOVE`). There is no per-rep identity — any extension user can toggle any contact.

Additionally, the extension has no awareness of:
- Whether the rep's API key has the `closer` scope
- Whether the rep is in the `allowed_closer_ids` rollout list

The sidepanel simply shows/hides the agent bar toggle based on whether the contact is whitelisted, with no eligibility pre-check.

### Desired Outcome

Replace the static shared key with the rep's per-rep API key (Bearer auth). Show a 4-state agent bar UX that communicates scope, eligibility, and toggle status. Pass `user_id` from the Revio contact response through to the sidepanel for eligibility checking.

### Success Criteria

- [ ] `CLOSER_API_KEY` removed from `config.js`
- [ ] All closer config API calls use `Authorization: Bearer {rep_key}` via existing `getStoredApiKey()` from `auth.js`
- [ ] Extension checks `allowed_closer_ids` status before showing the toggle
- [ ] `CLOSER_ADD` uses Bearer auth (server extracts `rep_id` from auth context for attribution)
- [ ] Agent bar shows 4 distinct UX states: hidden / disabled / OFF / ON
- [ ] `userId` (Revio assigned closer) propagated from content script through sidepanel

## Architecture Decision: Three Identity Spaces

Three identity spaces exist and do not overlap:

| Identifier | System | Example | Source in extension |
|-----------|--------|---------|---------------------|
| `rep_id` | Hackathon API keys | `"adam"` | Stored at key generation (not directly used by extension) |
| Revio `user_id` | Closer-bot eligibility | `"67a1b2c3d4e5f6"` | `contact.user_id` from Revio `/contacts/{id}` response |
| Revio `contact_id` | Closer-bot inbox whitelist | `"672a6a92875fefbae5085c87"` | URL path `/inbox/{id}` |

**Key insight**: `user_id` is the *contact's assigned closer*, not the logged-in rep. The eligibility check verifies that this closer is in the `allowed_closer_ids` rollout list.

### Two Authorization Layers

| Layer | Check | Question answered | Who controls |
|-------|-------|-------------------|-------------|
| **Service authorization** | `closer` scope on API key | "Is this rep licensed to use closer-bot?" | Admin (hackathon dashboard) |
| **Operational rollout** | `allowed_closer_ids` list | "Is this closer's inbox being processed?" | Admin (Streamlit) |

Both are checked. A rep could have `closer` scope but not be in `allowed_closer_ids` yet.

## Implementation Specification

### Files to Modify

| File | Change |
|------|--------|
| `config.js` | Remove `CLOSER_API_KEY` |
| `background/service-worker.js` | Use `getStoredApiKey()` for Bearer auth; add `CLOSER_ELIGIBLE` handler |
| `content/content.js` | Add `userId` to top-level scrape result |
| `sidepanel/sidepanel.js` | Read `userId` from scrape data; implement 4-state agent bar UX |

### 1. Remove Static Key — `config.js`

```diff
 const CONFIG = {
   SMARTRIP_API: "https://ai-sales-copilot-458007064300.us-east1.run.app",
   CLOSER_API: "https://close.alfredloh.com",
-  CLOSER_API_KEY: "aa282e3e5cba71b227771b971b6845130d3fa85eaefe5f5de58f60bc3994531f",
   // ... rest unchanged
 };
```

### 2. Switch to Bearer Auth — `background/service-worker.js`

Replace all three closer config API handlers to use the rep's stored API key via `getStoredApiKey()` from `auth.js` (already imported via `importScripts("auth.js")` at the top of the service worker).

**Important**: Use the existing `getStoredApiKey()` function from `background/auth.js:1-4`:
```javascript
async function getStoredApiKey() {
  const result = await chrome.storage.local.get("smartrip_api_key");
  return result.smartrip_api_key || null;
}
```

Do NOT create a new `getRepKey()` — `getStoredApiKey()` already does exactly this.

**403 differentiation** (C3): The closer-bot config API returns two distinct 403 messages:
- `"Invalid or revoked API key"` → key is dead, affects ALL extension features (SmartRip too). Must call `clearRevokedKey()` from `auth.js` (line 6) and show re-auth prompt.
- `"Key not authorized for Closer Bot"` → key is valid but lacks `closer` scope. Only hide closer agent bar.

The helper `handle403` reads the response body to distinguish:

```javascript
// Helper: differentiate revoked key from no-scope 403
// clearRevokedKey() is intentionally fire-and-forget (no await) —
// we only need the side effect (storage removal), not the return value
async function handle403(r) {
  const body = await r.json().catch(() => ({}));
  const revoked = (body.detail || "").includes("Invalid or revoked");
  if (revoked) clearRevokedKey();
  return { forbidden: true, revoked };
}

// CLOSER_CHECK — Bearer auth, differentiates 403 types
if (message.type === "CLOSER_CHECK") {
  const cid = message.contactId;
  getStoredApiKey().then((key) => {
    if (!key) { sendResponse({ success: false, whitelisted: false }); return; }
    fetch(`${CONFIG.CLOSER_API}/api/config/allowed-inboxes/${cid}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
      .then(async (r) => {
        if (r.status === 403) {
          const info = await handle403(r);
          return { whitelisted: false, ...info };
        }
        return r.json();
      })
      .then((data) => sendResponse({
        success: true,
        whitelisted: !!data.whitelisted,
        forbidden: !!data.forbidden,
        revoked: !!data.revoked,
      }))
      .catch(() => sendResponse({ success: false, whitelisted: false }));
  });
  return true;
}

// CLOSER_ADD — Bearer auth only (server extracts rep_id from auth context)
// No rep_key in body — avoids sending raw key twice (C2)
if (message.type === "CLOSER_ADD") {
  const cid = message.contactId;
  getStoredApiKey().then((key) => {
    if (!key) { sendResponse({ success: false }); return; }
    fetch(`${CONFIG.CLOSER_API}/api/config/allowed-inboxes/${cid}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    })
      .then(async (r) => {
        if (r.status === 403) {
          const info = await handle403(r);
          return { forbidden: true, revoked: info.revoked };
        }
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => sendResponse({
        success: !data.forbidden,
        data,
        forbidden: !!data.forbidden,
        revoked: !!data.revoked,
      }))
      .catch(() => sendResponse({ success: false }));
  });
  return true;
}

// CLOSER_REMOVE — Bearer auth, handles 403 same as above (R5)
if (message.type === "CLOSER_REMOVE") {
  const cid = message.contactId;
  getStoredApiKey().then((key) => {
    if (!key) { sendResponse({ success: false }); return; }
    fetch(`${CONFIG.CLOSER_API}/api/config/allowed-inboxes/${cid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    })
      .then(async (r) => {
        if (r.status === 403) {
          const info = await handle403(r);
          return { forbidden: true, revoked: info.revoked };
        }
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => sendResponse({
        success: !data.forbidden,
        data,
        forbidden: !!data.forbidden,
        revoked: !!data.revoked,
      }))
      .catch(() => sendResponse({ success: false }));
  });
  return true;
}
```

### 3. New Message Handler: `CLOSER_ELIGIBLE` — `background/service-worker.js`

Checks whether the contact's assigned closer (`userId`) is in the `allowed_closer_ids` rollout list. Uses the existing `GET /api/config/allowed-closers/{user_id}` endpoint (no new endpoint needed — decision from closer-bot spec).

```javascript
// CLOSER_ELIGIBLE — check if contact's closer is in allowed_closer_ids
// Simplified 403 handling: no handle403() call here. This handler only runs
// after CLOSER_CHECK succeeds (scope already validated). A 403 here means
// the key was revoked in the narrow window between the two calls — treating
// it as "not eligible" is safe; the next contact change triggers a fresh
// CLOSER_CHECK which will detect the revocation and clear the key.
if (message.type === "CLOSER_ELIGIBLE") {
  const userId = message.userId;
  getStoredApiKey().then((key) => {
    if (!key || !userId) {
      sendResponse({ success: false, eligible: false });
      return;
    }
    fetch(`${CONFIG.CLOSER_API}/api/config/allowed-closers/${userId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
      .then((r) => {
        if (r.status === 403) return { allowed: false };
        return r.json();
      })
      .then((data) => {
        // eligible if explicitly allowed OR no explicit list exists (all allowed)
        const eligible = !!data.allowed || data.explicit_list === false;
        sendResponse({ success: true, eligible });
      })
      .catch(() => sendResponse({ success: false, eligible: false }));
  });
  return true;
}
```

### 4. Extract `userId` from Revio Contact — `content/content.js`

The content script's `scrapeRevioAsync()` (lines 466-537) already calls `fetchRevioContact(contactId)` and builds a result object with `contactId`, `contactName`, `contactDetails`, etc. Add `userId` at the **top level** of the result object.

**Propagation path**:
1. `content.js` → `scrapeRevioAsync()` adds `userId: contact?.user_id || null` to result
2. Service worker returns scrape result in `SCRAPE_PAGE` response
3. `sidepanel.js` stores scrape result as `currentFullPage` (line ~345)
4. Sidepanel reads `currentFullPage.userId` when sending `CLOSER_ELIGIBLE` message

**Note**: The `unsupported_channel` early return path (content.js:482-488) does NOT need `userId` — the sidepanel detects unsupported channels and returns before reaching `CLOSER_CHECK`, so `userId` is never read in that flow.

```javascript
// content/content.js — in scrapeRevioAsync(), around line 517
const result = {
  type: "dm_thread",
  contactName: contactName,
  contactId: contactId,
  userId: contact?.user_id || null,  // ← ADD THIS: Revio assigned closer ID
  conversation: thread.join("\n\n"),
  messageCount: messages.length,
  messages: messages,
  contactDetails: contact
    ? {
        stage: contact.stage || "",
        score: contact.rocket_selling_score || null,
        currentBox: contact.rocket_selling_current_box || null,
        channel: contact.channel || null,
        tags: contact.tags || [],
        notes: contact.ai_notes || "",
      }
    : null,
};
```

### 5. Four-State Agent Bar UX — `sidepanel/sidepanel.js`

Implement a 4-state UX for the closer-bot agent bar based on scope, eligibility, and whitelist status.

**UX States:**

| Key has `closer` scope? | Rep in `allowed_closer_ids`? | Contact in `allowed_inboxes`? | UX |
|------------------------|----------------------------|------------------------------|-----|
| No | — | — | Agent bar hidden (no closer features) |
| Yes (revoked key) | — | — | Agent bar hidden + clear key + show re-auth prompt |
| Yes | No | — | Agent bar shows "Closer Bot not enabled for this rep" (disabled toggle) |
| Yes | Yes | No | Agent bar shows toggle in OFF state |
| Yes | Yes | Yes | Agent bar shows toggle in ON state |
| (checking) | — | — | Agent bar shows "Checking..." spinner (R7) |

**Disabled state rendering** (R6): The existing `setAgentDisabled()` (sidepanel.js:1177) sets opacity 0.4 and disables pointer events with a title "Not available for email contacts". Generalize this to accept a message parameter:

**Note**: Uses existing DOM elements — `agentBar` (id `agentBar`, the status bar div) and `agentLogoBtn` (id `agentLogoBtn`, the clickable logo button). The current toggle mechanism uses `agentLogoBtn.classList.toggle("agent-active")` — not a checkbox.

This function **replaces `setAgentDisabled()` and wraps `setAgentActive()`**. Delete `setAgentDisabled()` after migration — `setAgentBarState("disabled", msg)` supersedes it. It delegates to `setAgentActive()` for the "on" state because `setAgentActive(true)` manages responsibilities beyond visual toggle:
- `spHeader.classList.toggle("agent-header-active")` — header styling
- `agentMsgInterval` — rotating status messages every 3s
- `agentHudInterval` — periodic re-scrape every 15s for HUD freshness
- `updateHud()` — initial HUD refresh

For all non-"on" states, `setAgentActive(false)` is called first to clear those intervals and remove the active class, then the overlay styles (opacity, pointerEvents, title) are applied.

```javascript
function setAgentBarState(state, message) {
  // Delegate to setAgentActive for interval management, spHeader class,
  // and agentBar display (sidepanel.js:1848-1899)
  agentLogoBtn.classList.remove("agent-loading"); // clear loading pulse (O3)

  if (state === "on") {
    setAgentActive(true);
    agentLogoBtn.style.opacity = "";
    agentLogoBtn.style.pointerEvents = "";
    agentLogoBtn.title = "";
    return;
  }

  // All non-"on" states: deactivate first (clears intervals, hides bar)
  setAgentActive(false);

  switch (state) {
    case "hidden":
    case "off":
      agentLogoBtn.style.opacity = "";
      agentLogoBtn.style.pointerEvents = "";
      agentLogoBtn.title = "";
      break;
    case "disabled":
      // O1: Show message visibly in agentBar, not just tooltip.
      // Tooltip alone requires hover and is easy to miss.
      agentLogoBtn.style.opacity = "0.4";
      agentLogoBtn.style.pointerEvents = "none";
      agentLogoBtn.title = message || "Closer Bot not enabled for this rep";
      if (agentStatusText) {
        agentStatusText.textContent = message || "Closer Bot not enabled for this rep";
      }
      agentBar.style.display = "";
      break;
    case "loading":
      // O3: Reuse existing pulse ring animation for visual motion.
      // .agent-loading triggers the same CSS keyframes as .agent-active
      // but at reduced opacity so it reads as "checking" not "active".
      agentLogoBtn.classList.add("agent-loading");
      agentLogoBtn.style.opacity = "0.6";
      agentLogoBtn.style.pointerEvents = "none";
      agentLogoBtn.title = "Checking...";
      // F2: Show status bar with text (consistent with "disabled" case)
      if (agentStatusText) agentStatusText.textContent = "Checking...";
      agentBar.style.display = "";
      break;
  }
}
```

**CSS addition for loading pulse** (O3): Add to `sidepanel.css` alongside the existing `.agent-active` pulse rules (line ~1989):

```css
/* Loading state: reuse radar pulse at reduced intensity */
.sp-logo-wrap.agent-loading .sp-logo-pulse-ring {
  animation: sp-radar-pulse 2s ease-out infinite;
  opacity: 0.4;
}

/* Respect motion preferences (F1) — covers both active and loading pulse */
@media (prefers-reduced-motion: reduce) {
  .sp-logo-wrap.agent-active .sp-logo-pulse-ring,
  .sp-logo-wrap.agent-active .sp-logo-pulse-ring-2,
  .sp-logo-wrap.agent-active .sp-logo,
  .sp-logo-wrap.agent-loading .sp-logo-pulse-ring {
    animation: none;
  }
}
```

This reuses the existing `sp-radar-pulse` keyframes — no new animation needed. The `opacity: 0.4` on the ring (combined with the button's `0.6` opacity) makes it visually distinct from the fully-active pulse.

**Two entry points**: The same 4-state flow below applies to **both** `REVIO_CONTACT_CHANGED` (sidepanel.js:334-364) **and** `autoAnalyze` (sidepanel.js:401-409). Both paths scrape the page, store `currentFullPage`, and check the closer whitelist. Replace the existing `setAgentActive(r.whitelisted)` call in `autoAnalyze` with the full flow below. Add a `switchId` guard in `autoAnalyze` (same as `REVIO_CONTACT_CHANGED` at line 336) to discard stale responses when chaining CLOSER_CHECK → CLOSER_ELIGIBLE.

**Flow on contact change (REVIO_CONTACT_CHANGED and autoAnalyze):**

```
1. SCRAPE_PAGE → get { contactId, userId, platform, ... }
2. Store as currentFullPage
3. If platform === "revio":
   a. Show agent bar in "loading" state (R7)
   b. Send CLOSER_CHECK(contactId) to background
   c. Response: { whitelisted, forbidden, revoked }
      - If revoked: clearRevokedKey() already called by handle403().
        Hide agent bar, show re-auth prompt via first-run gate, STOP
      - If forbidden (no closer scope): hide agent bar, STOP
      - If whitelisted: show toggle ON, STOP
      - If not whitelisted:
        d. If currentFullPage.userId is null → show "not enabled" (disabled), STOP
        e. Send CLOSER_ELIGIBLE(userId from currentFullPage.userId) to background
        f. Response: { eligible }
           - If eligible: show toggle OFF (rep can activate)
           - If not eligible: show "not enabled for this rep" (disabled)
```

**Key detail**: The `userId` for `CLOSER_ELIGIBLE` comes from `currentFullPage.userId`, which was set in step 2 from the scrape result. This is the Revio assigned closer ID, NOT the rep's API key ID.

**Toggle click handler replacement** (O2): Replace the existing Revio branch of the `agentLogoBtn` click handler (sidepanel.js:1906-1921) with optimistic toggle + revert on failure + `switchId` guard:

```javascript
agentLogoBtn.addEventListener("click", () => {
  // On Revio pages with a contact — toggle via Closer Bot Config API
  if (currentPlatform === "revio" && closerContactId) {
    const capturedId = closerContactId; // switchId guard (N5)
    const isCurrentlyActive = agentLogoBtn.classList.contains("agent-active");

    if (isCurrentlyActive) {
      // ON → OFF: optimistic
      setAgentBarState("off");
      chrome.runtime.sendMessage({ type: "CLOSER_REMOVE", contactId: capturedId }, (r) => {
        if (closerContactId !== capturedId) return; // contact changed, discard
        if (chrome.runtime.lastError || !r || !r.success) {
          if (r && r.revoked) { setAgentBarState("hidden"); return; }
          if (r && r.forbidden) { setAgentBarState("hidden"); return; }
          setAgentBarState("on"); // revert — removal failed
          return;
        }
        // success: already showing "off"
      });
    } else {
      // OFF → ON: optimistic
      setAgentBarState("on");
      chrome.runtime.sendMessage({ type: "CLOSER_ADD", contactId: capturedId }, (r) => {
        if (closerContactId !== capturedId) return; // contact changed, discard
        if (chrome.runtime.lastError || !r || !r.success) {
          if (r && r.revoked) { setAgentBarState("hidden"); return; }
          if (r && r.forbidden) { setAgentBarState("hidden"); return; }
          setAgentBarState("off"); // revert — addition failed
          return;
        }
        // success: already showing "on"
      });
    }
    return;
  }
  // Non-Revio: local-only toggle (unchanged)
  const isActive = agentLogoBtn.classList.toggle("agent-active");
  chrome.storage.local.set({ agentEnabled: isActive });
  setAgentActive(isActive);
});
```

This replaces the existing handler at sidepanel.js:1906-1927. The non-Revio branch (local-only toggle) is unchanged.

## Key Algorithms & Logic

### Extension Toggle Flow

```
1. Contact changes in Revio
2. Content script scrapes page → { contactId, userId, ... }
3. Sidepanel receives scrape data, stores as currentFullPage
4. Sidepanel sets agent bar to "loading" state
5. Sidepanel sends CLOSER_CHECK(contactId) to background
6. Background calls GET /api/config/allowed-inboxes/{contactId} with Bearer
7. If 403 "Invalid or revoked":
   a. handle403() calls clearRevokedKey()
   b. Response includes revoked: true
   c. Sidepanel hides agent bar, triggers first-run re-auth gate, stop
8. If 403 "not authorized for Closer Bot":
   a. Response includes forbidden: true, revoked: false
   b. Sidepanel hides agent bar, stop
9. If whitelisted → show toggle ON, stop
10. If not whitelisted → sidepanel sends CLOSER_ELIGIBLE(currentFullPage.userId)
11. Background calls GET /api/config/allowed-closers/{userId} with Bearer
12. If eligible → show toggle OFF (can activate)
13. If not eligible → show "not enabled for this rep" (disabled toggle)
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No stored API key (pre-first-run) | `getStoredApiKey()` returns null. All closer calls skipped. Agent bar hidden. |
| 403 "Key not authorized for Closer Bot" | `forbidden: true, revoked: false`. Agent bar hidden (rep lacks `closer` scope). |
| 403 "Invalid or revoked API key" | `forbidden: true, revoked: true`. `handle403()` calls `clearRevokedKey()`. Agent bar hidden. First-run gate triggers re-auth on next action. **This affects all extension features, not just closer.** |
| 403 on CLOSER_ADD/REMOVE (R5) | Same `handle403()` logic. If revoked, key is cleared. Response includes `forbidden` flag so sidepanel can update agent bar state. |
| CLOSER_ADD/REMOVE network failure | `success: false`. Revert to previous state — if toggling ON failed, revert to OFF; if toggling OFF failed, revert to ON. No silent swallow. |
| Network error on CLOSER_CHECK | `success: false`. Agent bar hidden (fail-closed). |
| `userId` is null (contact has no assigned closer) | `CLOSER_ELIGIBLE` skipped. Show "not enabled" disabled state. |
| Config API 503 (no DATABASE_URL on server) | Treated as network error. Agent bar hidden. |

## Testing Requirements

### Critical Test Cases

```javascript
// tests/service-worker.test.js

test("CLOSER_CHECK uses getStoredApiKey for Bearer auth", () => {
  // Given: stored API key exists
  // When: CLOSER_CHECK message sent
  // Then: fetch called with Authorization: Bearer {key}
});

test("CLOSER_CHECK without stored key returns failure", () => {
  // Given: no stored API key
  // When: CLOSER_CHECK message sent
  // Then: sendResponse({ success: false, whitelisted: false })
});

test("CLOSER_CHECK 403 no-scope sets forbidden without revoked", () => {
  // Given: config API returns 403 "Key not authorized for Closer Bot"
  // When: CLOSER_CHECK message handled
  // Then: sendResponse includes forbidden: true, revoked: false
});

test("CLOSER_CHECK 403 revoked key calls clearRevokedKey", () => {
  // Given: config API returns 403 "Invalid or revoked API key"
  // When: CLOSER_CHECK message handled
  // Then: clearRevokedKey() called, sendResponse includes revoked: true
});

test("CLOSER_ADD does not send raw key in body", () => {
  // Given: stored API key exists
  // When: CLOSER_ADD message sent
  // Then: fetch has no body (server extracts rep_id from Bearer token)
});

test("CLOSER_ADD 403 calls handle403 and returns forbidden", () => {
  // Given: config API returns 403 on POST
  // When: CLOSER_ADD message handled
  // Then: sendResponse includes forbidden: true
});

test("CLOSER_REMOVE 403 calls handle403 and returns forbidden", () => {
  // Given: config API returns 403 on DELETE
  // When: CLOSER_REMOVE message handled
  // Then: sendResponse includes forbidden: true
});

test("CLOSER_ELIGIBLE checks allowed_closer_ids", () => {
  // Given: stored API key, userId provided
  // When: CLOSER_ELIGIBLE message sent
  // Then: fetch called to /api/config/allowed-closers/{userId}
});

test("CLOSER_ELIGIBLE with null userId returns ineligible", () => {
  // Given: userId is null
  // When: CLOSER_ELIGIBLE message sent
  // Then: sendResponse({ success: false, eligible: false })
});
```

### Edge Cases

- Extension sends `CLOSER_ADD` before `CLOSER_CHECK` completes → race handled by idempotent whitelist add
- `userId` missing from scrape result (non-Revio contact, or contact not yet loaded) → skip eligibility check, show "not enabled" disabled state
- Rep's key revoked between CLOSER_CHECK and CLOSER_ADD → CLOSER_ADD handle403 calls `clearRevokedKey()`, returns `revoked: true`, sidepanel hides agent bar
- Multiple rapid contact changes → each triggers fresh check; stale responses ignored if `closerContactId` changed. Apply the existing `switchId` capture pattern (from `REVIO_CONTACT_CHANGED`, sidepanel.js:336) to the toggle click handler for CLOSER_ADD/REMOVE to avoid acting on a stale contact:
  ```javascript
  // In agentLogoBtn click handler — capture contactId at click time
  const capturedId = closerContactId;
  chrome.runtime.sendMessage({ type: "CLOSER_ADD", contactId: capturedId }, (r) => {
    if (closerContactId !== capturedId) return; // contact changed, discard
    // ... handle response
  });
  ```
- 403 response body not valid JSON → `handle403` catches parse error, defaults to `revoked: false` (safe — treats as no-scope)

## Dependencies & Constraints

### Dependencies

- **Closer-bot dual auth** must be deployed first (accepts both `X-API-Key` and Bearer auth)
- `getStoredApiKey()` from `background/auth.js:1-4` (already exists, no changes needed)
- `clearRevokedKey()` from `background/auth.js:6` (already exists, clears `smartrip_api_key` from storage)
- `importScripts("auth.js")` already in service worker (no changes needed)

### Constraints

- **No build step** — all files loaded directly by Chrome
- **Three contexts** — content script, service worker, sidepanel are isolated; communicate via message passing
- **Backward incompatible** — once `CLOSER_API_KEY` is removed from `config.js`, the extension requires the closer-bot to have dual auth deployed

## Implementation Order

1. **`content/content.js`**: Add `userId` to scrape result (safe, additive)
2. **`config.js`**: Remove `CLOSER_API_KEY`
3. **`background/service-worker.js`**: Switch CLOSER_CHECK/ADD/REMOVE to Bearer auth; add CLOSER_ELIGIBLE handler
4. **`sidepanel/sidepanel.js`**: Implement 4-state agent bar UX
5. **Tests**: Verify message handling and auth flow

## Relationship to Other Specs

| Spec | Relationship |
|------|-------------|
| **Closer-bot dual auth** | Prerequisite. That spec adds Bearer auth to the config API. This spec is the consumer. |
| **API key scopes (hackathon)** | Upstream. The `closer` scope was added there. This spec makes the extension react to it. |
| **Per-rep bot attribution** | Superseded for auth. That spec originally proposed `rep_key` in body. Bearer auth now provides rep identity server-side — no raw key in body. |
| **B1 — Restrict content scripts** | Independent. Can be implemented in any order. |
