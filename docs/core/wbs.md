# Work Breakdown Structure — ChatRipper AI Launch

> **Target**: CWS unlisted submission by March 9-10, 2026
> **Developer**: Alfie (solo) + hackathon agent (backend)
> **Status**: Approved
> **PRD**: `docs/core/prd.md` (Approved)

## Overview

9 launch TODOs organized into two parallel tracks. Backend per-rep keys are implemented by the hackathon agent from spec; all other work is in the chat-ripper extension repo.

---

## Track A — Auth Chain (Serial)

Auth tasks form a dependency chain: backend must deploy before extension auth changes can land.

### A1. Per-Rep API Keys (Backend) ✅

> **Repo**: hackathon/ai-sales-copilot
> **Spec**: `hackathon/docs/specs/per_rep_api_keys_spec.md` (Approved)
> **Owner**: Hackathon agent
> **Effort**: 1-1.5 days
> **Depends on**: Nothing
> **Blocks**: A2, A3
> **Status**: **Deployed** — 178 tests pass across 3 test files

**Scope**: DB schema (api_keys table + rep_id on calls), key CRUD methods, middleware refactor with legacy fallback, pipeline rep_id passthrough, key management API endpoints, dashboard per-rep filtering + UI, tests.

**Deliverables**:
- `api_keys` table with SHA-256 hashed keys
- `POST /api/keys/generate`, `GET /api/keys`, `DELETE /api/keys/{id}` endpoints
- Middleware accepts `Authorization: Bearer {key}` + legacy `X-Copilot-Key` fallback
- `rep_id` recorded on every `/suggest` call
- Dashboard: Rep column, filter dropdown, detail panel
- 15+ automated tests across 3 test files

**Verification**:
- [x] Generate a test key via `POST /api/keys/generate`
- [x] `POST /suggest` with Bearer header returns 200 and records rep_id
- [x] `POST /suggest` with invalid key returns 403
- [x] `POST /suggest` with no key returns 401
- [x] Legacy `X-Copilot-Key` still returns 200 (rep_id = "legacy")
- [x] Dashboard shows Rep column and filter works
- [x] All tests pass (178 tests)

---

### A2. First-Run API Key Setup Gate ✅

> **Repo**: chat-ripper
> **Files**: `sidepanel/sidepanel.js`, `sidepanel/sidepanel.html`, `sidepanel/sidepanel.css`, `background/service-worker.js`
> **Spec**: `docs/specs/first_run_api_key_gate_spec.md` (Approved)
> **Effort**: 0.5 day (actual: 0.5 day — matched estimate)
> **Depends on**: A1 deployed + keys generated
> **Blocks**: A3
> **Status**: **Implemented** — commit `34d626e`, 5 tests pass

**Scope**: When sidepanel opens and no API key is stored in `chrome.storage.local`, show a setup screen instead of the normal UI. Rep enters their key, extension validates it against the backend, stores it on success.

**User Story**: As a rep, I enter my API key once on first use so the extension can authenticate my requests.

**Implementation**:
1. On sidepanel load, check `chrome.storage.local` for `smartrip_api_key`
2. If missing, show setup screen: input field, "Activate" button, error display
3. On submit, validate key by sending `VALIDATE_API_KEY` message to service worker, which POSTs `/suggest` with Bearer header — 401/403 = invalid, any other status = valid (key passed auth middleware)
4. Valid: store key, hide setup, show normal UI
5. Invalid: show "Invalid key — contact Alfred" with retry
6. Settings: header key icon button to clear stored key and re-show gate (with confirm dialog)

**Implementation discoveries**:
- Service worker required for validation (only context with `CONFIG.SMARTRIP_API` access via `importScripts`) — not in original file list
- `autofocus` HTML attribute doesn't work on `display:none` elements — fixed by calling `focus()` programmatically in `showGate()`
- `autoAnalyze()` (line 392) is the actual unconditional entry point, not `SIDE_PANEL_READY` (which is informational only)
- Gate replaces the bare `autoAnalyze()` call with a storage check that conditionally calls it

