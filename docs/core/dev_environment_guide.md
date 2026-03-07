# Development Environment Guide: ChatRipper AI

**Version:** 1.0
**Date:** March 7, 2026
**Status:** Approved
**PRD:** `docs/core/prd.md` (Approved)
**ADD:** `docs/core/add.md` (Approved)

---

## 1. Cleanup Checklist

This repo was scaffolded from a Python backend template. The following files are unused by the Chrome extension and should be removed.

### 1.1 Remove Python Scaffolding

```bash
# Python application scaffolding
rm -rf app/
rm -rf docker/
rm -rf playground/

# Python tooling
rm pyproject.toml
rm uv.lock
rm .python-version

# Python test structure (will be replaced with Vitest)
rm -rf tests/unit/
rm -rf tests/integration/
rm -rf tests/evals/
rm tests/CLAUDE.md
```

### 1.2 Remove Python-Specific Docs

```bash
rm docs/GETTING_STARTED.md
rm docs/guides/TROUBLESHOOTING.md
rm docs/guides/SECURITY_GUIDE.md
rm docs/guides/multi_project_management.md
```

### 1.3 Update docs/examples/README.md

Remove template language ("using this template", "on top of this template"). Reframe as standalone reference architecture.

### 1.4 Update docs/guides/README.md

Remove references to deleted guides (TROUBLESHOOTING.md, SECURITY_GUIDE.md, multi_project_management.md). Remove "this template" language.

---

## 2. Node.js Setup

### 2.1 Node Version

Create `.nvmrc` in project root:

```
22
```

Install and activate:

```bash
nvm install
nvm use
```

### 2.2 Package Initialization

Create `package.json`:

```json
{
  "name": "chat-ripper",
  "version": "1.0.0",
  "private": true,
  "description": "ChatRipper AI - Chrome extension for AI-powered sales reply suggestions",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "package": "scripts/package.sh"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "jsdom": "^25.0.0",
    "vitest": "^3.0.0"
  }
}
```

Install:

```bash
npm install
```

---

## 3. Code Quality: Biome

Single tool for linting and formatting (replaces ESLint + Prettier).

### 3.1 Configuration

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": false
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "files": {
    "ignore": [
      "node_modules",
      "**/*.min.js"
    ]
  }
}
```

### 3.2 Usage

```bash
npm run lint          # Check for lint errors
npm run lint:fix      # Auto-fix lint errors
npm run format        # Format all files
```

---

## 4. Testing: Vitest

### 4.1 Configuration

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/mocks/chrome.js'],
    include: ['tests/**/*.test.js'],
  },
});
```

### 4.2 Chrome API Mocks

Create `tests/mocks/chrome.js`:

```js
const storage = {};

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, cb) => {
        if (typeof keys === 'string') keys = [keys];
        const result = {};
        for (const k of keys) {
          if (k in storage) result[k] = storage[k];
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      }),
      set: vi.fn((items, cb) => {
        Object.assign(storage, items);
        if (cb) cb();
        return Promise.resolve();
      }),
    },
    session: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(() => ({
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      postMessage: vi.fn(),
    })),
    lastError: null,
  },
};

// Reset storage between tests
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
  vi.clearAllMocks();
});
```

### 4.3 Test Architecture

Extract pure logic into importable modules. The monolithic files (`content.js`, `sidepanel.js`, `service-worker.js`) stay as-is — you pull testable functions into separate files incrementally as you implement WBS tasks.

```
Extension loads:                    Tests import:

content/content.js                  content/utils.js
  └── imports content/utils.js        └── scrapeRevioAsync helpers
                                       └── channel detection
                                       └── message filtering

sidepanel/sidepanel.js              sidepanel/helpers.js
  └── imports sidepanel/helpers.js    └── MATCH color logic
                                       └── gate display logic
                                       └── toast logic

background/service-worker.js        background/helpers.js
  └── importScripts('helpers.js')     └── header construction
                                       └── key validation logic
```

**Dual-format helpers**: Helper files must work both as ES modules (for Vitest `import`) and as classic scripts (for extension `<script>` tags / `importScripts()`). Use the UMD-lite pattern:

**Example extracted module** (`sidepanel/helpers.js`):

