"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json();
      setMessage(result.message ?? result.error ?? "Something went wrong.");
      if (response.ok && (response.status !== 201 || !result.message?.includes("Check your email"))) router.push("/connect");
    } catch {
      setMessage("Could not reach the account service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-12 text-slate-900 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="text-sm font-bold text-emerald-900">FUTMINNA HOSTEL BOOKER</Link>
        <h1 className="mt-8 text-2xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Each student has a separate account and portal connection.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email
            <input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-emerald-800" />
          </label>
          <label className="block text-sm font-medium">App password
            <input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 10 : undefined} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-emerald-800" />
            {mode === "signup" && <span className="mt-1 block text-xs font-normal text-slate-500">At least 10 characters. This is for this app, not your FUTMINNA portal.</span>}
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        {message && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
        <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }} className="mt-5 text-sm font-semibold text-emerald-900">
          {mode === "signup" ? "Already registered? Sign in" : "New here? Create an account"}
        </button>
      </section>
    </main>
  );
}
