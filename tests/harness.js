"use strict";

const results = [];
let currentSuite = null;

function suite(name, fn) {
  const prev = currentSuite;
  currentSuite = name;
  try { fn(); } finally { currentSuite = prev; }
}

function test(name, fn) {
  const fullName = (currentSuite ? currentSuite + " :: " : "") + name;
  const start = Date.now();
  try {
    const maybe = fn();
    if (maybe && typeof maybe.then === "function") {
      // Promise-like, wrap
      return maybe.then(() => {
        results.push({ name: fullName, ok: true, ms: Date.now() - start });
      }).catch((err) => {
        results.push({ name: fullName, ok: false, error: err, ms: Date.now() - start });
      });
    }
    results.push({ name: fullName, ok: true, ms: Date.now() - start });
  } catch (err) {
    results.push({ name: fullName, ok: false, error: err, ms: Date.now() - start });
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual: (expected) => {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected ${a} to equal ${b}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected value to be truthy, got ${actual}`);
    },
    toBeFalsey: () => {
      if (actual) throw new Error(`Expected value to be falsey, got ${actual}`);
    },
    toMatch: (regex) => {
      if (!regex.test(String(actual))) {
        throw new Error(`Expected ${actual} to match ${regex}`);
      }
    },
    toBeGreaterThan: (n) => {
      if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThan: (n) => {
      if (!(actual < n)) throw new Error(`Expected ${actual} < ${n}`);
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

async function runAll(testModules) {
  for (const mod of testModules) {
    // Await any async tests registered
    for (const r of results.filter(r => r && r.pending)) {
      // no-op placeholder (unused)
      await r.pending;
    }
  }
  // Wait a tick for any stray microtasks in tests
  await new Promise((r) => setTimeout(r, 0));
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  for (const r of results) {
    if (r.ok) {
      console.log(`ok - ${r.name} (${r.ms}ms)`);
    } else {
      console.error(`not ok - ${r.name} (${r.ms}ms)\n  ${r.error && r.error.stack || r.error}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) process.exit(1);
}

module.exports = { suite, test, expect, assert, runAll };

