# Engineering Specification: B2 — Smartrip Analysis Panel Redesign

**Status:** Approved
**Date:** March 7, 2026
**WBS Task:** B2
**Depends on:** Nothing
**Effort:** 0.5 day

---

## Context

### Current State

The smartrip analysis panel in the side panel has three issues:

1. **"ENERGY" label is misleading** (`sidepanel.js:1027`). The value is Pinecone cosine similarity (KB match confidence, 0-1 scaled to %). "Energy" doesn't convey what it measures.

2. **"Why this works" section duplicates READ** (`sidepanel.js:1052-1056`). The `reasoning` field displayed under "Why this works" is the same `data.reasoning` value shown in the READ row (`analysis.realMeaning`). When a warning exists, the service worker overwrites `reasoning` with `"Warning: " + data.warning` (`service-worker.js:930-932`), hijacking the section instead of having a dedicated display.

3. **Warning has no dedicated UI**. The backend returns `warning` and `warning_fix` as separate fields, but the service worker merges them into the `reasoning` string (`service-worker.js:930-932`, `1261-1263`). The sidepanel has no way to style or conditionally render warnings.

**Two rendering paths** exist for analysis fields:
- **Final render**: `showReply()` (`sidepanel.js:1024-1029`) — builds HTML string with analysis rows, rendered on response completion
- **Streaming DOM**: `buildStreamDom()` (`sidepanel.js:743-758`) + `updateStreamDom()` (`sidepanel.js:776-812`) — used for deeprip/quickrip JSON streaming. Builds DOM elements incrementally. Smartrip streaming uses a separate card-based path (`updateAlfredStream`) that only shows messages, not analysis.

**Service worker builds the analysis object** in two places:
- Non-streaming: `handleAlfredResponse()` (`service-worker.js:923-943`)
- Streaming result: end of `doAlfredStreamFetch()` (`service-worker.js:1254-1277`)

Both currently produce:
```javascript
analysis = {
  stage: data.phase || "unknown",
  energy: data.confidence ? Math.round(data.confidence * 100) + "% confidence" : "",
  realMeaning: data.reasoning || "",
}
reasoning = data.reasoning || "";
// Warning overwrites reasoning:
if (data.warning) {
  reasoning = "Warning: " + data.warning;
  if (data.warning_fix) reasoning += "\nSuggested fix: " + data.warning_fix;
}
```

The raw `confidence` number (0-1 float) is lost after formatting into `"75% confidence"` string. The sidepanel cannot color-code without parsing the string back.

### Desired Outcome

After this work:
1. ENERGY label renamed to MATCH with color-coded value (green/yellow/red) and tooltip
2. Warning displayed as a distinct amber-styled row (only when present)
3. "Why this works" section removed entirely (no duplication with READ)
4. Both rendering paths (final + streaming DOM) are consistent

### Success Criteria

