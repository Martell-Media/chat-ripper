# Architecture Design Document: ChatRipper AI

**Version:** 1.0
**Date:** March 6, 2026
**Author:** Alfie Loh
**Status:** Approved
**PRD:** `docs/core/prd.md` (Approved)
**Charter:** `docs/core/project_charter.md` (Approved)

---

## 1. System Overview

ChatRipper AI is an internal Chrome MV3 extension that provides Martell Media's revenue team (5.5 FTE) with AI-powered sales reply suggestions. The system spans three repositories, five hosting environments, and integrates with external platforms that Alfie does not control.

```
                        Chrome Extension (chat-ripper)
                    ┌────────────────────────────────────┐
                    │  Content Script  │  Service Worker  │
                    │  (DOM + API)     │  (Message Broker) │
                    │        │         │    │    │    │    │
                    │        └─────────┼────┘    │    │    │
                    │                  │  Side Panel UI   │
                    └──────────────────┼─────────────────┘
                                       │
              ┌────────────────────────┼─────────────────────┐
              │                        │                     │
    ┌─────────▼────────┐    ┌─────────▼────────┐   ┌───────▼────────┐
    │   Smartrip (GCR)  │    │  Deeprip/Quickrip │   │  Coach / Score  │
    │   Alfie-owned     │    │  Railway (Chris)   │   │  n8n (Chris)    │
    │   /suggest        │    │  /api/reply/*      │   │  webhook/*      │
    └────────┬──────────┘    └────────────────────┘   └────────────────┘
             │
    ┌────────▼──────────┐
    │  Closer-Bot (VM)   │
    │  Ably WebSocket    │
    │  → /suggest        │
    │  → Revio API send  │
    └────────────────────┘
```

### Repositories

| Repo | Purpose | Hosting |
|------|---------|---------|
| `chat-ripper` | Chrome MV3 extension | Chrome Web Store (unlisted) |
| `hackathon/ai-sales-copilot` | Smartrip backend + KB vectorization pipeline | Google Cloud Run (us-east1) |
| `closer-bot` | Autonomous reply bot + dashboard | Self-hosted VM (docker-compose) |

---

## 2. Extension Architecture

The extension runs in three isolated execution contexts with distinct capabilities and lifecycles.

### 2.1 Execution Contexts

```
┌──────────────────────────────────────────────────────────┐
│                    Chrome Browser                         │
│                                                          │
│  ┌─────────────────┐  chrome.runtime   ┌──────────────┐ │
│  │  Content Script  │ ◄──────────────► │Service Worker │ │
│  │  content.js      │  sendMessage()   │ service-      │ │
│  │  ~1500 LOC       │                  │ worker.js     │ │
│  │                  │                  │ ~1100 LOC     │ │
│  │  - DOM access    │                  │               │ │
│  │  - API scraping  │                  │ - API gateway │ │
│  │  - Floating UI   │                  │ - Msg broker  │ │
│  │  - Text insert   │                  │ - Key validate│ │
│  └─────────────────┘                   └───────┬──────┘ │
│                                                │        │
│                                      chrome.runtime     │
│                                        connect()        │
│                                                │        │
│                                        ┌───────▼──────┐ │
│                                        │  Side Panel   │ │
│                                        │ sidepanel.js  │ │
│                                        │ ~1500 LOC     │ │
│                                        │               │ │
│                                        │ - API key gate│ │
│                                        │ - Reply UI    │ │
│                                        │ - Chat/Score  │ │
│                                        │ - Agent bar   │ │
│                                        └──────────────┘ │
└──────────────────────────────────────────────────────────┘
```

| Context | File | LOC | Responsibilities |
|---------|------|-----|------------------|
| Content Script | `content/content.js` | ~1464 | DOM access, Revio API scraping (incl. `userId` propagation), platform detection, text selection, reply insertion |
<!-- Updated 2026-03-09: B3 added handle403, CLOSER_ELIGIBLE handler, Bearer auth on all closer endpoints -->
| Service Worker | `background/service-worker.js` + `background/auth.js` | ~1780 + 16 | Message broker, API gateway to all backends, auth header injection (Bearer on smartrip + closer-bot), key validation, key revocation, 403 differentiation (`handle403`), auto-fallback |
<!-- Updated 2026-03-09: B3 added setAgentBarState (5-state), optimistic toggle, switchId guards, toast -->
| Side Panel | `sidepanel/sidepanel.js` + `sidepanel/helpers.js` | ~2006 + 61 | Reply display, chat/score UI, 5-state agent bar (`setAgentBarState`), insert warning toast, optimistic toggle, streaming display, API key gate, storage change listener, state management. `helpers.js` extracts analysis rendering + toast guard logic for testability — loaded via `<script>` before `sidepanel.js`. |

### 2.2 Message Passing

Two communication patterns:

