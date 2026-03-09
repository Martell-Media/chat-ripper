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

### B1. Restrict Content Scripts to Known Domains ✅

> **Repo**: chat-ripper
> **File**: `manifest.json`
> **Spec**: `docs/specs/restrict_content_scripts_domains_spec.md` (Approved)
> **Effort**: 15 min (actual: 15 min — matched estimate)
> **Depends on**: Nothing
> **Blocks**: C1
> **Status**: **Implemented** — commit `e392956`

**Scope**: Replace `<all_urls>` in `content_scripts.matches` and `web_accessible_resources.matches` with 12 domain patterns covering 8 platforms. Add `close.alfredloh.com` to `host_permissions`.

**Implementation**:
1. `content_scripts.matches`: 12 patterns (sbccrm, LinkedIn, Gmail, Instagram, Facebook, Messenger, X, Twitter, Salesforce, Force, HubSpot)
2. `web_accessible_resources.matches`: same 12 patterns
3. `host_permissions`: added `close.alfredloh.com` for closer-bot API

**Tests**: None — manifest is declarative. Chrome enforces patterns at content script injection time.

**Verification**:
- [x] Extension activates on Revio (app.sbccrm.com)
- [x] Extension activates on LinkedIn, Gmail, Instagram, Facebook, X
- [x] Extension does NOT activate on random sites (e.g., google.com)
- [x] `grep -c "all_urls" manifest.json` returns 0

---

### B2. Smartrip Analysis Panel Redesign ✅

> **Repo**: chat-ripper
> **Files**: `background/service-worker.js`, `sidepanel/helpers.js` (new), `sidepanel/sidepanel.html`, `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`, `tests/unit/analysis-panel.test.js` (new)
> **Spec**: `docs/specs/analysis_panel_redesign_spec.md` (Approved)
> **Effort**: 0.5 day (actual: 0.5 day — matched estimate)
> **Depends on**: Nothing
> **Blocks**: C1
> **Status**: **Implemented** — commit `d4f1fec`, 18 tests pass

**Scope**: Rename ENERGY → MATCH with color coding, add warning row, remove "Why this works" section. Smartrip only — deeprip/quickrip untouched.

**PRD Source**: FR-1.7, Section 7.1

**Implementation**:
1. Restructure service worker analysis object: `energy` (formatted string) → `match` (raw 0-1 float), add `warning`/`warningFix` as separate fields, set `reasoning: null`
2. Extract `formatMatchValue()`, `buildAnalysisHtml()`, `escHtml()`, `MATCH_TOOLTIP` to `sidepanel/helpers.js` with CJS export for Vitest
3. Replace inline analysis HTML in `showReply()` with `buildAnalysisHtml(analysis)`
4. Remove "Why this works" rendering + unused `reasoning` variable
5. Remove reasoning section from streaming DOM (`buildStreamDom` + `updateStreamDom`). Energy label and `s-energy-*` IDs preserved for deeprip/quickrip.
6. Delete dead `.sp-reasoning` CSS. Add `.sp-warning-row` + `.sp-analysis-label[title]` tooltip affordance CSS.

**Implementation discoveries**:
- Scope expanded beyond original file list: service worker needed data layer restructure (raw confidence instead of pre-formatted string), and `helpers.js` extracted for testability
- Two service worker sites build the analysis object (`handleAlfredResponse` + `doAlfredStreamFetch`) — both needed identical changes
- Streaming DOM is deeprip/quickrip path — "Energy" label intentionally preserved (different metric, different backend). "Match" only in smartrip final render via `buildAnalysisHtml()`
- `<strong>Fix:</strong>` added for typographic hierarchy in warning row — bold separates problem from solution at zero CSS cost
- Biome linter required `var` → `const`/`let` and string concatenation → template literals in helpers.js

**Tests** (`tests/unit/analysis-panel.test.js` — 18 unit tests):
- 7 `formatMatchValue` tests: green/yellow/red thresholds, boundaries at 40%/60%, zero, null/undefined
- 11 `buildAnalysisHtml` tests: Match label (not Energy), color application, tooltip, warning ±fix, no warning, "Why this works" absence, null analysis, XSS escaping

