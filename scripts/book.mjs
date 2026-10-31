#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  DEFAULT_PORTAL_URL,
  defaultProfileDir,
  goto,
  login,
  openSession,
  openSection,
  showLoginForm,
  signedIn,
  sleep,
  waitUntil,
} from "../worker/portal/session.mjs";
import { bookRoom, discoverPortal, feesCheck } from "../worker/portal/booker.mjs";
import { describePage, redact, scanRows } from "../worker/portal/inventory.mjs";
import { mergeSpecPage, readSpec, sectionUrl, SPEC_DIR, specPath } from "../worker/portal/spec.mjs";
import { isTransient } from "../worker/portal/retry.mjs";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}
loadLocalEnv();

const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith("-") ? argv.shift() : "book";

function takeFlag(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  if (index >= 0) {
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      argv.splice(index, 2);
      return value;
    }
    argv.splice(index, 1);
    return true;
  }
  const prefix = `--${name}=`;
  const equals = argv.findIndex((value) => value.startsWith(prefix));
  if (equals >= 0) {
    const value = argv[equals].slice(prefix.length);
    argv.splice(equals, 1);
    return value;
  }
  return fallback;
}

const hasFlag = (name) => takeFlag(name, false) === true;
const lagosTime = () => new Date().toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour12: false });
const log = (message) => console.log(`${lagosTime()} ${message}`);

function usage() {
  console.log(`FUTMINNA portal runner

  npm run portal:login                       Sign in once in a real browser
  npm run portal:record -- --label accommodation
                                             Capture the real hostel page after you open it
  npm run portal:discover                    Read-only crawl of the signed-in portal
  npm run portal:fees                        School-fees pipeline test (never pays)
  npm run portal:book -- --now --dry-run     Show what would be booked, click nothing
  npm run portal:book -- --at 2026-11-06T09:00:00 --live
                                             Timed booking rush

Options:
  --at <time>       ISO time with offset, or a Lagos HH:MM
  --now             Start immediately
  --live            Actually submit the booking (default is a dry run)
  --headed          Show the browser
  --profile <dir>   Browser profile directory
  --portal <url>    Override the portal URL
  --url <url>       Override the accommodation page URL
  --rooms "Room of 2,Room of 4"
  --poll <ms>       Poll interval during the rush (default 800)
  --window <min>    Keep trying this long after the start time (default 10)
  --label <name>    Capture label for record (default accommodation)
`);
}

function pressEnter(prompt) {
  if (!process.stdin.isTTY) return Promise.resolve();
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(prompt, () => {
    terminal.close();
    resolve();
  }));
}

