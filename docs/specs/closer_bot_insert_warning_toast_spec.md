# Engineering Specification: B3 — Closer-Bot Insert Warning Toast

## Context

### Current State

When a rep inserts a ChatRipper reply while the closer-bot is active for the same contact, there is no visual indication that the bot is also managing this conversation. The bot's Ably listener will cancel its pending timer when the rep sends (direction="sent"), but the rep has no awareness this is happening.

**Relevant files:**
- `sidepanel/sidepanel.js` — Insert button click handler (line 1072), Alt+I hotkey handler (line 67), `setAgentActive()` (line 1808), agent state via `agentLogoBtn.classList.contains("agent-active")`
- `sidepanel/sidepanel.css` — Existing `--warning` CSS variables (`--warning`, `--warning-bg`, `--warning-border`)
- `sidepanel/helpers.js` — Shared pure functions (B2 pattern)

**Two insert paths:**
1. **Click**: `.sp-insert-btn` click handler (line 1072) sends `INSERT_TEXT` to content script
2. **Alt+I**: Content script sends `GET_INSERT_TEXT` to sidepanel (line 67), sidepanel responds with text, content script inserts

**Agent active state:** No standalone boolean variable. Tracked via CSS class: `agentLogoBtn.classList.contains("agent-active")`. On Revio, this reflects real closer-bot whitelist status (set by `CLOSER_CHECK` API response). On non-Revio, it's a local-only toggle with no real bot.

### Desired Outcome

When a rep inserts a reply (click or Alt+I) while the closer-bot is actively managing the current Revio contact, a non-blocking amber toast appears at the top of the side panel. The insert proceeds immediately — the toast is informational only.

### Success Criteria

- Toast appears on insert when closer-bot is active for a Revio contact
- Toast does NOT appear when bot is inactive, or on non-Revio platforms
- Insert proceeds immediately regardless of toast (non-blocking)
- Toast auto-dismisses after 4 seconds
- Rapid inserts reset the timer instead of stacking toasts
- All existing tests still pass (`npm test`)

## Implementation Specification

### Data Models & Types

No new data structures. The condition check uses existing sidepanel globals:
- `currentPlatform` (string) — set by scrape response
- `closerContactId` (string|null) — set by `REVIO_CONTACT_CHANGED`
- `agentLogoBtn` (HTMLElement) — `.agent-active` class indicates bot status

### Interfaces & Contracts

```javascript
// In sidepanel/helpers.js — pure function, testable
function shouldShowInsertWarning(platform, contactId, agentActive) {
  return platform === "revio" && !!contactId && agentActive;
}
```

```javascript
// In sidepanel/sidepanel.js — DOM function, not unit-tested
function showInsertWarningToast() {
  // Delegates to shouldShowInsertWarning() for the condition check
  // Creates or reuses toast element
  // Resets 4s auto-dismiss timer on repeated calls
}
```

### Plan — High-Level Tasks

- [ ] *Task 1*: Add `shouldShowInsertWarning()` to `sidepanel/helpers.js`
- [ ] *Task 2*: Add `showInsertWarningToast()` to `sidepanel/sidepanel.js`
- [ ] *Task 3*: Wire toast into both insert paths (click + Alt+I)
- [ ] *Task 4*: Add `.sp-toast` CSS with amber styling and fade animation
- [ ] *Task 5*: Add unit tests for `shouldShowInsertWarning()`

### Implementation Order — Step-by-Step Subtasks

#### Task 1: Add `shouldShowInsertWarning()` to `sidepanel/helpers.js`

Add after `buildAnalysisHtml()`, before the CJS export block:

```javascript
const INSERT_WARNING_MSG =
  "Bot is managing this contact \u2014 sending will pause its next auto-reply";

function shouldShowInsertWarning(platform, contactId, agentActive) {
  return platform === "revio" && !!contactId && agentActive;
}
```

Update the CJS export to include:
```javascript
if (typeof module !== "undefined") {
  module.exports = {
    escHtml, formatMatchValue, buildAnalysisHtml, MATCH_TOOLTIP,
    shouldShowInsertWarning, INSERT_WARNING_MSG
  };
}
```

