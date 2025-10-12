# Lecture Q&A Prototype Architecture

## Overview
- Single Node.js backend (Express) serving REST endpoints and Socket.IO for real-time updates.
- In-memory data store holds active sessions, questions, and votes for prototype simplicity.
- Static frontend pages (lecturer + attendee) served from /public and communicating via WebSocket.

## Session Lifecycle
1. Lecturer generates a session link with an expiry timestamp, optional custom name, and auto-generated join password.
2. Attendees join via the link, provide the session password and a display name, then post/upvote questions in real time.
3. Lecturer dashboard receives live updates, can mark questions answered, remove questions, and (future work) deactivate sessions.

## Data Model (In-Memory)
`	s
interface Session {
  id: string;             // public session id embedded in attendee link
  name: string;           // friendly session name (custom or generated)
  adminKey: string;       // secret token for lecturer dashboard
  joinPassword: string;   // password required for attendee access and socket joins
  expiresAt: number;      // unix ms timestamp
  createdAt: number;
  status: 'active' | 'closed' | 'expired';
  questions: Map<string, Question>;
}

interface Question {
  id: string;
  text: string;
  authorAlias?: string;
  createdAt: number;
  upvotes: Set<string>;   // socket client ids to avoid duplicate votes
  status: 'open' | 'answered';
}
`

## API Surface
- GET /api/sessions → list active sessions (name, id, expiry) for homepage display.
- POST /api/sessions → create session with optional name and expiry duration; returns attendee/admin URLs and join password.
- GET /api/sessions/:id?password=... → attendee fetch, validates expiry and password before returning queue snapshot.
- GET /api/sessions/:id/admin?key=... → lecturer fetch (includes attendee link + password for resharing).
- WebSocket namespace /session/:id handles events:
  - question:add
  - question:upvote
  - question:answered
  - question:remove
  - Server broadcasts session:update with ranked questions (no secrets in payload).

## Profanity & Moderation Hooks
- Placeholder utility sanitizeQuestion(text) to integrate third-party or custom filters later.
- Currently no-op but ensures single insertion point; moderation actions can extend the admin endpoint/socket events.

## Constraints & Future Work
- Data resets when server restarts; replace with persistent store later.
- Token + password validation should move to signed tokens and hash storage for production hardening.
- Add lecturer controls for closing sessions and bulk moderation actions, plus rate limiting / CAPTCHA.
