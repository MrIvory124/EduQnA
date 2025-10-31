"use strict";

const crypto = require("crypto");
const { PASSWORD_LENGTH, ADJECTIVES, NOUNS, MAX_SESSION_NAME_LENGTH } = require("./config");

/**
 * Returns the current timestamp in milliseconds.
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Generates a short unique identifier using UUID without dashes.
 * @param {number} length Desired length of the id.
 * @returns {string}
 */
function generateId(length) {
  var id = crypto.randomUUID().replace(/-/g, "");
  return id.slice(0, length);
}

/**
 * Picks a random element from an array.
 * @param {Array} list
 * @returns {*}
 */
function pickRandom(list) {
  var index = Math.floor(Math.random() * list.length);
  return list[index];
}

/**
 * Generates a friendly human-readable session name.
 * @returns {string}
 */
function generateFriendlyName() {
  var adjective = pickRandom(ADJECTIVES);
  var noun = pickRandom(NOUNS);
  return adjective + " " + noun;
}

/**
 * Generates a short base64url password.
 * @param {number} length
 * @returns {string}
 */
function generatePassword(length) {
  var effectiveLength;
  if (typeof length === "number") {
    effectiveLength = length;
  } else {
    effectiveLength = PASSWORD_LENGTH;
  }
  return crypto.randomBytes(effectiveLength).toString("base64url").slice(0, effectiveLength);
}

/**
 * Extracts a client key string from request headers or socket info.
 * @param {import('express').Request} req
 * @returns {string}
 */
function extractClientKey(req) {
  var forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    var trimmed = forwarded.trim();
    if (trimmed) {
      var parts = trimmed.split(",");
      var first = parts[0];
      return first.trim();
    }
  }
  if (req.ip) {
    return req.ip;
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }
  return "unknown";
}

/**
 * Normalizes a participant identifier to an allowed safe format.
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeParticipantId(value) {
  if (typeof value !== "string") {
    return null;
  }
  var trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) {
    return null;
  }
  if (!/^[a-z0-9-]+$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Sanitizes and truncates a proposed session name.
 * @param {unknown} nameInput
 * @returns {string}
 */
function sanitizeSessionName(nameInput) {
  var candidate = typeof nameInput === "string" ? nameInput.trim() : "";
  candidate = candidate.replace(/[<>\r\n]/g, "");
  candidate = candidate.slice(0, MAX_SESSION_NAME_LENGTH);
  candidate = candidate.trim();
  return candidate;
}

module.exports = {
  now,
  generateId,
  pickRandom,
  generateFriendlyName,
  generatePassword,
  extractClientKey,
  normalizeParticipantId,
  sanitizeSessionName
};
