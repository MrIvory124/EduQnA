"use strict";
const { suite, test, expect, assert } = require("./harness");
const config = require("../src/config");

suite("config constants", function () {
  test("PORT default is number or stringifiable", function () {
    expect(Number.isNaN(Number(config.PORT))).toBe(false);
  });
  test("SESSION_MIN_DURATION <= SESSION_MAX_DURATION", function () {
    assert(config.SESSION_MIN_DURATION <= config.SESSION_MAX_DURATION, "min should be <= max");
  });
  test("PASSWORD_LENGTH positive", function () {
    expect(config.PASSWORD_LENGTH > 0).toBeTruthy();
  });
  test("MAX_SESSION_NAME_LENGTH sane", function () {
    expect(config.MAX_SESSION_NAME_LENGTH >= 10).toBeTruthy();
  });
  test("ADJECTIVES non-empty list", function () {
    expect(Array.isArray(config.ADJECTIVES)).toBeTruthy();
    expect(config.ADJECTIVES.length > 0).toBeTruthy();
  });
  test("NOUNS non-empty list", function () {
    expect(Array.isArray(config.NOUNS)).toBeTruthy();
    expect(config.NOUNS.length > 0).toBeTruthy();
  });
});

