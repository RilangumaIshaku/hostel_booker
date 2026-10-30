"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ConnectPortalPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/portal-connection", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.push("/login"); return; }
      const result = await response.json();
      setConnected(Boolean(result.connected));
      if (result.error) setMessage(result.error);
      setChecked(true);
    }).catch(() => { setMessage("Could not check the account connection."); setChecked(true); });
  }, [router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/portal-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json();
      setMessage(result.error ?? "Portal login saved encrypted for your account.");
      if (response.ok) { setConnected(true); formElement.reset(); }
    } catch {
      setMessage("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const response = await fetch("/api/portal-connection", { method: "DELETE" });
    setBusy(false);
    if (response.ok) { setConnected(false); setMessage("Portal connection removed."); }
    else setMessage("Could not remove the portal connection.");
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-12 text-slate-900 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="text-sm font-bold text-emerald-900">FUTMINNA HOSTEL BOOKER</Link>
        <h1 className="mt-8 text-2xl font-semibold">Connect your portal account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your FUTMINNA login is encrypted on the server and kept separate from other students&apos; accounts. It is used by the worker to sign in for your booking job.</p>
        {checked && !connected && <form onSubmit={save} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">FUTMINNA username
            <input name="username" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-emerald-800" />
          </label>
          <label className="block text-sm font-medium">FUTMINNA password
            <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-emerald-800" />
          </label>
          <p className="text-xs leading-5 text-amber-800">Only connect on the official FUTMINNA portal. If the portal presents CAPTCHA or another security check, the worker will pause and alert you.</p>
          <button disabled={busy} className="w-full rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving securely…" : "Save encrypted connection"}</button>
        </form>}
        {checked && connected && <div className="mt-6 rounded-2xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Portal account connected</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">This only saves your encrypted login. The cloud worker and observed accommodation booking flow still need to be deployed before any booking can run.</p>
          <button onClick={remove} disabled={busy} className="mt-4 rounded-lg border border-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-60">Remove portal login</button>
        </div>}
        {message && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-emerald-900">Back to dashboard</Link>
      </section>
    </main>
  );
}
