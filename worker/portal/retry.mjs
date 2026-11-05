// Transient-failure handling for slow, lossy Nigerian mobile networks.
// The portal can also return 502/503/504 while the booking window opens.

const TRANSIENT_PATTERN = new RegExp(
  [
    "net::ERR_",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "socket hang up",
    "Target closed",
    "page crashed",
    "Navigation timeout",
    "Timeout \\d+ms exceeded",
    "ERR_HTTP_RESPONSE_CODE_FAILURE",
    "502 Bad Gateway",
    "503 Service Temporarily Unavailable",
    "504 Gateway Time-out",
    "The portal is busy",
  ].join("|"),
  "i",
);

export const NETWORK_RETRY = Symbol("network-retry");

export class DeadlineExceededError extends Error {
  constructor() {
    super("The booking deadline passed before the portal responded.");
    this.code = "deadline_exceeded";
  }
}

export function isTransient(error) {
  if (!error) return false;
  if (error.code === "deadline_exceeded") return false;
  if (error.retryable === true) return true;
  return TRANSIENT_PATTERN.test(String(error.message ?? error));
}

// "The portal is down" is different from "the page loaded but the rooms are
// unreadable". Watch mode only keeps waiting for the first kind.
const CONNECTION_PATTERN = new RegExp(
  [
    "net::ERR_(CONNECTION|NAME|TIMED_OUT|NETWORK|ADDRESS|INTERNET|EMPTY_RESPONSE|TUNNEL)",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "socket hang up",
    "Navigation timeout",
    "Timeout \\d+ms exceeded",
    "Target closed",
    "page crashed",
  ].join("|"),
  "i",
);

export function isConnectionFailure(error) {
  if (!error) return false;
  if (error.code === "deadline_exceeded") return false;
  if (error.code === "portal_busy") return true;
  return CONNECTION_PATTERN.test(String(error.message ?? error));
}

/** 30s, 60s, 120s, 240s, then every 5 minutes while the portal stays down. */
export function watchBackoffMs(previous, { startMs = 30_000, maxMs = 300_000 } = {}) {
  const next = previous > 0 ? previous * 2 : startMs;
  return Math.max(startMs, Math.min(maxMs, Math.round(next)));
}

/**
 * Exponential backoff with jitter. Jitter matters when several students in the
 * same hostel share one overloaded network: fixed retry intervals create spikes.
 */
export function backoffDelay(attempt, { baseMs = 400, maxMs = 5_000, jitter = 0.35, random = Math.random } = {}) {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const spread = exponential * jitter;
  return Math.round(exponential - spread + random() * spread * 2);
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry(
  operation,
  {
    attempts = 4,
    baseMs = 400,
    maxMs = 5_000,
    deadline = Number.POSITIVE_INFINITY,
    shouldRetry = isTransient,
    onRetry,
    sleep = defaultSleep,
    random = Math.random,
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (Date.now() >= deadline) throw new DeadlineExceededError();
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error)) throw error;
      const delay = backoffDelay(attempt, { baseMs, maxMs, random });
      if (Date.now() + delay >= deadline) throw new DeadlineExceededError();
      await onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}

/** Chunked wall-clock wait so laptop sleep or timer drift cannot skip the window. */
export async function waitUntil(targetMs, { chunkMs = 1_000, now = Date.now, sleep = defaultSleep } = {}) {
  for (;;) {
    const remaining = targetMs - now();
    if (remaining <= 0) return;
    await sleep(Math.min(chunkMs, remaining));
  }
}