function parseStart(value) {
  if (!value || value === true) return null;
  const text = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return Date.parse(`${today}T${text.padStart(5, "0")}:00+01:00`);
  }
  const withOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}+01:00`;
  const parsed = Date.parse(withOffset);
  return Number.isFinite(parsed) ? parsed : null;
}

const options = {
  portalUrl: String(takeFlag("portal", process.env.PORTAL_URL) || ""),
  profileDir: String(takeFlag("profile", defaultProfileDir())),
  headed: hasFlag("headed"),
  live: hasFlag("live"),
  showHelp: hasFlag("help"),
  now: hasFlag("now"),
};
const spec = readSpec();
const portalUrl = options.portalUrl || spec.portalUrl || DEFAULT_PORTAL_URL;
const portalOrigin = new URL(portalUrl).origin;
const hostel = String(takeFlag("hostel", process.env.PORTAL_HOSTEL || "Needs Assessment Hostel"));
const preferences = String(takeFlag("rooms", process.env.PORTAL_ROOMS || "Room of 2,Room of 4"))
  .split(",").map((value) => value.trim()).filter(Boolean);
const credentials = {
  username: process.env.PORTAL_USERNAME || "",
  password: process.env.PORTAL_PASSWORD || "",
};

function saveResult(result, extra = {}) {
  const dir = join(SPEC_DIR, "results");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `result-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), portalUrl, hostel, preferences, ...extra, result }, null, 2)}\n`, { mode: 0o600 });
  return file;
}

function summarize(result) {
  switch (result.outcome) {
    case "confirmed": return "BOOKING CONFIRMED by the portal. Check the portal receipt before paying.";
    case "would_book": return `Dry run: would book ${result.preference}. Nothing was clicked.`;
    case "not_available": return `No matching room yet (${result.reason}).`;
    case "rejected": return "The portal rejected the booking attempt.";
    case "requires_user_confirmation": return "The portal asked for payment confirmation. Complete it yourself; nothing was charged.";
    case "security_challenge": return "The portal asked for a CAPTCHA/verification. Complete it manually.";
    case "session_expired": return "The portal session expired. Run npm run portal:login and try again.";
    case "needs_attention": return `The page could not be read safely (${result.reason}). Nothing further was submitted.`;
    case "unconfirmed": return "A submission may have reached the portal but no confirmation was read. CHECK THE PORTAL NOW; do not re-run blindly.";
    default: return `Result: ${result.outcome}`;
  }
}

async function ensureSignedIn(page, { interactive }) {
  await goto(page, portalUrl);
  if (await signedIn(page)) return "existing_session";
  if (interactive) {
    log("Sign in to the official portal in the browser window that just opened.");
    await pressEnter("Press Enter here once the signed-in dashboard is visible: ");
    if (!(await signedIn(page))) throw new Error("The portal still does not look signed in. Nothing was saved.");
    return "manual_login";
  }
  return (await login(page, { ...credentials, portalUrl })).method;
}

async function runLogin() {
  const session = await openSession({ profileDir: options.profileDir, headless: false });
  try {
    const method = await ensureSignedIn(session.page, { interactive: true });
    log(`Portal session ready (${method}). The profile is saved at ${options.profileDir}.`);
    log("The password was typed into the portal, not into this tool, and is not stored by it.");
  } finally {
    await session.close();
  }
}

async function runRecord() {
  const label = String(takeFlag("label", "accommodation"));
  const session = await openSession({ profileDir: options.profileDir, headless: false });
  try {
    const page = session.page;
    await ensureSignedIn(page, { interactive: true });
    log("In the browser, open the page you want to capture (for example the hostel/room page).");
    log("Do not click Book yet; just open the page so its controls are visible.");
    await pressEnter("Press Enter here once that page is showing: ");
    const description = await describePage(page);
    const scan = await scanRows(page);
    const dir = join(SPEC_DIR, "captures");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const captureFile = join(dir, `${label}-${stamp}.json`);
    const capture = {
      capturedAt: new Date().toISOString(),
      label,
      url: description.url,
      title: description.title,
      headings: description.headings,
      links: description.links,
      buttons: description.buttons,
      inputs: description.inputs,
      iframes: description.iframes,
      forms: scan.forms,
      selects: scan.selects,
      rows: scan.rows,
      text: redact(description.text),
    };
    writeFileSync(captureFile, `${JSON.stringify(capture, null, 2)}\n`, { mode: 0o600 });
    const screenshotFile = join(dir, `${label}-${stamp}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: true }).catch(() => {});
    mergeSpecPage(label, { url: page.url(), title: description.title }, { portalUrl });
    log(`Captured "${label}" at ${page.url()}`);
    log(`Found ${scan.rows.length} room-like rows and ${scan.selects.length} dropdowns.`);
    log(`Saved ${captureFile} and ${screenshotFile}. These files stay local (.portal/ is gitignored).`);
    log(`The runner will now open ${specPath()} for the ${label} URL.`);
    await pressEnter("Press Enter to close the browser: ");
  } finally {
    await session.close();
  }
}

