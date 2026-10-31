# Multi-student automation architecture

The dashboard, Supabase account/credential endpoints, database migrations, Playwright engine and worker all exist. Cloud deployment still requires a Supabase project. The engine is tested against a local mock of the portal; the real accommodation page must be captured once by a signed-in student because it is not visible before login.

## What runs where

- **Vercel dashboard**: student accounts, preferences, encrypted portal connection and job status.
- **Supabase**: Auth and Postgres; `portal_connections` holds one encrypted portal login per student, `booking_jobs` holds their scheduled job.
- **Worker** (Render, GitHub Actions, or a laptop): a fresh in-memory browser context per job. It signs in with that student's encrypted credentials, pre-warms before the opening time, opens the real accommodation page, and submits at most one verified booking.
- **Local race-day runner**: the same engine in a persistent browser profile on the student's own machine. This is the low-latency path for the actual rush.

The `portal:prepare` command remains a single-student prototype. The `portal:login`, `portal:fees`, `portal:discover`, `portal:record` and `portal:book` commands are the supported local path.

## Per-student workflow

1. The student creates an app account and saves hostel/room preferences.
2. The student connects their own portal login, encrypted per user.
3. The worker claims the job `PORTAL_CLAIM_LEAD_SECONDS` (default 150) before the opening time and signs in early.
4. At the opening time it opens the accommodation section and scans the page. Only rows that contain both the saved room type and a Book/Select control are eligible.
5. The first preference with an available control is used. The saved preference is standing authorization for one submission.
6. Once a submit is attempted, the worker never retries it. If the result is ambiguous the job becomes `unconfirmed` and the student is told to check the portal.
7. Success is reported only for an explicit portal confirmation. Payment is the student's action.

## Captured page map

The real accommodation URL and layout are learned, not guessed:

- `npm run portal:record -- --label accommodation` opens a visible browser, waits for the student to open the real page, then captures links, headings, forms, dropdowns, room-like rows and a screenshot under `.portal/` (gitignored).
- `npm run portal:discover` does a read-only crawl from the signed-in dashboard.
- The page URL is merged into `.portal/portal-flow.json`; the worker also accepts the same JSON through `PORTAL_FLOW_SPEC` (or a path via `PORTAL_FLOW_SPEC_PATH`).
- Captures redact emails and long numeric identifiers. They contain no passwords or cookies.

## Failure handling

- `502`/`503`/`504`, resets and timeouts retry with jittered exponential backoff.
- Not-open and sold-out pages are polled until the job window closes; the worker does not invent a room.
- A CAPTCHA or verification step stops the run.
- A stale `running` job is marked `needs_attention` with `worker_interrupted` on worker startup. It is never re-armed automatically, because it may already have submitted.
- The worker uses `BOOKING_AUTOMATION_ENABLED` as the live-booking switch; `SESSION_CHECK_ENABLED` permits sign-in-only checks.

## Credentials and session data

- Never commit credentials, browser profiles, cookies, captures or secret keys.
- A shared `.env` is for app configuration. Student portal logins belong in the encrypted per-user table, not in the environment.
- Browser cookies stay in memory and are discarded when the job ends.
- The local runner keeps its session in a local browser profile; the password is typed into the portal, not stored by the runner.
- Do not run the local runner and the cloud worker for the same student concurrently.

## Deployment boundary

Vercel hosts the dashboard. The worker can run continuously on a paid managed service or in bounded GitHub Actions windows on the free plan. Scheduled runs can be delayed, so the local runner is the primary race-day path. Until the real accommodation page has been captured and a dry run reviewed, keep `BOOKING_AUTOMATION_ENABLED=false`.