#### Task 2: Add `showInsertWarningToast()` to `sidepanel/sidepanel.js`

Add near the insert handlers (around line 1068). Uses module-level variables for toast state:

```javascript
let toastEl = null;
let toastTimer = null;
let toastFadeTimer = null;

function showInsertWarningToast() {
  const active = agentLogoBtn.classList.contains("agent-active");
  if (!shouldShowInsertWarning(currentPlatform, closerContactId, active)) return;

  // Reset timers if toast already visible (including fade-out phase)
  if (toastTimer) clearTimeout(toastTimer);
  if (toastFadeTimer) clearTimeout(toastFadeTimer);

  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "sp-toast";
    toastEl.textContent = INSERT_WARNING_MSG;
    document.body.appendChild(toastEl);
  } else {
    // Re-trigger entrance animation on repeated insert
    toastEl.classList.remove("sp-toast-out");
  }

  toastTimer = setTimeout(() => {
    if (toastEl) {
      toastEl.classList.add("sp-toast-out");
      toastFadeTimer = setTimeout(() => {
        if (toastEl) {
          toastEl.remove();
          toastEl = null;
        }
        toastTimer = null;
        toastFadeTimer = null;
      }, 200); // match fade-out duration
    }
  }, 4000);
}
```

#### Task 3: Wire toast into both insert paths

**Click path** — inside the `.sp-insert-btn` forEach (line 1072), add as first line of the click handler:

```javascript
content.querySelectorAll(".sp-insert-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    showInsertWarningToast();  // <-- add this
    const text = getMessageText(Number.parseInt(btn.dataset.idx));
    // ... rest unchanged
  });
});
```

**Alt+I path** — inside the `GET_INSERT_TEXT` handler (line 67), add before `sendResponse`:

```javascript
if (message.type === "GET_INSERT_TEXT") {
  const allMsgs = content.querySelectorAll(".sp-message-text[data-idx]");
  if (allMsgs.length === 0) {
    sendResponse({ text: "" });
    return true;
  }

  showInsertWarningToast();  // <-- add this (before sendResponse, after empty check)

  // ... rest unchanged
```

Toast fires before the insert proceeds. Non-blocking — no `await`, no conditional gate.

#### Task 4: Add `.sp-toast` CSS to `sidepanel/sidepanel.css`

Add after the `.sp-warning-row` rules (end of the analysis panel section):

```css
/* Toast — non-blocking notification */
.sp-toast {
  position: fixed;
  top: 8px;
  left: 8px;
  right: 8px;
  z-index: 50;
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  color: var(--warning);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  animation: sp-toast-in 200ms ease-out;
}

.sp-toast-out {
  animation: sp-toast-out 200ms ease-in forwards;
}

@keyframes sp-toast-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sp-toast-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-8px); }
}

@media (prefers-reduced-motion: reduce) {
  .sp-toast { animation: none; }
  .sp-toast-out { animation: none; opacity: 0; }
}
```

**Design notes:**
- Uses existing `--warning-*` CSS variables (amber palette) — consistent with B2 warning row
- `position: fixed` + `top: 8px` overlays at the top of the sidepanel viewport, above header (`z-index: 10`). Toast `z-index: 50` ensures it's always on top. Header overlap is acceptable: toast is temporary (4s), and the toast only fires on insert — when the header actions (re-analyze, stop) are not needed. The agent bar is always visible when the toast fires (bot must be active), so content is already pushed down ~100px. Positioning below the agent bar was considered but rejected — the agent bar height varies and absolute pixel offsets would be fragile.
- `left: 8px; right: 8px` gives edge breathing room matching the floating navbar pattern
- 200ms animation matches the existing `duration-timing` micro-interaction range

#### Task 5: Add unit tests

Create `tests/unit/warning-toast.test.js`:

```javascript
import { describe, it, expect } from "vitest";
const { shouldShowInsertWarning, INSERT_WARNING_MSG } = require("../../sidepanel/helpers.js");

describe("shouldShowInsertWarning", () => {
  it("returns true for revio with contactId and active agent", () => {
    expect(shouldShowInsertWarning("revio", "ct_123", true)).toBe(true);
  });

  it("returns false when agent is not active", () => {
    expect(shouldShowInsertWarning("revio", "ct_123", false)).toBe(false);
  });

  it("returns false for non-revio platform", () => {
    expect(shouldShowInsertWarning("linkedin", "ct_123", true)).toBe(false);
  });

  it("returns false when contactId is null", () => {
    expect(shouldShowInsertWarning("revio", null, true)).toBe(false);
  });

  it("returns false when contactId is empty string", () => {
    expect(shouldShowInsertWarning("revio", "", true)).toBe(false);
  });

  it("returns false when all conditions are false", () => {
    expect(shouldShowInsertWarning("gmail", null, false)).toBe(false);
  });
});

describe("INSERT_WARNING_MSG", () => {
  it("is a non-empty string", () => {
    expect(typeof INSERT_WARNING_MSG).toBe("string");
    expect(INSERT_WARNING_MSG.length).toBeGreaterThan(0);
  });

  it("mentions bot and sending", () => {
    expect(INSERT_WARNING_MSG).toContain("Bot");
    expect(INSERT_WARNING_MSG).toContain("sending");
  });
});
```

### Key Algorithms & Logic

**Toast lifecycle:**
1. Insert triggered (click or Alt+I)
2. `showInsertWarningToast()` called
3. `shouldShowInsertWarning()` checks: revio + contactId + agent-active → false = return early
4. If no existing toast: create element, append to body, start 4s timer
5. If existing toast: clear old timer, remove `sp-toast-out` class, start fresh 4s timer
6. After 4s: add `sp-toast-out` class (fade-out animation), remove element after 200ms

**Why no empty-check guard for toast on Alt+I:**
The Alt+I handler already returns early when `allMsgs.length === 0` (line 69-71). The `showInsertWarningToast()` call is placed after this check, so the toast only fires when there's actual text to insert.

### Error Handling

No error handling needed. Toast is fire-and-forget:
- If DOM append fails silently, insert still proceeds
- If `agentLogoBtn` is null (shouldn't happen — declared at line 19), `classList.contains` returns false → no toast
- Multiple rapid calls safely reset the timer (no stacking)

## Testing Requirements

### Critical Test Cases

6 tests for `shouldShowInsertWarning()` + 2 for `INSERT_WARNING_MSG` constant = 8 total (see Task 5 above).

Toast DOM behavior (`showInsertWarningToast`) is not unit-tested — it reads globals and manipulates DOM. Verified manually.

### Edge Cases to Consider

- Rapid Alt+I cycling (5+ presses in 2 seconds) → single toast, timer keeps resetting
- Contact switch while toast is visible → toast from previous contact stays visible for remaining time (harmless — 4s max, and new contact may also have bot active)
- Agent deactivated while toast is visible → toast completes its 4s cycle (harmless — already informational)
- Insert with no messages on page → no toast (Alt+I returns early at line 69; click handler has no text to insert)

## Dependencies & Constraints

### External Dependencies

None. Uses only existing CSS variables and sidepanel globals.

### Constraints & Assumptions

- Toast overlays the header. This is acceptable because it's temporary (4s) and the header actions (re-analyze, stop, reset key) are not needed during an insert action.
- `INSERT_WARNING_MSG` uses em-dash (`\u2014`). Same encoding pattern as `MATCH_TOOLTIP`.
- Non-Revio platforms never show the toast. The local-only agent toggle has no real bot — warning would be misleading.

## Files Modified Summary

| File | Change |
|------|--------|
| `sidepanel/helpers.js` | Add `shouldShowInsertWarning()`, `INSERT_WARNING_MSG`, update CJS export |
| `sidepanel/sidepanel.js` | Add `showInsertWarningToast()`, wire into click + Alt+I handlers |
| `sidepanel/sidepanel.css` | Add `.sp-toast`, `.sp-toast-out`, keyframe animations |
| `tests/unit/warning-toast.test.js` | 8 unit tests |

## Open Questions

None — all questions resolved during consultation.
