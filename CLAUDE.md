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
