"use strict";
const { suite, test, expect } = require("./harness");
const { attachSocketHandlers } = require("../src/sockets");
const store = require("../src/store/sessions");

function makeFakeIo() {
  const state = { middlewares: [], connections: [], emits: [] };
  return {
    state,
    use(fn) { state.middlewares.push(fn); },
    on(event, fn) {
      if (event === "connection") state.onConnection = fn;
    },
    to(room) {
      return { emit: (event, payload) => state.emits.push({ room, event, payload }) };
    }
  };
}

function makeSocket(query, roleExpect) {
  const handlers = {};
  return {
    id: "sock1",
    data: {},
    handshake: { query },
    join() {},
    emit(event, payload) { handlers.__emits = handlers.__emits || []; handlers.__emits.push({ event, payload }); },
    on(event, fn) { handlers[event] = fn; },
    disconnect() { handlers.__disconnected = true; },
    _handlers: handlers
  };
}

suite("sockets", function () {
  test("middleware rejects missing sessionId", function () {
    const io = makeFakeIo();
    attachSocketHandlers(io);
    const mw = io.state.middlewares[0];
    const sock = makeSocket({}, null);
    mw(sock, (err) => {
      expect(err instanceof Error).toBe(true);
    });
  });

  test("admin key authenticates as admin role", function () {
    const session = store.createSession(5, "S");
    const io = makeFakeIo();
    attachSocketHandlers(io);
    const mw = io.state.middlewares[0];
    const sock = makeSocket({ sessionId: session.id, adminKey: session.adminKey }, null);
    mw(sock, (err) => { expect(!err).toBeTruthy(); });
    expect(sock.data.role).toBe("admin");
  });

  test("question:add adds question and emits session:update", function () {
    const session = store.createSession(5, "S2");
    const io = makeFakeIo();
    attachSocketHandlers(io);
    const mw = io.state.middlewares[0];
    const sock = makeSocket({ sessionId: session.id, password: session.joinPassword, participantId: "u1" }, null);
    mw(sock, () => {});
    io.state.onConnection(sock);
    // Trigger question:add
    sock._handlers["question:add"]({ text: "Hello world", authorAlias: "A" });
    // Broadcast should include session:update
    const anyUpdate = io.state.emits.some(e => e.event === "session:update");
    expect(anyUpdate).toBe(true);
  });

  test("question:upvote increments upvotes", function () {
    const session = store.createSession(5, "S3");
    const io = makeFakeIo();
    attachSocketHandlers(io);
    const mw = io.state.middlewares[0];
    const sock = makeSocket({ sessionId: session.id, password: session.joinPassword, participantId: "u2" }, null);
    mw(sock, () => {});
    io.state.onConnection(sock);
    // Add a question first
    sock._handlers["question:add"]({ text: "Hi" });
    const q = Array.from(session.questions.values())[0];
    const before = q.upvotes.size;
    sock._handlers["question:upvote"]({ questionId: q.id });
    expect(q.upvotes.size).toBe(before + 1);
  });

  test("flagged question triggers moderation:flagged to admin room", function () {
    const session = store.createSession(5, "S4");
    const io = makeFakeIo();
    attachSocketHandlers(io);
    const mw = io.state.middlewares[0];
    const sock = makeSocket({ sessionId: session.id, password: session.joinPassword }, null);
    mw(sock, () => {});
    io.state.onConnection(sock);
    sock._handlers["question:add"]({ text: "<script>alert(1)</script>" });
    const flagged = io.state.emits.some(e => e.event === "moderation:flagged");
    expect(flagged).toBe(true);
  });
});

