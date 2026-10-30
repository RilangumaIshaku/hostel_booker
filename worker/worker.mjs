import { createDecipheriv, createHmac } from "node:crypto";
import { chromium } from "playwright";

const portalUrl = "https://eportal.futminna.edu.ng/ePortal_V2/std/index.php";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const idlePollMs = Number(process.env.WORKER_IDLE_POLL_MS ?? 60_000);
const rushPollMs = Number(process.env.WORKER_RUSH_POLL_MS ?? 1000);

if (!supabaseUrl || !serviceKey || !process.env.PORTAL_DATA_ENCRYPTION_KEY) {
  throw new Error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PORTAL_DATA_ENCRYPTION_KEY before starting the worker.");
}

function decrypt(userId, envelope) {
  const [version, nonceHex, tagHex, ciphertextHex] = envelope.split(":");
  const masterKey = Buffer.from(process.env.PORTAL_DATA_ENCRYPTION_KEY, "base64");
  if (version !== "v1" || masterKey.length !== 32 || !nonceHex || !tagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted portal credential or encryption key.");
  }
  const key = createHmac("sha256", masterKey).update(`futminna-portal:${userId}`).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonceHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}

async function api(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

async function claimJob() {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_due_booking_job`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_worker_id: workerId }),
  });
  if (!response.ok) throw new Error(`Could not claim a booking job (${response.status}).`);
  const jobs = await response.json();
  return jobs[0] ?? null;
}

async function waitForNextJob() {
  const rows = await api("booking_jobs?status=eq.armed&select=starts_at&order=starts_at.asc&limit=1");
  const next = rows[0]?.starts_at ? new Date(rows[0].starts_at).getTime() : null;
  if (next === null || !Number.isFinite(next)) return idlePollMs;
  const until = next - Date.now();
  if (until > 20_000) return Math.min(idlePollMs, until - 15_000);
  return rushPollMs;
}

async function updateJob(id, values) {
  return api(`booking_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  });
}

async function preparePortalSession(job) {
  const rows = await api(`portal_connections?user_id=eq.${encodeURIComponent(job.user_id)}&select=encrypted_username,encrypted_password`);
  const connection = rows[0];
  if (!connection) throw new Error("PORTAL_CONNECTION_MISSING");

  const username = decrypt(job.user_id, connection.encrypted_username);
  const password = decrypt(job.user_id, connection.encrypted_password);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const welcome = page.getByRole("heading", { name: "Welcome," });
    if (!(await welcome.count())) {
      const userField = page.getByPlaceholder("Enter User ID/Username", { exact: true }).filter({ visible: true });
      const passField = page.getByPlaceholder("Enter Password", { exact: true }).filter({ visible: true });
      if (await userField.count() !== 1 || await passField.count() !== 1) {
        throw new Error("PORTAL_LOGIN_LAYOUT_CHANGED");
      }
      await userField.fill(username);
      await passField.fill(password);
      await page.getByRole("button", { name: "Login", exact: true }).click();
      await welcome.waitFor({ state: "visible", timeout: 60_000 });
    }

    // The accommodation page and its controls are not currently inspectable.
    // Stop here until an observed portal adapter is implemented; never guess a room.
    return "PORTAL_SESSION_READY_ACCOMMODATION_FLOW_UNAVAILABLE";
  } finally {
    await context.close();
    await browser.close();
  }
}

async function processJob(job) {
  try {
    const resultCode = await preparePortalSession(job);
    await updateJob(job.id, {
      status: "needs_attention",
      result_code: resultCode,
      result_message: "Portal sign-in was checked. Accommodation controls have not been verified, so no room was selected or submitted.",
      last_checked_at: new Date().toISOString(),
    });
  } catch (error) {
    const code = error.message === "PORTAL_CONNECTION_MISSING"
      ? "portal_connection_missing"
      : error.message === "PORTAL_LOGIN_LAYOUT_CHANGED"
        ? "portal_login_layout_changed"
        : "portal_session_check_failed";
    await updateJob(job.id, {
      status: "needs_attention",
      result_code: code,
      result_message: "The worker could not confirm a ready portal session. No booking was submitted.",
      last_checked_at: new Date().toISOString(),
    });
    process.stderr.write(`Job ${job.id}: ${code}\n`);
  }
}

async function main() {
  process.stdout.write(`FUTMINNA worker ${workerId} started.\n`);
  for (;;) {
    if (process.env.BOOKING_AUTOMATION_ENABLED !== "true") {
      await new Promise((resolve) => setTimeout(resolve, idlePollMs));
      continue;
    }
    try {
      const job = await claimJob();
      if (job) await processJob(job);
    } catch (error) {
      process.stderr.write(`Worker loop error: ${error.message}\n`);
    }
    let waitMs = idlePollMs;
    try { waitMs = await waitForNextJob(); }
    catch (error) { process.stderr.write(`Schedule lookup failed: ${error.message}\n`); }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
