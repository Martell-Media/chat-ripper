# Product Requirements Document: ChatRipper AI

**Version:** 1.0
**Date:** March 5, 2026
**Author:** Alfie Loh
**Status:** Approved

---

## 1. Product Overview

ChatRipper AI is an internal Chrome extension that provides Martell Media's revenue team with AI-powered sales reply suggestions. Reps work primarily in Revio (app.sbccrm.com), which normalizes messaging from Instagram, Facebook, SMS, and Email into a single inbox. ChatRipper scrapes conversation context, sends it to one of three backend engines, and returns a suggested reply displayed in a side panel.

### 1.1 Core Value Proposition

- Replies grounded in 1,230+ real closed-won DM conversations and proven sales frameworks
- Multi-platform support (Revio primary; LinkedIn, Gmail, Instagram, Facebook, X secondary)
- Three backend engines with different speed/depth tradeoffs
- Coaching and conversation scoring beyond simple reply generation

### 1.2 System Landscape

| Component | Description | Owner |
|-----------|-------------|-------|
| **chat-ripper** (this project) | Chrome extension, multi-platform, manual trigger, 3 backends | Alfie |
| **hackathon/ai-sales-copilot** | GCR backend (`/suggest`), KB vectorization pipeline | Alfie |
| **closer-bot** | Autonomous reply bot via Ably WebSocket, consumer of `/suggest` | Alfie |

ChatRipper and closer-bot are independent systems. ChatRipper manages the closer-bot whitelist but does not control the bot's reply behavior.

---

## 2. User Personas

### 2.1 SDR (Sales Development Representative)

- **Count:** 2 FTE
- **Goal:** Activate and qualify prospects, hand off to Closers
- **Hypothesized usage:** Quick reply modes (follow_up, re_engage), fast engine (quickrip)
- **Context:** Works in Revio inbox, high message volume, speed matters

### 2.2 Closer

- **Count:** 3.5 FTE
- **Goal:** Convert qualified prospects to closed-won deals
- **Hypothesized usage:** Deeper analysis modes (objection, close), smartrip for KB-grounded replies
- **Context:** Works in Revio inbox, needs nuanced replies, manages closer-bot for follow-ups

### 2.3 Early Adopter (Adam)

- **Count:** 1
- **Goal:** Validate tool effectiveness, provide feedback
- **Context:** Has been using sideloaded extension since hackathon. Primary workflow: Analyze & Reply.

> **Note:** No usage data exists yet. SDR vs Closer patterns are hypotheses to validate post-rollout.

---

## 3. User Journeys

### 3.1 Analyze & Reply (Primary Workflow)

1. Rep opens a contact conversation in Revio
2. Rep opens ChatRipper side panel (browser toolbar icon)
3. Side panel auto-scrapes the page via Revio API (contact, messages, Rocket Selling data)
4. Conversation context is sent to the selected backend engine
5. Suggested reply appears in side panel with analysis (smartrip only: STAGE, MATCH, READ)
6. Rep copies reply (button or Ctrl+C) or inserts directly (Alt+I)
7. Rep reviews, edits if needed, and sends manually

**Alternate flows:**
- Rep clicks Re-analyze button to regenerate with fresh page state
- Rep switches reply mode (auto, objection, follow_up, close, re_engage) via dropdown
- Rep switches engine via popup (deeprip/quickrip/smartrip)

### 3.2 Score Conversation

1. Rep opens side panel on a Revio contact
2. Rep clicks Score button in controls bar
3. Extension scrapes conversation and sends to scoring endpoint
4. Score result displayed in side panel

### 3.3 Coach Chat

1. Rep opens side panel on a Revio contact
2. Rep clicks Coach button in controls bar (currently hidden by overflow -- see UX fix 7.3)
3. Chat interface opens for conversational coaching about the active conversation
4. Coach responses powered by n8n webhook (Chris)

### 3.4 Closer-Bot Toggle (Revio Only)

<!-- Updated 2026-03-09: B3 implemented 5-state agent bar with eligibility check and per-rep Bearer auth -->