```js
// UMD-lite: works as ES module (Vitest) and classic script (extension)
(function (exports) {
  function getMatchColor(score) {
    if (score >= 60) return '#3fb950';  // green
    if (score >= 40) return '#d29922';  // yellow
    return '#f85149';                    // red
  }

  function shouldShowGate(apiKey) {
    return !apiKey || apiKey.trim() === '';
  }

  exports.getMatchColor = getMatchColor;
  exports.shouldShowGate = shouldShowGate;
})(typeof module !== 'undefined' ? module.exports : (globalThis.Helpers = {}));
```

When loaded as a classic script (`<script src="helpers.js">`), functions are available via `Helpers.getMatchColor()`. When imported by Vitest (`import { getMatchColor } from '...'`), they resolve via `module.exports`.

For service worker helpers loaded via `importScripts()`, the global assignment pattern also works — `importScripts('helpers.js')` executes in the service worker's global scope, making `Helpers.*` available.

**Example test** (`tests/unit/analysis-panel.test.js`):

```js
import { getMatchColor } from '../../sidepanel/helpers.js';

describe('MATCH color coding', () => {
  test('green for 60%+', () => {
    expect(getMatchColor(75)).toBe('#3fb950');
    expect(getMatchColor(60)).toBe('#3fb950');
  });

  test('yellow for 40-59%', () => {
    expect(getMatchColor(50)).toBe('#d29922');
    expect(getMatchColor(40)).toBe('#d29922');
  });

  test('red for <40%', () => {
    expect(getMatchColor(30)).toBe('#f85149');
    expect(getMatchColor(0)).toBe('#f85149');
  });
});
```

### 4.4 Test Directory Structure

```
tests/
  mocks/
    chrome.js            # Chrome API stubs
  unit/
    analysis-panel.test.js   # B2 — MATCH label, colors, warning row
    first-run-gate.test.js   # A2 — gate display, key storage
    bearer-header.test.js    # A3 — header format, missing key
    warning-toast.test.js    # B3 — toast display, auto-dismiss
```

### 4.5 Usage

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on file change)
```

---

## 5. Configuration Management

### 5.1 Backend URL Config

Create `config.js` in project root:

```js
const CONFIG = {
  SMARTRIP_API: 'https://ai-sales-copilot-458007064300.us-east1.run.app',
  CLOSER_API: 'https://close.alfredloh.com',
  WEBHOOKS: {
    thinking: 'https://backend-production-06c5.up.railway.app/api/reply/thinking',
    fast: 'https://backend-production-06c5.up.railway.app/api/reply/fast',
  },
  COACH_WEBHOOK: 'https://rigchris.app.n8n.cloud/webhook/be253eb0-537a-4e3f-bfe7-b49e9d8dd17a/chat',
  SCORE_WEBHOOK: 'https://rigchris.app.n8n.cloud/webhook/2cca4c7d-1531-40b6-a818-b0b2495ec415/chat',
};
```

### 5.2 Loading Config

**Service worker** (`background/service-worker.js`):
```js
importScripts('../config.js');
// CONFIG is now available as a global
```

Remove the hardcoded constants from service-worker.js (lines 4-12) and reference `CONFIG.*` instead.

### 5.3 What Stays Out of Config

- **API keys**: Stored in `chrome.storage.local` (per-rep, set via first-run gate)
- **Revio API base**: Content script calls same-origin Revio endpoints — no config needed
- **Session ID**: Generated at runtime in service worker

---

## 6. CWS Packaging

### 6.1 Package Script

Create `scripts/package.sh`:

```bash
#!/bin/bash
set -e

VERSION=$(node -p "require('./manifest.json').version")
OUTFILE="dist/chat-ripper-v${VERSION}.zip"

mkdir -p dist

zip -r "$OUTFILE" \
  manifest.json \
  config.js \
  background/ \
  content/ \
  sidepanel/ \
  popup/ \
  icons/ \
  loading.gif \
  -x "**/.DS_Store"

echo "Packaged: $OUTFILE"
```

```bash
chmod +x scripts/package.sh
```

### 6.2 Usage

```bash
npm run package       # Creates dist/chat-ripper-v1.0.0.zip
```

The zip includes only extension runtime files. Excludes: `node_modules/`, `tests/`, `docs/`, `.git/`, `scripts/`, dev tooling.

### 6.3 Archive Convention

Keep known-good zips in `dist/` for rollback. The directory is gitignored.

---

## 7. Extension Hot-Reload (Dev Only)

### 7.1 Hot-Reload Script

Create `dev/hot-reload.js`:

```js
// Dev-only: auto-reload extension on file changes
// Include via importScripts() in service-worker.js during development
// Remove before CWS submission

