/**
 * CWS Screenshot Generator
 * Produces 1280x800 PNG screenshots with the side panel centered on a dark background.
 * Uses standalone mock HTML that loads only sidepanel.css — no extension JS.
 *
 * Usage: node scripts/screenshots.mjs
 * Output: dist/screenshots/1-reply.png, 2-agent-bar.png, 3-setup-gate.png
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "dist/screenshots");
const CSS_PATH = resolve(ROOT, "sidepanel/sidepanel.css");
const LOGO_PATH = resolve(ROOT, "icons/logo.png");
const TEXT_PATH = resolve(ROOT, "icons/text.png");

// Read icon files as base64 data URIs to avoid file:// path resolution issues
const logoB64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString("base64")}`;
const textB64 = `data:image/png;base64,${readFileSync(TEXT_PATH).toString("base64")}`;

mkdirSync(OUT, { recursive: true });

// Shared SVG icons (from sidepanel.html)
const SVG = {
  refresh:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  globe:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  target:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg>',
  chat: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  send: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  deep: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5-3.5 6.5L12 19l-3.5-3.5C7 14 5 12 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  quick:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  smart:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>',
  score:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
  clock:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  soldier: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" fill="none"><circle cx="20" cy="8" r="3.5"/><path d="M20 11.5v8"/><path d="M14 16l6-1.5 6 1.5"/><path d="M14 16l-4 6"/><path d="M26 16l3-3"/><path d="M17 19.5l-3 8"/><path d="M23 19.5l3 8"/><line x1="10" y1="13" x2="7" y2="11" stroke-width="1.5"/><line x1="7" y1="11" x2="3" y2="11.5" stroke-width="1.2"/></g></svg>`,
};

// Shared header HTML
function header(agentActive = false) {
  return `
    <div class="sp-header${agentActive ? " agent-header-active" : ""}">
      <div class="sp-brand">
        <div class="sp-logo-wrap${agentActive ? " agent-active" : ""}" id="agentLogoBtn">
          <div class="sp-logo-pulse-ring"></div>
          <div class="sp-logo-pulse-ring sp-logo-pulse-ring-2"></div>
          <img class="sp-logo" src="${logoB64}" alt="ChatRipper AI">
        </div>
        <div class="sp-brand-text">
          <img class="sp-text-logo" src="${textB64}" alt="ChatRipper AI">
          <div class="sp-subtitle">v1.0.0</div>
        </div>
      </div>
      <div class="sp-header-right">
        <div class="sp-status"><span class="sp-dot"></span> Ready</div>
        <button class="sp-header-btn sp-header-analyze">${SVG.refresh}</button>
      </div>
    </div>`;
}

// HUD bar
function hud(platform, prospect, msgs, rips) {
  return `
    <div class="sp-agent-bar" style="display:flex">
      <div class="sp-agent-sweep"></div>
      <div class="sp-agent-scanlines"></div>
      <div class="sp-agent-top">
        <div class="sp-agent-soldier">${SVG.soldier}</div>
        <span class="sp-agent-bar-dot"></span>
        <span class="sp-agent-bar-text">Bot active for ${prospect}...</span>
      </div>
      <div class="sp-agent-hud">
        <div class="sp-hud-chip sp-hud-platform">${SVG.globe}<span class="sp-hud-val">${platform}</span></div>
        <div class="sp-hud-chip sp-hud-prospect">${SVG.target}<span class="sp-hud-val">${prospect}</span></div>
        <div class="sp-hud-chip sp-hud-msgs">${SVG.chat}<span class="sp-hud-val">${msgs}</span><span class="sp-hud-label">msgs</span></div>
        <div class="sp-hud-chip sp-hud-rips">${SVG.send}<span class="sp-hud-val">${rips}</span><span class="sp-hud-label">rips</span></div>
      </div>
    </div>`;
}

// Controls bar
function controls(activeEngine = "smart") {
  const engines = [
    { key: "deep", label: "deeprip", svg: SVG.deep },
    { key: "quick", label: "quickrip", svg: SVG.quick },
    { key: "smart", label: "smartrip", svg: SVG.smart },
  ];
  const engineBtns = engines
    .map(
      (e) =>
        `<button class="sp-engine-btn sp-engine-${e.key}${e.key === activeEngine ? " active" : ""}">${e.svg} ${e.label}</button>`,
    )
    .join("");
  return `
    <div class="sp-controls">
      <select class="sp-select" id="modeSelect"><option selected>Auto</option><option>Objection</option><option>Follow Up</option><option>Close</option><option>Re-engage</option></select>
      <div class="sp-engine-bar">${engineBtns}</div>
      <div class="sp-controls-spacer"></div>
      <button class="sp-action-btn sp-action-score">${SVG.score} Score</button>
      <button class="sp-action-btn sp-action-coach">${SVG.chat} Coach</button>
      <button class="sp-action-btn sp-action-metrics">${SVG.clock}</button>
    </div>`;
}

// Wrapper for all pages: 1280x800 viewport with panel centered
function wrapPage(cssPath, innerHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssPath}">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    body {
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sp-wrapper {
      position: relative;
      width: 400px;
      height: 800px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 0 60px rgba(99, 102, 241, 0.15), 0 0 120px rgba(99, 102, 241, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .sp { height: 100%; }
    /* Stop animations for consistent screenshots */
    .sp-agent-sweep, .sp-agent-scanlines { animation: none !important; }
    .sp-agent-soldier { animation: none !important; }
    .sp-logo-pulse-ring { animation: none !important; opacity: 0; }
    .sp-agent-bar-dot { animation: none !important; }
    /* Keep gate inside panel wrapper instead of filling viewport */
    .sp-gate { position: absolute; }
  </style>
