# Engineering Specification: C1 — CWS Private Submission

## Context

### Current State

- All 9 pre-submission tasks complete (A1-A3, B1-B4)
- Extension packaged via `scripts/package.sh` → `dist/chat-ripper-v1.0.0.zip`
- Privacy policy live at `https://martell-media.github.io/chat-ripper/privacy-policy.html`
- No CWS developer account exists
- No screenshots exist for CWS listing
- 36 unit tests pass, Biome lint clean

### Desired Outcome

ChatRipper AI published as a Private extension on the Chrome Web Store, restricted to `@danmartell.com` Google Workspace users. Automated Playwright screenshot script for repeatable listing assets.

### Success Criteria

- Extension submitted and accepted for review on CWS
- Visibility set to Private (`@danmartell.com` only)
- Privacy policy URL linked in listing
- Permission justifications provided for all 5 permissions
- Known-good .zip archived in `dist/`
- Screenshot script produces repeatable CWS-ready images

## Implementation Specification

### Data Models & Types

N/A — this is a packaging and submission task with one Playwright script.

### Plan - High-Level Tasks

- [ ] *Task 1*: Register CWS developer account (`alfred@danmartell.com`)
- [ ] *Task 2*: Create Playwright screenshot script (`scripts/screenshots.mjs`)
- [ ] *Task 3*: Package extension (`scripts/package.sh`)
- [ ] *Task 4*: Configure CWS listing (description, category, screenshots, privacy URL, permissions)
- [ ] *Task 5*: Submit for review, archive known-good .zip

### Implementation Order - Step-by-Step Subtasks

#### 1. Register CWS Developer Account

Manual steps — cannot be automated:

1. Go to `https://chrome.google.com/webstore/devconsole`
2. Sign in with `alfred@danmartell.com`
3. Accept Chrome Web Store Developer Agreement
4. Pay $5 one-time registration fee
5. Verify the account is associated with the `danmartell.com` Google Workspace domain (required for Private visibility)

#### 2. Create Playwright Screenshot Script

**Prerequisites** — install Playwright as a dev dependency:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Create `scripts/screenshots.mjs` — generates CWS-ready screenshots from mocked side panel content.

**Approach**: Create a standalone mock HTML page that loads only `sidepanel/sidepanel.css` (via `<link>`) and hardcodes mock DOM content matching the real side panel structure. No extension JS is loaded — avoids Chrome API errors that would occur if `sidepanel.js` ran outside the extension context.

The mock page:
1. Loads `sidepanel.css` for real styling
2. Contains the same HTML structure as `sidepanel.html` (`.sp` wrapper, `.sp-header`, `.sp-agent-bar`, `.sp-controls`, `.sp-content`, `.sp-gate`)
3. Populates elements with sample data (not dynamic — just static HTML)
4. Playwright opens this page, sets viewport, and takes screenshots

**Screenshot dimensions**: Playwright viewport set to 400x800 (typical side panel width and height). Playwright's `screenshot()` captures at viewport size. The resulting image is then padded to 1280x800 with a dark background using Playwright's `page.setViewportSize(1280, 800)` + CSS centering on the `.sp` container. Alternatively, capture at 400x800 and use an image library or CSS wrapper to center-pad to 1280x800.

**Chosen approach**: Set viewport to 1280x800. Wrap the `.sp` container in a full-viewport dark background (`#0f172a`) with the side panel centered horizontally. This produces a CWS-ready 1280x800 screenshot in one step — no post-processing.

```
┌─────────── 1280 x 800 ───────────┐
│                                    │
│     ┌──── 400px ────┐             │
│     │  Side Panel    │             │
│     │  (real CSS)    │  #0f172a    │
│     │  (mock data)   │  background │
│     └────────────────┘             │
│                                    │
└────────────────────────────────────┘
```

**Screenshots to generate** (1280x800, PNG):

| Screenshot | Content | What it shows |
|-----------|---------|---------------|
| `1-reply.png` | Side panel with a sample reply, analysis panel (STAGE, MATCH, READ) | Primary workflow |
| `2-agent-bar.png` | Side panel with agent bar active, bot status message | Closer-bot toggle |
| `3-setup-gate.png` | First-run API key gate | Onboarding |

**Mock data for screenshot 1 (reply view)**:
- Agent bar: hidden (default reply view — no HUD chips)
- Status: "Ready"
- Reply content area: sample reply HTML with analysis panel
  - STAGE: "Objection Handling"
  - MATCH: "78%" (green, ≥60%)
  - READ: Sample reasoning text
  - Reply text: 2-3 sentence sample sales reply