async function runDiscover() {
  const session = await openSession({ profileDir: options.profileDir, headless: !options.headed });
  try {
    const page = session.page;
    await ensureSignedIn(page, { interactive: options.headed });
    const capture = await discoverPortal(page, { portalUrl, portalOrigin });
    const dir = join(SPEC_DIR, "captures");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `discovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, `${JSON.stringify(capture, null, 2)}\n`, { mode: 0o600 });
    for (const entry of capture.pages) {
      if (entry.url && ["accommodation", "fees"].includes(entry.name)) {
        mergeSpecPage(entry.name, { url: entry.url, title: entry.title }, { portalUrl });
      }
    }
    for (const entry of capture.pages) {
      if (entry.error) log(`${entry.name}: ${entry.error}`);
      else log(`${entry.name}: ${entry.url} · ${entry.rows?.length ?? 0} rows · ${entry.selects?.length ?? 0} dropdowns`);
    }
    log(`Saved ${file}. Share that file (it redacts emails and long numbers) to finish the adapter.`);
  } finally {
    await session.close();
  }
}

async function runFees() {
  const session = await openSession({ profileDir: options.profileDir, headless: !options.headed });
  try {
    const page = session.page;
    await ensureSignedIn(page, { interactive: options.headed });
    const result = await feesCheck({
      page,
      portalOrigin,
      deadline: Date.now() + Number(takeFlag("window", "5")) * 60_000,
      url: takeFlag("url", sectionUrl(spec, "fees")) || undefined,
    });
    const file = saveResult(result, { mode: "fees_check" });
    console.log(JSON.stringify(result, null, 2));
    log(`Saved ${file}`);
    const safe = ["gateway_reached", "fees_page_confirmed", "card_form_reached"].includes(result.status);
    log(safe
      ? "The fees pipeline reached the payment handoff. Nothing was paid and no card details were entered."
      : `The fees pipeline stopped early (${result.status}).`);
    if (!safe) process.exitCode = 1;
  } finally {
    await session.close();
  }
}

function randomDelay(base) {
  return Math.round(base * (0.85 + Math.random() * 0.4));
}

async function runBook() {
  const start = options.now ? Date.now() : parseStart(takeFlag("at", process.env.PORTAL_START));
  if (!start) {
    usage();
    process.exitCode = 2;
    return;
  }
  const pollMs = Math.max(250, Number(takeFlag("poll", "800")));
  const windowMinutes = Number(takeFlag("window", "10"));
  const warmupMs = Number(takeFlag("warmup", "180")) * 1_000;
  const until = start + windowMinutes * 60_000;
  if (until < Date.now()) {
    log("That booking window has already closed. Use --now to run a check.");
    process.exitCode = 2;
    return;
  }

  log(`${options.live ? "LIVE" : "DRY RUN"} · hostel: ${hostel} · order: ${preferences.join(" -> ")}`);
  log(`Start: ${new Date(start).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} (Lagos) · keep trying until ${new Date(until).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`);

  const session = await openSession({ profileDir: options.profileDir, headless: !options.headed });
  const mainPage = session.page;
  let current = mainPage;
  let accommodationUrl = String(takeFlag("url", sectionUrl(spec, "accommodation")) || "");
  let finalResult = null;
  let attempts = 0;
  let consecutiveErrors = 0;

  try {
    await waitUntil(Math.max(Date.now(), start - warmupMs));
    log("Pre-warming the portal session...");
    try {
      const method = await ensureSignedIn(current, { interactive: options.headed });
      log(`Session ready (${method}).`);
    } catch (error) {
      log(`Could not pre-warm the session: ${error.message}`);
      if (!options.headed) throw error;
    }

    await waitUntil(Math.max(Date.now(), start));
    log("Booking window reached. Polling the portal.");

    while (Date.now() < until) {
      if (current.isClosed()) current = mainPage;
      attempts += 1;
      try {
        if (await showLoginForm(current)) {
          log("Session expired; signing in again.");
          await login(current, { ...credentials, portalUrl });
        }
        let sectionPage = current;
        if (accommodationUrl) {
          await goto(current, accommodationUrl, { deadline: until });
        } else {
          await goto(current, portalUrl, { deadline: until });
          const opened = await openSection(current, {
            pattern: /hostel|accommodation|residence|room\s*allocation/i,
            label: "hostel accommodation",
            deadline: until,
          });
          sectionPage = opened.page ?? current;
          current = sectionPage;
          if (opened.url && opened.url !== portalUrl && /hostel|accommodation|residence|room/i.test(opened.url)) {
            accommodationUrl = opened.url;
            mergeSpecPage("accommodation", { url: opened.url }, { portalUrl });
            log(`Learned the accommodation page URL: ${opened.url}`);
          }
        }

        const result = await bookRoom({
          page: sectionPage,
          hostel,
          preferences,
          deadline: until,
          dryRun: !options.live,
        });
        finalResult = result;
        consecutiveErrors = 0;
        log(`Attempt ${attempts}: ${result.outcome}${result.preference ? ` (${result.preference})` : ""}${result.reason ? ` · ${result.reason}` : ""}`);

        if (result.submitted || ["confirmed", "rejected", "requires_user_confirmation", "security_challenge", "session_expired", "would_book"].includes(result.outcome)) {
          break;
        }
        if (result.reason === "portal_section_not_found") accommodationUrl = "";
      } catch (error) {
        consecutiveErrors += 1;
        log(`Attempt ${attempts} failed: ${error.code ?? "error"} · ${redact(error.message)}`);
        if (error.code === "portal_section_not_found" || error.code === "portal_layout_changed") accommodationUrl = "";
        if (error.code === "portal_security_challenge") break;
        if (error.code === "portal_login_required" || error.code === "portal_login_rejected") break;
        if (!isTransient(error) && !["portal_section_not_found", "portal_layout_changed", "portal_login_required"].includes(error.code) && consecutiveErrors >= 3) break;
        if (consecutiveErrors >= 8) {
          log("Stopping after 8 consecutive failures. The portal may be overloaded or blocking this network.");
          break;
        }
      }
      if (options.live === false) break;
      await sleep(Math.min(randomDelay(pollMs), Math.max(0, until - Date.now())));
    }

    if (!finalResult) {
      log("No booking attempt completed before the window closed.");
      process.exitCode = 1;
      return;
    }
    const file = saveResult(finalResult, { mode: options.live ? "live_booking" : "dry_run", attempts });
    console.log(JSON.stringify(finalResult, null, 2));
    log(`Saved ${file}`);
    log(summarize(finalResult));
    if (["confirmed", "would_book"].includes(finalResult.outcome)) process.exitCode = 0;
    else if (finalResult.submitted) process.exitCode = 2;
    else process.exitCode = 1;
  } finally {
    await session.close();
  }
}

async function main() {
  if (options.showHelp || command === "help") {
    usage();
    return;
  }
  switch (command) {
    case "login": return runLogin();
    case "record": return runRecord();
    case "discover": return runDiscover();
    case "fees": return runFees();
    case "book":
    case "check": return runBook();
    default:
      log(`Unknown command: ${command}`);
      usage();
      process.exitCode = 2;
  }
}

main().catch((error) => {
  log(`Stopped: ${redact(error.message)}`);
  process.exitCode = 1;
});
