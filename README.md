# 🚀 NEW USER? READ THIS FIRST! 👇

## **[📖 SIMPLE GUIDE - Click Here for Step-by-Step Instructions](SIMPLE-GUIDE.md)**

**The SIMPLE-GUIDE.md has everything you need in plain English:**
- ✅ How to install (copy-paste commands)
- ✅ How to test before booking day
- ✅ How to run on booking day (ONE command)
- ✅ What to do if something goes wrong
- ✅ Written for students, not programmers

**Other helpful guides:**
- **[TEST-ME-FIRST.md](TEST-ME-FIRST.md)** - 15-minute quick test
- **[RACE-DAY-CHECKLIST.md](RACE-DAY-CHECKLIST.md)** - Print this for booking day
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Fix any errors
- **[docs/quick-start.md](docs/quick-start.md)** - Alternative quick start
- **[docs/testing-guide.md](docs/testing-guide.md)** - Detailed testing guide

> **Safety:** Nothing books unless you use `--live`. The fees check never pays. Dry runs never click. Mock tests need no internet.

---

## For Developers / Technical Users

Below is the technical documentation. If you're not a developer, **[read the SIMPLE-GUIDE.md instead](SIMPLE-GUIDE.md)**.

---

---

# FUTMINNA Hostel Booker

An independent student-facing hostel booking assistant for FUTMINNA. It signs into the official student portal, waits for the accommodation page, picks the saved room order, submits one booking, and only reports success when the portal shows a confirmation.

The dashboard and the cloud account/worker scaffold remain. The important change is that a real booking engine now exists and is tested end to end.

## Why it could not book before

The old worker signed in and then deliberately returned `PORTAL_SESSION_READY_ACCOMMODATION_FLOW_UNAVAILABLE`. It contained no room selection and no submission. The dashboard also refused to schedule a booking unless two flags were set, but setting those flags still would not have booked anything. That placeholder path has been replaced.

## What happens on race day

1. The worker claims the job before the opening time and signs in early, so the session is warm.
2. At the opening time it opens the real accommodation page and rescans it.
3. It matches the saved hostel and room order (`Room of 2`, then `Room of 4`) only against rows that also contain a Book/Select control. It never clicks a page-level button that belongs to another room.
4. If a row is open, it submits once. It never retries a submission whose result is unknown.
5. It reports confirmation only when the portal itself says the room was allocated. Payment stays with the student.

Network failures (502/503/504, resets, timeouts) are retried with jittered exponential backoff. A CAPTCHA or verification step stops the run instead of being bypassed.

## Try it now, without booking anything

```bash
npm install
npm test
```

The 17 tests launch real Chromium against a local mock of the portal. They prove:

- the first preference is booked when available;
- it falls back to `Room of 4` when `Room of 2` is sold out;
- it submits nothing when every room is sold out or booking has not opened;
- it retries through two 503 responses and then books;
- a dry run reports the match without clicking;
- the fees check reaches the payment gateway without paying or entering card details;
- a rejected portal login is reported, not retried forever.

## Race-day fast lane (recommended)

A GitHub Actions or Render worker is useful for an account that must run while the phone is offline, but a scheduled run can start late and reaches the portal from another country. For the actual rush, run the booker on the laptop/network you will use.

```bash
# 1. Sign in once in a visible browser. The password goes into the portal,
#    not into this tool. The session is kept in a local browser profile.
npm run portal:login

# 2. Free end-to-end check on the real portal. It opens School Fees, reads the
#    outstanding balance, follows the payment control, and STOPS at the gateway.
#    No card details, no PIN, no charge.
npm run portal:fees

# 3. If the hostel link cannot be found automatically, open the real hostel
#    page yourself and capture it. This saves its URL and controls under .portal/.
npm run portal:record -- --label accommodation

# 4. Dry run: shows what would be booked and clicks nothing.
npm run portal:book -- --now

# 5. The timed run. Without an offset, the time is read as Africa/Lagos.
npm run portal:book -- --at 2026-11-06T09:00:00 --live
```

Options: `--headed` to watch the browser, `--poll 500` for a tighter loop, `--window 15` to keep trying for 15 minutes, `--rooms "Room of 2,Room of 4"`, `--profile <dir>`.

For a fully unattended run, put `PORTAL_USERNAME` and `PORTAL_PASSWORD` in `.env.local` (already gitignored) so the runner can sign in again if the portal session expires. The CLI never prints them. Do not put these on a shared server.