- Controls bar: smartrip engine selected, Auto mode

**Mock data for screenshot 2 (agent bar)**:
- HUD: platform = "Revio", prospect = "Marcus Chen", msgs = 24, rips = 3
- Agent bar: visible, active state (pulse rings, green dot, "Bot active for Marcus Chen...")
- Reply content: same as screenshot 1 (background context)

**Mock data for screenshot 3 (setup gate)**:
- Gate overlay visible (`display: block`)
- Input field empty, placeholder visible
- No error state

**Implementation notes**:
- Use `playwright` core (not `@playwright/test` — this is a script, not a test)
- The mock HTML is generated inline by the script (template literal), written to a temp file, opened via `file://` URL
- Icons referenced in HTML (`../icons/logo.png`, `../icons/text.png`) must resolve — place the temp HTML in the `sidepanel/` directory or adjust paths
- Output to `dist/screenshots/`
- Script: `node scripts/screenshots.mjs`

#### 3. Package Extension

Run existing script:

```bash
bash scripts/package.sh
```

Produces `dist/chat-ripper-v1.0.0.zip` containing:
- `manifest.json`
- `config.js`
- `background/` (service-worker.js, auth.js)
- `content/` (content.js, content.css)
- `sidepanel/` (sidepanel.html, sidepanel.js, sidepanel.css, helpers.js, marked.min.js, purify.min.js)
- `popup/` (popup.html, popup.js, popup.css)
- `icons/` (icon16.png, icon48.png, icon128.png, logo.png, text.png)
- `loading.gif`

**Excluded** (by omission from zip command): `docs/`, `tests/`, `scripts/`, `dev/`, `public/`, `node_modules/`, `.git/`, `.github/`

**Verify package contents before upload**:
```bash
unzip -l dist/chat-ripper-v1.0.0.zip | head -30
```

Confirm: no `docs/`, `tests/`, `node_modules/`, `.env`, or other non-extension files.

#### 4. Configure CWS Listing

All fields entered in the CWS Developer Dashboard (`https://chrome.google.com/webstore/devconsole`).

**Listing details:**

| Field | Value |
|-------|-------|
| Name | ChatRipper AI |
| Summary | AI-powered sales coaching right in your browser. Highlight any prospect message and get instant reply suggestions. |
| Description | AI-powered sales coaching for Martell Media's revenue team. Get instant reply suggestions, conversation scoring, and coaching across supported messaging platforms. Internal tool — not for public use. |
| Category | Productivity |
| Language | English |

**Visibility:**

