"use client";

import { useEffect, useState } from "react";
import { findHostel, formatNaira, hostelsFor, type Hostel } from "@/lib/hostels.mjs";
import { readLocalChoice, useHostelChoice, writeLocalChoice, type HostelChoice, type HostelGender } from "./hostel-choice";

type AccountState = "checking" | "ready" | "signed-out" | "unconfigured";

export default function HostelPicker() {
  const choice = useHostelChoice();
  const [tab, setTab] = useState<HostelGender | null>(null);
  const [account, setAccount] = useState<AccountState>("checking");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const gender = tab ?? choice?.gender ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preference", { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) { setAccount("signed-out"); return; }
        if (!response.ok) { setAccount("unconfigured"); return; }
        setAccount("ready");
        const result = await response.json();
        const saved: HostelChoice | null = result?.preference?.hostelId
          ? { gender: result.preference.gender, hostelId: result.preference.hostelId }
          : null;
        if (saved && !readLocalChoice()) {
          writeLocalChoice(saved);
        }
      })
      .catch(() => { if (!cancelled) setAccount("unconfigured"); });
    return () => { cancelled = true; };
  }, []);

  function choose(hostel: Hostel) {
    const next: HostelChoice = { gender: hostel.gender, hostelId: hostel.id };
    setTab(hostel.gender);
    writeLocalChoice(next);
    setStatus("Saved on this device.");
    if (account !== "ready") return;
    setBusy(true);
    fetch("/api/preference", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        setStatus(response.ok ? "Saved to your account. The worker will use this hostel." : result.error ?? "Saved on this device, but the account copy failed.");
      })
      .catch(() => setStatus("Saved on this device, but the account copy failed."))
      .finally(() => setBusy(false));
  }

  const selected = choice ? findHostel(choice.hostelId) : null;
  const listed = gender ? hostelsFor(gender) : [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Your shortlist</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight">Choose your hostel</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">SUG prices · 2026/27</span>
      </div>

      <div className="px-5 pt-5 sm:px-7">
        <div role="tablist" aria-label="Hostel gender" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          {(["male", "female"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={gender === value}
              aria-controls={`hostels-${value}`}
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${gender === value ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {value === "male" ? "Boys’ hostels" : "Girls’ hostels"}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-5 text-slate-400">Boys’ and girls’ hostels are never mixed. Only the list you choose here can be booked.</p>
      </div>

      {!gender && (
        <p className="mx-5 my-5 rounded-xl bg-[#f7f8f6] px-4 py-4 text-sm leading-6 text-slate-600 sm:mx-7">
          Pick boys’ or girls’ hostels to see the published list and prices.
        </p>
      )}

      {gender && (
        <div id={`hostels-${gender}`} role="tabpanel" className="mt-4 px-5 sm:px-7">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{gender === "male" ? "Boys’ hostels" : "Girls’ hostels"} · {listed.length} options</p>
          <ul className="space-y-2">
            {listed.map((hostel) => {
              const active = choice?.hostelId === hostel.id;
              return (
                <li key={hostel.id}>
                  <button
                    type="button"
                    onClick={() => choose(hostel)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${active ? "border-emerald-800 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-300 text-transparent"}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{hostel.name}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">{hostel.detail ?? "Any bed space in this hostel"}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{formatNaira(hostel.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mx-5 mb-5 mt-5 rounded-xl bg-[#f7f8f6] px-4 py-3 sm:mx-7">
        {selected && (
          <p className="text-xs leading-5 text-slate-700">
            Chosen: <strong>{selected.name}{selected.detail ? ` · ${selected.detail}` : ""}</strong> · {formatNaira(selected.price)} · {selected.gender === "male" ? "boys" : "girls"}
          </p>
        )}
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          {account === "ready"
            ? "This choice is saved to your account and the booking worker will use it."
            : account === "checking"
              ? "Saving on this device while the account check runs."
              : "Saving on this device. Sign in to also save it for the cloud worker."}
        </p>
        {status && <p role="status" className="mt-1.5 text-[11px] font-medium text-emerald-800">{busy ? "Saving to your account…" : status}</p>}
      </div>
    </div>
  );
}