**Request/Response** (`chrome.runtime.sendMessage`):
| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `GET_REPLY` | sidepanel -> service worker | Trigger reply generation |
| `ANALYZE_CHAT` | sidepanel -> service worker | Trigger chat analysis |
| `ANALYZE_SCORE` | sidepanel -> service worker | Trigger scoring |
| `SCRAPE_PAGE` | service worker -> content script | Request page scrape |
| `INSERT_TEXT` | service worker -> content script | Insert reply into chat input |
| `OPEN_SIDE_PANEL` | content script -> service worker | Open side panel |
| `SIDE_PANEL_READY` | sidepanel -> service worker | Panel loaded (informational only, does not trigger scraping) |
| `VALIDATE_API_KEY` | sidepanel -> service worker | Validate key via POST /suggest with Bearer header. Returns `{success, error?}` |
| `REVIO_CONTACT_CHANGED` | service worker -> sidepanel | Contact switch detected (via `webNavigation.onHistoryStateUpdated`) |
<!-- Updated 2026-03-09: B3 added CLOSER_ELIGIBLE, all closer messages now use Bearer auth -->
| `CLOSER_CHECK` | sidepanel -> service worker | Check whitelist status (Bearer auth, 403 differentiated via `handle403`) |
| `CLOSER_ADD` | sidepanel -> service worker | Add contact to whitelist (Bearer auth, optimistic toggle) |
| `CLOSER_REMOVE` | sidepanel -> service worker | Remove from whitelist (Bearer auth, optimistic toggle) |
| `CLOSER_ELIGIBLE` | sidepanel -> service worker | Check if contact's assigned closer (`userId`) is in `allowed_closer_ids` — determines off vs disabled state |
| `COACH_CHAT_SEND` | sidepanel -> service worker | Send coach message |
| `SCORE_CONVERSATION` | sidepanel -> service worker | Score conversation |

**Streaming** (`chrome.runtime.connect` ports):
| Port Name | Format | Purpose |
|-----------|--------|---------|
| `stream-reply` | NDJSON | Streaming reply from deeprip/quickrip |
| `stream-coach` | SSE | Streaming coach responses from n8n |

### 2.3 State Management

| Layer | Mechanism | Data | Lifetime |
|-------|-----------|------|----------|
| Persistent | `chrome.storage.local` | Engine preference, API key, metrics toggle, agent enabled | Across sessions |
| Session | `chrome.storage.session` | `pendingChatContext`, `pendingScoreContext` | Browser session |
| In-memory (sidepanel) | JS variables | `currentMessages`, `chatMessages`, `currentFullPage` | Until panel reload |
| In-memory (content) | JS variable | `_revioCache` (10s TTL) | Until tab reload |

No conversation data is persisted locally. Sidepanel reload loses all state.

### 2.4 Scraping Strategies

**Revio (Primary)** -- API-based scraping:
1. Extract auth cookies (`token`, `XSRF-TOKEN`) from browser cookie jar
2. `GET /bld/api/contacts/{contactId}` -- contact details, Rocket Selling data
3. `GET /bld/api/contacts/{contactId}/messages` -- conversation history (paginated)
4. 10-second `_revioCache` prevents duplicate API calls on rapid re-scrapes
5. Email channel early return (`channel === 'email' || channel === 'sms-email'`) skips message fetch

**All Other Platforms** -- DOM-based scraping:
- Platform-specific selectors for LinkedIn, Gmail, Instagram, Facebook, X
- Generic fallback scraper for unrecognized platforms
- Best-effort: quality varies by platform DOM stability

### 2.5 Contact Switch Detection

<!-- Updated 2026-03-09: B3 added 5-state eligibility flow with switchId guards -->

```
Revio SPA navigation
        │
        ▼
Service worker: webNavigation.onHistoryStateUpdated
        │
        ▼
Service worker: extract contactId from URL
        │
        ▼
REVIO_CONTACT_CHANGED message to sidepanel
        │
        ▼
Sidepanel: setAgentBarState("loading"), capture switchId
        │
        ▼
SCRAPE_PAGE → get contact data (incl. userId)
        │
        ▼
CLOSER_CHECK (Bearer auth) → 403 differentiation
        │
        ├─ revoked key → hidden, clear key
        ├─ no scope → hidden
        ├─ whitelisted → on
        └─ not whitelisted:
                │
                ▼
        CLOSER_ELIGIBLE (userId) → rollout check
                │
                ├─ eligible → off (can toggle on)
                └─ not eligible → disabled

All callbacks guarded by switchId === closerContactId
(prevents stale state on rapid contact navigation)
```

---

## 3. Backend Architecture

### 3.1 Smartrip (Alfie-Owned)

