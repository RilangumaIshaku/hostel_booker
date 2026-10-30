# FUTMINNA Hostel Booker

An independent student-facing hostel booking assistant for FUTMINNA. The responsive dashboard and early multi-student account/worker scaffold are present. Cloud account setup requires Supabase configuration; accommodation detection and booking are not implemented because the official portal has not exposed those controls.

## Booking behavior

After the student signs in and configures the criteria, the intended workflow automatically submits the first verified match: Needs Assessment Hostel, Room of 2 first, then Room of 4. It does not pause for a second approval during the booking rush. The student completes payment after the portal confirms the booking. If availability or the portal state is ambiguous, the assistant must stop rather than guess.

The student-provided opening time is Friday, 6 November 2026 at 9:00 a.m. Africa/Lagos. Availability and the exact opening behavior have not been verified on the portal.

## Requirements

- Node.js 20.9 or newer and npm
- Next.js, React, TypeScript, Tailwind CSS, and ESLint (declared in `package.json`)
- Playwright and a local sign-in launcher are included as an early prototype
- Git and GitHub for source control; Vercel can host the dashboard

## Start locally

After approving dependency installation, run `npm install`, then `npm run dev` and open `http://localhost:3000`.

The `npm run portal:prepare` command is an early local prototype. It opens Playwright on the same PC, prompts for one student's portal login, and keeps that browser session in that Windows user's profile. It is not connected to the dashboard or cloud worker.

## Server setup

The cloud account flow uses Supabase Auth and Postgres. Create a Supabase project, apply `supabase/migrations/202610300001_booking_jobs.sql`, and set the variables from `.env.example` in the server deployment. Generate the encryption key with `npm run portal:keygen`; use the same key only in the server and worker secret settings. Never put the service role key or encryption key in browser code or GitHub.

Deploy `worker/Dockerfile` as a continuously running worker with the same Supabase URL, service role key, and encryption key. The worker needs outbound access to the FUTMINNA portal. `render.yaml` prepares a Render background worker and prompts for its secret values during setup. Render documents background workers as continuously running services and supports Dockerfile based workers ([background worker docs](https://render.com/docs/background-workers), [Blueprint reference](https://render.com/docs/blueprint-spec)). Choose an always-on plan in the hosting dashboard; the service may incur hosting charges.

Vercel hosts the Next.js dashboard. Import this GitHub repository as a Next.js project, then add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORTAL_DATA_ENCRYPTION_KEY` in the Vercel project environment settings. Keep the service role and encryption keys server-only. Vercel applies environment changes to new deployments ([environment variable docs](https://vercel.com/docs/environment-variables)). Apply the SQL migration in `supabase/migrations/202610300001_booking_jobs.sql` to the Supabase project before using signup or account connection.

Set `SESSION_CHECK_ENABLED=true` on both Vercel and the worker to permit a sign-in-only dry run after the account and worker are configured. This verifies the saved login and stops without choosing a room. Booking creation remains disabled until the accommodation page and its actual room selection/submission flow have been implemented and verified. Do not set `PORTAL_BOOKING_FLOW_VERIFIED=true` or `BOOKING_AUTOMATION_ENABLED=true` merely to make the button available.

## Hosting and multiple students

Vercel serves the dashboard. The Playwright worker scaffold is designed to handle jobs while a student's phone is offline. Each student has a separate app account; their FUTMINNA login is encrypted for that account in Supabase. `.env.example` lists service-wide secrets for deployment; student logins do not go in `.env`. The account and worker code are present, but need Supabase and worker deployment, and the booking flow is not yet implemented.

## Security direction

- Never place student credentials in source code, environment files, logs, or shared browser configuration.
- The worker uses a separate in-memory browser context per job. Portal logins are encrypted per account; students can remove them from the connect page.
- CAPTCHA and other portal security checks remain manual.
- The prototype Playwright launcher opens a local browser at the official portal and keeps its session profile on the student's Windows account.
- Use the student's saved hostel and room criteria as standing authorization for the booking submission; do not add an approval pause at submission time.
- Do not submit if the portal's availability or selected room cannot be verified clearly.
- Report booking success only after the portal itself displays a clear confirmation.

## Phases

1. Project setup and dashboard (complete)
2. Per-student portal authentication and cloud worker (in progress)
3. Accommodation availability detection after the portal exposes the page
4. Room selection and automatic submission using the saved hostel and room preference
5. Testing, security, and reliability
6. GitHub, Vercel dashboard deployment, and worker deployment

The dashboard includes a live setup check, a sign-in-only dry-run control, and a booking schedule control. Dry runs require a connected student account and `SESSION_CHECK_ENABLED=true`. Booking remains disabled until the flow is implemented and verified. No accommodation page selectors or room identifiers are included because the booking interface is not available to inspect yet.
