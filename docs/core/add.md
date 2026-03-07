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
│  │  - Text insert   │                  │ - Auth header │ │
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
│                                        │ - Reply UI    │ │
│                                        │ - Chat/Score  │ │
│                                        │ - Agent bar   │ │
│                                        │ - State mgmt  │ │
│                                        └──────────────┘ │
└──────────────────────────────────────────────────────────┘
```

| Context | File | LOC | Responsibilities |
|---------|------|-----|------------------|
| Content Script | `content/content.js` | ~1500 | DOM access, Revio API scraping, platform detection, text selection, reply insertion |
| Service Worker | `background/service-worker.js` | ~1100 | Message broker, API gateway to all backends, auth header injection, auto-fallback |
| Side Panel | `sidepanel/sidepanel.js` | ~1500 | Reply display, chat/score UI, agent bar, streaming display, state management |

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
| `SIDE_PANEL_READY` | sidepanel -> service worker | Panel loaded, ready for data |
| `REVIO_CONTACT_CHANGED` | service worker -> sidepanel | Contact switch detected (via `webNavigation.onHistoryStateUpdated`) |
| `CLOSER_CHECK` | sidepanel -> service worker | Check whitelist status |
| `CLOSER_ADD` | sidepanel -> service worker | Add contact to whitelist |
| `CLOSER_REMOVE` | sidepanel -> service worker | Remove from whitelist |
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
Sidepanel: reset agent bar, re-scrape, re-check whitelist
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
  - X-Copilot-Key header (shared key, legacy)
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

The extension manages the closer-bot whitelist but does not control reply behavior:

| Extension Action | API Call | Effect |
|-----------------|----------|--------|
| `CLOSER_CHECK` | `GET /api/allowed-inboxes/{contactId}` | Returns `{whitelisted: bool}` |
| `CLOSER_ADD` | `POST /api/allowed-inboxes/{contactId}` | Adds contact to whitelist |
| `CLOSER_REMOVE` | `DELETE /api/allowed-inboxes/{contactId}` | Removes from whitelist |

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
┌──────────────┐    ┌──────────────┐
│   Extension   │    │   Smartrip    │
│               │    │              │
│ Bearer {key} ─┼───►│ Middleware   │
│               │    │ validates    │
│               │    └──────────────┘
│               │
│               │    ┌──────────────┐
│  Direct URLs ─┼───►│ Chris's      │
│  (no auth)    │    │ Backends     │
│               │    │ (known risk) │
└──────────────┘    └──────────────┘
```

| Backend | Auth Mechanism | Key Format |
|---------|---------------|------------|
| Smartrip | `Authorization: Bearer {key}` | `cr_{rep_id}_{24_hex_chars}` |
| Smartrip (legacy) | `X-Copilot-Key` header | Shared HMAC key |
| Deeprip/Quickrip | None | N/A |
| Coach/Score | None | N/A |
| Closer-bot API | None | N/A |
| Revio API | Cookie extraction (`token`, `XSRF-TOKEN`) | Browser session cookies |

**Launch state:** Per-rep keys on smartrip only. Chris's backends have no auth (security through obscurity -- URLs are not public but are embedded in extension source).

**Post-launch:** Proxy all engines through smartrip (PRD Section 8.3). Extension only talks to GCR, which forwards authenticated requests to Railway/n8n. Single point of auth enforcement.

### 6.2 Extension Distribution

- Chrome Web Store, unlisted listing
- Domain-restricted to `@danmartell.com` Google Workspace
- Content scripts restricted to known domains (B1 launch task)
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
| Extension | CWS upload (.zip) | None -- manual upload |
| Smartrip | `make deploy` → `gcloud run deploy` | None |
| Closer-bot | `docker-compose up` on VM | None |
| Deeprip/Quickrip | Railway auto-deploy (Chris) | Unknown |
| Coach/Score | n8n workflow editor (Chris) | N/A |

### 7.3 Infrastructure Constraints

- **Cloud Run max-instances=1**: Required by Litestream single-writer pattern. SQLite WAL → GCS replication (1-min sync interval). On redeploy: Litestream restores DB from GCS before app starts.
- **No staging environment**: All testing against production.
- **No CI/CD**: Manual deployment everywhere.
- **CWS update latency**: Review takes 1-3 days. No one-click rollback -- fix forward or unpublish.

---

## 8. Error Handling & Resilience

### 8.1 Extension Error Handling

| Scenario | Behavior |
|----------|----------|
| Deeprip/quickrip error (any type) | Auto-fallback to smartrip |
| Auto-fallback succeeds | Response tagged with `fallback: true` badge |
| Smartrip error (as primary or fallback) | Error message + retry button |
| Invalid/revoked API key (403) | "Invalid key -- contact Alfie" with reset option |
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
| Per-rep API keys | hackathon | Launch (A1) | Auth middleware, key management, dashboard per-rep filtering |
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