**Repo:** `hackathon/ai-sales-copilot`
**Hosting:** Google Cloud Run, us-east1, max-instances=1, min-instances=1, 512Mi/1CPU
**URL:** `https://ai-sales-copilot-458007064300.us-east1.run.app`

```
Request
  │
  ▼
CopilotKeyMiddleware (ASGI)
  │ - Authorization: Bearer {key} → validate against api_keys table
  │ - X-Copilot-Key fallback → hmac.compare_digest (legacy)
  │ - Exempt: /health, /dashboard/*, /api/keys/*
  │
  ▼
FastAPI Router
  │
  ▼
SuggestionService.generate()
  │
  ├─► Phase detection (Rocket Selling box → sales phase)
  │
  ├─► DiscoveryBrain.query() [2s timeout, fail-open]
  │     │
  │     ├─ Voyage embed (voyage-4-large, 1024 dims, input_type="query")
  │     └─ Pinecone query (sales-copilot-v3, cosine, top 5, dedup by contact_id)
  │
  ├─► PromptBuilder.build()
  │     │
  │     └─ system-prompt.md + phase + KB matches + conversation
  │
  ├─► LLM.generate() [12s timeout, fallback to cache]
  │     │
  │     ├─ Claude Sonnet 4.5 (tool_choice forced)
  │     └─ OpenAI as config option
  │
  └─► CachedFallback (JSON by contact/phase) [last resort]

  ▼
Response: { reply, reasoning, phase, confidence, warning }
  +
async DashboardStore.record() [fire-and-forget]
```

**Key Design Decisions:**
- **Fail-open everywhere:** Brain timeout → proceed without KB. LLM timeout → cached fallback. Dashboard write failure → silently dropped.
- **Single-writer constraint:** Litestream replicates SQLite WAL to GCS (1-min sync). Requires `max-instances=1` on Cloud Run.
- **No staging environment.** `make deploy` runs `gcloud run deploy` directly.

### 3.2 Deeprip / Quickrip (Chris-Owned)

**Hosting:** Railway
**URLs:** `https://backend-production-06c5.up.railway.app/api/reply/{thinking,fast}`
**Authentication:** None
**Response format:** NDJSON stream
**Data handling:** Unknown -- Chris-owned, Alfie cannot inspect or debug

### 3.3 Coach / Score (Chris-Owned)

