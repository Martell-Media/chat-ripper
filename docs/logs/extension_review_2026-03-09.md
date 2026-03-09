# Full Extension Review — 2026-03-09

Review of the entire ChatRipper AI Chrome extension prior to CWS submission.

**Verdict**: DENY — 7 actionable issues to address before submission.

**Status**: 3 fixed (#1, #2, #6), 1 false positive (#7), 3 deferred (#3, #4, #5). Low items resolved.

## Critical (2)

### 1. ~~`handle403` scoped inside listener callback~~ — FIXED

- **File**: `service-worker.js:302`
- **Issue**: Function declared inside the `onMessage` listener callback. If called from another handler, it's undefined.
- **Fix**: Moved `handle403` to module scope (commit 7e82aec).

### 2. ~~No `.catch()` on `getStoredApiKey()` promise chains~~ — FIXED

- **File**: `service-worker.js:311-414`
- **Issue**: Unhandled promise rejections crash the service worker silently.
- **Fix**: Added `.catch()` to CLOSER_CHECK, CLOSER_ADD, CLOSER_REMOVE, and CLOSER_ELIGIBLE chains (commit 7e82aec).

## Important (4)

### 3. Raw innerHTML sent to external scoring webhook

- **File**: `content.js:391`
- **Issue**: ~10KB of raw innerHTML sent to external webhook. Potential data leak of DOM artifacts (hidden elements, internal markup).
- **Fix**: Sanitize or send text-only content.

### 4. `document.execCommand('insertText')` deprecated

- **File**: `content.js:961-965`
- **Issue**: Works today but Chromium may remove it. The innerHTML fallback breaks React SPA undo history.
- **Fix**: Investigate `InputEvent`-based insertion or accept the limitation with a comment.

### 5. Revio 500ms polling interval never cleared

- **File**: `content.js:1452`
- **Issue**: Keeps running even after navigating away from Revio pages. Wastes CPU.
- **Fix**: Store the interval ID and clear it on page navigation or cleanup.

### 6. ~~`JSON.parse(bodyText)` without try/catch in `doCoachFetch`~~ — FIXED

- **File**: `service-worker.js:1390`
- **Issue**: Malformed response from backend crashes the handler.
- **Fix**: Wrapped `JSON.parse` in try/catch in both `doCoachFetch` and `doScoreFetch` (commit 7e82aec).

## Medium (1)

### 7. ~~`activeTab` insufficient for programmatic `chrome.tabs.query()`~~ — FALSE POSITIVE

- **File**: `manifest.json:6`
- **Issue**: Extension calls `chrome.tabs.query()` which requires the `tabs` permission. `activeTab` only grants temporary access on user gesture.
- **Resolution**: `chrome.tabs.query()` returns `tab.id` without the `tabs` permission. The `tabs` permission only unlocks sensitive properties (`url`, `title`, `favIconUrl`), none of which this extension reads. All 7 call sites only use `tab.id`. Adding `tabs` would increase CWS install warnings for zero benefit. No change needed.

## Low (not blocking)

- ~~**`lastStreamRafId` dead code**~~ — FIXED. Removed unused variable (commit 1a3120a).
- ~~**`*.gmail.com` dead host pattern**~~ — FIXED. Removed from both `content_scripts` and `web_accessible_resources` (commit 1a3120a).
- **No `default_popup` in manifest** — WONTFIX. Intentional — adding `default_popup` would prevent `chrome.action.onClicked` from firing, which opens the side panel on icon click.