const WATCH_INTERVAL = 1000;

// Hash the content of key files to detect changes
async function hashFile(url) {
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    const text = await resp.text();
    // Simple hash: length + first/last chars + checksum
    let sum = 0;
    for (let i = 0; i < text.length; i += 100) sum += text.charCodeAt(i);
    return `${text.length}:${sum}`;
  } catch (e) {
    return null;
  }
}

const WATCHED_FILES = [
  'manifest.json',
  'config.js',
  'background/service-worker.js',
  'content/content.js',
  'sidepanel/sidepanel.js',
  'popup/popup.js',
];

let prevHashes = null;

async function checkForChanges() {
  try {
    const hashes = {};
    for (const file of WATCHED_FILES) {
      hashes[file] = await hashFile(chrome.runtime.getURL(file));
    }
    const current = JSON.stringify(hashes);
    if (prevHashes !== null && prevHashes !== current) {
      console.log('[Hot Reload] Change detected, reloading...');
      chrome.runtime.reload();
    }
    prevHashes = current;
  } catch (e) {
    // Extension context invalidated, ignore
  }
}

setInterval(checkForChanges, WATCH_INTERVAL);
console.log('[Hot Reload] Watching for changes...');
```

**Limitation**: Only watches files in `WATCHED_FILES`. Add new files to the array as needed. CSS changes and helper files require a manual reload or adding them to the list.

### 7.2 Usage

Add to service-worker.js during development:

```js
// DEV ONLY — remove before packaging
importScripts('../dev/hot-reload.js');
```

The `scripts/package.sh` excludes the `dev/` directory, so it never ships to CWS.

---

## 8. CI/CD: GitHub Actions

### 8.1 Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test
```

**Important**: `npm ci` requires `package-lock.json` committed to the repo. After initial `npm install`, commit the generated `package-lock.json`.

Runs on every push to master. ~30 seconds. Catches lint errors and broken tests before they accumulate.

---

## 9. IDE Setup

### 9.1 Recommended: Cursor

Extensions:

| Extension | ID | Purpose |
|-----------|---|---------|
| Biome | `biomejs.biome` | Lint + format on save |
| Vitest Explorer | `vitest.explorer` | Test runner in sidebar |
| Chrome Extension Manifest | `nicedoc.vscode-chrome-ext-manifest-json` | manifest.json autocomplete |

### 9.2 Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "files.exclude": {
    "node_modules": true
  }
}
```

### 9.3 Debugging

- **Service worker**: `chrome://extensions` → ChatRipper AI → "Inspect views: service worker"
- **Content script**: Page DevTools → Sources → Content scripts → ChatRipper AI
- **Side panel**: Right-click side panel → Inspect

---

## 10. Git Conventions

### 10.1 Commit Messages

Conventional Commits with WBS task IDs:

```
feat(A2): add first-run API key setup gate
fix(B2): correct MATCH color threshold for yellow band
docs: update ADD with corrected fallback table
refactor(A3): extract smartrip fetch into helper module
test(B3): add warning toast unit tests
chore: remove Python scaffolding
```

**Prefixes:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
**Scope:** WBS task ID when applicable (e.g., `A2`, `B3`)

### 10.2 Branch Strategy

Solo developer — work directly on `master`. No branching strategy needed at this scale.

---

## 11. Updated .gitignore

Replace the current `.gitignore` with:

```gitignore
# Dependencies
node_modules/

# Build output
dist/

# OS files
.DS_Store

# IDE
.idea/
*.code-workspace
*.swp
*.swo

# Test coverage
coverage/

# Scratchpad (keep folder, ignore contents)
docs/scratchpad/
!docs/scratchpad/.gitkeep
```

---

## 12. Updated Project Structure

After cleanup and new tooling:

```
chat-ripper/
├── .github/
│   └── workflows/
│       └── ci.yml                  # Lint + test on push
├── .vscode/
│   └── settings.json               # Biome format-on-save
├── background/
│   ├── service-worker.js           # Message broker, API gateway
│   └── helpers.js                  # Extracted testable logic (new)
├── content/
│   ├── content.js                  # DOM access, scraping
│   ├── content.css
│   └── utils.js                    # Extracted testable logic (new)
├── dev/
│   └── hot-reload.js               # Dev-only auto-reload
├── docs/
│   ├── core/                       # Charter, PRD, ADD, WBS, this guide
│   ├── specs/                      # Pre-implementation specs
│   ├── features/                   # Post-implementation docs
│   ├── plans/                      # Active plans
│   ├── scratchpad/                 # Temporary notes
│   ├── logs/                       # Issues and fixes
│   ├── guides/                     # Methodology guides (kept)
│   ├── examples/                   # Reference architectures
│   ├── templates/                  # Document templates
│   └── CLAUDE.md                   # Document placement guidelines
├── icons/
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── scripts/
│   └── package.sh                  # CWS zip builder
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.js                # Reply UI, state management
│   ├── sidepanel.css
│   ├── helpers.js                  # Extracted testable logic (new)
│   ├── purify.min.js               # Vendored
│   └── marked.min.js               # Vendored
├── tests/
│   ├── mocks/
│   │   └── chrome.js               # Chrome API stubs
│   └── unit/
│       ├── analysis-panel.test.js
│       ├── first-run-gate.test.js
│       ├── bearer-header.test.js
│       └── warning-toast.test.js
├── .gitignore
├── .nvmrc                          # Node 22
├── biome.json
├── config.js                       # Backend URLs
├── CLAUDE.md                       # AI instructions
├── manifest.json
├── package.json
├── README.md
└── vitest.config.js
```

---

## 13. Updated CLAUDE.md

Replace the root `CLAUDE.md` with:

```markdown
# CLAUDE.md

This file provides guidance to AI Assistants working on the ChatRipper AI Chrome extension.

## What This Is

ChatRipper AI is an internal Chrome MV3 extension for Martell Media's revenue team. It provides AI-powered sales reply suggestions across Revio, LinkedIn, Gmail, Instagram, Facebook, and X.

See `docs/core/prd.md` for full product requirements and `docs/core/add.md` for system architecture.

## Philosophy

- **Minimize code** — Solve problems with as little code as possible
- **Self-descriptive code** — Clear naming, minimal comments
- **Simple first** — Vanilla JS, no frameworks, no build step
- **Spec before code** — Write implementation spec first

## Project Structure

```
chat-ripper/
├── background/           # Service worker (message broker, API gateway)
├── content/              # Content script (DOM access, Revio API scraping)
├── sidepanel/            # Side panel UI (reply display, chat, score, agent bar)
├── popup/                # Extension popup (engine selection)
├── icons/                # Extension icons
├── config.js             # Backend URLs (importScripts in service worker)
├── manifest.json         # Chrome MV3 manifest
├── tests/                # Vitest unit tests
├── docs/                 # Project documentation (see docs/CLAUDE.md)
└── scripts/              # Build/package scripts
```

## Three Execution Contexts

The extension runs in three isolated contexts that communicate via message passing:

| Context | File | Role |
|---------|------|------|
| Content Script | `content/content.js` | DOM access, Revio API scraping, text insertion |
| Service Worker | `background/service-worker.js` | Message broker, API gateway, auth headers |
| Side Panel | `sidepanel/sidepanel.js` | Reply UI, chat/score, agent bar, streaming |

## Development Workflow

1. Edit source files
2. Extension auto-reloads (dev/hot-reload.js)
3. Test in browser on Revio or other supported platform
4. Run `npm test` for unit tests
5. Run `npm run lint` before committing

## Code Style

- Vanilla JavaScript (no TypeScript, no JSX, no build step)
- Biome for linting and formatting (`npm run lint:fix`)
- 2-space indentation, 100-char line width
- No module bundler — files loaded via manifest, `<script>` tags, or `importScripts()`

## Testing

- Vitest with jsdom environment
- Chrome APIs mocked in `tests/mocks/chrome.js`
- Extract testable logic into `*/helpers.js` or `*/utils.js` modules
- Run: `npm test` or `npm run test:watch`
- See `tests/` directory for test structure

## Configuration

- Backend URLs: `config.js` (loaded via `importScripts()` in service worker)
- API keys: `chrome.storage.local` (set via first-run gate, never in source)
- Engine preference: `chrome.storage.local` (set via popup)

## Dependencies

- No npm runtime dependencies — extension uses vendored libs (`purify.min.js`, `marked.min.js`)
- Dev dependencies only: Vitest, jsdom, Biome (in `package.json`)
- Install: `npm install`

## Commit Convention

Conventional Commits with WBS task IDs:
- `feat(A2): add first-run gate`
- `fix(B2): correct MATCH color threshold`
- `test(B3): add warning toast tests`
- `chore: remove Python scaffolding`

## Key Reminders

- **Read before writing** — Understand existing patterns first
- **Spec before code** — Check `docs/specs/` for task specs
- **Check docs/CLAUDE.md** — For document placement guidelines
- **No build step** — Files are loaded directly by Chrome, not bundled
- **Three contexts** — Content script, service worker, and side panel are isolated
```

