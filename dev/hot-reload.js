// Dev-only: auto-reload extension on file changes
// Include via importScripts() in service-worker.js during development
// Remove before CWS submission

const WATCH_INTERVAL = 1000;

// Hash the content of key files to detect changes
async function hashFile(url) {
  try {
    const resp = await fetch(url, { cache: "no-store" });
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
  "manifest.json",
  "config.js",
  "background/service-worker.js",
  "content/content.js",
  "sidepanel/sidepanel.js",
  "popup/popup.js",
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
      console.log("[Hot Reload] Change detected, reloading...");
      chrome.runtime.reload();
    }
    prevHashes = current;
  } catch (e) {
    // Extension context invalidated, ignore
  }
}

setInterval(checkForChanges, WATCH_INTERVAL);
console.log("[Hot Reload] Watching for changes...");
