/**
 * Shared email validation for MediSnap.
 *
 * Why this exists: a plain regex accepts "user@gmail.cm", "user@gmail.co" and
 * "user@gmial.com" because all three are *format*-valid addresses (.cm is
 * Cameroon, .co is Colombia, gmial.com is a real registrable domain). A
 * password-reset mail sent to one of those is silently lost. So on top of the
 * format check we also run a typo check against the providers our users
 * actually use.
 *
 * Usage:
 *   const result = validateEmail(input);
 *   if (!result.valid) -> show result.message, stop.
 *   if (result.suggestion) -> ask "Did you mean <result.suggestion>?"
 */

// Local part: letters/digits and the punctuation RFC 5322 allows in practice,
// no leading/trailing/double dots. Domain: labels separated by dots, no
// leading/trailing hyphen. TLD: letters only, at least 2 chars.
const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;

// Domains we expect to see. Used both as an "already correct, stop checking"
// list and as the targets for typo detection.
export const KNOWN_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
  'qq.com',
  '163.com',
  'hotmail.co.uk',
  'outlook.my',
  'yahoo.com.my',
];

// TLDs that are almost always a slip of the finger on a known provider.
// ".cm" is one keystroke from ".com"; ".co" is ".com" missing its last letter.
const SUSPICIOUS_TLD_FIXES = {
  cm: 'com',
  co: 'com',
  om: 'com',
  con: 'com',
  cpm: 'com',
  comm: 'com',
  cim: 'com',
  vom: 'com',
  xom: 'com',
  clm: 'com',
  ent: 'net',
  nte: 'net',
  ne: 'net',
  orgg: 'org',
  ogr: 'org',
  rog: 'org',
};

/**
 * Damerau-Levenshtein edit distance: counts insertion, deletion, substitution
 * and *transposition* as one edit each. Transposition matters here because
 * "gmial" is the single most common way to misspell "gmail" — plain
 * Levenshtein scores it 2 and would let it through.
 */
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = [];

  for (let i = 0; i < rows; i += 1) {
    d[i] = new Array(cols).fill(0);
    d[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) d[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i][j - 1] + 1, // insertion
        d[i - 1][j] + 1, // deletion
        d[i - 1][j - 1] + cost // substitution
      );

      // transposition of two adjacent characters
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}

/**
 * Returns a corrected domain if `domain` looks like a typo of a known
 * provider, otherwise null.
 */
export function suggestDomain(domain) {
  if (!domain) return null;
  if (KNOWN_DOMAINS.includes(domain)) return null;

  const lastDot = domain.lastIndexOf('.');
  const base = lastDot === -1 ? domain : domain.slice(0, lastDot);
  const tld = lastDot === -1 ? '' : domain.slice(lastDot + 1);

  // 1. Bad TLD on an otherwise-correct provider: gmail.cm -> gmail.com
  const fixedTld = SUSPICIOUS_TLD_FIXES[tld];
  if (fixedTld) {
    const candidate = `${base}.${fixedTld}`;
    if (KNOWN_DOMAINS.includes(candidate)) return candidate;
  }

  // 2. Misspelled provider name: gmial.com -> gmail.com, yaho.com -> yahoo.com
  let best = null;
  let bestDistance = Infinity;

  for (const known of KNOWN_DOMAINS) {
    const knownBase = known.slice(0, known.lastIndexOf('.'));

    // If only the ending differs and that ending is not a known slip (step 1
    // already handled those), leave it alone: mail.ru, gmx.net, zoho.in and
    // yahoo.com.sg are all real addresses, not typos of mail.com or gmx.com.
    if (knownBase === base) continue;

    const distance = editDistance(domain, known);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = known;
    }
  }

  // Allow 1 edit for short domains, 2 for longer ones. Anything further away is
  // presumed to be a genuine domain (a company or university address) and is
  // left alone.
  const threshold = best && best.length > 8 ? 2 : 1;
  if (bestDistance > 0 && bestDistance <= threshold) return best;

  return null;
}

/**
 * @param {string} value raw text from the input field
 * @returns {{valid: boolean, email: string, message: string|null, suggestion: string|null}}
 *   valid       - passed format checks; safe to send to Firebase
 *   email       - trimmed + lowercased address to actually use
 *   message     - user-facing reason it was rejected (null when valid)
 *   suggestion  - a corrected address to offer, or null
 */
export function validateEmail(value) {
  const email = String(value == null ? '' : value).trim().toLowerCase();

  const fail = (message) => ({ valid: false, email, message, suggestion: null });

  if (!email) return fail('Please enter your email address.');
  if (/\s/.test(email)) return fail('Email address cannot contain spaces.');
  if (email.length > MAX_EMAIL_LENGTH) return fail('Email address is too long.');

  const atCount = (email.match(/@/g) || []).length;
  if (atCount === 0) return fail('Email address must contain "@".');
  if (atCount > 1) return fail('Email address must contain only one "@".');

  const [localPart, domain] = email.split('@');

  if (!localPart) return fail('Please enter the part before the "@".');
  if (localPart.length > MAX_LOCAL_LENGTH)
    return fail('The part before "@" is too long.');
  if (!domain) return fail('Please enter the domain after the "@".');
  if (!domain.includes('.'))
    return fail('Email domain must include a dot, for example gmail.com.');
  if (domain.includes('..'))
    return fail('Email domain cannot contain two dots in a row.');
  if (domain.startsWith('-') || domain.endsWith('-'))
    return fail('Email domain cannot start or end with a hyphen.');

  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (tld.length < 2)
    return fail('Email domain ending is too short, for example .com or .my.');
  if (!/^[a-z]+$/.test(tld))
    return fail('Email domain ending must contain letters only.');

  if (!EMAIL_PATTERN.test(email))
    return fail('Please enter a valid email address, for example name@gmail.com.');

  const fixedDomain = suggestDomain(domain);

  return {
    valid: true,
    email,
    message: null,
    suggestion: fixedDomain ? `${localPart}@${fixedDomain}` : null,
  };
}

/** Convenience boolean for callers that only need a yes/no. */
export function isValidEmail(value) {
  return validateEmail(value).valid;
}
