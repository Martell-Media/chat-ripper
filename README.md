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
