const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const { Server } = require("socket.io");
const { sanitizeQuestion } = require("./profanity");

const PORT = process.env.PORT || 3000;
const SESSION_MIN_DURATION = 5; // minutes
const SESSION_MAX_DURATION = 480; // minutes
const PASSWORD_LENGTH = 4;
const MAX_SESSION_NAME_LENGTH = 60;

const ADJECTIVES = [
  "bright",
  "calm",
  "curious",
  "eager",
  "gentle",
  "keen",
  "lively",
  "nimble",
  "quick",
  "sharp",
  "steady",
  "witty",
  "pearl"
];

const NOUNS = [
  "aurora",
  "breeze",
  "comet",
  "ember",
  "harbor",
  "meadow",
  "nebula",
  "oasis",
  "prairie",
  "stream",
  "summit",
  "voyage"
];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});
app.use(express.static(path.join(__dirname, "..", "public")));

const QUESTION_RATE_WINDOW_MS = 10 * 1000;
const QUESTION_RATE_MAX = 5;
const SESSION_CREATE_WINDOW_MS = 60 * 1000;
const SESSION_CREATE_MAX = 5;
const ADMIN_ROOM_SUFFIX = ':admins';

function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const ts = now();
    hits.forEach((entry, key) => {
      if (entry.resetAt <= ts) {
        hits.delete(key);
      }
    });
  }, windowMs).unref();

  return (key) => {
    const ts = now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= ts) {
      hits.set(key, { count: 1, resetAt: ts + windowMs });
      return false;
    }
    entry.count += 1;
    if (entry.count > max) {
      return true;
    }
    return false;
  };
}

const sessionCreationLimiter = createRateLimiter({
  windowMs: SESSION_CREATE_WINDOW_MS,
  max: SESSION_CREATE_MAX
});

function extractClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

function normalizeParticipantId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) {
    return null;
  }
  if (!/^[a-z0-9-]+$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}
/**
 * In-memory session store. Intended for prototype usage only.
 * Map<sessionId, Session>
 */
const sessions = new Map();

function now() {
  return Date.now();
}

function generateId(length = 10) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateFriendlyName() {
  const adjective = pickRandom(ADJECTIVES);
  const noun = pickRandom(NOUNS);
  return `${adjective} ${noun}`;
}

function generatePassword(length = PASSWORD_LENGTH) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function ensureSessionStatus(session) {
  if (session.status === "active" && session.expiresAt <= now()) {
    session.status = "expired";
  }
  return session.status;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  ensureSessionStatus(session);
  return session;
}

function createSession(expiresInMinutes, nameInput) {
  const id = generateId(8);
  const adminKey = generateId(16);
  const joinPassword = generatePassword();
  const createdAt = now();
  const expiresAt = createdAt + expiresInMinutes * 60 * 1000;
  const nameCandidate = typeof nameInput === "string" ? nameInput.trim() : "";
  const safeName = nameCandidate
    .replace(/[<>\r\n]/g, "")
    .slice(0, MAX_SESSION_NAME_LENGTH)
    .trim();
  const sessionName = safeName || generateFriendlyName();

  const session = {
    id,
    adminKey,
    joinPassword,
    name: sessionName,
    createdAt,
    expiresAt,
    status: "active",
    questions: new Map()
  };
  sessions.set(id, session);
  return session;
}

function formatQuestion(question) {
  return {
    id: question.id,
    text: question.text,
    authorAlias: question.authorAlias || null,
    createdAt: question.createdAt,
    upvotes: question.upvotes.size,
    status: question.status,
    moderation: question.moderation || (question.flagged ? "needs_review" : "approved"),
    flagged: Boolean(question.flagged),
    flaggedReasons: Array.isArray(question.flaggedReasons)
      ? [...question.flaggedReasons]
      : []
  };
}

function formatSession(session) {
  const status = ensureSessionStatus(session);
  const questions = Array.from(session.questions.values())
    .sort((a, b) => {
      const voteDiff = b.upvotes.size - a.upvotes.size;
      if (voteDiff !== 0) {
        return voteDiff;
      }
      return a.createdAt - b.createdAt;
    })
    .map(formatQuestion);

  return {
    id: session.id,
    name: session.name,
    status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    questions
  };
}

function broadcastSession(session) {
  const room = `session:${session.id}`;
  io.to(room).emit("session:update", formatSession(session));
}

