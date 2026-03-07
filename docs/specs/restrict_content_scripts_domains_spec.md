# Engineering Specification: B1 — Restrict Content Scripts to Known Domains

**Status:** Approved
**Date:** March 7, 2026
**WBS Task:** B1
**Depends on:** Nothing
**Effort:** 15 min

---

## Context

### Current State

`manifest.json` has two overly broad `<all_urls>` patterns:

1. **`content_scripts.matches`** (line 18): The content script loads on every page the rep visits. On non-supported domains, `detectPlatform()` returns `"other"` and the script runs uselessly — consuming memory, injecting CSS, and registering event listeners for no benefit.

2. **`web_accessible_resources.matches`** (line 27): Extension resources (icons, loading.gif) are accessible from any page. This allows external pages to probe for extension resources to fingerprint the installation.

Additionally, **`host_permissions`** (lines 7-12) is missing `close.alfredloh.com`, which the service worker calls for closer-bot API requests (CLOSER_CHECK/ADD/REMOVE). This currently works because the server sends CORS headers, but it's fragile — if the Caddy CORS config changes, the toggle breaks silently.

The content script's `detectPlatform()` (content.js:67-78) supports 8 platforms across 12 domains, but only 6 domains are listed in the PRD.

### Desired Outcome

After this work:
1. Content script only loads on the 8 supported platforms (12 domain patterns)
2. Extension resources only accessible from those same domains
3. `close.alfredloh.com` declared in `host_permissions` for robust closer-bot API calls
4. PRD Appendix B updated to reflect all supported platforms

### Success Criteria

- Content script activates on all 8 supported platforms (Revio, LinkedIn, Gmail, Instagram, Facebook, X, Salesforce, HubSpot)
- Content script does NOT activate on unsupported sites (e.g., google.com, youtube.com)
- Extension resources not accessible from unsupported sites
- Closer-bot toggle works (CLOSER_CHECK/ADD/REMOVE) — no regression
- `<all_urls>` does not appear anywhere in `manifest.json`
- All existing tests pass

---

## Implementation Specification

### Plan — High-Level Tasks

- [ ] **Task 1**: Replace `content_scripts.matches` with specific domain patterns
- [ ] **Task 2**: Replace `web_accessible_resources.matches` with the same patterns
- [ ] **Task 3**: Add `close.alfredloh.com` to `host_permissions`
- [ ] **Task 4**: Update PRD Appendix B with Salesforce and HubSpot

---

### Implementation Order — Step-by-Step

#### Task 1: Restrict `content_scripts.matches`

**File: `manifest.json`** — Replace line 18:

```json
"content_scripts": [
  {
    "matches": [
      "https://*.sbccrm.com/*",
      "https://*.linkedin.com/*",
      "https://mail.google.com/*",
      "https://*.gmail.com/*",
      "https://*.instagram.com/*",
      "https://*.facebook.com/*",
      "https://*.messenger.com/*",
      "https://x.com/*",
      "https://*.twitter.com/*",
      "https://*.salesforce.com/*",
      "https://*.force.com/*",
      "https://*.hubspot.com/*"
    ],
    "js": ["content/content.js"],
    "css": ["content/content.css"],
    "run_at": "document_idle"
  }
]
```

12 patterns covering 8 platforms. Every domain in `detectPlatform()` (content.js:67-78) has a corresponding match pattern:

| `detectPlatform()` check | Match pattern(s) |
|--------------------------|------------------|
| `h.includes("linkedin.com")` | `https://*.linkedin.com/*` |
| `h.includes("mail.google.com")` | `https://mail.google.com/*` |
| `h.includes("gmail.com")` | `https://*.gmail.com/*` |
| `h.includes("salesforce.com")` | `https://*.salesforce.com/*` |
| `h.includes("force.com")` | `https://*.force.com/*` |
| `h.includes("hubspot.com")` | `https://*.hubspot.com/*` |
| `h.includes("instagram.com")` | `https://*.instagram.com/*` |
| `h.includes("facebook.com")` | `https://*.facebook.com/*` |
| `h.includes("messenger.com")` | `https://*.messenger.com/*` |
| `h.includes("twitter.com")` | `https://*.twitter.com/*` |
| `h.includes("x.com")` | `https://x.com/*` |
| `h.includes("sbccrm.com")` | `https://*.sbccrm.com/*` (covers app, www, dev) |

