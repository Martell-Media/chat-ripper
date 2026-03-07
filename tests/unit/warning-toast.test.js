import { describe, it, expect } from "vitest";
const { shouldShowInsertWarning, INSERT_WARNING_MSG } = require("../../sidepanel/helpers.js");

describe("shouldShowInsertWarning", () => {
  it("returns true for revio with contactId and active agent", () => {
    expect(shouldShowInsertWarning("revio", "ct_123", true)).toBe(true);
  });

  it("returns false when agent is not active", () => {
    expect(shouldShowInsertWarning("revio", "ct_123", false)).toBe(false);
  });

  it("returns false for non-revio platform", () => {
    expect(shouldShowInsertWarning("linkedin", "ct_123", true)).toBe(false);
  });

  it("returns false when contactId is null", () => {
    expect(shouldShowInsertWarning("revio", null, true)).toBe(false);
  });

  it("returns false when contactId is empty string", () => {
    expect(shouldShowInsertWarning("revio", "", true)).toBe(false);
  });

  it("returns false when all conditions are false", () => {
    expect(shouldShowInsertWarning("gmail", null, false)).toBe(false);
  });
});

describe("INSERT_WARNING_MSG", () => {
  it("is a non-empty string", () => {
    expect(typeof INSERT_WARNING_MSG).toBe("string");
    expect(INSERT_WARNING_MSG.length).toBeGreaterThan(0);
  });

  it("mentions bot and sending", () => {
    expect(INSERT_WARNING_MSG).toContain("Bot");
    expect(INSERT_WARNING_MSG).toContain("sending");
  });
});