**Tests** (`tests/unit/first-run-gate.test.js` — unit tests for gate storage logic):
- `gate shown when no key stored` — storage empty returns undefined
- `gate hidden when key exists` — storage returns stored key
- `stores key on valid validation response` — chrome.storage.local.set persists key
- `does not store key on invalid validation response` — key not stored on failure
- `reset clears key from storage` — chrome.storage.local.remove clears key

**Verification**:
- [x] Fresh install (no key in storage) → setup screen shown
- [x] Enter valid key → stored, normal UI appears
- [x] Enter invalid key → error message, can retry
- [x] Reload sidepanel with key stored → normal UI immediately
- [x] Reset API key → returns to setup screen

---

### A3. Remove ALFRED_KEY + Wire Bearer Header ✅

> **Repo**: chat-ripper
> **Files**: `config.js`, `background/auth.js` (new), `background/service-worker.js`, `sidepanel/sidepanel.js`, `tests/unit/bearer-header.test.js` (new)
> **Spec**: `docs/specs/remove_alfred_key_wire_bearer_spec.md` (Approved)
> **Effort**: 0.25 day (estimated) → 0.5 day (actual — scope expanded to include module extraction, 403 auto-detection, onChanged listener)
> **Depends on**: A2 (key must be in storage)
> **Blocks**: Nothing
> **Status**: **Implemented** — commit `b76779c`, 5 tests pass

**Scope**: Remove the hardcoded `ALFRED_KEY` constant. Replace `X-Copilot-Key` header with `Authorization: Bearer {key}` read from `chrome.storage.local`. Relocate closer-bot key to `config.js`. Auto-detect 401/403 to clear revoked keys and re-show the setup gate. Add `chrome.storage.onChanged` listener for immediate gate display.

**Implementation**:
1. Add `CLOSER_API_KEY` to `config.js` — closer-bot key relocated from hardcoded constant
2. Create `background/auth.js` — extracted `getStoredApiKey()` and `clearRevokedKey()` for testability. CJS export via `typeof module` guard for Vitest compatibility
3. Update 3 smartrip fetch sites: `X-Copilot-Key: ALFRED_KEY` → `Authorization: Bearer {key}` with missing-key guard
4. Update 3 closer-bot fetch sites: `ALFRED_KEY` → `CONFIG.CLOSER_API_KEY`
5. Update `handleAlfredResponse()` + streaming 401 check: 401/403 → `clearRevokedKey()` (clears storage, throws with `keyRevoked: true`)
6. Propagate `key_revoked` flag in 4 error response sites (2 non-streaming, 2 streaming)
7. Sidepanel: handle `key_revoked` in COMPLETE + ERROR handlers → `resetApiKey()` → gate shown
8. Sidepanel: `chrome.storage.onChanged` listener detects key removal from any context → immediate gate display
9. Remove `const ALFRED_KEY = '...'` (line 5)

