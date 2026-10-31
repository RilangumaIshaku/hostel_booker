// Pure decision logic. Everything here is unit-testable without a browser.

const NUMBER_WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };

export function normalize(text) {
  return String(text ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function roomNumber(preference) {
  const match = String(preference).match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * "Room of 2" is one wording; portals also use "2 in a room", "2-man",
 * "two bed space". Match the count and a room-ish noun, never a bare digit.
 */
export function matchesRoom(text, preference) {
  const value = normalize(text);
  const number = roomNumber(preference);
  if (!value || !number) return false;
  const word = NUMBER_WORDS[number];
  const counts = [`(?<![\\d])${number}(?![\\d])`, word].filter(Boolean).join("|");
  const noun = "(room|man|bed|space|student|person|batch)";
  const countFirst = new RegExp(`${counts}[^\\n]{0,28}${noun}`, "i");
  const nounFirst = new RegExp(`${noun}[^\\n]{0,20}${counts}`, "i");
  return countFirst.test(value) || nounFirst.test(value);
}

export function matchesHostel(text, hostel) {
  const value = normalize(text);
  if (!value) return false;
  const cleaned = normalize(hostel);
  if (cleaned && value.includes(cleaned)) return true;
  if (/needs\s+assessment/i.test(cleaned) && /\bneeds\s+assessment\b|\bn\.?\s?a\.?\s?h\.?\b/i.test(value)) return true;
  const words = cleaned.split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  if (words.length === 0) return false;
  return words.every((word) => value.includes(word));
}

const SOLD_OUT_PATTERN = /sold\s*out|no\s+(?:more\s+)?(?:space|vacancy|vacancies|rooms?|bed)|fully\s+booked|fully\s+allocated|rooms?\s+(?:are\s+)?full|unavailable|closed|not\s+available/i;
const NOT_OPEN_PATTERN = /not\s+(?:yet\s+)?(?:open|started|available|begun)|opening\s+(?:soon|on|at)|booking\s+(?:has\s+)?(?:not|yet)|will\s+open|portal\s+(?:is\s+)?closed|no\s+active\s+booking|come\s+back/i;
const ACTION_PATTERN = /^(book|book\s*now|select|reserve|apply|allocate|choose|proceed|apply\s*now|make\s*booking|details)$/i;

export function classifyPage(text, { hasBookableAction = false } = {}) {
  const value = normalize(text);
  if (hasBookableAction) return "open";
  if (SOLD_OUT_PATTERN.test(value)) return "sold_out";
  if (NOT_OPEN_PATTERN.test(value)) return "not_open";
  return "unknown";
}

export function isActionLabel(text) {
  const value = normalize(text);
  if (!value) return false;
  if (ACTION_PATTERN.test(value)) return true;
  return /\b(book|reserve|allocate|select)\b/.test(value) && value.length <= 40;
}

/**
 * Pick the first preference that has at least one usable candidate.
 * A candidate is usable only when the row names the room type and offers an
 * action inside that same row, so we never click a page-level "Book" that
 * belongs to a different room.
 */
export function chooseCandidate(candidates, preferences) {
  for (const preference of preferences) {
    const matching = candidates.filter((candidate) => candidate.available !== false && candidate.roomPreference === preference);
    if (matching.length > 0) {
      const sorted = [...matching].sort((a, b) => (b.hostelMatched === true) - (a.hostelMatched === true));
      return { preference, candidate: sorted[0] };
    }
  }
  return null;
}

const CONFIRMED_PATTERN = /booking\s+(?:was\s+)?(?:successful|success|confirmed|completed|done)|successfully\s+(?:booked|allocated|reserved)|you\s+have\s+been\s+allocated|room\s+(?:has\s+been\s+)?(?:allocated|reserved|booked)|allocation\s+(?:was\s+)?(?:successful|complete)|reservation\s+(?:was\s+)?confirmed|application\s+(?:was\s+)?successful|booked\s+successfully/i;
const REJECTED_PATTERN = /already\s+(?:been\s+)?(?:booked|allocated|reserved|have\s+a\s+room)|not\s+eligible|not\s+allowed|no\s+(?:vacancy|space|room)|sold\s*out|failed|error|invalid|session\s+(?:has\s+)?expired|insufficient|allocation\s+(?:closed|not)/i;

export function classifyBookingResult(text) {
  const value = normalize(text);
  const confirmed = CONFIRMED_PATTERN.test(value);
  const rejected = REJECTED_PATTERN.test(value);
  // A page can contain both words (e.g. "booking failed: room sold out").
  // Rejection wins unless the page also names a successful allocation.
  if (confirmed && !rejected) return { outcome: "confirmed", reason: "portal_confirmation" };
  if (confirmed && rejected) {
    return { outcome: "unconfirmed", reason: "conflicting_confirmation_text" };
  }
  if (rejected) return { outcome: "rejected", reason: "portal_reported_failure" };
  return { outcome: "unconfirmed", reason: "no_confirmation_seen" };
}

const CHALLENGE_PATTERN = /captcha|recaptcha|verify\s+you\s+are\s+human|security\s+check|two[- ]factor|otp|verification\s+code/i;
const INVALID_LOGIN_PATTERN = /invalid\s+(?:user|username|login|credential)|incorrect\s+password|wrong\s+password|login\s+failed|user\s+not\s+found|authentication\s+failed/i;

export function detectChallenge(text) {
  return CHALLENGE_PATTERN.test(String(text ?? ""));
}

export function detectInvalidLogin(text) {
  return INVALID_LOGIN_PATTERN.test(String(text ?? ""));
}

const FEE_LINK_PATTERN = /school\s*fees?|fees?\s*payment|payment|pay\s*fees/i;
const FEE_ACTION_PATTERN = /pay|proceed|make\s*payment|generate\s*rrr|remita|continue/i;
const GATEWAY_PATTERN = /remita|interswitch|paystack|flutterwave|secure\s*payment|payment\s*gateway|card\s*payment|transaction\s*reference|rrr/i;

export function isFeeLink(text) {
  return FEE_LINK_PATTERN.test(normalize(text));
}

export function isFeeAction(text) {
  return FEE_ACTION_PATTERN.test(normalize(text));
}

export function isPaymentGateway({ url = "", text = "", portalOrigin = "" } = {}) {
  if (url && portalOrigin) {
    try {
      if (new URL(url).origin !== new URL(portalOrigin).origin) return true;
    } catch {
      // Fall through to text detection.
    }
  }
  return GATEWAY_PATTERN.test(normalize(text));
}

export function extractAmount(text) {
  const value = String(text ?? "").replace(/\u00a0/g, " ");
  // Stay on one line: a table header saying "Balance" must not pick up the
  // first year (2026) from a row further down the page.
  const labelled = value.match(/(?:outstanding|balance|amount\s*due|total|payable)[^0-9\u20a6\n]{0,30}[\u20a6N]?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const currency = value.match(/[\u20a6]\s*([\d,]+(?:\.\d{1,2})?)/i);
  const money = value.match(/([\d,]+\.\d{2})\s*(?:naira|ngn)?/i);
  const raw = labelled?.[1] ?? currency?.[1] ?? money?.[1] ?? null;
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}
