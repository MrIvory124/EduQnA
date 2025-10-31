"use strict";

/**
 * List of flagged terms for basic profanity detection.
 * TODO: Replace with a maintained library and locale-aware matching.
 */
const FLAGGED_TERMS = [
  'fuck', 'fucked', 'fucker', 'fucking', 'fuk', 'fuking', 'fukker', 'fuked',
  'shit', 'shitty', 'shite', 'shitter', 'shithead', 'shitface', 'shitting',
  'bitch', 'bitches', 'bitchy', 'biatch', 'b1tch', 'b!tch',
  'asshole', 'assholes', 'arsehole', 'ass', 'asses', 'a$$', 'a$$hole',
  'cunt', 'cunts', 'cunting', 'c*nt', 'cu*t',
  'bastard', 'bastards', 'bastardly',
  'dick', 'dicks', 'dickhead', 'd1ck', 'd!ck', 'dik', 'dikk',
  'pussy', 'pussies', 'pussey', 'pussi', 'puss', 'p*ssy',
  'cock', 'cocks', 'c0ck', 'cok', 'c*ck',
  'fag', 'fags', 'faggot', 'faggots', 'f@g', 'faqqot', 'faqqots',
  'slut', 'sluts', 'slutty', 'slutt', 'slutface',
  'whore', 'whores', 'whoring', 'wh0re', 'whor3',
  'twat', 'twats', 'tw@t',
  'prick', 'pricks', 'pr1ck', 'pr!ck',
  'wanker', 'wankers', 'wank', 'wanking', 'w4nker',
  'bollocks', 'bollock', 'bollok', 'bollokks',
  'damn', 'damned', 'dammit', 'damnit',
  'crap', 'crappy', 'crapping', 'crapped',
  'bugger', 'buggers', 'buggered', 'buggering',
  'arse', 'arses', 'ar5e', 'ar$e',
  'motherfucker', 'motherfuckers', 'motherfucking', 'muthafucka', 'muthafucker',
  'douche', 'douchebag', 'douchebags', 'douchebaggery',
  'jackass', 'jackasses', 'jackazz',
  'retard', 'retarded', 'retards', 'r3tard', 'r3tarded',
  'moron', 'morons', 'moronic',
  'idiot', 'idiots', 'idiotic',
  'imbecile', 'imbeciles',
  'dipshit', 'dipshits',
  'dumbass', 'dumbasses', 'dumbazz',
  'nigger', 'niggers', 'nigga', 'niggaz', 'n1gger', 'n1gga',
  'spic', 'spics',
  'chink', 'chinks',
  'gook', 'gooks',
  'kike', 'kikes',
  'coon', 'coons',
  'wetback', 'wetbacks',
  'tranny', 'trannies',
  'dyke', 'dykes',
  'queer', 'queers',
  'skank', 'skanks', 'skanky',
  'hoe', 'hoes', 'ho', 'h0e',
  'cum', 'cumming', 'cumshot', 'cumshots', 'cumslut',
  'jizz', 'jizzed', 'jizzing',
  'tit', 'tits', 'titties', 'titty', 't1t', 't1ts',
  'boob', 'boobs', 'boobies', 'booby', 'b00b', 'b00bs',
  'nipple', 'nipples',
  'penis', 'penises', 'p3nis',
  'vagina', 'vaginas', 'vaj', 'vajayjay', 'vag', 'v@gina',
  'anus', 'anuses',
  'rectum', 'rectums',
  'butt', 'butts', 'butthole', 'butthead', 'buttface', 'buttocks',
  'balls', 'ball', 'ballz', 'ball sack', 'ballsack',
  'testicle', 'testicles', 'testes',
  'scrotum', 'scrotums',
  'ejaculate', 'ejaculated', 'ejaculating', 'ejaculation',
  'orgasm', 'orgasms', 'orgasmic',
  'rape', 'raped', 'raping', 'rapist', 'rapists',
  'molest', 'molested', 'molesting', 'molester', 'molesters',
  'pedophile', 'pedophiles', 'pedophilia',
  'incest', 'incests', 'incestuous',
  'bestiality', 'bestial', 'beastiality',
  'sodomize', 'sodomized', 'sodomizing', 'sodomite', 'sodomites',
  'suck', 'sucks', 'sucking', 'sucked', 'sucker', 'suckers',
  'blowjob', 'blowjobs', 'blow job', 'blow jobs',
  'handjob', 'handjobs', 'hand job', 'hand jobs',
  'rimjob', 'rimjobs', 'rim job', 'rim jobs',
  'masturbate', 'masturbated', 'masturbating', 'masturbation', 'masturbator', 'masturbators',
  'jerkoff', 'jerk off', 'jerking', 'jerked', 'jerks',
  'porn', 'porno', 'pornography', 'pornographic', 'pr0n',
  'nude', 'nudes', 'nudity', 'naked', 'nakeds',
  'strip', 'stripped', 'stripping', 'stripper', 'strippers',
  'escort', 'escorts', 'escorting',
  'prostitute', 'prostitutes', 'prostitution',
  'hooker', 'hookers',
  'gigolo', 'gigolos',
  'callgirl', 'callgirls', 'call girl', 'call girls',
  'sex', 'sexual', 'sexually', 'sexed', 'sexing',
  'intercourse',
  'bang', 'banged', 'banging',
  'screw', 'screwed', 'screwing',
  'hump', 'humped', 'humping',
  'grope', 'groped', 'groping',
  'fondle', 'fondled', 'fondling',
  'spank', 'spanked', 'spanking',
  'bondage', 'bondaged',
  'fetish', 'fetishes', 'fetishist',
  'bdsm',
  'dominatrix', 'dominatrices',
  'submissive', 'submissives',
  'dominant', 'dominants',
  'slave', 'slaves',
  'master', 'masters'
];

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
function sanitizeQuestion(rawText) {
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

  var lower = trimmed.toLowerCase();
  var reasons = [];

  FLAGGED_TERMS.forEach(function eachTerm(term) {
    if (lower.indexOf(term) !== -1) {
      reasons.push('contains flagged term "' + term + '"');
    }
  });

  FLAGGED_PATTERNS.forEach(function eachPattern(rule) {
    if (rule.test(trimmed)) {
      reasons.push(rule.reason);
    }
  });

  var safeText = trimmed.replace(/\s{3,}/g, '  ');

  return {
    text: safeText,
    flagged: reasons.length > 0,
    reasons: reasons
  };
}

module.exports = {
  sanitizeQuestion
};