1. Rep opens side panel on a Revio contact (DM channel only)
2. Agent bar shows **loading** state while checking eligibility
3. Extension checks closer-bot whitelist (CLOSER_CHECK) and operational rollout (CLOSER_ELIGIBLE)
4. Agent bar resolves to one of 5 states: **hidden** (no key / 403), **disabled** (rep not in rollout), **off** (eligible, bot inactive), **on** (bot active), **loading** (checking)
5. Rep clicks logo button to toggle between on/off — **optimistic**: visual state changes immediately, reverts on failure
6. When bot is active and rep inserts a reply: warning toast appears (non-blocking)

**Eligibility flow:**
- Key rejected (revoked/no closer scope) → agent bar hidden, key cleared if revoked
- Key accepted, closer not in `allowed_closer_ids` → agent bar disabled ("not enabled for this rep")
- Key accepted, closer in rollout, contact not whitelisted → agent bar off (can toggle on)
- Key accepted, closer in rollout, contact whitelisted → agent bar on

**Constraints:**
- Email contacts: agent toggle disabled (dimmed, no clicks, "Not available for email contacts")
- Non-Revio platforms: toggle is local-only (no closer-bot link)
- Rapid contact switches: stale callback guards (`switchId` capture) prevent race conditions

### 3.5 Engine Switch

1. Rep clicks extension popup icon
2. Selects engine: deeprip (~8s), quickrip (~4s), or smartrip (~6s)
3. Selection persists in chrome.storage.local
4. Next Analyze & Reply uses selected engine

---

## 4. Functional Requirements

### FR-1: Analyze & Reply

**Description:** Scrape full conversation from current page, send to selected backend, display suggested reply in side panel.

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-1.1 | Auto-analyze on side panel open | Launch | Side panel triggers page scrape and backend call within 1s of opening |
| FR-1.2 | Re-analyze button | Launch | Clicking re-analyze scrapes fresh page state and generates new reply |
| FR-1.3 | Reply mode selection | Launch | Dropdown offers: auto, objection, follow_up, close, re_engage. Mode sent in backend payload. |
| FR-1.4 | Engine selection via popup | Launch | Popup shows 3 engine options. Selection persists across sessions. |
| FR-1.5 | Copy reply | Launch | Copy button copies reply text to clipboard. Visual confirmation shown. |
| FR-1.6 | Insert reply (Alt+I) | Launch | Inserts reply into the active chat input field. Works on Revio (textarea) and other platforms (contenteditable). Best effort on non-Revio. |
| FR-1.7 | Smartrip analysis panel | Launch | Shows STAGE, MATCH (renamed from ENERGY), READ for smartrip replies with color-coded MATCH and warning row (see 7.1). Deeprip/quickrip show reply only. |
| FR-1.8 | Loading state | Launch | Side panel shows generating indicator with status dot during backend call |
| FR-1.9 | Error + retry | Launch | Backend timeout/failure shows error message with retry button |

### FR-2: Revio Integration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-2.1 | Revio API scraping | Launch | On app.sbccrm.com, fetch contact details, messages, Rocket Selling data via API |
| FR-2.2 | Contact metadata | Launch | Payload includes rocket_selling_current_box, score, ai_notes, tags |
| FR-2.3 | Email channel blocking | Launch | Email/sms-email contacts return `unsupported_channel`. Side panel shows "Email not supported" message. No backend call made. No wasted fetchRevioMessages() call. |
| FR-2.4 | Agent toggle disabled for email | Launch | Agent logo button dimmed (opacity 0.4), pointer-events none, tooltip: "Not available for email contacts" |
| FR-2.5 | Score/Coach no-op for email | Launch | Score and Coach buttons silently no-op when currentFullPage is unsupported_channel |
<!-- Updated 2026-03-09: B3 replaced setAgentActive/setAgentDisabled with unified setAgentBarState -->
| FR-2.6 | Contact switch detection | Launch | REVIO_CONTACT_CHANGED triggers full eligibility re-check: shows loading state, re-scrapes page, checks whitelist + operational rollout. Stale callback guards prevent race conditions during rapid switches. |

### FR-3: Closer-Bot Management

