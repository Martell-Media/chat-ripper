# Full Extension Review — 2026-03-09

Review of the entire ChatRipper AI Chrome extension prior to CWS submission.

**Verdict**: DENY — 7 actionable issues to address before submission.

## Critical (2)

### 1. `handle403` scoped inside listener callback

- **File**: `service-worker.js:302`
- **Issue**: Function declared inside the `onMessage` listener callback. If called from another handler, it's undefined.
- **Fix**: Move `handle403` to module scope.

### 2. No `.catch()` on `getStoredApiKey()` promise chains

- **File**: `service-worker.js:311-414`
- **Issue**: Unhandled promise rejections crash the service worker silently.
- **Fix**: Add `.catch()` to all `getStoredApiKey()` call chains.

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

### 6. `JSON.parse(bodyText)` without try/catch in `doCoachFetch`

- **File**: `service-worker.js:1390`
- **Issue**: Malformed response from backend crashes the handler.
- **Fix**: Wrap in try/catch, return user-friendly error.

## Medium (1)

### 7. ~~`activeTab` insufficient for programmatic `chrome.tabs.query()`~~ — FALSE POSITIVE

- **File**: `manifest.json:6`
- **Issue**: Extension calls `chrome.tabs.query()` which requires the `tabs` permission. `activeTab` only grants temporary access on user gesture.
- **Resolution**: `chrome.tabs.query()` returns `tab.id` without the `tabs` permission. The `tabs` permission only unlocks sensitive properties (`url`, `title`, `favIconUrl`), none of which this extension reads. All 7 call sites only use `tab.id`. Adding `tabs` would increase CWS install warnings for zero benefit. No change needed.

## Low (not blocking)

- **`lastStreamRafId` dead code** — `sidepanel.js:920`. Unused variable. Cleanup.
- **`*.gmail.com` dead host pattern** — `manifest.json:23`. Gmail is served from `mail.google.com`, not `*.gmail.com`.
- **No `default_popup` in manifest** — `popup/` directory exists but no `default_popup` key. Harmless — popup opens via action click handler in service worker.
