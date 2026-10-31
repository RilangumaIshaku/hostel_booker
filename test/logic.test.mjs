import assert from "node:assert/strict";
import test from "node:test";
import { backoffDelay, retry, waitUntil } from "../worker/portal/retry.mjs";
import {
  chooseCandidate,
  classifyBookingResult,
  classifyPage,
  extractAmount,
  matchesHostel,
  matchesRoom,
} from "../worker/portal/matching.mjs";

test("room matching understands the portal's different wordings", () => {
  assert.equal(matchesRoom("Needs Assessment Hostel Room of 2 Available", "Room of 2"), true);
  assert.equal(matchesRoom("Two in a room", "Room of 2"), true);
  assert.equal(matchesRoom("2-man room", "Room of 2"), true);
  assert.equal(matchesRoom("Room of 4", "Room of 2"), false);
  assert.equal(matchesRoom("Room 12", "Room of 2"), false);
  assert.equal(matchesRoom("Room of 4", "Room of 4"), true);
});

test("hostel matching accepts NAH and the full name", () => {
  assert.equal(matchesHostel("Needs Assessment Hostel", "Needs Assessment Hostel"), true);
  assert.equal(matchesHostel("NAH block A", "Needs Assessment Hostel"), true);
  assert.equal(matchesHostel("Senate Hostel", "Needs Assessment Hostel"), false);
});

test("page classification separates not-open from sold-out", () => {
  assert.equal(classifyPage("Hostel booking has not yet opened for 2026/2027"), "not_open");
  assert.equal(classifyPage("Room of 2 is sold out"), "sold_out");
  assert.equal(classifyPage("No rooms are currently available."), "sold_out");
  assert.equal(classifyPage("Room of 2", { hasBookableAction: true }), "open");
});

test("confirmation and rejection are read conservatively", () => {
  const confirmed = classifyBookingResult("Booking successful. You have been allocated Room of 2 in Needs Assessment Hostel.");
  assert.equal(confirmed.outcome, "confirmed");
  assert.equal(classifyBookingResult("Booking failed: Room of 2 is sold out").outcome, "rejected");
  assert.equal(classifyBookingResult("You have already been allocated Room of 4.").outcome, "rejected");
  assert.equal(classifyBookingResult("Booking successful, but an error occurred.").outcome, "unconfirmed");
  assert.equal(classifyBookingResult("Please wait while we process your request.").outcome, "unconfirmed");
});

test("preference order falls back only when the first choice is unavailable", () => {
  const preferences = ["Room of 2", "Room of 4"];
  const onlyFour = [
    { roomPreference: "Room of 2", available: false, hostelMatched: true },
    { roomPreference: "Room of 4", available: true, hostelMatched: true },
  ];
  assert.equal(chooseCandidate(onlyFour, preferences).preference, "Room of 4");
  const both = [
    { roomPreference: "Room of 2", available: true, hostelMatched: true },
    { roomPreference: "Room of 4", available: true, hostelMatched: true },
  ];
  assert.equal(chooseCandidate(both, preferences).preference, "Room of 2");
  assert.equal(chooseCandidate([], preferences), null);
});

test("fees amounts are parsed from the usual portal wording", () => {
  assert.equal(extractAmount("Outstanding balance: \u20a6 48,500.00"), 48_500);
  assert.equal(extractAmount("Amount due NGN 12,000"), 12_000);
  assert.equal(extractAmount("No charges on this page"), null);
});

test("backoff stays inside its jittered bounds", () => {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const delay = backoffDelay(attempt, { baseMs: 400, maxMs: 5_000, jitter: 0.35, random: () => 0.5 });
    assert.ok(delay >= 260, `delay ${delay} too small`);
    assert.ok(delay <= 5_000, `delay ${delay} too large`);
  }
});

test("retry recovers from transient failures but never from fatal ones", async () => {
  let calls = 0;
  const result = await retry(async () => {
    calls += 1;
    if (calls < 3) throw new Error("net::ERR_CONNECTION_RESET");
    return "ok";
  }, { attempts: 4, baseMs: 1, maxMs: 2, sleep: async () => {}, random: () => 0.5 });
  assert.equal(result, "ok");
  assert.equal(calls, 3);

  let fatalCalls = 0;
  await assert.rejects(
    retry(async () => {
      fatalCalls += 1;
      throw new Error("Wrong password");
    }, { attempts: 4, sleep: async () => {} }),
    /Wrong password/,
  );
  assert.equal(fatalCalls, 1);
});

test("waitUntil stops at the target even with coarse sleep", async () => {
  let clock = 1_000;
  await waitUntil(2_500, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    chunkMs: 500,
  });
  assert.ok(clock >= 2_500);
  assert.ok(clock <= 3_000);
});
