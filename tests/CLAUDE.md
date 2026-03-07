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