**Hosting:** n8n (Chris's instance)
**URLs:** n8n webhook endpoints (see service-worker.js lines 8-9)
**Authentication:** None
**Response format:** SSE (coach), JSON (score)
**Data handling:** Unknown

### 3.4 Auto-Fallback

```
Service Worker receives GET_REPLY
        │
        ▼
   Selected engine?
   ┌────┴────────┐
   │             │
 alfred      thinking/fast
   │             │
   ▼             ▼
doAlfredFetch  doFetch(Railway)
   │             │
   │          on error
   │             │
   │             ▼
   │       doAlfredFetch (fallback)
   │             │
   │         res.fallback = true
   ▼             ▼
  Response    Response
```

Smartrip is always the fallback target. If smartrip is the primary and fails, there is no secondary fallback -- error is shown to the user.

---

## 4. Closer-Bot Architecture

**Repo:** `closer-bot`
**Hosting:** Self-hosted VM running docker-compose
**URL:** `https://close.alfredloh.com`

### 4.1 Deployment Topology

```
┌─────────────────────────────────────┐
│          Self-Hosted VM              │
│                                     │
│  ┌─────────┐  ┌───────────────────┐ │
│  │  Caddy   │  │   Bot Container   │ │
│  │ (reverse │  │                   │ │
│  │  proxy,  │  │  Ably listener    │ │
│  │ auto TLS)│  │  Worker pool      │ │
│  │          │  │  CopilotClient    │ │
│  │  :443 ───┼──┤  → /suggest      │ │
│  │          │  │  → Revio API send │ │
│  └─────────┘  └────────┬──────────┘ │
│       │                │            │
│       │         ┌──────▼──────┐     │
│       │         │   SQLite DB  │     │
│       │         │ (shared vol) │     │
│       │         └──────▲──────┘     │
│       │                │            │
│  ┌────▼───────────────┐│            │
│  │ Dashboard Container ││            │
│  │ Streamlit :8501    ││            │
│  │ FastAPI   :8502    │┘            │
│  │ /api/allowed-inboxes              │
│  └────────────────────┘             │
└─────────────────────────────────────┘
```

### 4.2 Message Processing Flow

```
Revio Ably Channel (customer-{id}-messages)
        │
        ▼
Ably SDK (token refresh every ~50 min)
        │
        ▼
Router: eligibility check
  - Is contact in allowed_inboxes?
  - Direction = "received"? (skip human-sent)
  - 30-min cooldown between follow-ups?
        │
        ▼
Worker queue
        │
        ▼
CopilotClient → POST /suggest (smartrip)
  - X-Copilot-Key header (shared key, legacy — bot process hasn't migrated to per-rep Bearer)
  - 30s timeout
        │
        ▼
Revio API → send reply
        │
        ▼
Human override detection:
  - direction="sent" (Ably) → cancel pending timer
  - Autochat tag removed (Revio) → human_takeover
```

### 4.3 Extension ↔ Closer-Bot Integration

<!-- Updated 2026-03-09: B3 switched to per-rep Bearer auth, added CLOSER_ELIGIBLE, 403 differentiation -->

The extension manages the closer-bot whitelist and checks operational rollout eligibility, but does not control reply behavior:

| Extension Action | API Call | Auth | Effect |
|-----------------|----------|------|--------|
| `CLOSER_CHECK` | `GET /api/config/allowed-inboxes/{contactId}` | Bearer | Returns `{whitelisted: bool}`. 403 differentiated via `handle403`: revoked key → clear storage; no scope → hide agent bar. |
| `CLOSER_ADD` | `POST /api/config/allowed-inboxes/{contactId}` | Bearer | Adds contact to whitelist. Optimistic UI — visual state changes before API response. |
| `CLOSER_REMOVE` | `DELETE /api/config/allowed-inboxes/{contactId}` | Bearer | Removes from whitelist. Optimistic UI — reverts on failure. |
| `CLOSER_ELIGIBLE` | `GET /api/config/allowed-closers/{userId}` | Bearer | Checks if contact's assigned closer is in `allowed_closer_ids`. Determines disabled vs off state. |

**Dual auth on closer-bot backend:** Extension sends `Authorization: Bearer {key}` (per-rep). Admin Streamlit dashboard sends `X-API-Key` (static). Backend `verify_auth()` accepts both. Key must have `closer` scope to access these endpoints.

---

## 5. Knowledge Base & Vectorization

### 5.1 Discovery Pipeline

**Location:** `hackathon/discovery/`
**Execution:** Manual (no automated scheduling)

```
Step 1: 1_fetch_contacts.py
  Revio API → closed-won contacts (≥10 messages)
        │
Step 2: 2_fetch_conversations.py
  Revio API → full conversation history
        │
Step 3: 3_classify.py
  Anthropic Batch API (Claude Opus, 50% cheaper)
  → sales phase, metadata classification
        │
Step 4: 4_aggregate.py
  Analyze classification results → metadata schema
        │
Step 5: 5_vectorize.py
  Voyage embed (voyage-4-large, 1024 dims) + Pinecone upsert
```

### 5.2 Vector Database

| Property | Value |
|----------|-------|
| Service | Pinecone (serverless) |
| Index | `sales-copilot-v3` |
| Region | AWS us-east-1 |
| Similarity | Cosine |
| Dimensions | 1024 |
| Vectors | 8,786 session-level vectors from 805 conversations |
| Metadata fields | 18 (phase, channel, objection_types, buying_signals, etc.) |
| Embedding model | Voyage `voyage-4-large` |
| Input types | `"document"` for ingestion, `"query"` for search |

### 5.3 Query-Time Flow

```
Conversation text
      │
      ▼
Voyage embed (input_type="query")
      │
      ▼
Pinecone query (top_k=5, cosine similarity)
      │
      ▼
Dedup by contact_id (prevents clustering from same conversation)
      │
      ▼
KB matches injected into LLM prompt
  - score ≥ 0.4 → brain_b source (strong match)
  - score < 0.4 → raw_context (weak match, still included)
```

---

## 6. Security Architecture

### 6.1 Authentication Model

```
┌──────────────────────────────────────────────────────┐
│                     Extension                          │
│                                                        │
│  Side Panel                    Service Worker          │
│  ┌─────────────┐              ┌─────────────────┐     │
│  │ API Key Gate │─VALIDATE──► │ POST /suggest    │     │
│  │ (first-run)  │ _API_KEY    │ Bearer {key}     │     │
│  │              │◄────────────│ 401/403=invalid  │     │
│  │ stores key   │             │ other=valid      │     │
│  │ in storage   │             └────────┬────────┘     │
│  └─────────────┘                       │              │
│                                        │              │
│                              ┌─────────▼────────┐     │
│                              │ Bearer {key} ────┼──► Smartrip
│                              │ (from storage)    │     │
│                              │                   │     │
│                              │ Bearer {key} ────┼──► Closer-bot API
│                              │ (same key, closer │     │
│                              │  scope required)  │     │
│                              │                   │     │
│                              │ Direct URLs ─────┼──► Chris's Backends
│                              │ (no auth)         │     (known risk)
│                              └───────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**First-run gate flow** (implemented in A2):
1. Side panel loads → checks `chrome.storage.local` for `smartrip_api_key`
2. No key → gate overlay blocks all features (autoAnalyze, Score, Coach, agent toggle)
3. Rep enters key → `VALIDATE_API_KEY` message to service worker
4. Service worker POSTs `/suggest` with `Authorization: Bearer {key}` and minimal body
5. 401/403 = invalid key → error shown. Any other status = key passed auth middleware → valid
6. Valid → stored in `chrome.storage.local`, gate dismissed, `autoAnalyze()` called
7. Header key button allows manual reset (with confirm dialog)

<!-- Updated 2026-03-07: A3 closed the revocation gap with two mechanisms -->
**Key revocation flow** (implemented in A3):
1. Smartrip returns 401/403 → `clearRevokedKey()` removes key from storage, throws with `keyRevoked: true`
2. Error propagates through message passing with `key_revoked` flag → sidepanel calls `resetApiKey()` → gate shown
3. `chrome.storage.onChanged` listener in sidepanel detects key removal from any context (service worker, external clear) → shows gate immediately without waiting for an error response
4. Both mechanisms are defense-in-depth — the `onChanged` listener mitigates the content script limitation where `new Error(response.error)` drops the `key_revoked` flag

| Backend | Auth Mechanism | Key Format |
|---------|---------------|------------|
| Smartrip | `Authorization: Bearer {key}` | `cr_{rep_id}_{24_hex_chars}` (per-rep, from `chrome.storage.local`) |
<!-- Updated 2026-03-07: Extension no longer sends X-Copilot-Key (A3). Backend still accepts it for legacy support. -->
| Smartrip (backend legacy) | `X-Copilot-Key` header | Shared HMAC key — accepted by backend, no longer sent by extension |
| Deeprip/Quickrip | None | N/A |
| Coach/Score | None | N/A |
<!-- Updated 2026-03-09: B3 switched closer-bot from static X-API-Key to per-rep Bearer -->
| Closer-bot API (extension) | `Authorization: Bearer {key}` | Same per-rep key as smartrip (from `chrome.storage.local`). Key must have `closer` scope. |
| Closer-bot API (admin dashboard) | `X-API-Key` header | Static key for Streamlit admin. Backend `verify_auth()` accepts both auth methods. |
| Revio API | Cookie extraction (`token`, `XSRF-TOKEN`) | Browser session cookies |

<!-- Updated 2026-03-09: B3 unified auth — single per-rep key for both smartrip and closer-bot -->
**Launch state:** Per-rep keys on smartrip and closer-bot. Single key per rep authenticates across both services — key scopes (`smartrip`, `closer`) control which APIs are accessible. `CLOSER_API_KEY` removed from `config.js`. Chris's backends have no auth (security through obscurity -- URLs are not public but are embedded in extension source). Auth helpers (`getStoredApiKey`, `clearRevokedKey`) are extracted to `background/auth.js` for testability, loaded via `importScripts` in service worker.

**Post-launch:** Proxy all engines through smartrip (PRD Section 8.3). Extension only talks to GCR, which forwards authenticated requests to Railway/n8n. Single point of auth enforcement.

### 6.2 Extension Distribution

- Chrome Web Store, unlisted listing
- Domain-restricted to `@danmartell.com` Google Workspace
<!-- Updated 2026-03-07: B1 implemented (commit e392956) -->
- Content scripts restricted to 12 domain patterns covering 8 platforms (B1 implemented). `web_accessible_resources` matches the same patterns. `close.alfredloh.com` added to `host_permissions`.
- No public discoverability

### 6.3 Data Privacy

**Data in transit:** All HTTPS. Conversation text, contact details, and Rocket Selling data sent to backends.

**Data at rest:**

| Location | What's Stored | PII | Retention |
|----------|--------------|-----|-----------|
| Extension (`chrome.storage.local`) | Settings only | API key | Indefinite |
| Extension (memory) | Conversation data | Yes (transient) | Until panel reload |
| Smartrip SQLite | contact_id, name, messages (last 5), suggestion, reasoning | Yes | Indefinite (no TTL) |
| Cloud Run logs | Metadata only (contact_id, latency) | contact_id | Default GCP retention |
| Chris's backends | Unknown | Unknown | Unknown |
| Closer-bot SQLite | contact_id, allowed_inboxes | contact_id | Until manually removed |

**Open risks:**
- Chris's backends are a data privacy blind spot (unknown retention/logging)
- Smartrip has no data retention policy (grows indefinitely)
- PIPEDA/PIPA compliance review deferred to post-launch

---

## 7. Deployment Architecture

### 7.1 Deployment Topology

```
┌──────────────────────────────────────────────────────────────┐
│                      Production Environment                   │
│                                                              │
│  Chrome Web Store          Google Cloud Run (us-east1)       │
│  ┌────────────┐            ┌──────────────────────┐          │
│  │ ChatRipper  │            │  Smartrip             │          │
│  │ Extension   │───HTTPS───►│  FastAPI + SQLite     │          │
│  │ (unlisted)  │            │  max=1, min=1         │          │
│  └────────────┘            │  512Mi / 1 CPU        │          │
│        │                   │  Litestream → GCS     │          │
│        │                   └──────────────────────┘          │
│        │                                                     │
│        │                   Railway                            │
│        │                   ┌──────────────────────┐          │
│        ├──────HTTPS───────►│  Deeprip / Quickrip   │          │
│        │                   │  (Chris)              │          │
│        │                   └──────────────────────┘          │
│        │                                                     │
│        │                   n8n                                │
│        │                   ┌──────────────────────┐          │
│        ├──────HTTPS───────►│  Coach / Score        │          │
│        │                   │  (Chris)              │          │
│        │                   └──────────────────────┘          │
│        │                                                     │
│        │                   Self-Hosted VM                     │
│        │                   ┌──────────────────────┐          │
│        └──────HTTPS───────►│  Closer-Bot           │          │
│                            │  docker-compose       │          │
│                            │  Caddy + Bot + Dash   │          │
│                            └──────────────────────┘          │
│                                                              │
│  External                                                    │
│  ┌────────────┐  ┌───────────┐  ┌────────────────┐          │
│  │ Revio API   │  │ Pinecone   │  │ Ably (Revio)   │          │
│  │ sbccrm.com  │  │ Serverless │  │ WebSocket      │          │
│  └────────────┘  └───────────┘  └────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Deployment Mechanisms

| Component | Deployment | CI/CD |
|-----------|-----------|-------|
| Extension | CWS upload (.zip via `scripts/package.sh`) | GitHub Actions: lint (Biome) + test (Vitest) on push |
<!-- Updated 2026-03-09: B4 added GitHub Pages for privacy policy -->
| Privacy policy | GitHub Pages from `public/` via `actions/deploy-pages@v4` | GitHub Actions: triggers on `public/**` changes to master |
| Smartrip | `make deploy` → `gcloud run deploy` | None |
| Closer-bot | `docker-compose up` on VM | None |
| Deeprip/Quickrip | Railway auto-deploy (Chris) | Unknown |
| Coach/Score | n8n workflow editor (Chris) | N/A |

### 7.3 Infrastructure Constraints

- **Cloud Run max-instances=1**: Required by Litestream single-writer pattern. SQLite WAL → GCS replication (1-min sync interval). On redeploy: Litestream restores DB from GCS before app starts.
- **No staging environment**: All testing against production.
- **Extension CI**: GitHub Actions runs Biome lint + Vitest on push. Deployment still manual (CWS upload).
- **CWS update latency**: Review takes 1-3 days. No one-click rollback -- fix forward or unpublish.

---

## 8. Error Handling & Resilience

### 8.1 Extension Error Handling

| Scenario | Behavior |
|----------|----------|
| Deeprip/quickrip error (any type) | Auto-fallback to smartrip |
| Auto-fallback succeeds | Response tagged with `fallback: true` badge |
| Smartrip error (as primary or fallback) | Error message + retry button |
| Invalid API key (gate validation) | "Invalid API key. Contact Alfred for a valid key." with retry |
| Network error (gate validation) | "Could not reach server. Check your connection and try again." |
<!-- Updated 2026-03-07: A3 auto-detects 401/403 and re-shows gate -->
| Invalid/revoked API key (401/403 during use) | Key auto-cleared from storage, gate re-shown immediately. `onChanged` listener provides belt-and-suspenders coverage. |
| Extension context invalidated | Error message asks to reload |
| Port disconnect (streaming) | Fallback handling, reconnect on next request |
| No conversation detected | "No conversation detected" empty state |
| Email channel contact | "Email not supported" message, toggle disabled |

### 8.2 Smartrip Resilience

| Layer | Failure Mode | Behavior |
|-------|-------------|----------|
| Brain (Pinecone/Voyage) | Timeout (2s) or error | Fail-open: proceed without KB matches |
| LLM (Claude) | Timeout (12s) or error | Fall back to cached response by contact/phase |
| Cached Fallback | No cache hit | Return generic error |
| Dashboard write | Any error | Fire-and-forget, silently dropped |

**Design principle:** Fail-open at every internal layer. A degraded response is always better than no response.

### 8.3 Closer-Bot Resilience

| Scenario | Behavior |
|----------|----------|
| Smartrip `/suggest` timeout (30s) | Error logged, message skipped |
| Revio API send failure | Error logged, no retry |
| Ably disconnect | SDK auto-reconnects |
| Human sends while bot pending | `direction="sent"` event cancels pending timer |
| Docker healthcheck fails | Container restart (30s interval) |

---

## 9. Observability

### 9.1 Current State

**Zero alerting anywhere in the stack.** No Sentry, Datadog, PagerDuty, or Cloud Monitoring alerts.

| Component | Observability |
|-----------|--------------|
| Extension | None (zero telemetry) |
| Smartrip | Structured JSON logs → Cloud Logging. Dashboard (SQLite): contact_id, latency, tokens, model. Brain telemetry: voyage_embed_ms, pinecone_query_ms, match_count |
| Closer-bot | Docker healthcheck (30s). Console logging. No external monitoring |
| Deeprip/Quickrip | Unknown (Chris) |
| Coach/Score | Unknown (Chris) |

### 9.2 Post-Launch Telemetry Plan

Extension-side counter → POST to smartrip endpoint:
- Track: engine used, platform detected, rip count, timestamp
- Per-rep API key identifies the rep
- Covers all 3 engines (extension tracks before sending to any backend)
- No third-party analytics SDK

---

## 10. Integration Points

### 10.1 External Dependencies

| System | Integration Type | Owner | Risk Level |
|--------|-----------------|-------|-----------|
| Revio (app.sbccrm.com) | Cookie-based API scraping | SBC/Revio | **High** -- no official API, cookie format changes break primary workflow |
| Revio Ably channels | WebSocket (closer-bot) | SBC/Revio | **Medium** -- Ably SDK handles reconnection |
| Pinecone | Managed vector DB | Alfie (Pinecone account) | **Low** -- serverless, managed SLA |
| Voyage AI | Embedding API | Alfie (Voyage account) | **Low** -- stateless API |
| Anthropic | LLM API (Claude Sonnet 4.5) | Alfie (Anthropic account) | **Low** -- fallback to cache on failure |
| Railway | Hosting for deeprip/quickrip | Chris | **Medium** -- no access to debug |
| n8n | Hosting for coach/score | Chris | **Medium** -- no access to debug |
| Chrome Web Store | Extension distribution | Google | **Low** -- review delays only |

### 10.2 Architectural Risk: Revio API Dependency

Revio has no official API. The extension extracts auth cookies (`token`, `XSRF-TOKEN`) from the browser's cookie jar and calls internal Revio endpoints (`sbccrm.com/bld/api/*`). This is a hard dependency with no mitigation:

- Cookie format changes → primary workflow breaks
- API endpoint changes → scraping breaks
- No contractual API guarantee
- No alternative data source for conversation history

---

## 11. Future State: Backend Proxy

**PRD Section 8.3 -- Post-Launch**

```
Current (Launch):
  Extension ──► Smartrip (Bearer auth)
  Extension ──► Railway (no auth)
  Extension ──► n8n (no auth)

Future (Post-Launch):
  Extension ──► Smartrip ──► Railway
                    │
                    └──────► n8n

  Single auth point. Extension only knows GCR URL.
  Chris's backend URLs removed from extension source.
```

Benefits:
- Full auth coverage for all engines
- Chris's backend URLs not embedded in extension source
- Single point for rate limiting, logging, circuit breaking
- Extension manifest `host_permissions` reduced to one domain

---

## 12. Known Specs & Planned Changes

| Spec | Repo | Status | Impact |
|------|------|--------|--------|
| Per-rep API keys | hackathon | ✅ Deployed (A1) | Auth middleware, key management, dashboard per-rep filtering. 178 tests. |
| First-run API key gate | chat-ripper | ✅ Implemented (A2) | Side panel gate, service worker validation handler, key storage. 5 tests. |
| Remove ALFRED_KEY + Bearer | chat-ripper | ✅ Implemented (A3) | Per-rep Bearer auth on smartrip, closer-bot key to config, 403 auto-detection, onChanged listener. 5 tests. |
| Restrict content scripts | chat-ripper | ✅ Implemented (B1) | 12 domain patterns replace `<all_urls>` in content_scripts and web_accessible_resources. `close.alfredloh.com` added to host_permissions. |
| Analysis panel redesign | chat-ripper | ✅ Implemented (B2) | MATCH label (smartrip only), color-coded confidence, warning row, "Why this works" removed. Analysis helpers extracted to `sidepanel/helpers.js`. Service worker passes raw `match` float + `warning`/`warningFix`. 18 tests. |
<!-- Updated 2026-03-09: B3 specs added -->
| Insert warning toast | chat-ripper | ✅ Implemented (B3) | Non-blocking amber toast on Insert when closer-bot active. `shouldShowInsertWarning` guard + `INSERT_WARNING_MSG` in helpers.js. Auto-dismiss 4s. 8 tests. |
| Extension toggle (closer Bearer auth) | chat-ripper + closer-bot | ✅ Implemented (B3) | Per-rep Bearer auth on closer API (replaces static `CLOSER_API_KEY`). 5-state agent bar, CLOSER_ELIGIBLE rollout check, optimistic toggle, switchId guards, handle403, prefers-reduced-motion. |
<!-- Updated 2026-03-09: B4 implemented -->
| Privacy policy + GitHub Pages | chat-ripper | ✅ Implemented (B4) | Self-contained HTML in `public/`, deployed via GitHub Actions (`upload-pages-artifact` → `deploy-pages`). No build step, no Jekyll. Only `public/` published — private docs not exposed. URL: `https://martell-media.github.io/chat-ripper/privacy-policy.html`. |
| Pinecone v2→v3 fix | hackathon | Active | Fix stale index name in discovery pipeline |
| Per-rep bot attribution | closer-bot | Post-launch | Bot calls attributed to activating rep |

---

## 13. Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Chrome MV3 (not MV2) | Required for new CWS submissions. Service worker lifecycle constraints accepted. | Hackathon |
| SQLite + Litestream (not Postgres) | Solo dev, simplicity, zero-ops. Single-writer constraint accepted (max-instances=1). | Hackathon |
| Per-rep keys (not OAuth/SSO) | 5.5 users, internal tool. OAuth overhead not justified. Keys distributed manually by Alfie. | March 2026 |
| No staging environment | Solo dev, 5.5 users. Risk of production-only testing accepted. | Hackathon |
| Fail-open brain queries | Degraded response (no KB) better than no response. Brain is enhancement, not gate. | Hackathon |
| API scraping over DOM for Revio | Revio API returns structured data. DOM scraping would be fragile and incomplete. | Hackathon |
| Self-hosted VM for closer-bot | Needs persistent WebSocket (Ably). Cloud Run cold starts would drop connections. | Hackathon |
| No monitoring/alerting | Solo dev, 5.5 users. Console logs + dashboard sufficient for launch. | March 2026 |
| Email channel blocking | Zero email training data, different API structure, different voice. Not worth the quality risk. | March 2026 |
| Validation via POST /suggest | Reuses existing endpoint instead of dedicated /validate-key. 401/403 = bad key, any other status = key passed auth middleware. No backend changes needed. | March 2026 |
| Gate routes through service worker | Side panel can't access CONFIG.SMARTRIP_API (loaded via importScripts in service worker only). Validation must route through message passing. | March 2026 |
| ~~Two-key split (smartrip vs closer-bot)~~ | ~~Smartrip uses per-rep dynamic keys from storage. Closer-bot uses a static shared key in config.js.~~ **Superseded by B3**: Single per-rep key authenticates both services. Key scopes (`smartrip`, `closer`) control access. `CLOSER_API_KEY` removed from `config.js`. | March 2026 |
| Auth module extraction (auth.js) | `getStoredApiKey()` and `clearRevokedKey()` extracted for Vitest testability. CJS export via `typeof module` guard — `importScripts` ignores it, Vite recognizes it. | March 2026 |
| `onChanged` listener for key revocation | Decouples gate display from error propagation. Content script drops `key_revoked` flag (limitation of `new Error(msg)` — only captures message string). Listener shows gate immediately regardless of which context cleared the key. | March 2026 |
| Unified per-rep key for closer-bot (B3) | Single key per rep authenticates both smartrip and closer-bot. Scopes control access — no separate closer key. Simplifies extension (one key in storage), enables per-rep audit trail on closer-bot actions. Backend dual auth (`Bearer` for extension, `X-API-Key` for admin) preserves Streamlit access. | March 2026 |
| 5-state agent bar (B3) | Binary active/inactive replaced with hidden/loading/disabled/off/on. Each state maps to a distinct business condition (no auth, checking, not rolled out, eligible-inactive, active). Prevents UI from showing toggle to reps who can't use it. | March 2026 |
| Optimistic toggle (B3) | Agent bar visual state changes immediately on click, reverts on API failure. Chose optimistic over loading-state pattern because toggle latency (~200ms) is fast enough that loading spinner would be more jarring than the rare revert. | March 2026 |
| `switchId` stale callback guards (B3) | Captured ID compared to current `closerContactId` in every async callback. Simpler than debouncing — no race conditions, no timing dependencies, works with any callback depth. | March 2026 |
| `handle403` string-matching (B3) | Extension parses `body.detail` from FastAPI's HTTPException to differentiate revoked key from no-scope. Creates a cross-repo contract — documented with warning comments in both repos. Accepted fragility because the string is controlled by Alfie in both repos. | March 2026 |
| Pure HTML over Jekyll (B4) | Single static privacy policy page doesn't justify a build step, template language, or gem dependencies. Zero-dependency deployment — raw HTML served directly from `public/`. | March 2026 |
| GitHub Actions over branch-based Pages (B4) | Branch-based Pages only supports `/` or `/docs` as source folder — not `/public`. Actions-based deployment via `upload-pages-artifact` gives full control over published directory. Only `public/` is deployed — no risk of exposing `docs/`, `tests/`, or extension source. | March 2026 |
