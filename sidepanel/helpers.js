function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMatchValue(confidence) {
  const pct = Math.round((confidence || 0) * 100);
  let color = "#f85149"; // red (<40%)
  if (pct >= 60) color = "#3fb950"; // green
  else if (pct >= 40) color = "#d29922"; // yellow
  return { text: `${pct}%`, color: color };
}

const MATCH_TOOLTIP =
  "How closely this conversation matches proven closed-won patterns. " +
  "KB examples are always used \u2014 higher scores mean more relevant matches.";

function buildAnalysisHtml(analysis) {
  if (!analysis) return "";
  const m = formatMatchValue(analysis.match);
  let html = '<div class="sp-analysis">';
  html +=
    '<div class="sp-analysis-row"><span class="sp-analysis-label">Stage</span>' +
    `<span class="sp-analysis-value">${escHtml(analysis.stage || "")}</span></div>`;
  html +=
    `<div class="sp-analysis-row"><span class="sp-analysis-label" title="${escHtml(MATCH_TOOLTIP)}">Match</span>` +
    `<span class="sp-analysis-value" style="color:${m.color}">${m.text}</span></div>`;
  html +=
    '<div class="sp-analysis-row"><span class="sp-analysis-label">Read</span>' +
    `<span class="sp-analysis-value">${escHtml(analysis.realMeaning || "")}</span></div>`;
  if (analysis.warning) {
    html += '<div class="sp-analysis-row sp-warning-row">';
    html += '<span class="sp-analysis-label">Warning</span>';
    html += `<span class="sp-analysis-value">${escHtml(analysis.warning)}`;
    if (analysis.warningFix) html += `<br><strong>Fix:</strong> ${escHtml(analysis.warningFix)}`;
    html += "</span></div>";
  }
  html += "</div>";
  return html;
}

if (typeof module !== "undefined") {
  module.exports = { escHtml, formatMatchValue, buildAnalysisHtml, MATCH_TOOLTIP };
}
