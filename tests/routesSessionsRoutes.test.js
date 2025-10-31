"use strict";
const http = require("http");
const express = require("express");
const { suite, test, expect } = require("./harness");
const { createSessionsRouter } = require("../src/routes/sessionsRoutes");
const store = require("../src/store/sessions");

function makeServer(sessionCreationLimiter) {
  const app = express();
  app.use(express.json());
  app.locals.forEachSession = store.forEachSession;
  app.use("/api", createSessionsRouter({ sessionCreationLimiter }));
  const server = http.createServer(app);
  return server;
}

function requestJSON(server, method, path, body) {
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const port = server.address().port;
      const data = body ? Buffer.from(JSON.stringify(body)) : null;
      const req = http.request({ method, path, host: "127.0.0.1", port, headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try { json = JSON.parse(buf.toString() || "null"); } catch (e) {}
          resolve({ status: res.statusCode, json });
          server.close();
        });
      });
      req.on("error", (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

suite("routes/sessionsRoutes", function () {
  test("GET /api/sessions lists active sessions array", async function () {
    const srv = makeServer(() => false);
    // Ensure at least one session exists
    store.createSession(5, "R1");
    const res = await requestJSON(srv, "GET", "/api/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.sessions)).toBeTruthy();
  });

  test("POST /api/sessions creates a session with 201", async function () {
    const srv = makeServer(() => false);
    const res = await requestJSON(srv, "POST", "/api/sessions", { expiresInMinutes: 5, name: "Lecture" });
    expect(res.status).toBe(201);
    expect(typeof res.json.sessionId).toBe("string");
    expect(typeof res.json.attendeePath).toBe("string");
    expect(typeof res.json.adminPath).toBe("string");
  });

  test("POST /api/sessions validates minutes and limits", async function () {
    const srv1 = makeServer(() => false);
    const bad = await requestJSON(srv1, "POST", "/api/sessions", { expiresInMinutes: "NaN" });
    expect(bad.status).toBe(400);

    const srv2 = makeServer(() => true); // forced limit
    const limited = await requestJSON(srv2, "POST", "/api/sessions", { expiresInMinutes: 5 });
    expect(limited.status).toBe(429);
  });

  test("GET attendee endpoint enforces password", async function () {
    const srv = makeServer(() => false);
    const created = await requestJSON(srv, "POST", "/api/sessions", { expiresInMinutes: 5, name: "X" });
    const id = created.json.sessionId;
    const wrong = await requestJSON(srv, "GET", `/api/sessions/${id}?password=wrong`);
    expect(wrong.status).toBe(403);
  });

  test("GET admin endpoint returns join details with correct key", async function () {
    const srv = makeServer(() => false);
    const created = await requestJSON(srv, "POST", "/api/sessions", { expiresInMinutes: 5, name: "X" });
    const id = created.json.sessionId;
    const key = created.json.adminKey;
    const res = await requestJSON(srv, "GET", `/api/sessions/${id}/admin?key=${encodeURIComponent(key)}`);
    expect(res.status).toBe(200);
    expect(typeof res.json.joinPassword).toBe("string");
    expect(typeof res.json.attendeePath).toBe("string");
  });
});

