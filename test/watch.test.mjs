import assert from "node:assert/strict";
import { test } from "node:test";
import { isConnectionFailure, isTransient, watchBackoffMs } from "../worker/portal/retry.mjs";

test("a portal that cannot be reached counts as a connection failure", () => {
  assert.equal(isConnectionFailure(new Error("page.goto: net::ERR_CONNECTION_TIMED_OUT at https://eportal.futminna.edu.ng/")), true);
  assert.equal(isConnectionFailure(new Error("page.goto: net::ERR_NAME_NOT_RESOLVED at https://eportal.futminna.edu.ng/")), true);
  assert.equal(isConnectionFailure(new Error("connect ECONNREFUSED 127.0.0.1:9")), true);
  assert.equal(isConnectionFailure(Object.assign(new Error("The portal returned 503."), { code: "portal_busy" })), true);
});

test("an overloaded portal that never finishes signing in is worth waiting for", () => {
  assert.equal(isConnectionFailure(Object.assign(new Error("The portal did not finish signing in within 60 seconds."), { code: "portal_login_timeout" })), true);
  // A real credential rejection must still stop the run, never be retried in a loop.
  assert.equal(isConnectionFailure(Object.assign(new Error("The portal rejected that username and password."), { code: "portal_login_rejected" })), false);
});

test("a page we can read but not act on is not a connection failure", () => {
  const soldOut = Object.assign(new Error("Every matching row is sold out."), { code: "portal_rows_sold_out" });
  assert.equal(isConnectionFailure(soldOut), false);
  assert.equal(isConnectionFailure(Object.assign(new Error("The booking deadline passed."), { code: "deadline_exceeded" })), false);
  assert.equal(isConnectionFailure(null), false);
});

test("watch backoff starts at 30s, doubles, and stops growing at 5 minutes", () => {
  assert.equal(watchBackoffMs(0), 30_000);
  assert.equal(watchBackoffMs(30_000), 60_000);
  assert.equal(watchBackoffMs(60_000), 120_000);
  assert.equal(watchBackoffMs(240_000), 300_000);
  assert.equal(watchBackoffMs(300_000), 300_000);
});

test("connection failures stay retryable inside a single attempt", () => {
  assert.equal(isTransient(new Error("net::ERR_CONNECTION_TIMED_OUT")), true);
  assert.equal(isTransient(Object.assign(new Error("deadline"), { code: "deadline_exceeded" })), false);
});
