import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MOCK_LOGIN, MOCK_PASSWORD, startMockPortal } from "./fixtures/mock-portal.mjs";
import { login, openSection, openSession } from "../worker/portal/session.mjs";
import { bookRoom, feesCheck } from "../worker/portal/booker.mjs";
import { resolveBookingTarget } from "../lib/hostels.mjs";

const HOSTEL = "Needs Assessment Hostel";
const PREFERENCES = ["Room of 2", "Room of 4"];

function targetFor(gender, hostelId) {
  const target = resolveBookingTarget({ gender, hostelId });
  return {
    hostel: target.portalName,
    hostelAliases: target.aliases,
    preferences: target.rooms,
    gender: target.gender,
  };
}

async function withPortal(portalOptions, run) {
  const portal = await startMockPortal(portalOptions);
  const profile = await mkdtemp(join(tmpdir(), "hostel-booker-test-"));
  const session = await openSession({ profileDir: profile, headless: true });
  try {
    await login(session.page, { username: MOCK_LOGIN, password: MOCK_PASSWORD, portalUrl: portal.url });
    await run({ portal, page: session.page });
  } finally {
    await session.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
    await portal.close();
  }
}

test("books the first preference when it is available", { timeout: 90_000 }, async () => {
  await withPortal({}, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, hostel: HOSTEL, preferences: PREFERENCES, deadline: Date.now() + 45_000 });
    assert.equal(result.outcome, "confirmed", JSON.stringify(result));
    assert.equal(result.preference, "Room of 2");
    assert.deepEqual(portal.state.bookings, ["Room of 2"]);
    assert.equal(portal.state.requests.filter((entry) => entry === "POST /std/book.php").length, 1);
  });
});

test("falls back to the second preference when the first is sold out", { timeout: 90_000 }, async () => {
  await withPortal({ mode: "room4only" }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, hostel: HOSTEL, preferences: PREFERENCES, deadline: Date.now() + 45_000 });
    assert.equal(result.outcome, "confirmed", JSON.stringify(result));
    assert.equal(result.preference, "Room of 4");
    assert.deepEqual(portal.state.bookings, ["Room of 4"]);
  });
});

test("never submits when nothing is available", { timeout: 90_000 }, async () => {
  await withPortal({ mode: "soldout" }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, hostel: HOSTEL, preferences: PREFERENCES, deadline: Date.now() + 20_000 });
    assert.equal(result.outcome, "not_available");
    assert.equal(result.reason, "sold_out");
    assert.equal(portal.state.bookings.length, 0);
  });
});

test("waits for a not-yet-open page instead of guessing", { timeout: 90_000 }, async () => {
  await withPortal({ mode: "notopen" }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, hostel: HOSTEL, preferences: PREFERENCES, deadline: Date.now() + 20_000 });
    assert.equal(result.outcome, "not_available");
    assert.equal(result.reason, "not_open");
    assert.equal(portal.state.bookings.length, 0);
  });
});

test("retries through portal 503s before booking", { timeout: 90_000 }, async () => {
  await withPortal({ flakyHostelFailures: 2 }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, hostel: HOSTEL, preferences: PREFERENCES, deadline: Date.now() + 45_000 });
    assert.equal(result.outcome, "confirmed", JSON.stringify(result));
    assert.ok(portal.state.hostelRequests >= 3);
    assert.deepEqual(portal.state.bookings, ["Room of 2"]);
  });
});

test("dry run reports the match without clicking submit", { timeout: 90_000 }, async () => {
  await withPortal({}, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, hostel: HOSTEL, preferences: PREFERENCES, deadline: Date.now() + 20_000, dryRun: true });
    assert.equal(result.outcome, "would_book");
    assert.equal(result.preference, "Room of 2");
    assert.equal(result.submitted, false);
    assert.equal(portal.state.bookings.length, 0);
  });
});

test("books the chosen girls' hostel from a page that lists both genders", { timeout: 90_000 }, async () => {
  await withPortal({ mode: "mixed" }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, ...targetFor("female", "girls-bosso"), deadline: Date.now() + 45_000 });
    assert.equal(result.outcome, "confirmed", JSON.stringify(result));
    assert.deepEqual(portal.state.hostelBookings, [{ hostel: "Bosso Girls Hostel", room: "Room of 4" }]);
    assert.equal(portal.state.requests.filter((entry) => entry === "POST /std/book.php").length, 1);
  });
});

test("a girls' choice never falls back into a boys' hostel", { timeout: 90_000 }, async () => {
  await withPortal({ mode: "mixedGirlsSoldOut" }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, ...targetFor("female", "girls-bosso"), deadline: Date.now() + 20_000 });
    assert.equal(result.outcome, "not_available", JSON.stringify(result));
    assert.equal(result.submitted, false);
    assert.equal(portal.state.bookings.length, 0);
    assert.deepEqual(portal.state.hostelBookings, []);
  });
});

test("an any-room choice never books a different hostel", { timeout: 90_000 }, async () => {
  await withPortal({ mode: "mixedBoysBlockSoldOut" }, async ({ portal, page }) => {
    await openSection(page, { pattern: /hostel|accommodation/i, label: "hostel" });
    const result = await bookRoom({ page, ...targetFor("male", "boys-block-a-b"), deadline: Date.now() + 20_000 });
    assert.equal(result.outcome, "not_available", JSON.stringify(result));
    assert.equal(portal.state.bookings.length, 0);
    assert.deepEqual(portal.state.hostelBookings, []);
  });
});

test("fees check reaches the gateway without paying", { timeout: 90_000 }, async () => {
  await withPortal({}, async ({ portal, page }) => {
    const result = await feesCheck({ page, portalOrigin: portal.origin, deadline: Date.now() + 45_000 });
    assert.equal(result.status, "gateway_reached", JSON.stringify(result));
    assert.equal(result.amount, 48_500);
    assert.equal(portal.state.payRequests, 1, "the fees action should be exercised once");
    assert.equal(portal.state.bookings.length, 0);
    assert.ok(!portal.state.requests.some((entry) => /charge|capture|card/i.test(entry)));
    assert.equal(await page.locator('input[autocomplete="cc-number"]').count(), 0);
  });
});

test("a rejected login is reported instead of retried forever", { timeout: 90_000 }, async () => {
  const portal = await startMockPortal();
  const profile = await mkdtemp(join(tmpdir(), "hostel-booker-test-"));
  const session = await openSession({ profileDir: profile, headless: true });
  try {
    await assert.rejects(
      login(session.page, { username: "student", password: "wrong-password", portalUrl: portal.url }),
      (error) => error.code === "portal_login_rejected",
    );
  } finally {
    await session.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
    await portal.close();
  }
});
