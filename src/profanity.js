"use strict";

const { default: profanityFilterer } = require("./profanityFilterer");

/**
 * Pattern rules for minimal XSS-like content detection.
 */
const FLAGGED_PATTERNS = [
  {
    test: function patternScript(text) { return /<script\b/i.test(text); },
    reason: 'contains script tag markup'
  },
  {
    test: function patternInlineHandler(text) { return /on\w+\s*=\s*("|')[^"']*("|')/i.test(text); },
    reason: 'contains inline event handler attributes'
  },
  {
    test: function patternJsHref(text) { return /href\s*=\s*("|')javascript:/i.test(text); },
    reason: 'contains javascript URL scheme'
  }
];

/**
 * Sanitizes a question string and flags potential issues.
 * - Normalizes whitespace and line endings
 * - Checks for flagged terms and simple dangerous patterns
 * @param {unknown} rawText
 * @returns {{ text: string, flagged: boolean, reasons: string[] }}
 */
function sanitizeText(rawText) {
  if (!rawText) {
    return { text: '', flagged: false, reasons: [] };
  }

  var normalized = String(rawText)
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n');
  var trimmed = normalized.trim();
  if (!trimmed) {
    return { text: '', flagged: false, reasons: [] };
  }
  
  var reasons = [];
  // also handles basic XSS patterns
  // TODO figure out what we want to do if we detect XSS patterns
  FLAGGED_PATTERNS.forEach(function eachPattern(rule) {
    if (rule.test(trimmed)) {
      reasons.push(rule.reason);
    }
  });
 
  profanityFilterer.isProfane(trimmed).badWords.forEach(function eachBadWord(word) {
    reasons.push('contains profane words "' + word + '"');
  });


  var safeText = trimmed.replace(/\s{3,}/g, '  ');

  return {
    text: safeText,
    flagged: reasons.length > 0,
    reasons: reasons
  };
}

module.exports = {
  sanitizeText
};