</head>
<body>
  <div class="sp-wrapper">
    ${innerHtml}
  </div>
</body>
</html>`;
}

// ── Screenshot 1: Reply view ──
function replyPage(cssPath) {
  const analysis = `
    <div class="sp-analysis">
      <div class="sp-analysis-row">
        <span class="sp-analysis-label">Stage</span>
        <span class="sp-analysis-value">Objection Handling</span>
      </div>
      <div class="sp-analysis-row">
        <span class="sp-analysis-label" title="Playbook alignment">Match</span>
        <span class="sp-analysis-value" style="color:#22c55e">78%</span>
      </div>
      <div class="sp-analysis-row">
        <span class="sp-analysis-label">Read</span>
        <span class="sp-analysis-value">Prospect is price-anchoring against a competitor. They're interested but need value justification before moving forward.</span>
      </div>
    </div>`;

  const reply = `
    <div class="sp-backend-badge sp-backend-alfred">smartrip</div>
    ${analysis}
    <div class="sp-messages">
      <div class="sp-message-block">
        <div class="sp-message-label">Suggested Reply</div>
        <div class="sp-message-text">Hey Marcus — totally hear you on the pricing concern. A few of our clients felt the same way before they saw the ROI within the first 60 days.\n\nWould it help if I walked you through a quick case study from someone in a similar space? I can show you exactly how they recouped their investment in under 2 months.</div>
        <div class="sp-message-actions">
          <button class="sp-copy-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button class="sp-insert-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            Insert <kbd>⌘I</kbd>
          </button>
        </div>
      </div>
    </div>`;

  const inner = `
    <div class="sp">
      ${header()}
      ${controls("smart")}
      <div class="sp-content">${reply}</div>
    </div>`;

  return wrapPage(cssPath, inner);
}

// ── Screenshot 2: Agent bar active ──
function agentPage(cssPath) {
  const analysis = `
    <div class="sp-analysis">
      <div class="sp-analysis-row">
        <span class="sp-analysis-label">Stage</span>
        <span class="sp-analysis-value">Objection Handling</span>
      </div>
      <div class="sp-analysis-row">
        <span class="sp-analysis-label" title="Playbook alignment">Match</span>
        <span class="sp-analysis-value" style="color:#22c55e">78%</span>
      </div>
      <div class="sp-analysis-row">
        <span class="sp-analysis-label">Read</span>
        <span class="sp-analysis-value">Prospect is price-anchoring against a competitor. They're interested but need value justification before moving forward.</span>
      </div>
    </div>`;

  const reply = `
    <div class="sp-backend-badge sp-backend-alfred">smartrip</div>
    ${analysis}
    <div class="sp-messages">
      <div class="sp-message-block">
        <div class="sp-message-label">Suggested Reply</div>
        <div class="sp-message-text">Hey Marcus — totally hear you on the pricing concern. A few of our clients felt the same way before they saw the ROI within the first 60 days.\n\nWould it help if I walked you through a quick case study from someone in a similar space? I can show you exactly how they recouped their investment in under 2 months.</div>
        <div class="sp-message-actions">
          <button class="sp-copy-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button class="sp-insert-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            Insert <kbd>⌘I</kbd>
          </button>
        </div>
      </div>
    </div>`;

  const inner = `
    <div class="sp">
      ${header(true)}
      ${hud("Revio", "Marcus Chen", 24, 3)}
      ${controls("smart")}
      <div class="sp-content">${reply}</div>
    </div>`;

  return wrapPage(cssPath, inner);
}

// ── Screenshot 3: Setup gate ──
function gatePage(cssPath) {
  const inner = `
    <div class="sp">
      <div class="sp-gate" style="display:flex">
        <div class="sp-gate-inner">
          <img class="sp-gate-logo" src="${logoB64}" alt="ChatRipper AI">
          <div class="sp-gate-title">Welcome to ChatRipper</div>
          <div class="sp-gate-desc">Enter your API key to get started. Contact Alfred if you don't have one.</div>
          <div class="sp-gate-form">
            <input type="text" class="sp-gate-input" placeholder="cr_yourname_..." autocomplete="off" spellcheck="false">
            <button class="sp-gate-btn">Activate</button>
          </div>
        </div>
      </div>
    </div>`;

  return wrapPage(cssPath, inner);
}

// ── Main ──
async function main() {
  const cssUri = `file://${CSS_PATH}`;
  const pages = [
    { name: "1-reply.png", html: replyPage(cssUri) },
    { name: "2-agent-bar.png", html: agentPage(cssUri) },
    { name: "3-setup-gate.png", html: gatePage(cssUri) },
  ];

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  for (const { name, html } of pages) {
    const tmpFile = resolve(OUT, `_tmp_${name}.html`);
    writeFileSync(tmpFile, html);
    try {
      const page = await context.newPage();
      await page.goto(`file://${tmpFile}`, { waitUntil: "networkidle" });
      // Let fonts load
      await page.waitForTimeout(1000);
      await page.screenshot({ path: resolve(OUT, name), type: "png" });
      await page.close();
      console.log(`✓ ${name}`);
    } finally {
      unlinkSync(tmpFile);
    }
  }

  await browser.close();
  console.log("\nScreenshots saved to dist/screenshots/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