app.get("/api/sessions", (req, res) => {
  const activeSessions = [];
  sessions.forEach((session) => {
    if (ensureSessionStatus(session) === "active") {
      activeSessions.push({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      });
    }
  });
  activeSessions.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ sessions: activeSessions });
});

app.post("/api/sessions", (req, res) => {
  const { expiresInMinutes = 60, name } = req.body || {};
  const clientKey = extractClientKey(req);
  if (sessionCreationLimiter(clientKey)) {
    return res.status(429).json({ message: "Too many sessions created from this address. Please wait a moment." });
  }
  const parsedMinutes = Number.parseInt(expiresInMinutes, 10);
  if (Number.isNaN(parsedMinutes)) {
    return res.status(400).json({ message: "expiresInMinutes must be a number" });
  }
  if (parsedMinutes < SESSION_MIN_DURATION || parsedMinutes > SESSION_MAX_DURATION) {
    return res.status(400).json({
      message: `expiresInMinutes must be between ${SESSION_MIN_DURATION} and ${SESSION_MAX_DURATION}`
    });
  }

  const session = createSession(parsedMinutes, name);
  const attendeePath = `/session.html?sessionId=${session.id}&password=${session.joinPassword}`;
  const adminPath = `/admin.html?sessionId=${session.id}&key=${session.adminKey}`;

  return res.status(201).json({
    sessionId: session.id,
    adminKey: session.adminKey,
    joinPassword: session.joinPassword,
    name: session.name,
    expiresAt: session.expiresAt,
    attendeePath,
    adminPath
  });
});

app.get("/api/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ message: "Session not found" });
  }
  if (session.status === "expired") {
    return res.status(410).json({ message: "Session expired" });
  }
  if (session.status !== "active") {
    return res.status(409).json({ message: "Session is not active" });
  }

  const rawPassword = req.query ? req.query.password : null;
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";
  if (!password || password.length > 128 || password !== session.joinPassword) {
    return res.status(403).json({ message: "Invalid session password" });
  }

  return res.json(formatSession(session));
});

app.get("/api/sessions/:id/admin", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ message: "Session not found" });
  }
  const rawKey = req.query ? req.query.key : null;
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!key || key.length > 128 || key !== session.adminKey) {
    return res.status(403).json({ message: "Invalid admin key" });
  }
  const formatted = formatSession(session);
  return res.json({
    ...formatted,
    joinPassword: session.joinPassword,
    attendeePath: `/session.html?sessionId=${session.id}&password=${session.joinPassword}`
  });
});

io.use((socket, next) => {
  const query = socket.handshake.query || {};
  const pickString = (value) => {
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      return typeof first === "string" ? first : null;
    }
    return null;
  };

  const sessionId = pickString(query.sessionId);
  if (!sessionId) {
    return next(new Error("Missing sessionId"));
  }
  const session = getSession(sessionId);
  if (!session) {
    return next(new Error("Session not found"));
  }
  if (session.status !== "active") {
    return next(new Error("Session inactive"));
  }

  const adminKeyRaw = pickString(query.adminKey);
  const adminKey = adminKeyRaw ? adminKeyRaw.trim() : null;
  const passwordRaw = pickString(query.password);
  const password = passwordRaw ? passwordRaw.trim() : null;
  const participantIdInput = pickString(query.participantId);

  if (adminKey && adminKey.length > 128) {
    return next(new Error("Invalid admin key"));
  }
  if (password && password.length > 128) {
    return next(new Error("Invalid session password"));
  }

  socket.data.sessionId = sessionId;
  const normalizedParticipantId = normalizeParticipantId(participantIdInput);
  socket.data.participantId = normalizedParticipantId || `socket-${socket.id}`;

  if (adminKey && adminKey === session.adminKey) {
    socket.data.role = "admin";
    return next();
  }

  if (!password || password !== session.joinPassword) {
    return next(new Error("Invalid session password"));
  }

  socket.data.role = "attendee";
  return next();
});

