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