| Field | Value |
|-------|-------|
| Visibility | Private |
| Domain | `danmartell.com` (auto-detected from publisher account's Google Workspace) |

**Privacy:**

| Field | Value |
|-------|-------|
| Privacy policy URL | `https://martell-media.github.io/chat-ripper/privacy-policy.html` |
| Single purpose description | Provides AI-powered reply suggestions for sales conversations across supported messaging platforms. |

**Permission justifications** (copy-paste into CWS form):

| Permission | Justification |
|-----------|---------------|
| `storage` | Stores user preferences (engine selection, API key) locally in the browser. No data is sent externally from storage. |
| `activeTab` | Reads the current page to extract conversation context for generating reply suggestions. Only activates when the user opens the side panel. |
| `contextMenus` | Adds a right-click menu option to generate a reply from selected text. |
| `sidePanel` | Displays the reply suggestion interface in Chrome's side panel. This is the primary UI surface for the extension. |
| `webNavigation` | Detects page navigation events to refresh conversation context when the user switches between contacts. |

**Host permission justifications:**

| Host Permission | Justification |
|----------------|---------------|
| `https://*.sbccrm.com/*` | Reads conversation data from the CRM platform (Revio) via its internal API. |
| `https://ai-sales-copilot-*.us-east1.run.app/*` | Sends conversation context to our AI backend to generate reply suggestions. |
| `https://backend-production-*.up.railway.app/*` | Sends conversation context to alternative AI reply engines. |
| `https://rigchris.app.n8n.cloud/*` | Connects to coaching and scoring AI services. |
| `https://close.alfredloh.com/*` | Manages the automated reply bot whitelist for contacts. |

**Screenshots**: Upload from `dist/screenshots/` (generated in Task 2)

**Icons**: CWS uses the icons from `manifest.json` (16, 48, 128). No separate upload needed — they're in the .zip.

#### 5. Submit and Archive

1. Upload `dist/chat-ripper-v1.0.0.zip` in CWS Developer Dashboard
2. Fill in all listing fields from Task 4
3. Upload screenshots from `dist/screenshots/`
4. Click "Submit for Review"
5. Archive: copy `dist/chat-ripper-v1.0.0.zip` to `dist/archive/chat-ripper-v1.0.0-submitted.zip`

```bash
mkdir -p dist/archive
cp dist/chat-ripper-v1.0.0.zip dist/archive/chat-ripper-v1.0.0-submitted.zip
```

### Error Handling

- **CWS developer account creation fails**: Verify alfred@danmartell.com is a Google Workspace account (not personal Gmail). Workspace admin may need to allow CWS developer registration.
- **Private visibility not available**: Requires the publisher account to be a member of a Google Workspace domain. Verify domain association in CWS settings.
- **Package too large**: CWS limit is ~150MB. Current extension is well under (mostly JS + CSS + a few images). If `loading.gif` is large (200KB), consider replacing with CSS animation post-launch.
- **CWS rejects for permission justification**: Review the justification text — CWS reviewers want to understand *why* each permission is needed, not just *what* it does. The justifications above are written for reviewers.
- **CWS rejects for `<all_urls>` or broad host permissions**: Already mitigated — content scripts restricted to 12 specific domains (B1), host permissions scoped to 5 specific backends.
- **Screenshot script fails**: Verify Playwright and Chromium are installed (`npm install --save-dev playwright && npx playwright install chromium`). If icon paths don't resolve, adjust the temp HTML file location or use inline base64 images.

## Testing Requirements

### Critical Test Cases

No automated tests — this is a packaging and submission task. Manual verification:

- [ ] `dist/chat-ripper-v1.0.0.zip` contains only extension files (no docs, tests, node_modules)
- [ ] `manifest.json` in zip has version `1.0.0`
- [ ] Screenshots exist in `dist/screenshots/` and are 1280x800 PNG
- [ ] Screenshots show realistic side panel content (not broken layout)
- [ ] All 36 existing tests still pass (`npm test`)
- [ ] Extension loads from zip in Chrome (chrome://extensions → Load unpacked from extracted zip)
- [ ] Privacy policy URL in CWS listing resolves to live page

### Edge Cases to Consider

- CWS review takes 1-3 business days — submit early in the week
- CWS reviewers may test the extension on non-matching domains — it should gracefully do nothing (content scripts won't inject)
- Private visibility means only @danmartell.com Workspace users can see the listing — share the install link directly with the team
- If the extension is rejected, CWS provides specific rejection reasons — fix and resubmit (no penalty for resubmission)
- `popup/` directory is included in the package but has no `default_popup` in manifest — popup opens via `action.default_icon` click handler in service worker. This is fine for CWS.

## Dependencies & Constraints

### External Dependencies

- Chrome Web Store Developer Dashboard (requires Google account + $5 fee)
- Playwright (for screenshot automation — `npx playwright install chromium`)
- Google Workspace domain `danmartell.com` (for Private visibility)

### Constraints & Assumptions

- Publisher account: `alfred@danmartell.com` — must be a Google Workspace account
- Google Workspace admin has not blocked CWS developer registration for the domain
- CWS review typically takes 1-3 business days (can be longer for first submission)
- Private visibility requires domain verification — usually automatic for Workspace accounts
- No CWS API automation — all listing configuration is manual via the Developer Dashboard
- `scripts/package.sh` already excludes non-extension files — verified against directory listing

## Verification Checklist

- [ ] CWS developer account registered (`alfred@danmartell.com`)
- [ ] `scripts/screenshots.mjs` created and produces 3 screenshots
- [ ] `dist/chat-ripper-v1.0.0.zip` packaged and verified (no non-extension files)
- [ ] `dist/archive/chat-ripper-v1.0.0-submitted.zip` archived
- [ ] CWS listing: name, description, category, visibility (Private) configured
- [ ] Privacy policy URL linked: `https://martell-media.github.io/chat-ripper/privacy-policy.html`
- [ ] All 5 permission justifications provided
- [ ] All 5 host permission justifications provided
- [ ] Screenshots uploaded (3x 1280x800 PNG)
- [ ] Submitted for review
- [ ] All 36 existing tests still pass (`npm test`)

## Open Questions

- [x] CWS developer account: Needs creation — `alfred@danmartell.com` ($5 fee)
- [x] Visibility: Private (only @danmartell.com Workspace users)
- [x] Screenshots: Automated via Playwright with mocked side panel content
- [x] Description: Short manifest description + internal use note
- [x] Category: Productivity
- [x] Permission justifications: Copy-paste text drafted above
- [x] Publisher account: `alfred@danmartell.com`
