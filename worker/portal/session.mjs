import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  DeadlineExceededError,
  retry,
  waitUntil,
} from "./retry.mjs";
import { detectChallenge, detectInvalidLogin } from "./matching.mjs";

export const DEFAULT_PORTAL_URL = "https://eportal.futminna.edu.ng/ePortal_V2/std/index.php";

export class PortalError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.name = "PortalError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function defaultProfileDir() {
  if (process.env.PORTAL_PROFILE_DIR) return process.env.PORTAL_PROFILE_DIR;
  if (process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, "FUTMINNA Hostel Booker", "browser-profile");
  return join(homedir(), ".local", "share", "futminna-hostel-booker", "browser-profile");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function openSession({ profileDir = defaultProfileDir(), headless = true } = {}) {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1366, height: 900 },
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
    args: ["--disable-dev-shm-usage"],
  });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(30_000);
  const page = context.pages()[0] ?? (await context.newPage());
  return {
    context,
    page,
    close: async () => {
      await context.close().catch(() => {});
    },
  };
}

/** Fresh in-memory browser per job: no cookies or profile leak between students. */
export async function openIsolatedSession({ headless = true } = {}) {
  const browser = await chromium.launch({ headless, args: ["--disable-dev-shm-usage"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
  });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(30_000);
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

export async function bodyText(page) {
  try {
    return await page.locator("body").innerText({ timeout: 5_000 });
  } catch {
    return "";
  }
}

export function showLoginForm(page) {
  return page.locator('input[name="pwd"], input[type="password"]').first().isVisible().catch(() => false);
}

export async function signedIn(page) {
  if (await showLoginForm(page)) return false;
  const text = await bodyText(page);
  if (detectChallenge(text)) return false;
  // Real dashboards vary; any of these mean the portal shell is behind the login.
  return /logout|sign\s*out|welcome|dashboard|my\s+profile|student\s+portal|hostel|accommodation|school\s*fees|course\s*registration|payment/i.test(text);
}

export async function goto(page, url, { deadline = Number.POSITIVE_INFINITY, attempts = 4 } = {}) {
  return retry(
    async () => {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      if (response && [502, 503, 504].includes(response.status())) {
        const error = new PortalError("portal_busy", `The portal returned ${response.status()}.`, { retryable: true });
        throw error;
      }
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      return response;
    },
    { attempts, baseMs: 500, maxMs: 4_000, deadline },
  );
}

export async function openPortal(page, { portalUrl = DEFAULT_PORTAL_URL, deadline } = {}) {
  await goto(page, portalUrl, { deadline });
  const text = await bodyText(page);
  if (detectChallenge(text)) {
    throw new PortalError("portal_security_challenge", "The portal presented a security check. Complete it manually in the browser; the assistant will not bypass it.");
  }
  if (!(await showLoginForm(page)) && !(await signedIn(page))) {
    throw new PortalError("portal_layout_changed", "The portal did not show the expected sign-in fields or a signed-in dashboard.");
  }
  return page;
}

export async function login(page, { username, password, portalUrl = DEFAULT_PORTAL_URL, deadline = Number.POSITIVE_INFINITY } = {}) {
  const current = page.url();
  const startUrl = /^https?:/i.test(current) && !/about:blank/i.test(current) ? current : portalUrl;
  await openPortal(page, { portalUrl: startUrl, deadline });
  if (await signedIn(page)) return { method: "existing_session" };
  if (!username || !password) {
    throw new PortalError("portal_login_required", "The saved portal session has expired and no portal login is configured for automatic sign-in.");
  }

  const usernameField = page.locator('input[name="uid"], input[placeholder*="User ID" i], input[name*="user" i]').first();
  const passwordField = page.locator('input[name="pwd"], input[type="password"]').first();
  const submit = page.locator('button[name="login"], button:has-text("Login"), input[type="submit"][value*="Login" i]').first();

  if (!(await usernameField.isVisible().catch(() => false)) || !(await passwordField.isVisible().catch(() => false))) {
    throw new PortalError("portal_layout_changed", "The expected sign-in fields were not found. No credentials were entered.");
  }

  await usernameField.fill(username);
  await passwordField.fill(password);
  await submit.click();

  const started = Date.now();
  let lastText = "";
  while (Date.now() - started < 60_000) {
    if (Date.now() >= deadline) throw new DeadlineExceededError();
    await sleep(500);
    lastText = await bodyText(page);
    if (detectChallenge(lastText)) {
      throw new PortalError("portal_security_challenge", "The portal requested a CAPTCHA or verification step. Complete it manually; the assistant stopped and did not try to bypass it.");
    }
    if (detectInvalidLogin(lastText)) {
      throw new PortalError("portal_login_rejected", "The portal rejected the saved username or password. Update the connection before the booking window.");
    }
    if (!(await showLoginForm(page))) {
      if (await signedIn(page)) return { method: "form_login" };
      if (page.url() !== startUrl && !/index\.php/i.test(new URL(page.url()).pathname)) {
        return { method: "form_login" };
      }
    }
  }
  throw new PortalError("portal_login_timeout", "The portal did not finish signing in within 60 seconds.");
}

/** Find a link/button by text, preferring a real href so we can GET instead of click. */
export async function findEntry(page, pattern) {
  const elements = page.locator("a[href], button, [role=button], input[type=button], input[type=submit]");
  const count = Math.min(await elements.count().catch(() => 0), 400);
  for (let index = 0; index < count; index += 1) {
    const element = elements.nth(index);
    if (!(await element.isVisible().catch(() => false))) continue;
    const text = (await element.innerText().catch(() => "")) || (await element.getAttribute("value").catch(() => "")) || "";
    if (!pattern.test(text)) continue;
    const href = await element.getAttribute("href").catch(() => null);
    return { element, text: text.trim(), href };
  }
  return null;
}

/**
 * Open a portal section (accommodation, fees). Uses the real link when the
 * portal exposes one, and only falls back to a supplied URL.
 */
export async function openSection(page, { pattern, url, deadline, label }) {
  if (url) {
    await goto(page, url, { deadline });
    return { via: "configured_url", url: page.url() };
  }
  const entry = await findEntry(page, pattern);
  if (!entry) {
    throw new PortalError("portal_section_not_found", `Could not find the ${label} link on the signed-in portal dashboard. Run \`npm run portal:discover\` and share portal-flow.json so the real menu can be mapped.`);
  }
  if (entry.href && !/^javascript:/i.test(entry.href) && !entry.href.startsWith("#")) {
    const target = new URL(entry.href, page.url()).toString();
    await goto(page, target, { deadline });
    return { via: "link", label: entry.text, url: page.url() };
  }
  const popupPromise = page.context().waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  await entry.element.click();
  const popup = await popupPromise;
  const active = popup ?? page;
  await active.waitForLoadState("domcontentloaded").catch(() => {});
  return { via: "click", label: entry.text, url: active.url(), page: active };
}

export { sleep, waitUntil };
