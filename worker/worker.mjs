import { createDecipheriv, createHmac } from "node:crypto";
import {
  DEFAULT_PORTAL_URL,
  goto as gotoWithRetry,
  login,
  openIsolatedSession,
  openSection,
  showLoginForm,
  signedIn,
  sleep,
  waitUntil,
} from "./portal/session.mjs";
import { bookRoom } from "./portal/booker.mjs";
import { readSpec, sectionUrl } from "./portal/spec.mjs";
import { isTransient } from "./portal/retry.mjs";
import { redact } from "./portal/inventory.mjs";
import { describePreference, resolveBookingTarget } from "../lib/hostels.mjs";

const portalUrl = process.env.PORTAL_URL || DEFAULT_PORTAL_URL;
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const idlePollMs = Number(process.env.WORKER_IDLE_POLL_MS ?? 60_000);
const rushPollMs = Number(process.env.WORKER_RUSH_POLL_MS ?? 1_000);
const maxRuntimeMs = Number(process.env.WORKER_MAX_RUNTIME_MS ?? 0);
const claimLeadSeconds = Number(process.env.PORTAL_CLAIM_LEAD_SECONDS ?? 150);
const jobWindowMs = Number(process.env.PORTAL_JOB_WINDOW_MINUTES ?? 10) * 60_000;
const portalPollMs = Math.max(250, Number(process.env.PORTAL_POLL_MS ?? 800));
const headless = process.env.PORTAL_WORKER_HEADLESS !== "false";

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
  const leadBody = JSON.stringify({ p_worker_id: workerId, p_lead_seconds: claimLeadSeconds });
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_booking_job`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: leadBody,
  });
  if (response.ok) {
    const jobs = await response.json();
    return jobs[0] ?? null;
  }
  // Older deployments may not have the rush migration yet.
  const fallback = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_due_booking_job`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_worker_id: workerId }),
  });
  if (!fallback.ok) throw new Error(`Could not claim a booking job (${response.status}/${fallback.status}).`);
  const jobs = await fallback.json();
  return jobs[0] ?? null;
}

async function waitForNextJob() {
  const rows = await api("booking_jobs?status=eq.armed&select=starts_at&order=starts_at.asc&limit=1");
  const next = rows[0]?.starts_at ? new Date(rows[0].starts_at).getTime() : null;
  if (next === null || !Number.isFinite(next)) return idlePollMs;
  const until = next - Date.now();
  if (until <= 0) return rushPollMs;
  if (until <= 180_000) return rushPollMs;
  return Math.min(idlePollMs, Math.max(1_000, until - 120_000));
}

