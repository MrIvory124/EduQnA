"use strict";

const { ADMIN_ROOM_SUFFIX, QUESTION_RATE_WINDOW_MS, QUESTION_RATE_MAX } = require("./config");
const { getSession, formatSession, ensureSessionStatus } = require("./store/sessions");
const { now, normalizeParticipantId } = require("./utils");
const { sanitizeQuestion } = require("./profanity");
const { generateId } = require("./utils");

/**
 * Broadcasts a session update to all clients in the session room.
 * @param {import('socket.io').Server} io
 * @param {any} session
 */
function broadcastSession(io, session) {
  var room = "session:" + session.id;
  io.to(room).emit("session:update", formatSession(session));
}

/**
 * Attaches Socket.IO middleware and event handlers for session interactions.
 * @param {import('socket.io').Server} io
 */
function attachSocketHandlers(io) {
  /**
   * Socket.IO middleware to authenticate and assign roles to connections.
   */
  io.use(function socketAuth(socket, next) {
    var query = socket.handshake.query || {};

    function pickString(value) {
      if (typeof value === "string") {
        return value;
      }
      if (Array.isArray(value) && value.length > 0) {
        var first = value[0];
        if (typeof first === "string") {
          return first;
        }
        return null;
      }
      return null;
    }

    var sessionId = pickString(query.sessionId);
    if (!sessionId) {
      next(new Error("Missing sessionId"));
      return;
    }
    var session = getSession(sessionId);
    if (!session) {
      next(new Error("Session not found"));
      return;
    }
    if (session.status !== "active") {
      next(new Error("Session inactive"));
      return;
    }

    var adminKeyRaw = pickString(query.adminKey);
    var adminKey = null;
    if (adminKeyRaw) {
      adminKey = adminKeyRaw.trim();
    }
    var passwordRaw = pickString(query.password);
    var password = null;
    if (passwordRaw) {
      password = passwordRaw.trim();
    }
    var participantIdInput = pickString(query.participantId);

    if (adminKey && adminKey.length > 128) {
      next(new Error("Invalid admin key"));
      return;
    }
    if (password && password.length > 128) {
      next(new Error("Invalid session password"));
      return;
    }

    socket.data.sessionId = sessionId;
    var normalizedParticipantId = normalizeParticipantId(participantIdInput);
    if (normalizedParticipantId) {
      socket.data.participantId = normalizedParticipantId;
    } else {
      socket.data.participantId = "socket-" + socket.id;
    }

    if (adminKey && adminKey === session.adminKey) {
      socket.data.role = "admin";
      next();
      return;
    }

    if (!password || password !== session.joinPassword) {
      next(new Error("Invalid session password"));
      return;
    }

    socket.data.role = "attendee";
    next();
  });

  /**
   * Handles a new socket connection and registers event listeners.
   */
  io.on("connection", function onConnection(socket) {
    var session = getSession(socket.data.sessionId);
    if (!session || session.status !== "active") {
      socket.emit("session:inactive");
      socket.disconnect();
      return;
    }

    var room = "session:" + session.id;
    socket.join(room);
    if (socket.data.role === "admin") {
      socket.join(room + ADMIN_ROOM_SUFFIX);
    }
    socket.emit("session:update", formatSession(session));

    /**
     * Tracks per-socket question submission rates to reduce spam.
     * @returns {boolean} true if the limit was exceeded.
     */
    function hitQuestionRateLimit() {
      var ts = now();
      var limiter = socket.data.questionLimiter;
      if (!limiter || limiter.resetAt <= ts) {
        socket.data.questionLimiter = { count: 1, resetAt: ts + QUESTION_RATE_WINDOW_MS };
        return false;
      }
      limiter.count = limiter.count + 1;
      if (limiter.count > QUESTION_RATE_MAX) {
        return true;
      }
      return false;
    }

    /**
     * Adds a new question from an attendee, applying sanitization and moderation flags.
     */
    socket.on("question:add", function onQuestionAdd(payload) {
      var data = payload || {};
      var currentSession = getSession(socket.data.sessionId);
      if (!currentSession || currentSession.status !== "active") {
        socket.emit("session:inactive");
        return;
      }

      var inputText = "";
      if (data.text !== undefined) {
        inputText = data.text;
      }
      var sanitized = sanitizeQuestion(String(inputText));
      var text = sanitized.text;
      var aliasRaw = data.authorAlias || "";
      var authorAlias = aliasRaw.toString().replace(/[<>]/g, "").trim().slice(0, 50);

      if (!text) {
        socket.emit("question:error", { message: "Question cannot be empty" });
        return;
      }
      if (text.length > 500) {
        socket.emit("question:error", { message: "Question is too long" });
        return;
      }
      if (hitQuestionRateLimit()) {
        socket.emit("question:error", { message: "Too many questions submitted quickly. Please wait a moment." });
        return;
      }

      var flaggedReasons = [];
      if (Array.isArray(sanitized.reasons)) {
        flaggedReasons = [].concat(sanitized.reasons);
      }
      var isFlagged = Boolean(sanitized.flagged);

      var question = {
        id: generateId(10),
        text: text,
        authorAlias: authorAlias,
        createdAt: now(),
        upvotes: new Set(),
        status: "open",
        flagged: isFlagged,
        flaggedReasons: flaggedReasons,
        moderation: isFlagged ? "needs_review" : "approved"
      };

      currentSession.questions.set(question.id, question);
      if (question.flagged) {
        var reasonText = flaggedReasons.length ? flaggedReasons.join("; ") : "automatic moderation trigger";
        // eslint-disable-next-line no-console
        console.warn("[moderation] flagged question " + question.id + " in session " + currentSession.id + ": " + reasonText);
        io.to(room + ADMIN_ROOM_SUFFIX).emit("moderation:flagged", {
          questionId: question.id,
          text: question.text,
          reasons: flaggedReasons
        });
      }

      broadcastSession(io, currentSession);
    });

    /**
     * Records an upvote for a question by the current participant.
     */
    socket.on("question:upvote", function onQuestionUpvote(payload) {
      var data = payload || {};
      var currentSession = getSession(socket.data.sessionId);
      if (!currentSession || currentSession.status !== "active") {
        socket.emit("session:inactive");
        return;
      }

      var questionId = data.questionId;
      if (!questionId) {
        return;
      }

      var question = currentSession.questions.get(questionId);
      if (!question || question.status !== "open") {
        return;
      }
      if (question.moderation !== "approved") {
        return;
      }

      var voterId = socket.data.participantId;
      question.upvotes.add(voterId);
      broadcastSession(io, currentSession);
    });

    /**
     * Admin action: marks a question as answered and clears moderation flags.
     */
    socket.on("question:answered", function onQuestionAnswered(payload) {
      if (socket.data.role !== "admin") {
        return;
      }
      var data = payload || {};
      var currentSession = getSession(socket.data.sessionId);
      if (!currentSession) {
        return;
      }
      var questionId = data.questionId;
      if (!questionId) {
        return;
      }
      var question = currentSession.questions.get(questionId);
      if (!question) {
        return;
      }
      question.status = "answered";
      question.flagged = false;
      question.flaggedReasons = [];
      question.moderation = "approved";
      broadcastSession(io, currentSession);
    });

    /**
     * Admin action: approves a previously flagged question so attendees can see it.
     */
    socket.on("question:approve", function onQuestionApprove(payload) {
      if (socket.data.role !== "admin") {
        return;
      }
      var data = payload || {};
      var currentSession = getSession(socket.data.sessionId);
      if (!currentSession || currentSession.status !== "active") {
        return;
      }
      var questionId = data.questionId;
      if (!questionId) {
        return;
      }
      var question = currentSession.questions.get(questionId);
      if (!question) {
        return;
      }
      if (!question.flagged && question.moderation === "approved") {
        return;
      }
      question.flagged = false;
      question.flaggedReasons = [];
      question.moderation = "approved";
      broadcastSession(io, currentSession);
    });

    /**
     * Admin action: removes a question from the session queue.
     */
    socket.on("question:remove", function onQuestionRemove(payload) {
      if (socket.data.role !== "admin") {
        return;
      }
      var data = payload || {};
      var currentSession = getSession(socket.data.sessionId);
      if (!currentSession) {
        return;
      }
      var questionId = data.questionId;
      if (!questionId) {
        return;
      }
      if (currentSession.questions.delete(questionId)) {
        broadcastSession(io, currentSession);
      }
    });
  });
}

module.exports = {
  attachSocketHandlers,
  broadcastSession
};