**Verification**:
- [x] Smartrip response shows "Match" label (not "Energy")
- [x] High-confidence response (60%+) → green Match value
- [x] Low-confidence response (<40%) → red Match value
- [x] Response with warning → amber warning row visible
- [x] Response with warning + warning_fix → "Fix: ..." in warning row
- [x] Response without warning → no warning row
- [x] "Why this works" section no longer appears
- [x] Deeprip/quickrip streaming DOM still shows "Energy" label
- [x] All 28 tests pass (`npm test`)

---

### B3. Closer-Bot Insert Warning Toast + Extension Toggle ✅

> **Repo**: chat-ripper
> **Files**: `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`, `sidepanel/helpers.js`, `background/service-worker.js`, `config.js`, `content/content.js`, `tests/unit/warning-toast.test.js` (new)
> **Specs**: `docs/specs/closer_bot_insert_warning_toast_spec.md`, `docs/specs/closer_bot_extension_toggle_spec.md`
> **Effort**: 0.25 day (estimated) → 1 day (actual — scope expanded to include per-rep Bearer auth on closer API, 5-state agent bar, operational rollout)
> **Depends on**: A3 (per-rep key in storage)
> **Blocks**: C1
> **Status**: **Implemented** — commits `c66bbf7`, `902f470`, `21a2b8d`, 8 tests pass

**Original scope (warning toast)**: Show a non-blocking warning toast when rep clicks Insert while closer-bot is active for the contact.

**Expanded scope (extension toggle)**: Replace shared `CLOSER_API_KEY` with per-rep Bearer auth on closer-bot API. Introduce 5-state agent bar (hidden/loading/disabled/off/on), CLOSER_ELIGIBLE operational rollout check, optimistic toggle with revert on failure, `switchId` stale callback guards, `userId` propagation from content script, `prefers-reduced-motion` CSS.

**PRD Source**: FR-3.1–3.8, FR-8.4, Section 7.2, Section 7.5

**Implementation (warning toast — commits `c66bbf7`, `902f470`)**:
1. `shouldShowInsertWarning()` + `INSERT_WARNING_MSG` extracted to `sidepanel/helpers.js`
2. `showInsertWarningToast()` in sidepanel.js — creates `.sp-toast` div, auto-dismiss after 4s with fade-out
3. Called from Insert button click handler + Alt+I keyboard shortcut
4. CSS: `.sp-toast` with dark opaque background, `sp-toast-in`/`sp-toast-out` animations
5. `prefers-reduced-motion`: toast animations suppressed

**Implementation (extension toggle — commit `21a2b8d`)**:
1. Remove `CLOSER_API_KEY` from `config.js` — closer-bot uses same per-rep Bearer token
2. Replace all 3 closer handlers (CLOSER_CHECK/ADD/REMOVE) with Bearer auth in service-worker.js
3. Add `handle403()` helper — string-matches `body.detail` to differentiate revoked key vs no scope
4. Add `CLOSER_ELIGIBLE` handler — checks `allowed_closers/{userId}` endpoint
5. Add `userId` to content script scrape result (`contact.user_id`)
6. Replace `setAgentDisabled()` with `setAgentBarState(state, message)` — unified 5-state controller
7. Update `REVIO_CONTACT_CHANGED` handler — loading → scrape → CLOSER_CHECK → CLOSER_ELIGIBLE flow with `switchId` guards
8. Update `autoAnalyze` Revio block — same 4-state flow with `switchId` guards
9. Replace click handler with optimistic toggle — immediate visual change, revert on failure
10. CSS: `.agent-loading` pulse animation, `prefers-reduced-motion` covers both active and loading states

**Implementation discoveries**:
- B3 scope expanded 4x: original WBS described a 0.25 day toast task, but cross-repo spec review identified the need to switch closer-bot from shared key to per-rep Bearer auth simultaneously — deploying the toast without auth migration would leave the shared key in place
- Two specs needed: warning toast spec (320 lines) + extension toggle spec (590 lines), each went through 8+ review rounds across SE/architect/UX perspectives
- `setAgentDisabled` deletion required migrating 3 call sites (REVIO_CONTACT_CHANGED, autoAnalyze, email path) — code review agent caught the autoAnalyze migration gap
- `handle403` string-matching on `body.detail` creates a cross-repo contract — documented with warning comments in both repos
- A2 bug fix discovered during B3 work: gate overlay used `position: absolute` instead of `position: fixed`, didn't cover scrolled sidepanel content (commit `b659e58`)

