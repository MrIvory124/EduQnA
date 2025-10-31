"use strict";
const { suite, test, expect } = require("./harness");
const { createRateLimiter } = require("../src/rateLimiter");

suite("rateLimiter", function () {
  test("allows up to max within window", function () {
    const limiter = createRateLimiter({ windowMs: 50, max: 3 });
    const key = "k1";
    expect(limiter(key)).toBe(false);
    expect(limiter(key)).toBe(false);
    expect(limiter(key)).toBe(false);
    expect(limiter(key)).toBe(true);
  });

  test("resets after window", async function () {
    const limiter = createRateLimiter({ windowMs: 30, max: 1 });
    const key = "k2";
    expect(limiter(key)).toBe(false);
    expect(limiter(key)).toBe(true);
    await new Promise(r => setTimeout(r, 40));
    expect(limiter(key)).toBe(false);
  });

  test("separate keys tracked independently", function () {
    const limiter = createRateLimiter({ windowMs: 100, max: 1 });
    expect(limiter("a")).toBe(false);
    expect(limiter("b")).toBe(false);
    expect(limiter("a")).toBe(true);
    expect(limiter("b")).toBe(true);
  });

  test("many keys cleanup does not throw", async function () {
    const limiter = createRateLimiter({ windowMs: 10, max: 1 });
    for (let i = 0; i < 20; i++) {
      limiter("key-" + i);
    }
    await new Promise(r => setTimeout(r, 20));
    // after cleanup cycle, new hit allowed
    expect(limiter("key-5")).toBe(false);
  });

  test("immediate burst over max is limited", function () {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    const k = "burst";
    expect(limiter(k)).toBe(false);
    expect(limiter(k)).toBe(false);
    expect(limiter(k)).toBe(true);
  });
});