<!-- Updated 2026-03-09: B3 expanded scope — 5-state agent bar, operational rollout, per-rep Bearer auth, optimistic toggle -->

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-3.1 | Whitelist check on load | Launch | Side panel checks CLOSER_CHECK with Bearer auth on open when contactId is present. 403 differentiated: revoked key clears storage + re-shows gate; no-scope 403 hides agent bar. |
| FR-3.2 | Toggle on/off | Launch | Logo button calls CLOSER_ADD or CLOSER_REMOVE with Bearer auth. **Optimistic**: visual state changes immediately on click, reverts on API failure. |
| FR-3.3 | Agent bar display | Launch | Shows "Bot active for {name}..." with rotating status messages when active |
| FR-3.4 | Insert warning toast | Launch | Non-blocking warning toast when inserting reply on bot-managed contact. Bot's Ably listener cancels pending timer on human send. Toast is safety net, not gate. Auto-dismiss after 4s with fade-out. |
| FR-3.5 | Email contacts excluded | Launch | Agent bar shows disabled state ("Not available for email contacts"). Toggle dimmed, no pointer events. |
| FR-3.6 | 5-state agent bar | Launch | Agent bar has 5 distinct states: **hidden** (no key, 403), **loading** (pulse animation, checking API), **disabled** (opacity 0.4, no pointer events, tooltip), **off** (eligible but inactive), **on** (active with pulse). Each state driven by eligibility flow outcome. |
| FR-3.7 | Operational rollout check | Launch | After whitelist check, CLOSER_ELIGIBLE verifies the contact's assigned closer (`userId`) is in `allowed_closer_ids`. Reps not in rollout see disabled state. This separates key authorization (can access closer API) from operational rollout (can use Closer Bot). |
| FR-3.8 | Stale callback guards | Launch | All async closer API callbacks capture `switchId` at call time and early-return if contact changed during the request. Prevents stale state on rapid contact navigation. |

### FR-4: Conversation Scoring

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-4.1 | Score button | Launch | Triggers scoring of current conversation context |
| FR-4.2 | Score display | Launch | Score result shown in side panel |

### FR-5: Coach Chat

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-5.1 | Coach interface | Launch | Chat interface for conversational coaching about active conversation |
| FR-5.2 | Controls bar visibility | Post-launch | Coach button must be accessible (see UX fix 7.3) |

### FR-6: Agent HUD

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-6.1 | Platform detection | Launch | HUD shows detected platform (Revio, LinkedIn, Gmail, etc.) |
| FR-6.2 | Prospect name | Launch | Shows prospect name from scraped data |
| FR-6.3 | Message count | Launch | Shows number of messages in conversation |
| FR-6.4 | Rip count | Launch | Shows number of rips generated this session |

### FR-7: Context Menu

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-7.1 | Right-click reply | Launch | Right-click on selected text offers ChatRipper context menu option |

### FR-8: Per-Rep API Key Authentication

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-8.1 | First-run gate | Launch | If no API key in chrome.storage.local, side panel shows setup screen before any feature works. Gate blocks all features (autoAnalyze, Score, Coach, agent toggle). |
| FR-8.2 | Key validation | Launch | Validation routes through service worker (only context with CONFIG.SMARTRIP_API access). Sends POST /suggest with Bearer header — 401/403 = invalid key, any other status = key passed auth middleware (valid). Invalid key shows "Invalid key -- contact Alfred" with reset option. |
| FR-8.3 | Per-rep keys | Launch | Unique key per rep (e.g., cr_adam_xxxx). Dashboard shows per-rep usage. |
<!-- Updated 2026-03-09: B3 removed CLOSER_API_KEY from config.js — closer-bot now uses same per-rep Bearer token -->
| FR-8.4 | Remove hardcoded keys | Launch | Remove ALFRED_KEY from service-worker.js. Closer-bot API uses the same per-rep Bearer token as smartrip — no separate closer key. Single key authenticates across both services. |
<!-- Updated 2026-03-07: A3 implemented (commit b76779c). Gap closed — 403 auto-detection + onChanged listener now re-show gate immediately. -->
| FR-8.5 | Key revocation | Launch | Revoking a key on the backend causes 401/403 on next API call → extension clears stored key and re-shows setup gate automatically. Two mechanisms: (1) `handleAlfredResponse` / streaming status check detect 401/403, clear key via `clearRevokedKey()`, propagate `key_revoked` flag through error responses to sidepanel. (2) `chrome.storage.onChanged` listener in sidepanel detects key removal from any context and shows gate immediately — no API call needed. |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target | Notes |
|----|-------------|--------|-------|
| NFR-1 | Response time | 4-8s | Quality over speed within reason. Quickrip ~4s, smartrip ~6s, deeprip ~8s. |
| NFR-2 | Availability | Manual redundancy | 3 independent engines. Rep switches manually if one is down. |
| NFR-3 | Auto-fallback | Post-launch | Plumbing exists (response.fallback badge). Not wired for launch. |
| NFR-4 | Usability | Self-explanatory | No training required. Reference guide web page post-launch. |
| NFR-5 | Distribution updates | Automatic | CWS handles auto-updates for unlisted extensions (every few hours) |
| NFR-6 | Browser support | Chrome only | No formal OS requirements |
<!-- Updated 2026-03-09: B3 established deploy order requirement -->
| NFR-7 | Deploy order | Backend first | Closer-bot backend must deploy before extension update. Backend accepts both Bearer (new) and X-API-Key (legacy) during transition window. Extension then ships with Bearer-only. Prevents auth failures during rollout. |