- Analysis panel shows "Match" label (not "Energy")
- MATCH value is color-coded: green 60%+, yellow 40-59%, red <40%
- MATCH label has tooltip explaining the score
- Warning row appears with amber styling when backend returns `warning`
- Warning row shows "Fix: ..." when `warning_fix` is present
- No warning row when backend returns no `warning`
- "Why this works" section does not appear in any response
- Deeprip/quickrip responses are unaffected (no analysis rendered)
- Streaming DOM keeps "Energy" label for deeprip/quickrip (different metric than smartrip's "Match")
- All existing tests pass
- New unit tests for analysis helpers pass

---

## Implementation Specification

### Plan — High-Level Tasks

- [ ] **Task 1**: Restructure analysis response in service worker (pass raw confidence, warning, warningFix; stop passing reasoning)
- [ ] **Task 2**: Extract analysis helpers to `sidepanel/helpers.js` (formatMatchValue, buildAnalysisHtml)
- [ ] **Task 3**: Update `showReply()` to use helpers (MATCH label, color, warning row, remove "Why this works")
- [ ] **Task 4**: Update streaming DOM (`buildStreamDom` + `updateStreamDom`) for consistency
- [ ] **Task 5**: Add CSS for warning row
- [ ] **Task 6**: Write unit tests

---

### Implementation Order — Step-by-Step

#### Task 1: Restructure analysis response in service worker

**File: `background/service-worker.js`**

Two call sites build the smartrip analysis object. Both need the same change.

**Site 1: `handleAlfredResponse()`** (lines 923-943) — non-streaming smartrip:

Replace lines 923-943:

```javascript
const analysis = {
  stage: data.phase || "unknown",
  match: data.confidence || 0,
  realMeaning: data.reasoning || "",
  warning: data.warning || null,
  warningFix: data.warning_fix || null,
};

return {
  success: true,
  structured: true,
  analysis: analysis,
  messages: suggestionMessages,
  reasoning: null,
  source: data.source || "alfred",
  backend: "alfred",
};
```

**Site 2: end of `doAlfredStreamFetch()`** (lines 1254-1277) — streaming result:

Replace lines 1254-1277:

```javascript
const analysis = {
  stage: metadata?.phase || "unknown",
  match: metadata?.confidence || 0,
  realMeaning: metadata?.reasoning || "",
  warning: metadata?.warning || null,
  warningFix: metadata?.warning_fix || null,
};

port.postMessage({
  type: "STREAM_END",
  data: {
    success: true,
    structured: true,
    analysis: analysis,
    messages: suggestionMessages,
    reasoning: null,
    source: metadata?.source || "alfred",
    backend: "alfred",
  },
});
```

**Changes from current code:**
- `energy` field removed, replaced by `match` (raw 0-1 float, not formatted string)
- `warning` and `warningFix` added to analysis object (previously merged into reasoning)
- `reasoning` set to `null` (was duplicating `analysis.realMeaning` / READ row)
- Deeprip/quickrip response handling (`handleThinkingResponse`, `handleFastResponse`) untouched — they pass through `parsed.analysis || null` and `parsed.reasoning || null` from the backend

**Note on deeprip/quickrip `reasoning` field:** These backends pass `reasoning: parsed.reasoning || null` unchanged. Since we're removing the "Why this works" rendering in the sidepanel, this field becomes dead data if it ever has a value. No change needed — the rendering removal is sufficient.

---

#### Task 2: Extract analysis helpers

**File: `sidepanel/helpers.js`** (new)

```javascript
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMatchValue(confidence) {
  var pct = Math.round((confidence || 0) * 100);
  var color = "#f85149"; // red (<40%)
  if (pct >= 60) color = "#3fb950"; // green
  else if (pct >= 40) color = "#d29922"; // yellow
  return { text: pct + "%", color: color };
}

var MATCH_TOOLTIP =
  "How closely this conversation matches proven closed-won patterns. " +
  "KB examples are always used \u2014 higher scores mean more relevant matches.";

function buildAnalysisHtml(analysis) {
  if (!analysis) return "";
  var m = formatMatchValue(analysis.match);
  var html = '<div class="sp-analysis">';
  html +=
    '<div class="sp-analysis-row"><span class="sp-analysis-label">Stage</span>' +
    '<span class="sp-analysis-value">' + escHtml(analysis.stage || "") + "</span></div>";
  html +=
    '<div class="sp-analysis-row"><span class="sp-analysis-label" title="' + escHtml(MATCH_TOOLTIP) + '">Match</span>' +
    '<span class="sp-analysis-value" style="color:' + m.color + '">' + m.text + "</span></div>";
  html +=
    '<div class="sp-analysis-row"><span class="sp-analysis-label">Read</span>' +
    '<span class="sp-analysis-value">' + escHtml(analysis.realMeaning || "") + "</span></div>";
  if (analysis.warning) {
    html += '<div class="sp-analysis-row sp-warning-row">';
    html += '<span class="sp-analysis-label">Warning</span>';
    html += '<span class="sp-analysis-value">' + escHtml(analysis.warning);
    if (analysis.warningFix) html += "<br><strong>Fix:</strong> " + escHtml(analysis.warningFix);
    html += "</span></div>";
  }
  html += "</div>";
  return html;
}

if (typeof module !== "undefined") {
  module.exports = { escHtml, formatMatchValue, buildAnalysisHtml, MATCH_TOOLTIP };
}
```

**Design decisions:**
- `escHtml()` is string-based (not DOM-based like sidepanel's `esc()`). Works in both browser and Vitest jsdom.
- `formatMatchValue()` returns `{text, color}` — pure function, easily testable
- `buildAnalysisHtml()` returns complete analysis card HTML string — testable against DOM assertions
- `MATCH_TOOLTIP` exported as constant for test assertions
- CJS export via `typeof module` guard — same pattern as `background/auth.js`
- Warning row uses "Warning" as the label (consistent with analysis row structure)

**Loading:** Add `<script src="helpers.js"></script>` to `sidepanel/sidepanel.html` before `sidepanel.js`.

---

#### Task 3: Update `showReply()`

**File: `sidepanel/sidepanel.js`**

**3a.** Replace lines 1024-1029 (analysis rendering):

```javascript
// Analysis
if (analysis) {
  html += buildAnalysisHtml(analysis);
}
```

**3b.** Remove lines 1052-1057 ("Why this works" section):

```javascript
// DELETE this entire block:
if (reasoning) {
  html += `<div class="sp-reasoning">
    <div class="sp-reasoning-label">Why this works</div>
    <div class="sp-reasoning-text">${esc(reasoning)}</div>
  </div>`;
}
```

**3c.** Remove unused `reasoning` variable (line 977 declaration, line 990 assignment):

```javascript
// BEFORE (line 975-977):
let messages,
  analysis = null,
  reasoning = null;

// AFTER:
let messages,
  analysis = null;
```

```javascript
// BEFORE (line 990):
  reasoning = response.reasoning;

// AFTER:
  // (delete this line entirely)
```

The `reasoning` variable is no longer read after removing "Why this works". Keeping it would cause a Biome lint failure (unused variable).

The 6-line inline analysis HTML is replaced by `buildAnalysisHtml(analysis)`. The "Why this works" block and `reasoning` variable are deleted entirely.

---

#### Task 4: Update streaming DOM

**File: `sidepanel/sidepanel.js`**

**4a. `buildStreamDom()`** (lines 743-758) — remove reasoning section, keep Energy label:

Replace innerHTML string:

```javascript
el.innerHTML =
  '<div class="sp-analysis" id="s-analysis" style="display:none">' +
  '<div class="sp-analysis-row" id="s-stage-row" style="display:none"><span class="sp-analysis-label">Stage</span><span class="sp-analysis-value" id="s-stage-val"></span></div>' +
  '<div class="sp-analysis-row" id="s-energy-row" style="display:none"><span class="sp-analysis-label">Energy</span><span class="sp-analysis-value" id="s-energy-val"></span></div>' +
  '<div class="sp-analysis-row" id="s-read-row" style="display:none"><span class="sp-analysis-label">Read</span><span class="sp-analysis-value" id="s-read-val"></span></div>' +
  "</div>" +
  '<div class="sp-messages" id="s-messages" style="display:none"></div>';
```

Changes:
- Reasoning section (`s-reasoning` div with "Why this works") removed entirely
- "Energy" label and `s-energy-*` IDs kept unchanged — this is the deeprip/quickrip streaming path, where "energy" is the correct backend field name. The "Match" rename only applies to the smartrip final render via `buildAnalysisHtml()`.

**4b. `updateStreamDom()`** — no changes to energy block (IDs remain `s-energy-row` / `s-energy-val`).

**4c. Remove reasoning block from `updateStreamDom()`** (lines 852-860):

Delete the entire reasoning block:

```javascript
// DELETE:
var reasoning = jsonExtractString(json, "reasoning");
if (reasoning) {
  var rEl = document.getElementById("s-reasoning");
  var rVal = document.getElementById("s-reasoning-val");
  if (rEl) rEl.style.display = "";
  if (rVal) rVal.textContent = reasoning.value;
  if (!reasoning.done) setStreamCursor("s-reasoning-val");
  else if (streamActiveField === "s-reasoning-val") setStreamCursor(null);
}
```

**Note on streaming path scope:** The streaming DOM is the deeprip/quickrip path. The "Energy" label and `s-energy-*` IDs are intentionally preserved — "energy" is the correct field name for these backends. The "Match" rename only applies to smartrip's final render via `buildAnalysisHtml()`. No color-coding during streaming — the `energy` field from deeprip/quickrip JSON is a string (e.g., "75% confidence"), not a raw number.

---

#### Task 5: Update CSS (add warning row, remove dead reasoning styles)

**File: `sidepanel/sidepanel.css`**

**5a.** Delete `.sp-reasoning`, `.sp-reasoning-label`, and `.sp-reasoning-text` rules (lines 844-869). These are dead CSS after Task 3b removes the "Why this works" HTML.

**5b.** Add after `.sp-analysis-value` block (after line 607):

```css
.sp-warning-row {
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: 4px;
  padding: 6px 8px;
  margin-top: 4px;
}

.sp-warning-row .sp-analysis-label {
  color: var(--warning);
}

.sp-warning-row .sp-analysis-value {
  color: var(--warning);
}

.sp-analysis-label[title] {
  cursor: help;
  text-decoration: underline dotted var(--text-faint);
  text-underline-offset: 2px;
}
```

Uses existing CSS variables (`--warning`, `--warning-bg`, `--warning-border`) already defined at lines 33-35. The warning row is an `sp-analysis-row` with additional amber styling — inherits flex layout, font size, gap from the parent class.

The `[title]` selector automatically applies to any analysis label with a tooltip (currently only Match). The dotted underline in `--text-faint` (`#52525b`) is subtle enough to not compete with the label text but visible enough to signal interactivity. `cursor: help` reinforces on hover.

---

#### Task 6: Write unit tests

**File: `tests/unit/analysis-panel.test.js`** (new)

```javascript
import { describe, it, expect } from "vitest";
import { formatMatchValue, buildAnalysisHtml, MATCH_TOOLTIP } from "../../sidepanel/helpers.js";

describe("Analysis Panel (B2)", () => {
  describe("formatMatchValue", () => {
    it("returns green for 60%+", () => {
      const result = formatMatchValue(0.75);
      expect(result.text).toBe("75%");
      expect(result.color).toBe("#3fb950");
    });

    it("returns yellow for 40-59%", () => {
      const result = formatMatchValue(0.5);
      expect(result.text).toBe("50%");
      expect(result.color).toBe("#d29922");
    });

    it("returns red for <40%", () => {
      const result = formatMatchValue(0.3);
      expect(result.text).toBe("30%");
      expect(result.color).toBe("#f85149");
    });

    it("handles boundary at 60%", () => {
      const result = formatMatchValue(0.6);
      expect(result.color).toBe("#3fb950");
    });

    it("handles boundary at 40%", () => {
      const result = formatMatchValue(0.4);
      expect(result.color).toBe("#d29922");
    });

    it("handles zero confidence", () => {
      const result = formatMatchValue(0);
      expect(result.text).toBe("0%");
      expect(result.color).toBe("#f85149");
    });

    it("handles null/undefined confidence", () => {
      expect(formatMatchValue(null).text).toBe("0%");
      expect(formatMatchValue(undefined).text).toBe("0%");
    });
  });

  describe("buildAnalysisHtml", () => {
    it("renders Match label (not Energy)", () => {
      const html = buildAnalysisHtml({ stage: "qualify", match: 0.75, realMeaning: "test" });
      expect(html).toContain("Match");
      expect(html).not.toContain("Energy");
    });

    it("applies green color for high match", () => {
      const html = buildAnalysisHtml({ match: 0.75 });
      expect(html).toContain('style="color:#3fb950"');
      expect(html).toContain("75%");
    });

    it("applies yellow color for moderate match", () => {
      const html = buildAnalysisHtml({ match: 0.5 });
      expect(html).toContain('style="color:#d29922"');
    });

    it("applies red color for low match", () => {
      const html = buildAnalysisHtml({ match: 0.25 });
      expect(html).toContain('style="color:#f85149"');
    });

    it("includes tooltip on Match label", () => {
      const html = buildAnalysisHtml({ match: 0.5 });
      expect(html).toContain('title="');
      expect(html).toContain("closed-won patterns");
    });

    it("renders warning row when warning exists", () => {
      const html = buildAnalysisHtml({ match: 0.5, warning: "Low match", warningFix: "Add context" });
      expect(html).toContain("sp-warning-row");
      expect(html).toContain("Low match");
      expect(html).toContain("<strong>Fix:</strong> Add context");
    });

    it("renders warning row without Fix line when warningFix is absent", () => {
      const html = buildAnalysisHtml({ match: 0.5, warning: "Low match", warningFix: null });
      expect(html).toContain("sp-warning-row");
      expect(html).toContain("Low match");
      expect(html).not.toContain("Fix:");
    });

    it("omits warning row when no warning", () => {
      const html = buildAnalysisHtml({ match: 0.5, warning: null });
      expect(html).not.toContain("sp-warning-row");
      expect(html).not.toContain("Warning");
    });

    it("does not contain Why this works", () => {
      const html = buildAnalysisHtml({ match: 0.5, realMeaning: "reasoning text" });
      expect(html).not.toContain("Why this works");
    });

    it("returns empty string for null analysis", () => {
      expect(buildAnalysisHtml(null)).toBe("");
    });

    it("escapes HTML in values", () => {
      const html = buildAnalysisHtml({ stage: "<script>alert(1)</script>", match: 0.5 });
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });
});
```

18 tests covering:
- Color thresholds (green/yellow/red) with boundary values
- Null/undefined confidence handling
- Label rename (Match not Energy)
- Tooltip presence
- Warning row conditional rendering
- Warning fix display
- "Why this works" absence
- HTML escaping (XSS prevention)

---

### Error Handling

No new error handling. Changes are presentational:
- Null/undefined `match` defaults to 0 (red, 0%)
- Null `warning` omits the row entirely
- HTML escaping prevents XSS in all analysis values

---

## Testing Requirements

### Critical Test Cases

See Task 6 above — 18 unit tests in `tests/unit/analysis-panel.test.js`.

### Manual Verification

- [ ] Smartrip response shows "Match" label (not "Energy")
- [ ] High-confidence response (60%+) shows green Match value
- [ ] Medium-confidence response (40-59%) shows yellow Match value
- [ ] Low-confidence response (<40%) shows red Match value
- [ ] Hover on "Match" label shows tooltip text
- [ ] Response with `warning` shows amber warning row
- [ ] Response with `warning` + `warning_fix` shows "Fix: ..." in warning row
- [ ] Response without `warning` shows no warning row
- [ ] "Why this works" section no longer appears in any response
- [ ] Deeprip/quickrip responses still render correctly (reply only, no analysis)
- [ ] Streaming smartrip shows message cards during stream, analysis in final render
- [ ] Streaming deeprip/quickrip JSON DOM still shows "Energy" label (unchanged)
- [ ] Closer-bot toggle still works (no regression)
- [ ] All existing tests pass (`npm test`)

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| `confidence` is 0 | Match shows "0%" in red. Valid — no KB match found. |
| `confidence` is null/undefined | `formatMatchValue` defaults to 0. Shows "0%" in red. |
| `confidence` is exactly 0.4 | Yellow (40% threshold is inclusive). |
| `confidence` is exactly 0.6 | Green (60% threshold is inclusive). |
| `warning` without `warning_fix` | Warning row shows warning text only. No "Fix:" line. |
| `warning_fix` without `warning` | No warning row rendered (`analysis.warning` is falsy). |
| Deeprip/quickrip with analysis | Rendered normally via `showReply`. Unlikely but handled. |
| XSS in analysis fields | `escHtml()` escapes `<`, `>`, `&`, `"` in all values. |

---

## Dependencies & Constraints

### External Dependencies

None. All changes are in the extension codebase.

### Constraints

- `sidepanel/helpers.js` must load before `sidepanel/sidepanel.js` in the HTML
- CJS export guard (`typeof module`) required for Vitest compatibility
- Streaming DOM does not color-code MATCH (partial string parsing is fragile; deeprip/quickrip rarely return analysis)
- Backend response format (`data.confidence`, `data.warning`, `data.warning_fix`) is stable — Alfie owns the smartrip backend

---

## Files Modified Summary

| File | Change |
|------|--------|
| `background/service-worker.js` | Restructure analysis object: `energy` -> `match` (raw float), add `warning`/`warningFix`, set `reasoning: null`. Two call sites. |
| `sidepanel/helpers.js` (new) | Extract `formatMatchValue()`, `buildAnalysisHtml()`, `escHtml()`, `MATCH_TOOLTIP`. CJS export for Vitest. |
| `sidepanel/sidepanel.html` | Add `<script src="helpers.js"></script>` before sidepanel.js |
| `sidepanel/sidepanel.js` | `showReply()`: use `buildAnalysisHtml()`, remove "Why this works". `buildStreamDom()`: remove reasoning section (Energy label unchanged). `updateStreamDom()`: remove reasoning block (energy IDs unchanged). |
| `sidepanel/sidepanel.css` | Delete dead `.sp-reasoning` styles (lines 844-869). Add `.sp-warning-row` styles (amber background/border/text using existing CSS variables). |
| `tests/unit/analysis-panel.test.js` (new) | 18 unit tests for formatMatchValue + buildAnalysisHtml |

---

## Open Questions

None — all clarified during spec consultation.
