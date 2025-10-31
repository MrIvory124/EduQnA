"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const config = require("./config");
const { createRateLimiter } = require("./rateLimiter");
const { forEachSession } = require("./store/sessions");
const { now } = require("./utils");
const { attachSocketHandlers, broadcastSession } = require("./sockets");
const { createSessionsRouter } = require("./routes/sessionsRoutes");

// Initialize core services
var app = express();
var server = http.createServer(app);
var io = new Server(server);

// App Security and JSON parsing
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(function headers(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});
app.use(express.static(path.join(__dirname, "..", "public")));

// Rate limiting
var sessionCreationLimiter = createRateLimiter({
  windowMs: config.SESSION_CREATE_WINDOW_MS,
  max: config.SESSION_CREATE_MAX
});

// Make session iteration available to routes
app.locals.forEachSession = forEachSession;

// REST routes
app.use("/api", createSessionsRouter({ sessionCreationLimiter: sessionCreationLimiter }));

// WebSocket handlers
attachSocketHandlers(io);

// Expiry watcher
setInterval(function expiryTick() {
  var timestamp = now();
  forEachSession(function eachSession(session) {
    if (session.status === "active" && session.expiresAt <= timestamp) {
      session.status = "expired";
      broadcastSession(io, session);
    }
  });
}, 30000).unref();

server.listen(config.PORT, function onListen() {
  // eslint-disable-next-line no-console
  console.log("Lecture Q&A prototype running on http://localhost:" + config.PORT);
});