---

## 6. Data Requirements

### 6.1 Data in Transit

All data transmitted over HTTPS.

| Flow | Data | Direction |
|------|------|-----------|
| Content script -> Service worker | Conversation text, contact details, Rocket Selling data | Internal (extension) |
| Service worker -> Backend | Full conversation text, contact metadata, reply mode, engine selection | Extension -> Backend |
| Backend -> Service worker | Suggested reply, reasoning, confidence, phase, warning | Backend -> Extension |

### 6.2 Data at Rest

#### Extension (chrome.storage.local)
- Settings only: engine preference, metrics toggle, agent enabled, API key
- Conversation data in memory only -- not persisted
- No PII stored locally

#### Smartrip Backend (GCR) -- Alfie-owned
- SQLite `calls` table: contact_id, contact_name, channel, recent_messages (last 5 message texts), suggestion, reasoning, phase, confidence, warning, tokens, latency, model
- **PII stored:** Contact name + prospect message text
- **No TTL/cleanup** -- grows indefinitely
- **Action required:** Define retention policy (e.g., 90-day TTL or manual purge)
- Cloud Run structured logs: metadata only (contact_id, message_count, latency) -- no message text
- Dashboard access: Alfie only (password-protected)

#### Deeprip / Quickrip / Coach / Score (Railway/n8n) -- Chris-owned
- **Data handling: UNKNOWN**
- Alfie to confirm with Chris what data is logged/stored
- Privacy policy must cover worst case: data may be processed/logged by third-party services

### 6.3 Open Risk

<!-- Updated 2026-03-09: B4 privacy policy now covers this — states third-party retention "not independently verified" -->
Chris's backends are a data privacy blind spot. The published privacy policy (`https://martell-media.github.io/chat-ripper/privacy-policy.html`) addresses this by stating that conversation data is sent to third-party AI services and that their retention practices have not been independently verified. Confirming Chris's actual data handling remains a post-launch item.

---

## 7. UX Requirements

### 7.1 Smartrip Analysis Panel Redesign (Launch)

The smartrip analysis panel has terminology and layout issues.

**Current state:**
- "ENERGY" label = actually Pinecone cosine similarity score (KB match confidence, 0-1 scaled to %)
- "READ" = LLM reasoning field
- "STAGE" = detected sales phase from Rocket Selling box
- "Why this works" section duplicates READ reasoning; warning overwrites it when present

**Fix:**
- Rename ENERGY -> MATCH
- Color-code MATCH value text:
  - Green (60%+): Strong semantic match to closed-won conversation
  - Yellow (40-60%): Moderate match, KB patterns tagged as brain_b source
  - Red (<40%): Weak match, KB patterns flagged as raw_context