HTTPS only — all platforms use HTTPS. No `http://` patterns needed.

---

#### Task 2: Restrict `web_accessible_resources.matches`

**File: `manifest.json`** — Replace lines 24-29 with the same domain list:

```json
"web_accessible_resources": [
  {
    "resources": ["icons/*", "loading.gif"],
    "matches": [
      "https://*.sbccrm.com/*",
      "https://*.linkedin.com/*",
      "https://mail.google.com/*",
      "https://*.gmail.com/*",
      "https://*.instagram.com/*",
      "https://*.facebook.com/*",
      "https://*.messenger.com/*",
      "https://x.com/*",
      "https://*.twitter.com/*",
      "https://*.salesforce.com/*",
      "https://*.force.com/*",
      "https://*.hubspot.com/*"
    ]
  }
]
```

Same rationale: extension icons/loading.gif are only used by the content script's injected UI. No content script = no injected UI = no need for resource access.

---

#### Task 3: Add `close.alfredloh.com` to `host_permissions`

**File: `manifest.json`** — Add to `host_permissions` array:

```json
"host_permissions": [
  "https://rigchris.app.n8n.cloud/*",
  "https://ai-sales-copilot-458007064300.us-east1.run.app/*",
  "https://backend-production-06c5.up.railway.app/*",
  "https://*.sbccrm.com/*",
  "https://close.alfredloh.com/*"
]
```

This makes the closer-bot API calls go through the proper MV3 permission model instead of relying on server CORS headers.

---

#### Task 4: Update PRD Appendix B

**File: `docs/core/prd.md`** — Add Salesforce and HubSpot rows to the Platform Support Matrix, and update Section 10.1 content script domains list.

---

### Error Handling

No new error handling. This is a declarative manifest change — Chrome enforces the patterns automatically.

---

## Testing Requirements

### Critical Test Cases

No automated tests — manifest.json is declarative. Chrome enforces match patterns at content script injection time.

### Manual Verification

- [ ] Extension activates on Revio (`app.sbccrm.com`)
- [ ] Extension activates on LinkedIn (`linkedin.com`)
- [ ] Extension activates on Gmail (`mail.google.com`)
- [ ] Extension activates on Instagram (`instagram.com`)
- [ ] Extension activates on Facebook (`facebook.com`)
- [ ] Extension activates on X (`x.com`)
- [ ] Extension does NOT activate on unsupported sites (e.g., `google.com`, `youtube.com`)
- [ ] Closer-bot toggle still works (CLOSER_CHECK/ADD/REMOVE)
- [ ] All existing tests pass (`npm test`)
- [ ] `grep -c "all_urls" manifest.json` returns 0

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Rep visits unsupported site | Content script doesn't load. No ChatRipper functionality. Expected behavior. |
| Rep visits `twitter.com` (redirects to `x.com`) | Both domains in matches — content script loads regardless of redirect timing. |
| Rep visits `messenger.com` directly | Covered by `*.messenger.com/*` pattern. `detectPlatform()` returns `"facebook"`. |
| Closer-bot server removes CORS headers | No impact — `host_permissions` now grants access independently of CORS. |

---

## Dependencies & Constraints

### External Dependencies

None. Manifest changes are self-contained.

### Constraints

- Chrome MV3 match patterns use a specific syntax (`*` for subdomain wildcard, not regex).
- `host_permissions` changes may trigger a CWS re-review (adding a new domain).
- Match patterns are checked at content script injection time, not at runtime. No performance impact.

---

## Files Modified Summary

| File | Change |
|------|--------|
| `manifest.json` | Replace `<all_urls>` in `content_scripts.matches` and `web_accessible_resources.matches` with 12 domain patterns. Add `close.alfredloh.com` to `host_permissions`. |
| `docs/core/prd.md` | Add Salesforce and HubSpot to Appendix B. Update Section 10.1 domain list. |

---

## Open Questions

None — all clarified during spec consultation.