**Implementation discoveries**:
- Scope expanded from 0.25 day to 0.5 day: original WBS described a simple header swap, but spec review (6 review cycles across SE + architect perspectives) identified the 403 auto-detection gap, content script `key_revoked` propagation limitation, and need for `onChanged` listener
- `clearRevokedKey()` returns error (doesn't throw) — enables `throw await clearRevokedKey()` pattern for sequencing storage clear before throw
- Content script drops `key_revoked` flag (`new Error(response.error)` only captures message string) — mitigated by `onChanged` listener
- `resetApiKey()` is idempotent — concurrent 403s safely call it multiple times

**Tests** (`tests/unit/bearer-header.test.js` — 5 unit tests):
- `getStoredApiKey returns stored key` — storage returns correct key
- `getStoredApiKey returns null when no key` — empty storage returns null
- `clearRevokedKey removes key from storage` — key cleared after call
- `clearRevokedKey returns error with keyRevoked flag` — Error instance with correct message and flag
- `error response shape for key_revoked propagation` — wire format contract verification

**Verification**:
- [x] `grep -r ALFRED_KEY --include="*.js"` returns nothing
- [x] `grep -r X-Copilot-Key --include="*.js"` returns nothing
- [x] Smartrip request in Network tab shows `Authorization: Bearer cr_...` header
- [x] No `X-Copilot-Key` header sent
- [x] Smartrip reply generation works end-to-end with per-rep key
- [x] Deeprip/quickrip still work (no auth change)
- [x] Closer-bot toggle still works (CLOSER_CHECK/ADD/REMOVE)
- [x] Revoke key on backend → next smartrip call → gate re-appears
- [x] Clear `smartrip_api_key` from storage manually → gate re-appears immediately
- [x] Enter new valid key in gate → normal operation resumes
- [x] All tests pass (`npm test` — 10 tests)

---

## Track B — Independent Tasks (Parallel)

These tasks have no dependencies on each other or on Track A. Work on them while the backend is being implemented.

### B1. Restrict Content Scripts to Known Domains

> **Repo**: chat-ripper
> **File**: `manifest.json`
> **Effort**: 15 min
> **Depends on**: Nothing
> **Blocks**: C1

**Scope**: Replace `<all_urls>` in `content_scripts.matches` with the specific domains ChatRipper supports.

**Implementation**:
```json
"content_scripts": [{
  "matches": [
    "https://app.sbccrm.com/*",
    "https://*.linkedin.com/*",
    "https://mail.google.com/*",
    "https://*.instagram.com/*",
    "https://*.facebook.com/*",
    "https://x.com/*"
  ]
}]
```

**Tests**: None — manifest is declarative. Verified by manual testing.

**Verification**:
- [ ] Extension activates on Revio (app.sbccrm.com)
- [ ] Extension activates on LinkedIn, Gmail, Instagram, Facebook, X
- [ ] Extension does NOT activate on random sites (e.g., google.com)

---

### B2. Smartrip Analysis Panel Redesign

> **Repo**: chat-ripper
> **Files**: `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`
> **Effort**: 0.5 day
> **Depends on**: Nothing
> **Blocks**: C1

**Scope**: Rename ENERGY → MATCH with color coding, add warning row, remove "Why this works" section.

**PRD Source**: FR-1.7, Section 7.1

**Implementation**:
1. **Rename ENERGY → MATCH**: Change label text from "ENERGY" to "MATCH" in the analysis panel rendering
2. **Color-code MATCH value**:
   - Green (`#3fb950`) for 60%+ — strong KB match
   - Yellow (`#d29922`) for 40-60% — moderate match
   - Red (`#f85149`) for <40% — weak match
3. **Add tooltip** on MATCH value: "How closely this conversation matches proven closed-won patterns. KB examples are always used — higher scores mean more relevant matches."
4. **Warning row**: New `sp-analysis-row` with amber styling, only rendered when `warning` field exists in response. Shows warning text + "Fix: [suggested fix]"
5. **Remove "Why this works"** section — reasoning is in READ, warning has own row

**Tests** (`tests/test_analysis_panel.js`):
- `test_match_label_replaces_energy` — rendered HTML contains "MATCH" not "ENERGY"
- `test_match_color_green_above_60` — value element has green color for 75%
- `test_match_color_yellow_40_to_60` — yellow for 50%
- `test_match_color_red_below_40` — red for 30%
- `test_warning_row_shown_when_warning_exists` — warning row rendered
- `test_warning_row_hidden_when_no_warning` — no warning row in DOM
- `test_why_this_works_removed` — no "Why this works" in output

**Verification**:
- [ ] Smartrip response shows "MATCH" label (not "ENERGY")
- [ ] High-confidence response → green MATCH value
- [ ] Low-confidence response → red MATCH value
- [ ] Response with warning → amber warning row visible
- [ ] Response without warning → no warning row
- [ ] "Why this works" section no longer appears

---

### B3. Closer-Bot Insert Warning Toast

> **Repo**: chat-ripper
> **Files**: `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`
> **Effort**: 0.25 day
> **Depends on**: Nothing
> **Blocks**: C1

**Scope**: Show a non-blocking warning toast when rep clicks Insert while closer-bot is active for the contact.

**PRD Source**: FR-3.4, Section 7.2

**Implementation**:
1. In the Insert button click handler, check `agentActive` state
2. If active, show toast: "Bot is active for this contact — your message will cancel its pending reply"
3. Toast: amber background, auto-dismiss after 4s, positioned at top of sidepanel
4. Non-blocking — insert proceeds immediately, toast is informational only
5. CSS: `.sp-toast` with amber styling, fade-in/fade-out animation

**Tests** (`tests/test_warning_toast.js`):
- `test_toast_shown_when_agent_active_on_insert` — toast appears
- `test_toast_not_shown_when_agent_inactive` — no toast
- `test_insert_proceeds_despite_toast` — insert function still called
- `test_toast_auto_dismisses` — toast removed after timeout

**Verification**:
- [ ] Activate bot for a contact → click Insert → toast appears
- [ ] Reply is still inserted (non-blocking)
- [ ] Toast disappears after ~4 seconds
- [ ] Bot not active → Insert → no toast

---

### B4. Privacy Policy

> **Repo**: chat-ripper
> **File**: `docs/privacy-policy.md` (source), GitHub Pages serves it
> **Effort**: 0.5 day
> **Depends on**: Nothing
> **Blocks**: C1 (CWS requires privacy policy URL)

**Scope**: Draft privacy policy covering data collection, storage, processing, and third-party sharing. Host on GitHub Pages from this repo.

**Content must cover**:
- What data is collected (conversation text, contact info, Rocket Selling data)
- How data flows (extension → backend APIs over HTTPS)
- What's stored (smartrip: SQLite with contact_id, name, messages, suggestion; extension: settings only, no PII)
- Third-party processing (Chris's Railway/n8n backends — unknown retention)
- No data sold or shared externally
- Data retention (smartrip: indefinite, no TTL currently; extension: in-memory only)
- User rights (internal tool — contact Alfie for data requests)
- PIPEDA considerations (Canadian data privacy — post-launch review flagged)

**Deliverables**:
- `docs/privacy-policy.md` — source document
- GitHub Pages config to serve at a stable URL
- Privacy policy URL for CWS submission

**Verification**:
- [ ] Privacy policy accessible at GitHub Pages URL
- [ ] Covers all data flows (smartrip, deeprip, quickrip, coach, score)
- [ ] Accurate about what's stored vs in-memory
- [ ] URL works and is stable

---

## Track C — CWS Submission

### C1. CWS Unlisted Submission

> **Platform**: Chrome Web Store Developer Dashboard
> **Effort**: 0.5 day
> **Depends on**: A1-A3, B1-B4 ALL complete
> **Blocks**: Nothing (but review takes 1-3 days)

**Scope**: Package extension, configure CWS listing, submit for review.

**Steps**:
1. Set domain restriction to `@danmartell.com` Google Workspace in CWS admin
2. Prepare CWS listing: description, screenshots, categories
3. Set visibility to "Unlisted"
4. Set privacy policy URL (from B4)
5. Justify permissions: storage, activeTab, contextMenus, sidePanel, webNavigation
6. Package .zip (exclude docs/, tests/, .git/)
7. Upload and submit for review
8. Archive known-good .zip for rollback

**Verification**:
- [ ] CWS listing shows correct description and screenshots
- [ ] Privacy policy URL linked
- [ ] Visibility set to Unlisted
- [ ] Domain restriction configured for @danmartell.com
- [ ] Permissions justifications provided
- [ ] Submission accepted (pending review)

---

## Schedule

```
Day 1 (March 6):                              STATUS
  Track A: A1 backend per-rep keys             ✅ Deployed (178 tests)
  Track B: (dev env setup instead)             ✅ Vitest, Biome, CI

Day 2 (March 7):
  Track A: A2 first-run gate                   ✅ Implemented (34d626e)
           A3 remove ALFRED_KEY + Bearer       ✅ Implemented (b76779c)
  Track B: Not started                         ⬜ Deferred

Day 3 (March 8):
  Track A: Complete                            ✅ All auth tasks done
  Track B: B1 manifest restriction             ⬜ 15 min
           B2 analysis panel redesign          ⬜ 0.5 day
           B3 warning toast                    ⬜ 0.25 day
           B4 privacy policy                   ⬜ 0.5 day

Day 4 (March 9):
  Track B: Any overflow
  C1: CWS submission                           ⬜ Depends on all above
  Final integration testing
```

**Schedule notes**: A track complete on Day 2 (A2 + A3 both done, planned for Days 2-3). B track is 1 day behind (no B tasks started — dev env setup took Day 1). Net: ahead of schedule — Day 3 is fully available for B track + CWS submission.

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Backend delay (hackathon agent issues) | Track A slips | Medium | Legacy fallback: shared key still works. Submit CWS with Track B done, auth in follow-up version. |
| CWS review takes 3+ days | Miss March 10 target | Medium | Submit Day 3 if possible. Keep known-good .zip for re-submission. |
| Privacy policy incomplete | CWS rejection | Low | Draft early (Day 2), review against CWS requirements. |
| First-run gate UX confusing | Reps can't set up | Low | Keep UI minimal: single input + button. Alfie distributes keys directly. |

## Test Strategy

**Automated tests**: Each extension task (A2, A3, B2, B3) includes unit tests for core logic. Tests mock Chrome APIs (`chrome.storage`, `chrome.runtime`) and verify DOM output.

**Test files** (Vitest naming convention: `tests/unit/<name>.test.js`):
| File | Covers | Status |
|------|--------|--------|
| `tests/unit/first-run-gate.test.js` | A2 — gate storage, key persistence, reset | ✅ 5 tests |
| `tests/unit/bearer-header.test.js` | A3 — auth helpers, key revocation, error shape | ✅ 5 tests |
| `tests/unit/analysis-panel.test.js` | B2 — MATCH label, colors, warning row | ⬜ |
| `tests/unit/warning-toast.test.js` | B3 — toast display, auto-dismiss, non-blocking | ⬜ |

**Manual verification**: Each task has a checklist (see individual sections). Run through all checklists on Day 3-4 before CWS submission.

**Backend tests**: 15+ tests defined in per-rep keys spec, run by hackathon agent.

## Files Modified Summary

| File | Tasks | Status |
|------|-------|--------|
| `manifest.json` | B1 | ⬜ |
| `background/auth.js` | A3 (new) | ✅ (getStoredApiKey, clearRevokedKey) |
| `background/service-worker.js` | A2, A3 | ✅ (VALIDATE_API_KEY + Bearer auth + key_revoked propagation) |
| `config.js` | A3 | ✅ (CLOSER_API_KEY added) |
| `sidepanel/sidepanel.js` | A2, A3, B2, B3 | A2+A3 done (gate + key_revoked handlers + onChanged listener) |
| `sidepanel/sidepanel.html` | A2 | ✅ (gate HTML + key button) |
| `sidepanel/sidepanel.css` | A2, B2, B3 | A2 done (gate + key button styles) |
| `docs/privacy-policy.md` | B4 (new) | ⬜ |
| `tests/mocks/chrome.js` | A2 | ✅ (added remove(), fixed noParameterAssign) |
| `tests/unit/first-run-gate.test.js` | A2 (new) | ✅ |
| `tests/unit/bearer-header.test.js` | A3 (new) | ⬜ |
| `tests/unit/analysis-panel.test.js` | B2 (new) | ⬜ |
| `tests/unit/warning-toast.test.js` | B3 (new) | ⬜ |

## Out of Scope (Post-Launch)

- Graceful degradation / auto-fallback between engines
- Phase detection fix (deal_stage fallback)
- KB growth pipeline
- Extension-side telemetry
- PIPEDA formal review
- Proxy all engines through smartrip
- Reference guide web page

---

## Change History

### 2026-03-07 Update (PM)

**Evidence source**: Commit `b76779c`

**Completed tasks**:
- **A3**: Implemented — commit `b76779c`, 5 unit tests pass, spec at `docs/specs/remove_alfred_key_wire_bearer_spec.md`
- **Track A complete** — all 3 auth tasks (A1, A2, A3) done. Auth chain fully wired.

**Scope expansion**:
- A3 estimated 0.25 day in WBS, actual was 0.5 day. Original description was a simple header swap. Spec review (6 cycles across SE + architect perspectives) identified:
  - Module extraction needed for testability (`background/auth.js`)
  - 403 auto-detection closes the key revocation gap flagged in FR-8.5
  - Content script drops `key_revoked` flag → `onChanged` listener needed as belt-and-suspenders
  - 7 implementation tasks vs original 3-step description
- Complexity: Low (estimated) → Medium (actual)

**Files added**:
- `background/auth.js` — extracted auth helpers (not in original WBS file list)
- `config.js` — modified, `CLOSER_API_KEY` added (not in original WBS file list)
- `docs/specs/remove_alfred_key_wire_bearer_spec.md` — A3 spec (591 lines, approved)

**Schedule impact**:
- A track completed Day 2 (both A2 and A3), freeing Day 3 entirely for B track
- B track has full day available (B1 + B2 + B3 + B4 = ~1.5 days estimated, tight but feasible)

---

### 2026-03-07 Update (AM)

**Evidence source**: Commits `91e532e`, `8f41213`, `34d626e` (last 2 days)

**Completed tasks**:
- **A1**: Deployed — 178 tests pass across 3 test files (verified in hackathon repo)
- **A2**: Implemented — commit `34d626e`, 5 unit tests pass, spec at `docs/specs/first_run_api_key_gate_spec.md`

**Discoveries during A2**:
- `background/service-worker.js` needed a `VALIDATE_API_KEY` handler — sidepanel can't access `CONFIG.SMARTRIP_API` directly (loaded via `importScripts` in service worker only). Added to A2 file list.
- `autoAnalyze()` at line 392 is the actual unconditional entry point, not `SIDE_PANEL_READY` (informational only). Gate replaces this bare call with a storage check.
- `autofocus` HTML attribute doesn't fire on `display:none` elements — required programmatic `focus()` call in `showGate()`. Caught during UI/UX review.
- Key revocation gap identified: gate checks storage presence only, not key validity on load. Revoked keys cause 403 errors but don't re-show gate. Documented in PRD FR-8.5, flagged as consideration for A3.

**Unplanned work**:
- Dev environment setup (commits `91e532e`, `8f41213`): Vitest, Biome, CI workflow, project docs. Not a WBS launch task but necessary infrastructure. Covered by `docs/specs/dev_environment_setup_spec.md`.

**WBS corrections**:
- Test file paths updated from `tests/test_*.js` → `tests/unit/*.test.js` (Vitest naming convention)
- A2 file list expanded to include `background/service-worker.js`
- A3 line reference corrected: `ALFRED_KEY` is at line 5, not line 11
- `tests/mocks/chrome.js` added to files modified (A2 required `remove()` method + lint fix)

**Schedule adjustment**:
- A track 1 day ahead: A2 completed Day 2 (planned Day 3)
- B track 1 day behind: No B tasks started (dev env setup took Day 1)
- Net: On track for Day 4 CWS submission

## Development Insights

### Patterns Observed
- Chrome MV3 context boundaries drive architectural decisions — validation had to route through service worker because only it loads `config.js`
- `Write` tool creates files with CRLF line endings — Biome flags these. Fix with `sed -i '' 's/\r$//'` after creating test files
- Spec → multi-perspective review → implement workflow catches real bugs before code (autofocus, wrong line target, validation contract)

### Estimation Accuracy
- A2 estimated 0.5 day, actual 0.5 day — accurate. Spec + 6 review cycles + implementation fit within estimate
- A3 estimated 0.25 day, actual 0.5 day — underestimated 2x. Original WBS described a simple header swap; spec review revealed 403 auto-detection gap, module extraction need, and cross-context error propagation complexity. Lesson: tasks that touch error handling across multiple execution contexts are consistently more complex than "swap X for Y" descriptions suggest.
- Dev environment setup was unplanned (~0.5 day) — should have been a WBS task

### Technical Decisions
- Validation uses POST /suggest with minimal body (reuses existing endpoint, no backend changes needed)
- Gate uses `position: absolute; inset: 0; z-index: 100` to fully cover sidepanel — prevents interaction with underlying UI
- Header key button uses neutral styling (muted → secondary on hover) to avoid competing with primary action buttons
- `confirm()` dialog for reset — native browser dialog, not pretty but correct for a rare destructive action