---

## 14. Updated tests/CLAUDE.md

Create new `tests/CLAUDE.md`:

```markdown
# Testing Guidelines

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on change)
```

## Test Structure

```
tests/
├── mocks/
│   └── chrome.js           # Chrome API stubs (storage, runtime)
└── unit/
    ├── analysis-panel.test.js   # B2 — MATCH label, colors, warning
    ├── first-run-gate.test.js   # A2 — gate display, key storage
    ├── bearer-header.test.js    # A3 — header format, missing key
    └── warning-toast.test.js    # B3 — toast display, auto-dismiss
```

## Writing Tests

- Import extracted functions from `*/helpers.js` or `*/utils.js`
- Chrome APIs are auto-mocked via `tests/mocks/chrome.js` (loaded in vitest setup)
- Use `vi.fn()` for additional mocks
- Name test files `*.test.js`
```

---

## 15. Updated README.md

Replace with:

```markdown
# ChatRipper AI

Internal Chrome extension that provides Martell Media's revenue team with AI-powered sales reply suggestions.

## What It Does

- Scrapes conversation context from Revio, LinkedIn, Gmail, Instagram, Facebook, X
- Sends to one of three backend engines (smartrip, deeprip, quickrip)
- Displays suggested reply in a side panel with analysis
- Manages closer-bot whitelist for autonomous follow-ups
- Coaching chat and conversation scoring

## Development

### Prerequisites

- Node.js 22+ (`nvm use`)
- Chrome browser

### Setup

```bash
nvm use
npm install
```

### Develop

1. Open `chrome://extensions` with Developer Mode enabled
2. Click "Load unpacked" and select the project root
3. Edit source files — extension auto-reloads via `dev/hot-reload.js`
4. Test on [Revio](https://app.sbccrm.com) or other supported platforms

### Test & Lint

```bash
npm test              # Run unit tests
npm run test:watch    # Watch mode
npm run lint          # Check lint errors
npm run lint:fix      # Auto-fix lint errors
```

### Package for Chrome Web Store

```bash
npm run package       # Creates dist/chat-ripper-v{version}.zip
```

## Project Structure

```
background/           # Service worker — message broker, API gateway
content/              # Content script — DOM access, Revio API scraping
sidepanel/            # Side panel — reply UI, chat, score, agent bar
popup/                # Popup — engine selection
config.js             # Backend URLs
manifest.json         # Chrome MV3 manifest
tests/                # Vitest unit tests
docs/                 # Project documentation
```

## Documentation

- [Product Requirements](docs/core/prd.md)
- [Architecture Design](docs/core/add.md)
- [Work Breakdown](docs/core/wbs.md)
- [Dev Environment Guide](docs/core/dev_environment_guide.md)

## Tech Stack

- **Extension**: Chrome MV3, vanilla JavaScript
- **Backends**: Smartrip (Cloud Run), Deeprip/Quickrip (Railway), Coach/Score (n8n)
- **Dev tools**: Vitest, Biome, GitHub Actions
```

---

## 16. Development Workflow

### Daily Development

```bash
# 1. Start
nvm use
# Extension should be loaded unpacked in Chrome already
# hot-reload.js handles auto-reload on file changes

# 2. Develop
# Edit source files in Cursor
# Extension reloads automatically
# Test manually in Chrome on Revio or other platforms

# 3. Test
npm test              # Run unit tests
npm run lint          # Check lint

# 4. Commit
git add .
git commit -m "feat(B2): add MATCH color coding to analysis panel"

# 5. Push (CI runs automatically)
git push
```

### Implementing a WBS Task

```
1. Read the task spec (docs/specs/ or WBS section)
2. Extract testable logic into */helpers.js or */utils.js
3. Write tests in tests/unit/
4. Implement in the main source file
5. npm test && npm run lint
6. git commit -m "feat(XX): description"
```

### Packaging for CWS

```bash
# 1. Remove dev-only imports from service-worker.js
#    (remove importScripts('../dev/hot-reload.js'))

# 2. Package
npm run package

# 3. Upload dist/chat-ripper-v{version}.zip to CWS

# 4. Re-add hot-reload import for continued development
```
