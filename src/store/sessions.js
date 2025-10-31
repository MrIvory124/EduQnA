"use strict";

const { generateId, generatePassword, generateFriendlyName, now, sanitizeSessionName } = require("../utils");

/**
 * In-memory session store (prototype-only).
 * Map<sessionId, Session>
 */
var sessions = new Map();

/**
 * Ensures a session status is updated based on expiry.
 * @param {any} session
 * @returns {string} status
 */
function ensureSessionStatus(session) {
  if (session.status === "active" && session.expiresAt <= now()) {
    session.status = "expired";
  }
  return session.status;
}

/**
 * Retrieves a session by id or null if not found.
 * @param {string} sessionId
 * @returns {any|null}
 */
function getSession(sessionId) {
  var session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  ensureSessionStatus(session);
  return session;
}

/**
 * Creates and stores a new session with a random id and admin key.
 * @param {number} expiresInMinutes
 * @param {unknown} nameInput
 * @returns {any}
 */
function createSession(expiresInMinutes, nameInput) {
  var id = generateId(8);
  var adminKey = generateId(16);
  var joinPassword = generatePassword();
  var createdAt = now();
  var expiresAt = createdAt + expiresInMinutes * 60 * 1000;

  var safeName = sanitizeSessionName(nameInput);
  var sessionName = safeName;
  if (!sessionName) {
    sessionName = generateFriendlyName();
  }

  var session = {
    id: id,
    adminKey: adminKey,
    joinPassword: joinPassword,
    name: sessionName,
    createdAt: createdAt,
    expiresAt: expiresAt,
    status: "active",
    questions: new Map()
  };
  sessions.set(id, session);
  return session;
}

/**
 * Formats a question for sending to clients.
 * @param {any} q
 * @returns {any}
 */
function formatQuestion(q) {
  var authorAlias = null;
  if (q.authorAlias) {
    authorAlias = q.authorAlias;
  }

  var upvotesCount = 0;
  if (q.upvotes) {
    upvotesCount = q.upvotes.size;
  }

  var moderation = "approved";
  if (q.moderation) {
    moderation = q.moderation;
  } else if (q.flagged) {
    moderation = "needs_review";
  }

  var flaggedReasons = [];
  if (Array.isArray(q.flaggedReasons)) {
    flaggedReasons = [].concat(q.flaggedReasons);
  }

  var result = {
    id: q.id,
    text: q.text,
    authorAlias: authorAlias,
    createdAt: q.createdAt,
    upvotes: upvotesCount,
    status: q.status,
    moderation: moderation,
    flagged: Boolean(q.flagged),
    flaggedReasons: flaggedReasons
  };
  return result;
}

/**
 * Formats a session snapshot for clients, including ranked questions.
 * @param {any} session
 * @returns {any}
 */
function formatSession(session) {
  var status = ensureSessionStatus(session);

  var questionsArray = Array.from(session.questions.values());
  questionsArray.sort(function sortQuestions(a, b) {
    var voteDiff = b.upvotes.size - a.upvotes.size;
    if (voteDiff !== 0) {
      return voteDiff;
    }
    return a.createdAt - b.createdAt;
  });

  var formattedQuestions = questionsArray.map(function mapQuestion(item) {
    return formatQuestion(item);
  });

  return {
    id: session.id,
    name: session.name,
    status: status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    questions: formattedQuestions
  };
}

/**
 * Iterates all sessions.
 * @param {(session:any)=>void} fn
 */
function forEachSession(fn) {
  sessions.forEach(function forEach(session) {
    fn(session);
  });
}

module.exports = {
  sessions,
  ensureSessionStatus,
  getSession,
  createSession,
  formatQuestion,
  formatSession,
  forEachSession
};
