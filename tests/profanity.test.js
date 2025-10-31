"use strict";
const { suite, test, expect } = require("./harness");
const { sanitizeText } = require("../src/profanity");

suite("profanity sanitizeText", function () {
  test("empty or whitespace returns empty text and not flagged", function () {
    expect(sanitizeText("").flagged).toBe(false);
    expect(sanitizeText("   ").text).toBe("");
  });

  test("normalization removes NUL and CRs", function () {
    const out = sanitizeText("Hi\u0000\r\nThere");
    expect(out.text.indexOf("\u0000") === -1).toBeTruthy();
    expect(out.text.indexOf("\r") === -1).toBeTruthy();
  });

  test("flags known profane term", function () {
    const out = sanitizeText("This is shit");
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  test("flags simple XSS pattern <script>", function () {
    const out = sanitizeText("<script>alert(1)</script>");
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  test("collapses long spaces to two", function () {
    const out = sanitizeText("hello   world");
    expect(out.text).toBe("hello  world");
  });
});

