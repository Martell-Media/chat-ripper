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

### A1. Per-Rep API Keys (Backend)

> **Repo**: hackathon/ai-sales-copilot
> **Spec**: `hackathon/docs/specs/per_rep_api_keys_spec.md` (Approved)
> **Owner**: Hackathon agent
> **Effort**: 1-1.5 days
> **Depends on**: Nothing
> **Blocks**: A2, A3

**Scope**: DB schema (api_keys table + rep_id on calls), key CRUD methods, middleware refactor with legacy fallback, pipeline rep_id passthrough, key management API endpoints, dashboard per-rep filtering + UI, tests.

**Deliverables**:
- `api_keys` table with SHA-256 hashed keys
- `POST /api/keys/generate`, `GET /api/keys`, `DELETE /api/keys/{id}` endpoints
- Middleware accepts `Authorization: Bearer {key}` + legacy `X-Copilot-Key` fallback
- `rep_id` recorded on every `/suggest` call
- Dashboard: Rep column, filter dropdown, detail panel
- 15+ automated tests across 3 test files

**Verification**:
- [ ] Generate a test key via `POST /api/keys/generate`
- [ ] `POST /suggest` with Bearer header returns 200 and records rep_id
- [ ] `POST /suggest` with invalid key returns 403
- [ ] `POST /suggest` with no key returns 401
- [ ] Legacy `X-Copilot-Key` still returns 200 (rep_id = "legacy")
- [ ] Dashboard shows Rep column and filter works
- [ ] All tests pass

---

### A2. First-Run API Key Setup Gate

> **Repo**: chat-ripper
> **Files**: `sidepanel/sidepanel.js`, `sidepanel/sidepanel.html`, `sidepanel/sidepanel.css`
> **Effort**: 0.5 day
> **Depends on**: A1 deployed + keys generated
> **Blocks**: A3

**Scope**: When sidepanel opens and no API key is stored in `chrome.storage.local`, show a setup screen instead of the normal UI. Rep enters their key, extension validates it against the backend, stores it on success.

**User Story**: As a rep, I enter my API key once on first use so the extension can authenticate my requests.

**Implementation**:
1. On sidepanel load, check `chrome.storage.local` for `smartrip_api_key`
2. If missing, show setup screen: input field, "Activate" button, error display
3. On submit, validate key by sending `POST /suggest` with minimal body — 403 means invalid key, 422 means key accepted (request body validation failed, key is valid)
4. Valid: store key, hide setup, show normal UI
5. Invalid: show "Invalid key — contact Alfie" with retry
6. Settings: add "Reset API Key" option to clear stored key and re-show gate

**Tests** (`tests/test_first_run_gate.js` — unit tests for gate logic):
- `test_gate_shown_when_no_key_stored` — gate renders when storage empty
- `test_gate_hidden_when_key_exists` — normal UI renders when key present
- `test_gate_stores_key_on_valid_input` — chrome.storage.local.set called with key
- `test_gate_shows_error_on_invalid_key` — error message displayed on 403
- `test_reset_clears_key_and_shows_gate` — reset returns to gate screen

**Verification**:
- [ ] Fresh install (no key in storage) → setup screen shown
- [ ] Enter valid key → stored, normal UI appears
- [ ] Enter invalid key → error message, can retry
- [ ] Reload sidepanel with key stored → normal UI immediately
- [ ] Reset API key → returns to setup screen

---

### A3. Remove ALFRED_KEY + Wire Bearer Header

> **Repo**: chat-ripper
> **Files**: `background/service-worker.js`
> **Effort**: 0.25 day
> **Depends on**: A2 (key must be in storage)
> **Blocks**: Nothing

**Scope**: Remove the hardcoded `ALFRED_KEY` constant from service-worker.js line 11. Replace the `X-Copilot-Key` header with `Authorization: Bearer {key}` read from `chrome.storage.local`.

