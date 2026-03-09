# Engineering Specification: B4 — Privacy Policy

## Context

### Current State

- CWS submission (C1) requires a privacy policy URL
- No privacy policy exists
- GitHub Pages is not enabled for this repo
- No `public/` folder exists
- Data flows documented in PRD Section 6 and ADD Section 6.3

### Desired Outcome

A privacy policy hosted on GitHub Pages at `https://martell-media.github.io/chat-ripper/privacy-policy.html` that satisfies CWS submission requirements. The policy covers what the extension collects, where data is sent, and what backends store — honestly and without unenforceable commitments.

### Success Criteria

- Privacy policy accessible at `https://martell-media.github.io/chat-ripper/privacy-policy.html`
- Covers all CWS-required sections: data collection, usage, storage, third-party sharing, contact info
- No private project files (specs, architecture docs) are publicly accessible
- Accurate about data retention (no false commitments)
- Honest about third-party processing (Chris's backends)

## Implementation Specification

### Data Models & Types

N/A — this is a documentation task, no code changes.

### Plan - High-Level Tasks

- [ ] *Task 1*: Create `public/` directory with privacy policy HTML and index HTML
- [ ] *Task 2*: Create GitHub Actions workflow to deploy `public/` to Pages (no build step)
- [ ] *Task 3*: Enable GitHub Pages with Actions source via API (before pushing)
- [ ] *Task 4*: Push, wait for deploy, verify URL is live and renders correctly

### Implementation Order - Step-by-Step Subtasks

#### 1. Create `public/privacy-policy.html`

Self-contained HTML file with inline CSS. No build step, no dependencies.

**Content guidelines:**
- Use generic language — avoid internal jargon that could confuse CWS reviewers
- "CRM metadata" not "Rocket Selling score"
- "Sales pipeline data" not "AI notes, assigned closer ID"
- "Supported messaging platforms" not specific platform names in data collection (platform names OK in the "where it works" context)

The privacy policy must cover these sections:

**a. Introduction**
- Extension name: ChatRipper AI
- Developer: Martell Media (internal tool)
- Effective date

**b. Data Collection**
What the extension accesses:
- Conversation text from supported messaging platforms
- Contact details (name, ID, channel type)
- CRM metadata (sales pipeline data, notes, tags)
- User settings (engine preference, API key — stored locally)

What the extension does NOT collect:
- Passwords or login credentials
- Financial information
- Data from websites outside the supported platform list

**c. How Data Is Used**
- Conversation text is sent to backend AI services to generate reply suggestions
- Contact metadata is used to personalize suggestions
- API key authenticates requests (never sent to third parties)

**d. Data Storage**

| Location | What | Retention |
|----------|------|-----------|
| Extension (chrome.storage.local) | Settings only: engine preference, API key | Until user clears or extension removed |
| Extension (memory) | Conversation data | Until side panel reloads — not persisted |
| Backend servers (Google Cloud) | Contact ID, name, recent messages, generated suggestions | Retained for service improvement. No formal retention period currently defined. |
| Backend server logs | Metadata only (contact ID, response latency) | Default cloud provider retention |
| Automation backend (self-hosted) | Contact ID, automation status | Until manually removed |
| Third-party AI services | Conversation data sent for reply generation | Retention practices not independently verified |

**e. Third-Party Services**
- Some reply suggestions are processed by third-party AI services operated independently from Martell Media
- These services receive conversation data for processing
- Data retention practices for these services have not been independently verified
- No data is sold or shared with advertisers

**f. Data Security**
- All data transmitted over HTTPS
- API keys stored in Chrome's browser-managed local storage, protected by the user's OS login and browser profile
- Per-user authentication — each user has a unique key
- Extension restricted to specific website domains

**g. User Rights**
- Internal tool — contact Alfred Loh (alfred@danmartell.com) for data requests
- Users can clear their API key and settings via the extension
- Uninstalling the extension removes all locally stored data

**h. Changes to This Policy**
- Policy may be updated. Changes take effect when published to this URL.

**i. Contact**
- Alfred Loh — alfred@danmartell.com
- Martell Media, Kelowna, BC, Canada

#### 2. Create `public/index.html`

Simple index page linking to the privacy policy. Prevents a 404 on the root URL.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChatRipper AI</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1rem; color: #1a1a1a; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>ChatRipper AI</h1>
  <p>Internal Chrome extension for Martell Media.</p>
  <ul>
    <li><a href="./privacy-policy.html">Privacy Policy</a></li>
  </ul>
</body>
</html>
```

#### 3. Create `.github/workflows/pages.yml`

GitHub Pages branch-based deployment only supports `/` or `/docs` as source folders — **not `/public`**. Use GitHub Actions to deploy `public/` directly as a static artifact. No build step needed.

```yaml
name: Deploy privacy policy to Pages

on:
  push:
    branches: [master]
    paths: [public/**]

  # Allow manual trigger if first deploy fails
  workflow_dispatch:

permissions:
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public
      - id: deployment
        uses: actions/deploy-pages@v4
```

Notes:
- Only triggers on changes to `public/` — extension code changes don't redeploy
- No build step — raw HTML files served directly
- `docs/`, `tests/`, `background/`, etc. are never published
- `workflow_dispatch` allows manual re-trigger if first run fails

#### 4. Enable GitHub Pages (Actions source)

**Must be done BEFORE pushing the workflow file.** If Pages isn't enabled when the workflow runs, `deploy-pages` will fail. Either:

**(a) Enable via API before push:**

```bash
gh api repos/Martell-Media/chat-ripper/pages \
  --method POST \
  --field build_type="workflow"
```

**(b) Or manually:** Repo Settings → Pages → Source: **GitHub Actions** → Save.

If the push happens before Pages is enabled, manually trigger the workflow after enabling:

```bash
gh workflow run pages.yml
```

**Important**: Only files inside `public/` are deployed. Unlike branch-based deployment, Actions gives full control over what's published.

#### 5. Verify

- Push changes, wait for GitHub Actions workflow to complete (~20-30s)
- Check `https://martell-media.github.io/chat-ripper/privacy-policy.html`
- Verify no project files are accessible (try `https://martell-media.github.io/chat-ripper/docs/core/prd` — should 404)
- Check workflow status: `gh run list --workflow=pages.yml`

### Error Handling

- If GitHub Actions workflow fails: check `gh run list --workflow=pages.yml` and `gh run view` for error details
- If Pages not enabled: `gh api repos/Martell-Media/chat-ripper/pages` returns 404 — enable via settings or API, then re-trigger with `gh workflow run pages.yml`
- If 404 on privacy-policy.html: verify the file is in `public/` and the workflow completed successfully

## Testing Requirements

### Critical Test Cases

No automated tests — this is a static document. Manual verification:

- [ ] `https://martell-media.github.io/chat-ripper/privacy-policy.html` loads and renders
- [ ] Policy covers: data collection, usage, storage, third-party, contact
- [ ] `https://martell-media.github.io/chat-ripper/docs/core/prd` returns 404 (private docs not exposed)
- [ ] No broken links in the policy
- [ ] Contact email is correct (alfred@danmartell.com)
- [ ] No internal jargon visible (no "Rocket Selling", "Revio", "smartrip", "closer-bot")

### Edge Cases to Consider

- GitHub Actions workflow takes ~20-30s to deploy after push
- Repo is private — GitHub Team plan confirmed (supports Pages)
- CWS reviewer needs the URL to be live at submission time
- GitHub Pages sites from private repos are still publicly accessible on the internet — this is expected (the whole point is a public URL for CWS)

## Dependencies & Constraints

### External Dependencies

- GitHub Pages (requires paid plan for private repos — Team plan confirmed)
- GitHub Actions (`actions/checkout@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`)

### Constraints & Assumptions

- Martell-Media GitHub org is on Team plan — GitHub Pages supported on private repos.
- Contact email: `alfred@danmartell.com` — confirmed
- No legal review — best-effort policy for internal tool launch
- No PIPEDA/PIPA section — deferred to post-launch compliance review
- Generic language in policy — no internal tool names, platform names, or jargon

## Verification Checklist

- [ ] `public/privacy-policy.html` created with all required sections
- [ ] `public/index.html` created with link to privacy policy
- [ ] `.github/workflows/pages.yml` created with static deployment (no build step)
- [ ] GitHub Pages enabled (source: GitHub Actions) — **before** first push
- [ ] URL live: `https://martell-media.github.io/chat-ripper/privacy-policy.html`
- [ ] Private docs NOT accessible via GitHub Pages
- [ ] No internal jargon in published policy
- [ ] All 36 existing tests still pass (`npm test`)

## Open Questions

- [x] Hosting: GitHub Pages from `/public` folder via Actions — confirmed
- [x] Legal review: Best-effort — confirmed
- [x] Chris's backends: State "not independently verified" — confirmed
- [x] Data retention: State honestly, no false commitments — confirmed
- [x] Scope: Extension-focused, backend high-level — confirmed
- [x] PIPEDA: Defer to post-launch — confirmed
- [x] Contact email: `alfred@danmartell.com` — confirmed
- [x] Repo is private, org on GitHub Team plan — GitHub Pages supported
- [x] Format: Pure HTML, no Jekyll — confirmed
- [x] Language: Generic, no internal jargon — confirmed