async function updateJob(id, values) {
  return api(`booking_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  });
}

/** Never re-arm a job that may already have submitted. Surface it for a human. */
async function recoverInterruptedJobs() {
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  try {
    await api(`booking_jobs?status=eq.running&claimed_at=lt.${encodeURIComponent(cutoff)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "needs_attention",
        result_code: "worker_interrupted",
        result_message: "The worker stopped before reporting a result. Check the portal before scheduling another attempt.",
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    process.stderr.write(`Could not recover interrupted jobs: ${error.message}\n`);
  }
}

async function portalCredentials(userId) {
  const rows = await api(`portal_connections?user_id=eq.${encodeURIComponent(userId)}&select=encrypted_username,encrypted_password`);
  const connection = rows[0];
  if (!connection) throw Object.assign(new Error("PORTAL_CONNECTION_MISSING"), { code: "portal_connection_missing" });
  return {
    username: decrypt(userId, connection.encrypted_username),
    password: decrypt(userId, connection.encrypted_password),
  };
}

async function openPortalSession(job) {
  const credentials = await portalCredentials(job.user_id);
  const session = await openIsolatedSession({ headless });
  try {
    await login(session.page, { ...credentials, portalUrl });
    return { ...session, credentials };
  } catch (error) {
    await session.close();
    throw error;
  }
}

function terminalStatus(result) {
  switch (result.outcome) {
    case "confirmed":
      return {
        status: "confirmed",
        result_code: "booking_confirmed",
        result_message: "The portal confirmed the booking. Complete payment on the official portal.",
      };
    case "rejected":
      return {
        status: "failed",
        result_code: "booking_rejected",
        result_message: "The portal rejected the booking attempt. Check the portal for the exact reason.",
      };
    case "unconfirmed":
      return {
        status: "unconfirmed",
        result_code: "booking_unconfirmed",
        result_message: "A submission may have reached the portal but no confirmation was read. Check the portal now; do not submit again blindly.",
      };
    case "requires_user_confirmation":
      return {
        status: "needs_attention",
        result_code: "payment_confirmation_required",
        result_message: "The portal asked for a payment confirmation. Complete it yourself on the portal.",
      };
    case "security_challenge":
      return {
        status: "needs_attention",
        result_code: "portal_security_challenge",
        result_message: "The portal requested a CAPTCHA or verification step. Complete it manually; nothing was bypassed.",
      };
    case "session_expired":
      return {
        status: "needs_attention",
        result_code: "portal_session_expired",
        result_message: "The portal session expired before the booking could be submitted.",
      };
    case "would_book":
      return {
        status: "needs_attention",
        result_code: "dry_run_only",
        result_message: `Found ${describePreference(result.preference)}, but the worker was in dry-run mode.`,
      };
    default:
      return {
        status: "needs_attention",
        result_code: result.reason ?? result.outcome ?? "booking_not_completed",
        result_message: "The booking was not completed. No unverified room was submitted.",
      };
  }
}

async function processSessionCheck(job) {
  let session;
  try {
    session = await openPortalSession(job);
    if (!(await signedIn(session.page))) throw Object.assign(new Error("Portal not signed in."), { code: "portal_session_check_failed" });
    await updateJob(job.id, {
      status: "session_checked",
      result_code: "portal_session_ready",
      result_message: "Portal sign-in was confirmed. This was a sign-in-only dry run; no room was selected or submitted.",
      last_checked_at: new Date().toISOString(),
    });
    process.stdout.write(`Job ${job.id}: session ready.\n`);
  } catch (error) {
    const code = error.code ?? "portal_session_check_failed";
    await updateJob(job.id, {
      status: "needs_attention",
      result_code: code,
      result_message: code === "portal_security_challenge"
        ? "The portal requested a security check. Complete it manually; the worker stopped and did not try to bypass it."
        : "The worker could not confirm a ready portal session. No booking was submitted.",
      last_checked_at: new Date().toISOString(),
    }).catch(() => {});
    process.stderr.write(`Job ${job.id}: ${code} (${redact(error.message)})\n`);
  } finally {
    await session?.close();
  }
}

async function processBooking(job) {
  // Resolve the saved choice before touching the portal. A hostel that belongs
  // to the other gender stops the job here; nothing is signed in or clicked.
  let target = null;
  if (job.hostel_id) {
    try {
      target = resolveBookingTarget({ gender: job.gender, hostelId: job.hostel_id });
    } catch (error) {
      await updateJob(job.id, {
        status: "needs_attention",
        result_code: error.code ?? "invalid_hostel_choice",
        result_message: error.message,
        last_checked_at: new Date().toISOString(),
      });
      process.stderr.write(`Job ${job.id}: ${error.code ?? "invalid_hostel_choice"}\n`);
      return;
    }
  }

  const startAt = new Date(job.starts_at).getTime();
  const until = Math.max(startAt + jobWindowMs, Date.now() + 60_000);
  const hostelName = target?.portalName ?? job.hostel_preference ?? "Needs Assessment Hostel";
  const hostelAliases = target?.aliases ?? [];
  const preferences = target ? target.rooms : (Array.isArray(job.room_preferences) ? job.room_preferences : []);
  const gender = target?.gender ?? job.gender ?? null;
  const spec = readSpec();
  let accommodationUrl = sectionUrl(spec, "accommodation") ?? "";
  let session;
  let page;
  let lastResult = null;
  let attempts = 0;
  let consecutiveErrors = 0;

  try {
    session = await openPortalSession(job);
    page = session.page;
    process.stdout.write(`Job ${job.id}: signed in for ${hostelName}${gender ? ` (${gender})` : ""}; waiting for ${new Date(startAt).toISOString()}.\n`);

    if (Date.now() < startAt) await waitUntil(startAt, { chunkMs: 500 });
    process.stdout.write(`Job ${job.id}: booking window reached.\n`);

    while (Date.now() < until) {
      attempts += 1;
      try {
        if (await showLoginForm(page)) {
          process.stdout.write(`Job ${job.id}: session expired; signing in again.\n`);
          await login(page, { ...session.credentials, portalUrl });
        }

        if (accommodationUrl) {
          await gotoWithRetry(page, accommodationUrl, { deadline: until });
        } else {
          await gotoWithRetry(page, portalUrl, { deadline: until });
          const opened = await openSection(page, {
            pattern: /hostel|accommodation|residence|room\s*allocation/i,
            label: "hostel accommodation",
            deadline: until,
          });
          page = opened.page ?? page;
          if (opened.url && opened.url !== portalUrl && /hostel|accommodation|residence|room/i.test(opened.url)) {
            accommodationUrl = opened.url;
            process.stdout.write(`Job ${job.id}: accommodation page is ${opened.url}.\n`);
          }
        }

        if (await showLoginForm(page)) {
          await login(page, { ...session.credentials, portalUrl });
          continue;
        }

        const result = await bookRoom({
          page,
          hostel: hostelName,
          hostelAliases,
          preferences,
          gender,
          deadline: until,
          onBeforeSubmit: async (info) => {
            await updateJob(job.id, {
              status: "booking_pending",
              result_code: "submitting_booking",
              result_message: `Submitting ${describePreference(info.preference)} for ${hostelName}.`,
              last_checked_at: new Date().toISOString(),
            }).catch(() => {});
          },
        });
        lastResult = result;
        consecutiveErrors = 0;
        process.stdout.write(`Job ${job.id}: attempt ${attempts} -> ${result.outcome}${result.reason ? ` (${result.reason})` : ""}\n`);

        if (result.submitted || ["confirmed", "rejected", "requires_user_confirmation", "security_challenge", "session_expired"].includes(result.outcome)) break;
        if (result.reason === "portal_section_not_found") accommodationUrl = "";
      } catch (error) {
        consecutiveErrors += 1;
        process.stderr.write(`Job ${job.id}: attempt ${attempts} failed: ${error.code ?? "error"} (${redact(error.message)})\n`);
        if (error.code === "portal_section_not_found" || error.code === "portal_layout_changed") accommodationUrl = "";
        if (error.code === "portal_security_challenge" || error.code === "portal_login_rejected") {
          lastResult = { outcome: "security_challenge", reason: error.code };
          break;
        }
        if (!isTransient(error) && !["portal_section_not_found", "portal_layout_changed", "portal_login_required"].includes(error.code) && consecutiveErrors >= 3) break;
        if (consecutiveErrors >= 10) break;
      }
      await sleep(portalPollMs + Math.round(Math.random() * portalPollMs * 0.4));
    }

    const final = lastResult ?? { outcome: "needs_attention", reason: "booking_window_closed" };
    const status = terminalStatus(final);
    await updateJob(job.id, { ...status, last_checked_at: new Date().toISOString() });
    process.stdout.write(`Job ${job.id}: ${status.status} (${status.result_code}).\n`);
  } catch (error) {
    const code = error.code ?? "worker_error";
    await updateJob(job.id, {
      status: "needs_attention",
      result_code: code,
      result_message: code === "portal_connection_missing"
        ? "The portal login is missing. Reconnect the portal account."
        : "The worker could not complete the booking. No unverified submission was retried.",
      last_checked_at: new Date().toISOString(),
    }).catch(() => {});
    process.stderr.write(`Job ${job.id}: ${code} (${redact(error.message)})\n`);
  } finally {
    await session?.close();
  }
}

async function processJob(job) {
  if (job.run_mode === "session_check") return processSessionCheck(job);
  if (process.env.BOOKING_AUTOMATION_ENABLED !== "true") {
    await updateJob(job.id, {
      status: "needs_attention",
      result_code: "booking_automation_disabled",
      result_message: "Booking automation is disabled on this worker. No portal sign-in or booking was attempted.",
      last_checked_at: new Date().toISOString(),
    });
    return;
  }
  return processBooking(job);
}

async function main() {
  process.stdout.write(`FUTMINNA worker ${workerId} started.\n`);
  await recoverInterruptedJobs();
  const deadline = maxRuntimeMs > 0 ? Date.now() + maxRuntimeMs : Number.POSITIVE_INFINITY;
  for (;;) {
    if (Date.now() >= deadline) break;
    const bookingEnabled = process.env.BOOKING_AUTOMATION_ENABLED === "true";
    const sessionCheckEnabled = process.env.SESSION_CHECK_ENABLED === "true";
    if (!bookingEnabled && !sessionCheckEnabled) {
      await sleep(Math.min(idlePollMs, Math.max(0, deadline - Date.now())));
      continue;
    }
    try {
      const job = await claimJob();
      if (job) await processJob(job);
    } catch (error) {
      process.stderr.write(`Worker loop error: ${redact(error.message)}\n`);
    }
    let waitMs = idlePollMs;
    try {
      waitMs = await waitForNextJob();
    } catch (error) {
      process.stderr.write(`Schedule lookup failed: ${redact(error.message)}\n`);
    }
    await sleep(Math.min(waitMs, Math.max(0, deadline - Date.now())));
  }
  process.stdout.write(`FUTMINNA worker ${workerId} reached its run limit and stopped.\n`);
}

main().catch((error) => {
  process.stderr.write(`${redact(error.message)}\n`);
  process.exitCode = 1;
});