- Add tooltip on MATCH: "How closely this conversation matches proven closed-won patterns. KB examples are always used -- higher scores mean more relevant matches."
- Key context: KB content is ALWAYS in the prompt regardless of score. Score = relevance of match, not presence/absence. Backend threshold: 0.4 = brain_b vs raw_context.
- Add warning as distinct amber-styled sp-analysis-row (only when warning exists). Shows warning text + "Fix: [suggested fix]"
- Remove "Why this works" section -- reasoning is in READ, warning has own row. No duplication.
- Deeprip/quickrip: no changes (they don't return analysis/reasoning/warnings). Streaming DOM retains "Energy" label for these engines — different metric, different backend field name.
<!-- Updated 2026-03-07: B2 implemented (commit d4f1fec). Data contract changed: service worker now passes raw `match` float (0-1) instead of pre-formatted `energy` string, plus `warning`/`warningFix` as separate fields. Analysis rendering extracted to `sidepanel/helpers.js` (formatMatchValue, buildAnalysisHtml) for testability. -->

### 7.2 Closer-Bot Insert Warning (Launch)

- **Decision:** Option B -- non-blocking warning toast on Insert when bot is active for contact
- Toast is awareness, not a gate. Bot's Ably listener cancels pending timer on human send.
- Can upgrade to confirm dialog or auto-deactivate if double-replies become a real problem.

### 7.5 Agent Bar States (Launch)

<!-- Updated 2026-03-09: B3 introduced 5-state agent bar. Functional behavior in FR-3.6. -->

The agent bar has 5 visual states (see FR-3.6 for triggers):

| State | Visual | Interaction |
|-------|--------|-------------|
| hidden | Agent bar not visible | N/A |
| loading | Pulse animation, opacity 0.6 | No pointer events |
| disabled | Opacity 0.4, tooltip message | No pointer events |
| off | Normal appearance, no pulse | Click to toggle on |
| on | Active pulse rings + glow | Click to toggle off |

- `prefers-reduced-motion`: all pulse animations suppressed (both active and loading states)
- Optimistic toggle: on↔off changes visually on click, reverts on API failure

### 7.3 Controls Bar Overflow Fix (Post-Launch)

- Coach button exists in HTML but is hidden by controls bar overflow (bar too wide for side panel)
- User can click it if they know it's there, but it's not discoverable
- **Fix needed:** Adjust controls bar layout so all buttons are visible

### 7.4 Floating Button

- **Status:** Dead code. mouseup handler saves selection but never shows the button. Comment in code: "floating button disabled -- side panel auto-analyzes"
- No action needed for launch. Remove dead code post-launch.

---

## 8. Security & Access Control

### 8.1 Distribution (Launch)

- **Domain-restricted CWS installation:** @danmartell.com Google Workspace only
- Unlisted listing -- install via direct link shared with team
- No public discoverability

### 8.2 Authentication (Launch)

- **Per-rep API keys on smartrip:**
  - Generate unique key per rep (e.g., `cr_adam_xxxx`)
  - Side panel first-run gate: if no key in chrome.storage.local, show setup screen blocking all features
  - Validation routes through service worker → POST /suggest with Bearer header. 401/403 = invalid, other = valid (key passed auth middleware)
  - 403 handling: invalid/revoked key → extension auto-clears stored key and re-shows setup gate
  <!-- Updated 2026-03-07: A3 closed the revocation gap. Two mechanisms provide immediate gate display. -->
  - Revoke individual key on departure → next API call returns 401/403 → key cleared, gate shown automatically. `chrome.storage.onChanged` listener also detects external key removal (e.g., Chrome clear data) and shows gate immediately without waiting for an API call.
  - Dashboard shows per-rep usage breakdowns
  <!-- Updated 2026-03-09: B3 removed CLOSER_API_KEY — closer-bot uses same per-rep key -->
  - Hardcoded `ALFRED_KEY` removed from service-worker.js. Closer-bot uses same per-rep Bearer token (no separate key).

<!-- Updated 2026-03-09: B3 unified closer-bot under per-rep Bearer auth -->
- **Closer-bot API (`close.alfredloh.com`):**
  - Uses same per-rep Bearer token as smartrip — single key per rep, shared across services
  - Backend accepts `Authorization: Bearer {key}` (extension) and `X-API-Key` (admin Streamlit dashboard) — dual auth
  - Key scopes control service access: `smartrip` scope for /suggest, `closer` scope for closer-bot API
  - No separate closer-bot key — `CLOSER_API_KEY` removed from `config.js`

- **Chris's backends:** NO authentication. Railway URLs and n8n webhook URLs are effectively public (security through obscurity). Known and accepted risk for launch.

### 8.3 Backend Proxy (Post-Launch)

- Proxy all engines through smartrip -- extension only talks to GCR, which forwards to Railway/n8n
- Full auth coverage: per-rep key validates at GCR, then GCR forwards authenticated requests
- Extension no longer needs direct URLs to Chris's backends
- Single point of auth enforcement

---

## 9. Observability & Telemetry

### 9.1 Current State

- **Zero telemetry in extension**
- Smartrip dashboard covers smartrip calls only (contact_id, latency, tokens, model)
- No visibility into deeprip/quickrip usage, platform distribution, or per-rep patterns

### 9.2 Extension-Side Telemetry (Post-Launch)

- Extension-side counter -> POST to smartrip endpoint
- Track: engine used, platform detected, rip count, timestamp
- Per-rep API key identifies the rep -- no hashing needed
- Covers all 3 engines (extension tracks before sending to any backend)
- No third-party analytics SDK -- data stays on Alfie's infrastructure

---

## 10. CWS Manifest Requirements

### 10.1 Content Script Scope (Launch)

<!-- Updated 2026-03-07: Expanded to all platforms detected by content script, HTTPS only, wildcard subdomains -->
Restrict `content_scripts.matches` from `<all_urls>` to known domains:

- `https://*.sbccrm.com/*` (Revio — app, www, dev)
- `https://*.linkedin.com/*`
- `https://mail.google.com/*`
- `https://*.gmail.com/*`
- `https://*.instagram.com/*`
- `https://*.facebook.com/*`
- `https://*.messenger.com/*`
- `https://x.com/*`
- `https://*.twitter.com/*`
- `https://*.salesforce.com/*`
- `https://*.force.com/*`
- `https://*.hubspot.com/*`

### 10.2 Permissions

All current permissions are justifiable:

| Permission | Justification |
|-----------|---------------|
| storage | Engine preference, API key, settings |
| activeTab | Access active tab for scraping |
| contextMenus | Right-click reply option |
| sidePanel | Side panel UI |
| webNavigation | Detect page navigation for contact changes |

### 10.3 Host Permissions

<!-- Updated 2026-03-07: Added close.alfredloh.com, broadened sbccrm.com to wildcard -->
Backend API URLs scoped in host_permissions. `close.alfredloh.com` added for closer-bot API calls (previously relied on CORS headers). `sbccrm.com` broadened to wildcard for dev/www subdomain support.

---

## 11. Constraints & Assumptions

### 11.1 Constraints

| Constraint | Impact |
|-----------|--------|
| Chrome MV3 | Service worker lifecycle (no long-lived connections), MV3 API surface |
| Unlisted CWS distribution | Link-only install, restricted to @danmartell.com |
| Split backend ownership | 2/3 engines + coach + score = Chris. Alfie cannot modify or debug. |
| Solo developer | Alfie is the only developer. Scope must be realistic. |
| No billing/monetization | Internal tool, no revenue model |
| Chrome only | No Firefox, Safari, or Edge support |

### 11.2 Assumptions

- Reps primarily work in Revio (primary use case)
- Revio API structure and selectors remain stable
- Chris's backends remain available and maintained
- 5.5 FTE users -- scale is not a concern
- Email channel support is not needed for launch (DM-only training data)

---

## 12. Edge Cases & Known Issues

| Scenario | Current Behavior | Status |
|----------|-----------------|--------|
| Email channel contact (Revio) | `unsupported_channel` early return, "Email not supported" UI | Implemented |
<!-- Updated 2026-03-09: B3 replaced simple reset with full 5-state re-check + switchId guards -->
| Closer-bot stale state on contact switch | Full eligibility re-check with `switchId` capture guards stale callbacks. Loading state shown during check. | Fixed (B3) |
| Long conversations | No truncation, no issues reported | Monitor |
| Backend timeout | Error message + retry button | Existing |
| No conversation on page | "No conversation detected" empty state | Existing |
| Extension context invalidated | Error message asks to reload | Existing |
| Contact switch during generation | Stale switch guard exists | Existing |
| Non-Revio platforms | DOM scraping fallback, no Rocket Selling enrichment | By design |
<!-- Updated 2026-03-07: A3 closed this gap -->
| Revoked key after setup | 401/403 from smartrip → key auto-cleared, gate re-appears. `onChanged` listener provides immediate gate display even for external key removal. | Fixed (A3) |
<!-- Updated 2026-03-09: B3 edge cases -->
| Closer 403: revoked key vs no scope | Extension string-matches `body.detail` on "Invalid or revoked" to differentiate. Revoked → clear key + gate. No scope → hide agent bar only. | Fixed (B3) |
| Rapid contact switching during API calls | `switchId` capture pattern: callbacks compare captured ID to current `closerContactId`, early-return if stale. | Fixed (B3) |
| Rep not in operational rollout | CLOSER_ELIGIBLE returns false → agent bar disabled with tooltip. Key still works for smartrip. | Fixed (B3) |
| Optimistic toggle API failure | Visual state reverts to previous on CLOSER_ADD/REMOVE failure. Revoked/forbidden 403 → hidden instead of revert. | Fixed (B3) |
| Controls bar overflow | Coach button hidden on narrow side panels | UX bug (see 7.3) |
| Floating button | Dead code, never shown | Dormant (see 7.4) |

---

## 13. Testing Strategy

### 13.1 Unit Tests

<!-- Updated 2026-03-07: Reflects actual test infrastructure established during A2 -->

**Framework:** Vitest + jsdom (configured in `vitest.config.js`)

**Test structure:**
<!-- Updated 2026-03-07: Added A3 bearer-header tests -->
<!-- Updated 2026-03-09: Added B3 warning-toast tests -->
```
tests/
├── mocks/
│   └── chrome.js           # Chrome API stubs (storage.local, runtime, session)
└── unit/
    ├── first-run-gate.test.js   # A2 — gate display, key storage, reset (5 tests)
    ├── bearer-header.test.js    # A3 — auth helpers, key revocation, error shape (5 tests)
    ├── analysis-panel.test.js   # B2 — MATCH label, colors, warning row, tooltip, XSS (18 tests)
    └── warning-toast.test.js    # B3 — toast display, auto-dismiss, non-blocking insert (8 tests)
```

**Chrome mock** (`tests/mocks/chrome.js`): Stubs `chrome.storage.local` (get/set/remove), `chrome.storage.session`, and `chrome.runtime` (sendMessage, connect). Storage is reset between tests via `beforeEach`.

**Commands:** `npm test` (run once), `npm run test:watch` (watch mode)

### 13.2 Manual Test Checklist

Template based on email blocking verification:

1. Open email-channel contact in Revio -> "Email not supported" in side panel, agent toggle greyed out
2. Open sms-email contact -> same behavior
3. Open DM contact (Instagram/Facebook/SMS) -> all features work normally
4. Switch from DM to email contact -> toggle deactivates and disables
5. Switch from email to DM contact -> toggle re-enables, CLOSER_CHECK fires
6. Verify no fetchRevioMessages call for email contacts (Network tab)
7. Verify no CLOSER_ADD/REMOVE/CHECK calls for email contacts

Extend this pattern for each feature area.

### 13.3 E2E Automation

Not realistic for a solo developer with a Chrome extension. Manual testing is the pragmatic approach.

---

## 14. Rollback Plan

- CWS has no one-click rollback
- **Fix forward:** Push new version (1-3 day CWS review)
- Keep known-good .zip archived for each release
- **Emergency brake:** Unpublish listing (existing installs keep working until next update)

---

## 15. External Dependencies

| Dependency | Owner | Risk | Blast Radius |
|-----------|-------|------|-------------|
| Revio API (app.sbccrm.com) | SBC/Revio | API changes break scraping | Primary workflow broken |
| Smartrip (/suggest) | Alfie (GCR) | Full control | Smartrip replies unavailable |
| Deeprip (Railway) | Chris | No access to debug | Deeprip replies unavailable |
| Quickrip (Railway) | Chris | No access to debug | Quickrip replies unavailable |
| Coach (n8n webhook) | Chris | No access to debug | Coach chat unavailable |
| Score (n8n webhook) | Chris | No access to debug | Scoring unavailable |
| Closer-bot API (close.alfredloh.com) | Alfie | Full control | Agent toggle broken |
| Pinecone (vector DB) | Alfie | Managed service | KB matching degrades |
| Chrome Web Store | Google | Review delays (1-3 days) | Update delays |

---

## 16. Prioritized Roadmap

### Launch (March 9-10, 2026)

| Item | Status |
|------|--------|
| Analyze & Reply (primary workflow) | Existing |
| All 3 engines operational | Existing |
| Score, Coach | Existing |
| Closer-bot toggle (Revio DM only) | Existing |
| Email channel blocking | Implemented |
| Closer-bot stale state fix | Implemented |
| Per-rep API keys on smartrip | Deployed |
| First-run API key setup gate | Implemented |
| Remove hardcoded ALFRED_KEY + wire Bearer auth | Implemented |
<!-- Updated 2026-03-09: B4 implemented — pure HTML on GitHub Pages, no build step -->
| Privacy policy (CWS requirement) | Implemented |
| Restrict content_scripts to known domains | Implemented |
| Smartrip analysis panel redesign (MATCH rename, color coding, warning row, remove duplication) | Implemented |
<!-- Updated 2026-03-09: B3 scope expanded to include extension toggle + per-rep Bearer auth on closer API -->
| Closer-bot insert warning toast + extension toggle (per-rep auth, 5-state agent bar) | Implemented |
| Domain-restricted CWS installation | **TODO** |
| CWS unlisted submission | **TODO** |

### Post-Launch

| Item | Effort | Impact |
|------|--------|--------|
| Controls bar overflow fix (Coach button visibility) | Low | Feature discoverability |
| Backend proxy (all engines through GCR) | Medium | Full auth coverage |
| Extension-side telemetry | Medium | Visibility into all engine usage |
| Graceful degradation (auto-fallback) | Medium | Reliability |
| Phase detection fix (fall back to deal_stage when box is null) | Low | Prompt quality |
| Data retention policy for smartrip SQLite | Low | Privacy compliance |
| Confirm Chris's data handling practices | Low | Privacy compliance |
| PIPEDA/PIPA compliance review | Medium | Regulatory |
| KB1 growth (Alfie's version) | Ongoing | Reply quality |
| Remove floating button dead code | Low | Code hygiene |
| Reference guide web page | Low | Onboarding |

---

## Appendix A: Closer-Bot Interaction Model

<!-- Updated 2026-03-09: B3 added Bearer auth and eligibility check -->
When a rep toggles the closer-bot on for a contact (requires per-rep Bearer auth + `closer` scope + rep in `allowed_closer_ids`):

1. Contact is added to `ALLOWED_INBOXES` via `close.alfredloh.com` (Bearer auth)
2. Closer-bot (separate system) monitors Ably WebSocket for incoming messages
3. On eligible inbound message: bot calls `/suggest`, waits, then auto-sends reply via Revio API
4. If rep sends manually (direction="sent" via Ably): bot cancels pending timer
5. If rep removes the Autochat tag in Revio: bot marks `human_takeover`, fully disengages
6. Race guard: 30-min cooldown prevents overlapping follow-ups
7. **Gap:** No automatic `human_takeover` on manual message -- contact stays `active` unless tag removed

ChatRipper shows the agent bar as informational. It does NOT block reply generation. The insert warning toast provides awareness without friction.

## Appendix B: Platform Support Matrix

| Platform | Scraping | Insert Reply | Rocket Selling Data | Closer-Bot Toggle |
|----------|----------|-------------|--------------------|--------------------|
<!-- Updated 2026-03-09: B3 — closer-bot toggle requires eligibility (key scope + rollout check) -->
| Revio (DM channels) | API | textarea | Yes | Yes (requires `closer` scope + rollout eligibility) |
| Revio (email channels) | Blocked | N/A | N/A | Disabled ("Not available for email contacts") |
| LinkedIn | DOM | contenteditable | No | Local only |
| Gmail | DOM | contenteditable | No | Local only |
| Instagram | DOM | contenteditable | No | Local only |
| Facebook | DOM | contenteditable | No | Local only |
| X (Twitter) | DOM | contenteditable | No | Local only |
| Salesforce | DOM | contenteditable | No | Local only |
| HubSpot | DOM | contenteditable | No | Local only |

## Appendix C: Backend Engine Comparison

| Attribute | deeprip | quickrip | smartrip |
|-----------|---------|----------|----------|
| Owner | Chris | Chris | Alfie |
| Infrastructure | Railway | Railway | Google Cloud Run |
| Speed | ~8s | ~4s | ~6s |
| KB grounded | Yes (Chris's KB) | Yes (Chris's KB) | Yes (Alfie's KB via Pinecone) |
<!-- Updated 2026-03-07: Clarified "Reply only" and Energy vs Match distinction -->
| Analysis output | Reply only (no analysis panel; streaming DOM retains "Energy" label if backend ever returns it) | Reply only (same as deeprip) | Reply + STAGE + MATCH + READ + warning (launch). "Match" = KB cosine similarity, color-coded green/yellow/red. |
| Authentication | None | None | Per-rep API key (launch) |
| Data logging | Unknown | Unknown | SQLite dashboard_store |
| Alfie can debug | No | No | Yes |
