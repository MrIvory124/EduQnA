"use strict";

/**
 * Central configuration and constants for the application.
 */

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_MIN_DURATION: 5, // minutes
  SESSION_MAX_DURATION: 480, // minutes
  PASSWORD_LENGTH: 4,
  MAX_SESSION_NAME_LENGTH: 60,

  QUESTION_RATE_WINDOW_MS: 10 * 1000,
  QUESTION_RATE_MAX: 5,
  SESSION_CREATE_WINDOW_MS: 60 * 1000,
  SESSION_CREATE_MAX: 5,
  ADMIN_ROOM_SUFFIX: ":admins",

  ADJECTIVES: [
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
  ],

  NOUNS: [
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
  ]
};

