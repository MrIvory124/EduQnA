# EduQ&A: Lecture Q&A web app
[![Build](https://github.com/MrIvory124/EduQnA/actions/workflows/ci.yml/badge.svg)](https://github.com/MrIvory124/EduQnA/actions/workflows/ci.yml)

## Overview
- Single Node.js backend (Express) serving REST endpoints and Socket.IO for real-time updates.
- In-memory data store holds active sessions, questions, and votes for prototype simplicity.
- Static frontend pages (lecturer + attendee) served from /public and communicating via WebSocket.
  
## Profanity & Moderation Hooks
- Using Obscenity to filter out bad words
- Filter can be customised to add words
- Admin of a room can remove a message with a bad word

## How to install
To install and use this with NPM, see [usage.md](https://github.com/MrIvory124/anonymous-questions/blob/main/docs/usage.md)

## Session Lifecycle
1. Lecturer generates a session link with an expiry timestamp, optional custom name, and auto-generated join password.
2. Attendees join via the link, provide the session password and a display name, then post/upvote questions in real time.
3. Lecturer dashboard receives live updates, can mark questions answered, remove questions, and (future work) deactivate sessions.

## Data Model (In-Memory)
```	js
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
```

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


## Constraints & Future Work
- Data resets when server restarts; replace with persistent store later.
- Token + password validation should move to signed tokens and hash storage for production hardening.
- Add lecturer controls for closing sessions and bulk moderation actions, plus rate limiting / CAPTCHA.
- Do sanitization on the names of both users and rooms
- Improve the css of the whole prototype