The runner prints a JSON result and saves it under `.portal/results/`. Exit codes: `0` confirmed or dry-run match, `2` a submission may have reached the portal but no confirmation was read, `1` anything else.

### What the fees check proves

It proves the parts that usually break: the saved login still works, the real portal menu is navigable, the page is readable, a real payment control can be found and followed, and the runner stops at the right boundary.

It does **not** prove room allocation, because room inventory and contention are different from a fees page. Booking logic itself is proven by the mock-portal tests above. The remaining unknown is the real accommodation page's layout, which the recorder captures.

## Real portal status

The public login page was verified on 31 October 2026:

- it posts to `index.php` with fields `uid` and `pwd` and a submit button named `login`;
- the other payment links redirect to the portal rather than exposing a public page.

The accommodation page appears only after a real student signs in, so its room table/dropdown layout has not been observed. The engine handles tables, cards, lists and dropdown forms, but if the real page uses something different, run `npm run portal:record -- --label accommodation` and share the generated `.portal/captures/accommodation-*.json`. That file contains page structure with emails and long numbers redacted, no passwords and no cookies. The captured page URL is then reused automatically by both the local runner and the worker.

## Cloud setup (optional)

Supabase Auth/Postgres holds app accounts and one encrypted portal login per student. Vercel serves the dashboard. The worker runs on Render (paid) or in a bounded GitHub Actions window (free, best effort).

1. Create a Supabase project and apply both migrations:
   - `supabase/migrations/202610300001_booking_jobs.sql`
   - `supabase/migrations/202610310001_booking_rush.sql` (early claim, so the session is pre-warmed)
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORTAL_DATA_ENCRYPTION_KEY` in Vercel. Generate the key with `npm run portal:keygen`; use the same key in the worker only. Never expose the service role key or encryption key to the browser.
3. Deploy the worker with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_DATA_ENCRYPTION_KEY`, and optionally `PORTAL_FLOW_SPEC` (the captured page map as JSON). Apply `render.yaml`, or add the three Supabase values as GitHub Actions secrets and set the repository variable `BOOKING_AUTOMATION_ENABLED=true` when you are ready for live booking.
4. `SESSION_CHECK_ENABLED=true` allows a sign-in-only dry run. It is safe to leave on. `BOOKING_AUTOMATION_ENABLED` is the live switch; the API now refuses to schedule a booking when it is off.
5. The worker claims a job 150 seconds early (`PORTAL_CLAIM_LEAD_SECONDS`) so it can sign in before 09:00. It keeps trying for `PORTAL_JOB_WINDOW_MINUTES` (default 10) after the opening time.

If a worker dies mid-job, startup recovery marks the stale job `needs_attention` with `worker_interrupted`. It never re-arms a job that may already have submitted.

## Security and safety

- Student portal passwords are encrypted per user with AES-256-GCM in the cloud path; the local runner uses a browser profile and does not store the password itself.
- Credentials never go in source, logs, analytics, or a shared `.env`.
- The worker uses a fresh in-memory browser context per job, so one student's cookies cannot leak into another's.
- CAPTCHA and other security checks stop the run.
- The fees check stops before entering card details or confirming a charge. Depending on the portal, following the payment control may generate an invoice/RRR; it does not pay it.
- Only a portal confirmation counts as success. A job status by itself never means a room was allocated.
- Do not run the local runner and the cloud worker for the same student at the same time, and do not keep the same portal account open elsewhere while a job runs.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Mock-portal browser tests and pure-logic tests |
| `npm run portal:login` | Save a real portal session locally |
| `npm run portal:fees` | Sign in, read fees, stop at the payment handoff |
| `npm run portal:discover` | Read-only crawl of the signed-in portal |
| `npm run portal:record -- --label accommodation` | Capture the real hostel page |
| `npm run portal:book -- --now` | Dry run: show the match, click nothing |
| `npm run portal:book -- --at 2026-11-06T09:00:00 --live` | Timed booking rush |
| `npm run worker:start` | Cloud worker (needs Supabase env) |
| `npm run portal:prepare` | Older single-student local sign-in prototype |

`docs/automation-architecture.md` describes the per-student worker boundary.

## Status

1. Dashboard and project setup — complete
2. Booking engine, retries, confirmation detection — complete and tested against a mock portal
3. Local race-day runner and recorder — complete
4. Fees pipeline check — complete
5. Real accommodation page capture — needs one run by a signed-in student
6. Cloud deployment — needs Supabase, then Render/GitHub Actions and Vercel