**Implementation**:
1. Remove `const ALFRED_KEY = '...'` (line 11)
2. At smartrip fetch call sites, read key from `chrome.storage.local`
3. Replace header: `"X-Copilot-Key": ALFRED_KEY` → `"Authorization": "Bearer " + key`
4. Handle missing key: if not in storage, return error prompting first-run gate
5. Deeprip/quickrip/coach/score: no auth changes (Chris's backends have no auth)

**Tests** (`tests/test_bearer_header.js`):
- `test_smartrip_request_uses_bearer_header` — fetch called with Authorization header
- `test_no_x_copilot_key_header_sent` — old header absent
- `test_missing_key_returns_error` — graceful error when key not in storage

**Verification**:
- [ ] `ALFRED_KEY` string no longer in codebase (`grep -r ALFRED_KEY` returns nothing)
- [ ] Smartrip request in Network tab shows `Authorization: Bearer cr_...` header
- [ ] No `X-Copilot-Key` header sent
- [ ] Smartrip reply generation works end-to-end with per-rep key
- [ ] Deeprip/quickrip still work (no auth change)

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
Day 1 (March 6):
  Track A: Backend per-rep keys (hackathon agent starts)
  Track B: B1 manifest restriction (15 min)
           B2 analysis panel redesign (start)

Day 2 (March 7):
  Track A: Backend continues / deploys
  Track B: B2 analysis panel redesign (finish)
           B3 warning toast
           B4 privacy policy

Day 3 (March 8):
  Track A: A2 first-run gate
           A3 remove ALFRED_KEY + Bearer header
           End-to-end auth testing
  Track B: Any overflow

Day 4 (March 9):
  C1: CWS submission
  Final integration testing across all changes
```

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Backend delay (hackathon agent issues) | Track A slips | Medium | Legacy fallback: shared key still works. Submit CWS with Track B done, auth in follow-up version. |
| CWS review takes 3+ days | Miss March 10 target | Medium | Submit Day 3 if possible. Keep known-good .zip for re-submission. |
| Privacy policy incomplete | CWS rejection | Low | Draft early (Day 2), review against CWS requirements. |
| First-run gate UX confusing | Reps can't set up | Low | Keep UI minimal: single input + button. Alfie distributes keys directly. |

## Test Strategy

**Automated tests**: Each extension task (A2, A3, B2, B3) includes unit tests for core logic. Tests mock Chrome APIs (`chrome.storage`, `chrome.runtime`) and verify DOM output.

**Test files**:
| File | Covers |
|------|--------|
| `tests/test_first_run_gate.js` | A2 — gate display, key storage, error handling |
| `tests/test_bearer_header.js` | A3 — header format, missing key handling |
| `tests/test_analysis_panel.js` | B2 — MATCH label, colors, warning row |
| `tests/test_warning_toast.js` | B3 — toast display, auto-dismiss, non-blocking |

**Manual verification**: Each task has a checklist (see individual sections). Run through all checklists on Day 3-4 before CWS submission.

**Backend tests**: 15+ tests defined in per-rep keys spec, run by hackathon agent.

## Files Modified Summary

| File | Tasks |
|------|-------|
| `manifest.json` | B1 |
| `background/service-worker.js` | A3 |
| `sidepanel/sidepanel.js` | A2, B2, B3 |
| `sidepanel/sidepanel.html` | A2 |
| `sidepanel/sidepanel.css` | A2, B2, B3 |
| `docs/privacy-policy.md` | B4 (new) |
| `tests/test_first_run_gate.js` | A2 (new) |
| `tests/test_bearer_header.js` | A3 (new) |
| `tests/test_analysis_panel.js` | B2 (new) |
| `tests/test_warning_toast.js` | B3 (new) |

## Out of Scope (Post-Launch)

- Graceful degradation / auto-fallback between engines
- Phase detection fix (deal_stage fallback)
- KB growth pipeline
- Extension-side telemetry
- PIPEDA formal review
- Proxy all engines through smartrip
- Reference guide web page
