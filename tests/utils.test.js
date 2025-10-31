"use strict";
const { suite, test, expect, assert } = require("./harness");
const { now, generateId, generatePassword, extractClientKey, normalizeParticipantId, sanitizeSessionName, generateFriendlyName } = require("../src/utils");

suite("utils", function () {
  test("now returns ms timestamp close to Date.now()", function () {
    const a = Date.now();
    const b = now();
    expect(typeof b).toBe("number");
    expect(Math.abs(b - a) < 50).toBeTruthy();
  });

  test("generateId returns specific length and is hex-ish", function () {
    const id = generateId(12);
    expect(id.length).toBe(12);
    expect(/^[a-f0-9]+$/i.test(id)).toBeTruthy();
  });

  test("generatePassword returns correct length and urlsafe", function () {
    const pw = generatePassword(6);
    expect(pw.length).toBe(6);
    // base64url charset
    expect(/^[A-Za-z0-9_-]+$/.test(pw)).toBeTruthy();
  });

  test("extractClientKey prefers x-forwarded-for first ip", function () {
    const req = { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } };
    expect(extractClientKey(req)).toBe("1.1.1.1");
  });

  test("extractClientKey falls back to req.ip", function () {
    const req = { headers: {}, ip: "3.3.3.3" };
    expect(extractClientKey(req)).toBe("3.3.3.3");
  });

  test("normalizeParticipantId accepts safe id", function () {
    expect(normalizeParticipantId("User-123")).toBe("User-123");
  });

  test("normalizeParticipantId rejects invalid characters", function () {
    expect(normalizeParticipantId("bad id")).toBe(null);
  });

  test("sanitizeSessionName trims, strips < > and newlines, and length", function () {
    const name = sanitizeSessionName("  <Hello>\nWorld  ");
    expect(name).toBe("HelloWorld");
  });

  test("generateFriendlyName returns adjective noun", function () {
    const s = generateFriendlyName();
    expect(/^[a-z]+\s+[a-z]+$/i.test(s)).toBeTruthy();
  });
});