**Tests** (`tests/unit/warning-toast.test.js` — 8 unit tests):
- `shouldShowInsertWarning` — returns true when platform=revio, contactId set, agentActive=true
- `shouldShowInsertWarning` — returns false when agent not active
- `shouldShowInsertWarning` — returns false when no contactId
- `shouldShowInsertWarning` — returns false on non-revio platform
- `INSERT_WARNING_MSG` — contains expected message text
- `shouldShowInsertWarning` — false when all conditions false
- `shouldShowInsertWarning` — false when only platform matches
- `shouldShowInsertWarning` — false when only contactId present

**Verification**:
- [x] Activate bot for a contact → click Insert → toast appears
- [x] Reply is still inserted (non-blocking)
- [x] Toast disappears after ~4 seconds
- [x] Bot not active → Insert → no toast
- [x] CLOSER_CHECK/ADD/REMOVE send Bearer auth header (Network tab)
- [x] No `X-API-Key` or `CLOSER_API_KEY` in requests
- [x] Revoked key 403 → key cleared, gate re-appears
- [x] No-scope 403 → agent bar hidden (key preserved)
- [x] Rep not in `allowed_closer_ids` → agent bar disabled
- [x] Rep in rollout, contact not whitelisted → agent bar off (can toggle on)
- [x] Toggle on → optimistic visual, API call succeeds
- [x] Toggle off → optimistic visual, API call succeeds
- [x] Rapid contact switching → no stale state
- [x] Email contact → agent bar disabled ("Not available for email contacts")
- [x] All 36 tests pass (`npm test`)

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
  Track B: B1 manifest restriction             ✅ Implemented (e392956)
           B2 analysis panel redesign          ✅ Implemented (d4f1fec)

Day 3 (March 8):
  Track A: Complete                            ✅ All auth tasks done
  Track B: B3 warning toast                    ✅ Implemented (c66bbf7, 902f470)
           B3 extension toggle (expanded)      ✅ Implemented (21a2b8d)
           B4 privacy policy                   ⬜ 0.5 day

Day 4 (March 9):
  Track B: B4 privacy policy                   ⬜ In progress
  C1: CWS submission                           ⬜ Depends on B4
  Final integration testing
