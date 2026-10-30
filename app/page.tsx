import Link from "next/link";
import DashboardStatus from "./dashboard-status";

const preferences = [
  { rank: "01", name: "Room of 2", detail: "First choice", active: true },
  { rank: "02", name: "Room of 4", detail: "Fallback option", active: false },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const common = {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
  if (name === "bed") return <svg {...common}><path d="M3 19v-8m0 4h18v4M5 15V8a2 2 0 0 1 2-2h3v9m-5-4h14a2 2 0 0 1 2 2v2" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "help") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.3-1.8 2.7m0 3h.01" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>;
}

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-emerald-900 text-white shadow-sm">
        <Icon name="home" className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-slate-900">FUTMINNA</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">HOSTEL BOOKER</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#f5f7f4] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white px-5 py-7 lg:flex">
          <Wordmark />
          <div className="mt-12">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
            <nav aria-label="Main navigation" className="mt-3 space-y-1">
              <a href="#dashboard" className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-900"><Icon name="home" className="size-[18px]" />Dashboard</a>
              <a href="#preferences" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50"><Icon name="bed" className="size-[18px]" />My preferences</a>
              <a href="#security" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50"><Icon name="shield" className="size-[18px]" />Security</a>
            </nav>
          </div>
          <div className="mt-auto rounded-2xl bg-[#f5f7f4] p-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-white text-emerald-800"><Icon name="help" /></div>
            <p className="mt-4 text-sm font-semibold">Need a hand?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">The worker follows your saved room order and reports the portal result.</p>
            <a href="#security" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">How it works <Icon name="arrow" className="size-3.5" /></a>
          </div>
          <p className="mt-5 px-1 text-[11px] text-slate-400">Student assistant · 2026/27</p>
        </aside>

        <section id="dashboard" className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 sm:px-8 lg:px-10">
            <div className="lg:hidden"><Wordmark /></div>
            <p className="hidden text-sm font-medium text-slate-500 lg:block">Student workspace <span className="mx-2 text-slate-300">/</span><span className="text-slate-800">Dashboard</span></p>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex">2026 / 2027 session</span>
              <div className="grid size-9 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-900" aria-label="Student profile">ST</div>
            </div>
          </header>

          <div className="mx-auto max-w-[1120px] px-5 pb-12 pt-8 sm:px-8 sm:pt-10 lg:px-10 lg:pt-11">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Your accommodation journey</p>
                <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Good to have you back.</h1>
                <p className="mt-2 text-sm text-slate-500 sm:text-base">Your hostel preferences are ready for the 2026/2027 session.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><span className="size-1.5 rounded-full bg-amber-500" />Portal availability not checked</span>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                <p className="text-xs font-medium text-slate-500">Student category</p>
                <div className="mt-4 flex items-center justify-between"><p className="text-lg font-semibold tracking-tight">Returning student</p><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon name="home" /></span></div>
                <p className="mt-1 text-xs text-slate-400">200–500 level</p>
              </article>
              <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                <p className="text-xs font-medium text-slate-500">School fees</p>
                <div className="mt-4 flex items-center justify-between"><p className="text-lg font-semibold tracking-tight">Paid</p><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name="check" /></span></div>
                <p className="mt-1 text-xs text-slate-400">As provided by you</p>
              </article>
              <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                <p className="text-xs font-medium text-slate-500">Booking window</p>
                <div className="mt-4 flex items-center justify-between"><p className="text-lg font-semibold tracking-tight">Fri, 6 November</p><span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><Icon name="clock" /></span></div>
                <p className="mt-1 text-xs text-slate-400">9:00 a.m. Lagos time · as you provided</p>
              </article>
            </div>

            <DashboardStatus />

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
              <article id="preferences" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
                  <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Your shortlist</p><h2 className="mt-1.5 text-lg font-semibold tracking-tight">Hostel preferences</h2></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">2 choices</span>
                </div>
                <div className="px-5 sm:px-7">
                  <div className="flex items-center justify-between py-4 text-xs font-medium text-slate-400"><span>HOSTEL</span><span>ROOM TYPE</span></div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-5">
                    <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon name="bed" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">Needs Assessment Hostel</p><p className="mt-1 text-xs text-slate-400">Also known as NAH</p></div></div>
                    <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900">Preferred</span>
                  </div>
                  {preferences.map((preference) => <div key={preference.rank} className="flex items-center justify-between gap-3 border-t border-slate-100 py-4"><div className="flex items-center gap-3"><span className={`grid size-8 place-items-center rounded-lg text-xs font-bold ${preference.active ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-500"}`}>{preference.rank}</span><div><p className="text-sm font-semibold">{preference.name}</p><p className="mt-0.5 text-xs text-slate-400">{preference.detail}</p></div></div><span className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500">{preference.active ? "Priority" : "Fallback"}</span></div>)}
                </div>
                <div className="mx-5 mb-5 mt-1 rounded-xl bg-[#f7f8f6] px-4 py-3 sm:mx-7"><p className="text-xs leading-5 text-slate-500">We’ll check the official portal before recommending any room. Availability has not been verified yet.</p></div>
              </article>

              <article id="security" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon name="shield" /></div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">Prepare your portal account</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Your portal login is encrypted separately for your account. When the worker and the observed accommodation flow are ready, it will use your saved room order automatically.</p>
                <div className="my-5 h-px bg-slate-100" />
                <div className="space-y-3 text-xs leading-5 text-slate-600">
                  <div className="flex gap-2.5"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><Icon name="check" className="size-3" /></span><p>It follows Needs Assessment Hostel, Room of 2 first, then Room of 4.</p></div>
                  <div className="flex gap-2.5"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><Icon name="check" className="size-3" /></span><p>After a confirmed booking, you complete the payment.</p></div>
                </div>
                <Link href="/login" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800">Create account or connect <Icon name="arrow" className="size-4" /></Link>
                <p className="mt-3 text-center text-[11px] text-slate-400">Portal connection requires the hosted account service to be configured. No booking has been made.</p>
              </article>
            </div>

            <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-5 text-[11px] leading-5 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p>FUTMINNA Hostel Booker is an independent student assistant.</p>
              <a className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-emerald-800" href="https://eportal.futminna.edu.ng/ePortal_V2/std/index.php" target="_blank" rel="noreferrer">Official student portal <Icon name="arrow" className="size-3" /></a>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
