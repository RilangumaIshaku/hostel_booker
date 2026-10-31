"use client";

import { useState } from "react";
import Link from "next/link";

type Job = { id: string; run_mode: string; status: string; starts_at: string; result_message: string | null };
type Readiness = { connected: boolean; canSchedule: boolean; sessionCheckEnabled: boolean; automationEnabled: boolean; jobs: Job[] };

export default function DashboardStatus() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState("Setup has not been checked yet.");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/booking-jobs", { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        setReadiness(null);
        setMessage(response.status === 401 ? "Sign in to check your setup." : "The account service is not configured yet.");
        return;
      }
      setReadiness(await response.json() as Readiness);
      setMessage("");
    } catch {
      setReadiness(null);
      setMessage(controller.signal.aborted ? "The account service did not respond. Check the server setup and try again." : "Could not reach the account service.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function schedule(runMode: "booking" | "session_check") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/booking-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runMode,
          startsAt: runMode === "booking"
            ? "2026-11-06T09:00:00+01:00"
            : new Date(Date.now() + 60_000).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Could not schedule the booking job.");
        return;
      }
      setMessage(runMode === "session_check"
        ? "Sign-in-only dry run scheduled. It will not select or submit a room."
        : "Booking job scheduled. This is not a booking confirmation.");
      await refresh();
    } catch {
      setMessage("Could not reach the booking service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const latestJob = readiness?.jobs?.[0];
  return (
    <article className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Live setup check</p><h2 className="mt-1.5 text-lg font-semibold tracking-tight">Will the booker be ready?</h2></div>
        <button onClick={() => void refresh()} disabled={loading || busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{loading ? "Checking…" : "Refresh status"}</button>
      </div>
      {loading && <p className="mt-4 text-sm text-slate-500">Checking your account and booking service…</p>}
      {!loading && message && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p>{message}</p>{message.startsWith("Sign in") && <Link href="/login" className="mt-2 inline-block font-semibold underline">Sign in or create your account</Link>}</div>}
      {!loading && readiness && <>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><StatusItem label="Your account" value="Signed in" good /><StatusItem label="FUTMINNA login" value={readiness.connected ? "Connected" : "Not connected"} good={readiness.connected} /><StatusItem label="Booking automation" value={readiness.automationEnabled ? "Armed" : "Off"} good={readiness.automationEnabled} /></div>
        {!readiness.connected && <Link href="/connect" className="mt-4 inline-block text-sm font-semibold text-emerald-900 underline">Connect your FUTMINNA account</Link>}
        {!readiness.automationEnabled && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">The cloud worker is not armed yet. Run the free school-fees check on your laptop first — it signs in, opens the fees page and reaches the payment handoff without paying. Then enable <code className="rounded bg-slate-200 px-1">BOOKING_AUTOMATION_ENABLED</code> on the worker.</p>}
        {latestJob && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">Latest {latestJob.run_mode === "session_check" ? "sign-in check" : "booking job"}: <strong>{latestJob.status.replaceAll("_", " ")}</strong> · {new Date(latestJob.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}{latestJob.result_message ? ` · ${latestJob.result_message}` : ""}</p>}
        {readiness.connected && <button onClick={() => void schedule("session_check")} disabled={!readiness.sessionCheckEnabled || busy} className="mt-5 w-full rounded-xl border border-emerald-900 px-4 py-3 text-sm font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:mr-3 sm:w-auto">{busy ? "Scheduling…" : "Run sign-in-only dry run"}</button>}
        <button onClick={() => void schedule("booking")} disabled={!readiness.canSchedule || busy} className="mt-3 w-full rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">{busy ? "Scheduling…" : "Schedule my booking attempt"}</button>
        <p className="mt-3 text-xs leading-5 text-slate-400">The room order is Needs Assessment Hostel: Room of 2, then Room of 4. A job status never means a booking succeeded; only the portal confirmation does.</p>
      </>}
    </article>
  );
}

function StatusItem({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${good ? "text-emerald-900" : "text-amber-800"}`}>{value}</p></div>;
}