```

**Schedule notes**: All code tasks complete (A1-A3, B1-B3). B3 scope expanded from 0.25 day to ~1 day but completed on Day 3. Remaining: B4 (0.5 day) + C1 (0.5 day) = 1 day. Today is Day 4 — on track for same-day CWS submission if B4 is completed.

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
| `tests/unit/analysis-panel.test.js` | B2 — MATCH label, colors, warning row | ✅ 18 tests |
| `tests/unit/warning-toast.test.js` | B3 — toast guard logic, insert warning conditions | ✅ 8 tests |

**Manual verification**: Each task has a checklist (see individual sections). Run through all checklists on Day 3-4 before CWS submission.

**Backend tests**: 15+ tests defined in per-rep keys spec, run by hackathon agent.

## Files Modified Summary

| File | Tasks | Status |
|------|-------|--------|
| `manifest.json` | B1 | ✅ (12 domain patterns, close.alfredloh.com host permission) |
| `background/auth.js` | A3 (new) | ✅ (getStoredApiKey, clearRevokedKey) |
| `background/service-worker.js` | A2, A3, B2 | ✅ (VALIDATE_API_KEY + Bearer auth + key_revoked + analysis restructure) |
| `config.js` | A3 | ✅ (CLOSER_API_KEY added) |
| `sidepanel/helpers.js` | B2 (new) | ✅ (formatMatchValue, buildAnalysisHtml, escHtml, MATCH_TOOLTIP) |
| `sidepanel/sidepanel.js` | A2, A3, B2, B3 | ✅ (gate + key_revoked + buildAnalysisHtml + toast + setAgentBarState + optimistic toggle + switchId guards) |
| `sidepanel/sidepanel.html` | A2, B2 | ✅ (gate HTML + key button + helpers.js script) |
| `sidepanel/sidepanel.css` | A2, B2, B3 | ✅ (gate + key button + warning row + tooltip + toast + agent-loading pulse + prefers-reduced-motion) |
| `content/content.js` | B3 | ✅ (userId propagation from Revio contact) |
| `docs/privacy-policy.md` | B4 (new) | ⬜ |
| `tests/mocks/chrome.js` | A2 | ✅ (added remove(), fixed noParameterAssign) |
| `tests/unit/first-run-gate.test.js` | A2 (new) | ✅ |
| `tests/unit/bearer-header.test.js` | A3 (new) | ✅ |
| `tests/unit/analysis-panel.test.js` | B2 (new) | ✅ |
| `tests/unit/warning-toast.test.js` | B3 (new) | ✅ |

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

### 2026-03-09 Update

**Evidence source**: Commits `c66bbf7` (B3 toast), `902f470` (B3 toast fix), `b659e58` (A2 gate fix), `21a2b8d` (B3 extension toggle)

**Completed tasks**:
- **B3**: Implemented — 4 commits, 8 unit tests pass. Original scope was warning toast only (0.25 day). Expanded to include per-rep Bearer auth on closer API, 5-state agent bar, CLOSER_ELIGIBLE, optimistic toggle, switchId guards, userId propagation, prefers-reduced-motion. Two specs: `closer_bot_insert_warning_toast_spec.md` (320 lines) + `closer_bot_extension_toggle_spec.md` (590 lines).
- **All code tasks complete** — A1-A3, B1-B3 done. Only B4 (privacy policy) and C1 (CWS submission) remain.

**Scope expansion (B3)**:
- Original WBS: 2 files, 0.25 day, toast only
- Actual: 7 files + 2 specs, ~1 day, toast + extension toggle + Bearer auth migration
- Cross-repo spec review (15+ rounds across SE/architect/UX) identified that deploying toast without auth migration would leave the shared `CLOSER_API_KEY` in place — both changes needed to ship together
- Complexity: Low (estimated) → High (actual)

**Bug fix (A2)**:
- Gate overlay used `position: absolute` which didn't cover scrolled sidepanel content. Fixed to `position: fixed` in commit `b659e58`. Discovered during B3 manual testing.

**Files added**:
- `docs/specs/closer_bot_insert_warning_toast_spec.md` — B3 toast spec (320 lines, approved)
- `docs/specs/closer_bot_extension_toggle_spec.md` — B3 toggle spec (590 lines, approved)
- `tests/unit/warning-toast.test.js` — 8 unit tests

**Schedule impact**:
- 8 of 9 launch tasks complete. All code tasks done.
- Remaining: B4 (0.5 day) + C1 (0.5 day) = 1 day
- Today is Day 4 — on track for same-day CWS submission if B4 completed

---

### 2026-03-07 Update (Evening)

**Evidence source**: Commits `e392956` (B1), `d4f1fec` (B2)

**Completed tasks**:
- **B1**: Implemented — commit `e392956`. 12 domain patterns replace `<all_urls>` in content_scripts and web_accessible_resources. `close.alfredloh.com` added to host_permissions. Spec at `docs/specs/restrict_content_scripts_domains_spec.md`.
- **B2**: Implemented — commit `d4f1fec`, 18 unit tests pass. Spec at `docs/specs/analysis_panel_redesign_spec.md` (6 review cycles: 2 SE, 2 UX, 1 architect, 1 UI/UX Pro Max).

**Scope expansion (B2)**:
- Original WBS file list: `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css` (2 files)
- Actual files: `background/service-worker.js`, `sidepanel/helpers.js` (new), `sidepanel/sidepanel.html`, `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`, `tests/unit/analysis-panel.test.js` (new) (6 files)
- Service worker needed data layer restructure: raw float instead of pre-formatted string, warning/warningFix surfaced as separate fields
- `helpers.js` extracted for testability (CJS export pattern matching `background/auth.js`)
- Streaming DOM "Energy" label intentionally preserved for deeprip/quickrip — different metric, different backend
- Despite scope expansion, effort matched 0.5 day estimate. Spec review identified the scope early, avoiding rework.

**Files added**:
- `sidepanel/helpers.js` — analysis rendering helpers (not in original WBS file list)
- `docs/specs/analysis_panel_redesign_spec.md` — B2 spec (579 lines, approved)
- `docs/specs/restrict_content_scripts_domains_spec.md` — B1 spec (222 lines, approved)

**Schedule impact**:
- 7 of 9 launch tasks complete (A1-A3, B1-B2 + dev env setup)
- Remaining: B3 (0.25 day), B4 (0.5 day), C1 (0.5 day)
- Day 3 has full capacity — comfortably on track

---

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
- Cross-repo tasks consistently expand scope: A3 (2x) and B3 (4x) both started as "simple swaps" but spec review revealed auth migration, error handling, and cross-context concerns. Single-repo tasks (A2, B1, B2) estimated accurately.
- Code review agents catch migration gaps: B3 autoAnalyze was left using deleted `setAgentDisabled` — caught by review before manual testing

### Estimation Accuracy
- A2 estimated 0.5 day, actual 0.5 day — accurate. Spec + 6 review cycles + implementation fit within estimate
- A3 estimated 0.25 day, actual 0.5 day — underestimated 2x. Original WBS described a simple header swap; spec review revealed 403 auto-detection gap, module extraction need, and cross-context error propagation complexity. Lesson: tasks that touch error handling across multiple execution contexts are consistently more complex than "swap X for Y" descriptions suggest.
- B1 estimated 15 min, actual 15 min — accurate. Declarative manifest change, spec was straightforward.
- B2 estimated 0.5 day, actual 0.5 day — accurate despite 3x file count expansion (2 → 6). Spec review caught the scope expansion early (service worker data layer, helpers extraction) before implementation started. Lesson: thorough spec review absorbs scope expansion into the estimate rather than causing rework.
- B3 estimated 0.25 day, actual ~1 day — underestimated 4x. Original WBS described a simple toast; cross-repo spec review expanded scope to include Bearer auth migration, 5-state agent bar, and operational rollout. Lesson: tasks that span repo boundaries and require auth migration are categorically different from single-feature additions — they should be estimated as Medium/High from the start.
- Dev environment setup was unplanned (~0.5 day) — should have been a WBS task

### Technical Decisions
- Validation uses POST /suggest with minimal body (reuses existing endpoint, no backend changes needed)
- Gate uses `position: fixed; inset: 0; z-index: 100` to fully cover sidepanel — prevents interaction with underlying UI (fixed from `absolute` in commit `b659e58`)
- Header key button uses neutral styling (muted → secondary on hover) to avoid competing with primary action buttons
- `confirm()` dialog for reset — native browser dialog, not pretty but correct for a rare destructive action
- B2: Analysis helpers extracted to `sidepanel/helpers.js` (same CJS export pattern as `background/auth.js`) — keeps rendering logic testable without DOM mocking
- B2: Match colors use GitHub dark-mode palette (`#3fb950`/`#d29922`/`#f85149`) intentionally distinct from design system semantic colors (`--success`/`--warning`/`--error`) to avoid false "error" signal on low match scores
- B2: Streaming DOM preserves "Energy" label for deeprip/quickrip — different backend field name, different metric. "Match" scoped to smartrip only via `buildAnalysisHtml()`
- B3: `handle403` string-matches on `body.detail` to differentiate revoked key from no-scope — creates a cross-repo contract documented with warning comments in both repos
- B3: `setAgentBarState` unified 5-state controller replaces separate `setAgentActive`/`setAgentDisabled` — single function, clear state machine
- B3: `switchId` capture pattern prevents stale callbacks during rapid contact switches — simpler than debouncing, no race conditions
- B3: Optimistic toggle pattern for responsive UX — immediate visual feedback, revert on failure rather than show loading state
