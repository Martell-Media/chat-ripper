# Engineering Specification: Dev Environment Setup

> **Status**: Active
> **Estimated effort**: 1 session
> **Priority**: Immediate (prerequisite for all WBS tasks)
> **Source**: `docs/core/dev_environment_guide.md` (Approved)

## Context

### Current State

- Repo scaffolded from Python backend template ("Agentic Coding Blueprint")
- Python scaffolding exists but is unused: `app/`, `docker/`, `pyproject.toml`, `tests/unit/`, `tests/integration/`, `tests/evals/`, `.python-version`, `uv.lock`, `playground/`
- `CLAUDE.md` describes a Python/UV/Pydantic project (wrong)
- `README.md` describes the Agentic Coding Blueprint template (wrong)
- `.gitignore` has Python patterns, missing JS/Node patterns
- `docs/guides/` references deleted Python-specific guides
- `docs/examples/README.md` uses template language
- No JS test framework, linter, formatter, or CI/CD
- No `package.json`, `.nvmrc`, or Node tooling

### Desired Outcome

The repo tooling matches the actual project: a Chrome MV3 extension in vanilla JavaScript. Python scaffolding is removed. JS dev tooling (Vitest, Biome, CI) is installed and configured. All project-level docs (`CLAUDE.md`, `README.md`, `tests/CLAUDE.md`) accurately describe the Chrome extension project.

### Success Criteria

- `npm test` runs Vitest with jsdom and Chrome API mocks
- `npm run lint` runs Biome check
- `npm run package` produces a CWS-ready zip in `dist/`
- No Python files remain (`app/`, `docker/`, `pyproject.toml`, etc.)
- `CLAUDE.md` describes the Chrome extension, not Python
- `README.md` describes ChatRipper AI, not the template
- `.gitignore` covers JS/Node patterns
- GitHub Actions CI runs lint + test on push
- Hot-reload script exists at `dev/hot-reload.js`
- `config.js` centralizes backend URLs

## Plan - High-Level Tasks

- [ ] **Phase 1**: Delete Python scaffolding and Python-specific docs
- [ ] **Phase 2**: Create Node/JS tooling files
- [ ] **Phase 3**: Create test infrastructure
- [ ] **Phase 4**: Create config, packaging, and dev scripts
- [ ] **Phase 5**: Rewrite project-level docs
- [ ] **Phase 6**: Create CI/CD and IDE config
- [ ] **Phase 7**: Verify

## Implementation Order - Step-by-Step Subtasks

### Phase 1: Remove Python Scaffolding

**1.1 Delete Python application files**

```bash
rm -rf app/
rm -rf docker/
rm -rf playground/
rm pyproject.toml
rm uv.lock
rm .python-version
```

**1.2 Delete Python test structure**

```bash
rm -rf tests/unit/
rm -rf tests/integration/
rm -rf tests/evals/
rm tests/CLAUDE.md
```

**1.3 Delete Python-specific docs**

```bash
rm docs/GETTING_STARTED.md
rm docs/guides/TROUBLESHOOTING.md
rm docs/guides/SECURITY_GUIDE.md
rm docs/guides/multi_project_management.md
```

**1.4 Update `docs/examples/README.md`**

Remove "using this template" and "on top of this template" language. Change:
- Line 3: "...patterns you might implement using this template." → "...patterns for reference."
- Line 5: "...not documentation of code that exists in this template." → "...not documentation of code that exists in this project."
- Line 19: "...on top of this template." → remove or reword to "...in your own projects."

**1.5 Update `docs/guides/README.md`**

- Remove SECURITY_GUIDE.md section (lines 7-18)
- Remove TROUBLESHOOTING.md section (lines 35-49)
- Remove multi_project_management.md section (lines 111-125)
- Edit genai_launchpad_workflow_architecture.md section (lines 95-108) — change "this template" to "this project"
- Update "Guide Selection" section (lines 141-158) — remove "this template" language
- Update "See Also" section (lines 162-166) — remove GETTING_STARTED.md reference
- Remove "this template" language throughout

### Phase 2: Create Node/JS Tooling Files

**2.1 Replace `.gitignore`**

Full replacement with JS/Node patterns. Source: guide Section 11. Key: no `dev/` entry (version controlled). Must happen before `npm install` so `node_modules/` is properly ignored from the start.

**2.2 Create `.nvmrc`**

```
22
```

**2.3 Create `package.json`**

Content from dev environment guide Section 2.2.

**2.4 Run `npm install`**

Generates `node_modules/` and `package-lock.json`. Both must exist before CI works.

**2.5 Create `biome.json`**

Content from dev environment guide Section 3.1. Key: `**/*.min.js` in files.ignore.

**2.6 Create `vitest.config.js`**

Content from dev environment guide Section 4.1.

### Phase 3: Create Test Infrastructure

**3.1 Create `tests/mocks/chrome.js`**

Chrome API stubs with `vi.fn()` mocks and storage simulation. Content from guide Section 4.2.

**3.2 Create empty test directory**

```bash
mkdir -p tests/unit
```

No test files yet — those come with WBS task implementation. But the directory must exist for `npm test` to run without error (`vitest run` with no test files exits 0).

### Phase 4: Create Config, Packaging, and Dev Scripts

**4.1 Create `config.js`**

Global `CONFIG` object with backend URLs. Content from guide Section 5.1.

**4.2 Create `scripts/package.sh`**

CWS zip builder with inclusion-list pattern. Content from guide Section 6.1. Run `chmod +x`.

**4.3 Create `dev/hot-reload.js`**

Multi-file content-hashing hot-reload script. Content from guide Section 7.1.

**4.4 Wire `config.js` into `background/service-worker.js`**

