import assert from "node:assert/strict";
import test from "node:test";
import { backoffDelay, retry, waitUntil } from "../worker/portal/retry.mjs";
import {
  ANY_ROOM,
  chooseCandidate,
  classifyBookingResult,
  classifyPage,
  crossesGender,
  extractAmount,
  matchesHostel,
  matchesRoom,
} from "../worker/portal/matching.mjs";
import { toCandidates } from "../worker/portal/inventory.mjs";
import {
  HOSTELS,
  exclusiveHostelNames,
  findHostel,
  formatNaira,
  hostelsFor,
  resolveBookingTarget,
  textNamesHostel,
} from "../lib/hostels.mjs";

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

test("the catalogue matches the published SUG list", () => {
  assert.equal(hostelsFor("male").length, 6);
  assert.equal(hostelsFor("female").length, 7);
  assert.deepEqual(hostelsFor("male").map((hostel) => hostel.price), [60_000, 50_000, 110_000, 130_000, 150_000, 180_000]);
  assert.deepEqual(hostelsFor("female").map((hostel) => hostel.price), [50_000, 50_000, 60_000, 110_000, 130_000, 150_000, 180_000]);
  assert.equal(findHostel("boys-needs-assessment-2").price, 180_000);
  assert.deepEqual(findHostel("girls-needs-assessment-4").rooms, ["Room of 4"]);
  assert.equal(new Set(HOSTELS.map((hostel) => hostel.id)).size, HOSTELS.length);
  assert.equal(formatNaira(60_000), "\u20a660,000");
  for (const hostel of HOSTELS) assert.ok(hostel.gender === "male" || hostel.gender === "female", hostel.id);
});

test("a boys' hostel can never be booked for a girls' choice", () => {
  assert.throws(
    () => resolveBookingTarget({ gender: "female", hostelId: "boys-bosso" }),
    (error) => error.code === "hostel_gender_mismatch",
  );
  assert.throws(() => resolveBookingTarget({ gender: "male", hostelId: "girls-medical" }), /girls' hostel/i);
  assert.throws(() => resolveBookingTarget({ gender: "male", hostelId: "not-a-hostel" }), (error) => error.code === "hostel_unknown");
  assert.throws(() => resolveBookingTarget({ gender: "male" }), (error) => error.code === "hostel_required");
  assert.throws(() => resolveBookingTarget({ gender: "other", hostelId: "boys-bosso" }), (error) => error.code === "gender_required");

  const target = resolveBookingTarget({ gender: "female", hostelId: "girls-bosso" });
  assert.equal(target.portalName, "Bosso Girls Hostel");
  assert.deepEqual(target.rooms, []);
});

test("the gender guard only blocks hostels the other gender alone has", () => {
  assert.ok(exclusiveHostelNames("male").includes("Old Girls Hostel"));
  assert.ok(exclusiveHostelNames("male").includes("Bosso Girls Hostel"));
  assert.ok(!exclusiveHostelNames("male").includes("Medical Hostel"));
  assert.ok(!exclusiveHostelNames("male").includes("Needs Assessment Hostel"));
  assert.ok(exclusiveHostelNames("female").includes("Block A & B"));
  assert.ok(!exclusiveHostelNames("female").includes("Medical Hostel"));
  assert.equal(crossesGender("Old Girls Hostel", "male"), true);
  assert.equal(crossesGender("Bosso Girls Hostel", "male"), true);
  assert.equal(crossesGender("Bosso Boys Hostel", "male"), false);
});

function scanOf(...texts) {
  return {
    rows: texts.map((text) => ({ text, tag: "tr", actions: [{ id: "a0", kind: "click", text: "Book now", href: null, name: null }] })),
    selects: [],
    forms: [],
    iframeCount: 0,
  };
}

test("any-room matching books only the chosen hostel", () => {
  const mixed = scanOf(
    "Bosso Boys Hostel Room of 4 Available Book now",
    "Bosso Girls Hostel Room of 4 Available Book now",
    "Old Girls Hostel Room of 4 Available Book now",
  );
  const forGirl = toCandidates(mixed, { hostel: "Bosso Girls Hostel", preferences: [], gender: "female" });
  assert.equal(forGirl.length, 1);
  assert.equal(forGirl[0].roomPreference, ANY_ROOM);
  assert.match(forGirl[0].rowText, /Bosso Girls Hostel/);
  assert.deepEqual(chooseCandidate(forGirl, []).preference, ANY_ROOM);

  const forBoy = toCandidates(mixed, { hostel: "Bosso Boys Hostel", preferences: [], gender: "male" });
  assert.equal(forBoy.length, 1);
  assert.match(forBoy[0].rowText, /Bosso Boys Hostel/);

  const unavailable = toCandidates(scanOf("Medical Hostel Room of 4 Available Book now"), {
    hostel: "Bosso Girls Hostel", preferences: [], gender: "female",
  });
  assert.equal(unavailable.length, 0, "a different hostel must never be booked as a fallback");
});

test("the gender guard skips the other gender's rows even on a mixed page", () => {
  const mixed = scanOf(
    "Old Girls Hostel Room of 4 Available Book now",
    "Block A & B Room of 4 Available Book now",
  );
  const candidates = toCandidates(mixed, { hostel: "Block A & B", hostelAliases: ["block a and b", "block a"], preferences: [], gender: "male" });
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].rowText, /Block A & B/);

  const wrongOnly = toCandidates(scanOf("Medical Hostel Room of 4 Available Book now"), {
    hostel: "Medical Hostel", preferences: [], gender: "male",
    hostelAliases: [],
  });
  assert.equal(wrongOnly.length, 1, "a shared hostel name is still bookable");
});

test("hostel names are matched strictly for any-room bookings", () => {
  assert.equal(textNamesHostel("Block A & B \u00b7 Room of 4", "Block A & B"), true);
  assert.equal(textNamesHostel("Block A and B hostel", "Block A & B", ["block a and b"]), true);
  assert.equal(textNamesHostel("Block C hostel", "Block A & B", ["block a", "block b"]), false);
  assert.equal(textNamesHostel("Old Girls' Hostel", "Old Girls Hostel", ["old girls"]), true);
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
