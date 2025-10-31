"use strict";

const express = require("express");
const { SESSION_MIN_DURATION, SESSION_MAX_DURATION } = require("../config");
const { extractClientKey } = require("../utils");
const { createSession, getSession, ensureSessionStatus, formatSession } = require("../store/sessions");

/**
 * Builds an Express router with session-related REST endpoints.
 * @param {{ sessionCreationLimiter: (key:string)=>boolean }} deps
 * @returns {import('express').Router}
 */
function createSessionsRouter(deps) {
  var router = express.Router();

  /**
   * Lists all active sessions for the homepage display.
   */
  router.get("/sessions", function listSessions(req, res) {
    var activeSessions = [];
    // Iterate all sessions and collect the active ones
    // We access the store indirectly via ensureSessionStatus on getSession.
    // Since we don't have a direct listing function here, we will require it from the store in the server bootstrap.
    // This route will be wired to provide data via dependency injection in server.js if needed.
    if (typeof req.app.locals.forEachSession === "function") {
      req.app.locals.forEachSession(function onSession(session) {
        if (ensureSessionStatus(session) === "active") {
          activeSessions.push({
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt
          });
        }
      });
    }
    activeSessions.sort(function sortByCreated(b, a) {
      return a.createdAt - b.createdAt;
    });
    res.json({ sessions: activeSessions });
  });

  /**
   * Creates a new session. Returns admin and attendee URLs and password.
   */
  router.post("/sessions", function postSession(req, res) {
    var body = req.body || {};
    var expiresInMinutes = body.expiresInMinutes;
    var name = body.name;
    var clientKey = extractClientKey(req);
    if (deps.sessionCreationLimiter(clientKey)) {
      res.status(429).json({ message: "Too many sessions created from this address. Please wait a moment." });
      return;
    }
    var parsedMinutes = Number.parseInt(expiresInMinutes, 10);
    if (Number.isNaN(parsedMinutes)) {
      res.status(400).json({ message: "expiresInMinutes must be a number" });
      return;
    }
    if (parsedMinutes < SESSION_MIN_DURATION || parsedMinutes > SESSION_MAX_DURATION) {
      res.status(400).json({ message: "expiresInMinutes must be between " + SESSION_MIN_DURATION + " and " + SESSION_MAX_DURATION });
      return;
    }
    var session = createSession(parsedMinutes, name);
    var attendeePath = "/session.html?sessionId=" + session.id + "&password=" + session.joinPassword;
    var adminPath = "/admin.html?sessionId=" + session.id + "&key=" + session.adminKey;
    res.status(201).json({
      sessionId: session.id,
      adminKey: session.adminKey,
      joinPassword: session.joinPassword,
      name: session.name,
      expiresAt: session.expiresAt,
      attendeePath: attendeePath,
      adminPath: adminPath
    });
  });

  /**
   * Attendee fetch; validates password and session state.
   */
  router.get("/sessions/:id", function getSessionAttendee(req, res) {
    var session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    if (session.status === "expired") {
      res.status(410).json({ message: "Session expired" });
      return;
    }
    if (session.status !== "active") {
      res.status(409).json({ message: "Session is not active" });
      return;
    }

    var rawPassword = null;
    if (req.query) {
      rawPassword = req.query.password;
    }
    var password = "";
    if (typeof rawPassword === "string") {
      password = rawPassword.trim();
    }
    if (!password || password.length > 128 || password !== session.joinPassword) {
      res.status(403).json({ message: "Invalid session password" });
      return;
    }

    res.json(formatSession(session));
  });

  /**
   * Admin fetch; validates admin key and includes join details.
   */
  router.get("/sessions/:id/admin", function getSessionAdmin(req, res) {
    var session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    var rawKey = null;
    if (req.query) {
      rawKey = req.query.key;
    }
    var key = "";
    if (typeof rawKey === "string") {
      key = rawKey.trim();
    }
    if (!key || key.length > 128 || key !== session.adminKey) {
      res.status(403).json({ message: "Invalid admin key" });
      return;
    }
    var formatted = formatSession(session);
    res.json({
      id: formatted.id,
      name: formatted.name,
      status: formatted.status,
      createdAt: formatted.createdAt,
      expiresAt: formatted.expiresAt,
      questions: formatted.questions,
      joinPassword: session.joinPassword,
      attendeePath: "/session.html?sessionId=" + session.id + "&password=" + session.joinPassword
    });
  });

  return router;
}

module.exports = {
  createSessionsRouter
};
