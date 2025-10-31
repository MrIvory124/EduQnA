"use strict";
const { suite, test, expect, assert } = require("./harness");
const store = require("../src/store/sessions");
const { now } = require("../src/utils");

suite("store/sessions", function () {
  test("createSession creates active session with expected fields", function () {
    const s = store.createSession(5, "My Session");
    expect(typeof s.id).toBe("string");
    expect(s.status).toBe("active");
    expect(typeof s.joinPassword).toBe("string");
    expect(s.name).toBe("My Session");
    expect(s.questions instanceof Map).toBeTruthy();
  });

  test("getSession returns same object and updates status on expiry", function () {
    const s = store.createSession(0, "Short");
    // force expiration
    s.expiresAt = now() - 1;
    const fetched = store.getSession(s.id);
    expect(fetched.status).toBe("expired");
  });

  test("formatQuestion maps fields correctly", function () {
    const q = { id: "q1", text: "hi", createdAt: now(), authorAlias: undefined, upvotes: new Set(["a"]), status: "open", flagged: true, flaggedReasons: ["t"] };
    const f = store.formatQuestion(q);
    expect(f.authorAlias).toBe(null);
    expect(f.upvotes).toBe(1);
    expect(f.moderation).toBe("needs_review");
    expect(f.flagged).toBe(true);
  });

  test("formatSession sorts questions by votes then time", function () {
    const s = store.createSession(5, "Sort");
    const q1 = { id: "1", text: "a", createdAt: 1, upvotes: new Set(["x"]), status: "open" };
    const q2 = { id: "2", text: "b", createdAt: 2, upvotes: new Set(["x","y"]), status: "open" };
    const q3 = { id: "3", text: "c", createdAt: 0, upvotes: new Set(["x"]), status: "open" };
    s.questions.set("1", q1);
    s.questions.set("2", q2);
    s.questions.set("3", q3);
    const f = store.formatSession(s);
    expect(f.questions[0].id).toBe("2");
    expect(f.questions[1].id).toBe("3");
    expect(f.questions[2].id).toBe("1");
  });

  test("forEachSession visits created sessions", function () {
    const seen = [];
    store.forEachSession(function (sess) { seen.push(sess.id); });
    expect(Array.isArray(seen)).toBeTruthy();
    expect(seen.length > 0).toBeTruthy();
  });
});

