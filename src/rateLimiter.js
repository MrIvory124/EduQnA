"use strict";

const { now } = require("./utils");

/**
 * Creates an in-memory sliding-window rate limiter.
 * Returns a function that, given a key, returns true if the limit was exceeded.
 *
 * @param {{ windowMs: number, max: number }} options
 * @returns {(key: string) => boolean}
 */
function createRateLimiter(options) {
  var windowMs = options.windowMs;
  var max = options.max;
  var hits = new Map();

  setInterval(function intervalCleanup() {
    var ts = now();
    hits.forEach(function forEachEntry(entry, key) {
      if (entry.resetAt <= ts) {
        hits.delete(key);
      }
    });
  }, windowMs).unref();

  return function limit(key) {
    var ts = now();
    var entry = hits.get(key);
    if (!entry || entry.resetAt <= ts) {
      hits.set(key, { count: 1, resetAt: ts + windowMs });
      return false;
    }
    entry.count = entry.count + 1;
    if (entry.count > max) {
      return true;
    }
    return false;
  };
}

module.exports = {
  createRateLimiter
};