Source: guide Section 5.2. Three changes to `background/service-worker.js`:

1. Add `importScripts('../config.js');` after line 2 (must be top-level, before any event listeners)
2. Remove hardcoded URL constants (lines 4-12): `WEBHOOKS`, `COACH_WEBHOOK`, `SCORE_WEBHOOK`, `ALFRED_API`, `CLOSER_API`
3. Replace all references throughout the file:
   - `ALFRED_API` → `CONFIG.SMARTRIP_API`
   - `CLOSER_API` → `CONFIG.CLOSER_API`
   - `WEBHOOKS` → `CONFIG.WEBHOOKS`
   - `COACH_WEBHOOK` → `CONFIG.COACH_WEBHOOK`
   - `SCORE_WEBHOOK` → `CONFIG.SCORE_WEBHOOK`

**Keep in place**: `ALFRED_KEY` (line 11) stays hardcoded until WBS task A2/A3 replaces it with per-rep keys from `chrome.storage.local`. `sessionId` (line 13) stays — it's runtime-generated, not config.

### Phase 5: Rewrite Project-Level Docs

**5.1 Rewrite `CLAUDE.md`**

Full replacement with Chrome extension content. Source: guide Section 13.

**5.2 Rewrite `README.md`**

Full replacement with ChatRipper AI content. Source: guide Section 15.

**5.3 Create new `tests/CLAUDE.md`**

Vitest testing guidelines. Source: guide Section 14.

### Phase 6: Create CI/CD and IDE Config

**6.1 Create `.github/workflows/ci.yml`**

Lint + test GitHub Action. Content from guide Section 8.1.

**6.2 Create `.vscode/settings.json`**

Biome format-on-save. Content from guide Section 9.2.

### Phase 7: Verify

```bash
# Tooling works
npm test                    # Vitest runs (0 tests, exit 0)
npm run lint                # Verify Biome runs (will likely flag legacy code — run lint:fix after)
npm run package             # Creates dist/chat-ripper-v*.zip

# Python remnants gone
ls app/ docker/ playground/ pyproject.toml uv.lock .python-version 2>&1 | grep -c "No such file"
# Should output 6

# New files exist
ls .nvmrc package.json biome.json vitest.config.js config.js
ls scripts/package.sh dev/hot-reload.js
ls tests/mocks/chrome.js
ls .github/workflows/ci.yml .vscode/settings.json

# Config loads
node -e "require('./config.js'); console.log('config.js valid')" 2>&1 || echo "config.js uses global assignment, not module.exports — expected"

# Package contents are correct
unzip -l dist/chat-ripper-v*.zip | head -20
# Should contain: manifest.json, config.js, background/, content/, sidepanel/, popup/, icons/
# Should NOT contain: node_modules/, tests/, docs/, dev/, scripts/
```

## Files Summary

| Action | Path | Source |
|--------|------|--------|
| DELETE | `app/` | Guide 1.1 |
| DELETE | `docker/` | Guide 1.1 |
| DELETE | `playground/` | Guide 1.1 |
| DELETE | `pyproject.toml` | Guide 1.1 |
| DELETE | `uv.lock` | Guide 1.1 |
| DELETE | `.python-version` | Guide 1.1 |
| DELETE | `tests/unit/` | Guide 1.1 |
| DELETE | `tests/integration/` | Guide 1.1 |
| DELETE | `tests/evals/` | Guide 1.1 |
| DELETE | `tests/CLAUDE.md` | Guide 1.1 |
| DELETE | `docs/GETTING_STARTED.md` | Guide 1.2 |
| DELETE | `docs/guides/TROUBLESHOOTING.md` | Guide 1.2 |
| DELETE | `docs/guides/SECURITY_GUIDE.md` | Guide 1.2 |
| DELETE | `docs/guides/multi_project_management.md` | Guide 1.2 |
| EDIT | `docs/examples/README.md` | Guide 1.3 |
| EDIT | `docs/guides/README.md` | Guide 1.4 |
| CREATE | `.nvmrc` | Guide 2.1 |
| CREATE | `package.json` | Guide 2.2 |
| CREATE | `biome.json` | Guide 3.1 |
| CREATE | `vitest.config.js` | Guide 4.1 |
| CREATE | `tests/mocks/chrome.js` | Guide 4.2 |
| CREATE | `config.js` | Guide 5.1 |
| CREATE | `scripts/package.sh` | Guide 6.1 |
| CREATE | `dev/hot-reload.js` | Guide 7.1 |
| EDIT | `background/service-worker.js` | Guide 5.2 |
| REWRITE | `.gitignore` | Guide 11 |
| REWRITE | `CLAUDE.md` | Guide 13 |
| REWRITE | `README.md` | Guide 15 |
| CREATE | `tests/CLAUDE.md` | Guide 14 |
| CREATE | `.github/workflows/ci.yml` | Guide 8.1 |
| CREATE | `.vscode/settings.json` | Guide 9.2 |

## Dependencies & Constraints

- **Node.js 22**: Must be installed via nvm before `npm install`
- **No runtime deps**: Only devDependencies (Vitest, jsdom, Biome)
- **`package-lock.json`**: Generated by `npm install`, must be committed for CI (`npm ci`)
- **`chmod +x`**: Required for `scripts/package.sh`
- **Git staging**: Deletions and new files must be staged carefully — suggest committing Phase 1 (cleanup) separately from Phase 2-6 (new tooling)

## Commit Strategy

Two commits:

1. `chore: remove Python scaffolding and update docs` — Phase 1
2. `chore: add JS dev tooling, CI, and rewrite project docs` — Phases 2-6

## Open Questions

None — all decisions captured in the approved dev environment guide.