io.on("connection", (socket) => {
  const session = getSession(socket.data.sessionId);
  if (!session || session.status !== "active") {
    socket.emit("session:inactive");
    socket.disconnect();
    return;
  }

  const room = `session:${session.id}`;
  socket.join(room);
  if (socket.data.role === "admin") {
    socket.join(`${room}${ADMIN_ROOM_SUFFIX}`);
  }
  socket.emit("session:update", formatSession(session));

  const hitQuestionRateLimit = () => {
    const ts = now();
    let limiter = socket.data.questionLimiter;
    if (!limiter || limiter.resetAt <= ts) {
      limiter = { count: 1, resetAt: ts + QUESTION_RATE_WINDOW_MS };
      socket.data.questionLimiter = limiter;
      return false;
    }
    limiter.count += 1;
    if (limiter.count > QUESTION_RATE_MAX) {
      return true;
    }
    return false;
  };

  socket.on("question:add", (payload = {}) => {
    const currentSession = getSession(socket.data.sessionId);
    if (!currentSession || currentSession.status !== "active") {
      socket.emit("session:inactive");
      return;
    }

    const sanitized = sanitizeQuestion(String(payload.text ?? ""));
    const text = sanitized.text;
    const authorAlias = (payload.authorAlias || "")
      .toString()
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 50);

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

    const flaggedReasons = Array.isArray(sanitized.reasons) ? [...sanitized.reasons] : [];
    const isFlagged = Boolean(sanitized.flagged);

    const question = {
      id: generateId(10),
      text,
      authorAlias,
      createdAt: now(),
      upvotes: new Set(),
      status: "open",
      flagged: isFlagged,
      flaggedReasons,
      moderation: isFlagged ? "needs_review" : "approved"
    };

    currentSession.questions.set(question.id, question);

    if (question.flagged) {
      const reasonText = flaggedReasons.length ? flaggedReasons.join("; ") : "automatic moderation trigger";
      console.warn(`[moderation] flagged question ${question.id} in session ${currentSession.id}: ${reasonText}`);
      io.to(`${room}${ADMIN_ROOM_SUFFIX}`).emit("moderation:flagged", {
        questionId: question.id,
        text: question.text,
        reasons: flaggedReasons
      });
    }

    broadcastSession(currentSession);
  });

  socket.on("question:upvote", (payload = {}) => {
    const currentSession = getSession(socket.data.sessionId);
    if (!currentSession || currentSession.status !== "active") {
      socket.emit("session:inactive");
      return;
    }

    const { questionId } = payload;
    if (!questionId) {
      return;
    }

    const question = currentSession.questions.get(questionId);
    if (!question || question.status !== "open") {
      return;
    }
    if (question.moderation !== "approved") {
      return;
    }

    const voterId = socket.data.participantId;
    question.upvotes.add(voterId);
    broadcastSession(currentSession);
  });

  socket.on("question:answered", (payload = {}) => {
    if (socket.data.role !== "admin") {
      return;
    }
    const currentSession = getSession(socket.data.sessionId);
    if (!currentSession) {
      return;
    }
    const { questionId } = payload;
    if (!questionId) {
      return;
    }
    const question = currentSession.questions.get(questionId);
    if (!question) {
      return;
    }
    question.status = "answered";
    question.flagged = false;
    question.flaggedReasons = [];
    question.moderation = "approved";
    broadcastSession(currentSession);
  });

  socket.on("question:approve", (payload = {}) => {
    if (socket.data.role !== "admin") {
      return;
    }
    const currentSession = getSession(socket.data.sessionId);
    if (!currentSession || currentSession.status !== "active") {
      return;
    }
    const { questionId } = payload;
    if (!questionId) {
      return;
    }
    const question = currentSession.questions.get(questionId);
    if (!question) {
      return;
    }
    if (!question.flagged && question.moderation === "approved") {
      return;
    }
    question.flagged = false;
    question.flaggedReasons = [];
    question.moderation = "approved";
    broadcastSession(currentSession);
  });
  socket.on("question:remove", (payload = {}) => {
    if (socket.data.role !== "admin") {
      return;
    }
    const currentSession = getSession(socket.data.sessionId);
    if (!currentSession) {
      return;
    }
    const { questionId } = payload;
    if (!questionId) {
      return;
    }
    if (currentSession.questions.delete(questionId)) {
      broadcastSession(currentSession);
    }
  });
});

setInterval(() => {
  const timestamp = now();
  sessions.forEach((session) => {
    if (session.status === "active" && session.expiresAt <= timestamp) {
      session.status = "expired";
      broadcastSession(session);
    }
  });
}, 30000).unref();

server.listen(PORT, () => {
  console.log(`Lecture Q&A prototype running on http://localhost:${PORT}`);
});







