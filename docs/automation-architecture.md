# Multi-student automation architecture

This is the intended architecture. The dashboard, Supabase account/credential endpoints, database migration, and worker scaffold exist in the repository. They are not connected to a Supabase project or deployed, and the accommodation booking flow is not implemented.

## What runs where

- **Vercel dashboard**: serves the web interface and each student's preferences and booking status.
- **Application backend**: manages student accounts and securely hands each student's job to that student's isolated worker.
- **Playwright worker**: runs a separate in-memory browser context for each job, signs into the official FUTMINNA portal for that student, watches the observed accommodation flow, and performs the saved preference workflow. The repository has a paid always-on Render option and a free, bounded GitHub Actions option; scheduled GitHub runs may be delayed and do not provide a precise start guarantee.
- **Per-student data store**: holds encrypted portal credentials and that student's job. Access is isolated by account. Shared app configuration may use environment variables, but student portal passwords do not go in a shared `.env` file.

The current `portal:prepare` command is for development on one Windows PC. It prompts for one student's credentials in a local terminal and keeps that browser session on that PC. It is not invoked by the Vercel site and is not the multi-user worker. The hosted account form and encrypted credential endpoint are now in the code; they require a configured Supabase project before use.

## Per-student workflow

1. Each student creates an app account and sets their own hostel preferences.
2. Each student connects their own FUTMINNA account through an isolated browser session. The worker must never reuse one student's browser profile or credentials for another student.
3. Before the opening time, the worker verifies that the student's portal session is still valid and ready.
4. When accommodation becomes available, the worker uses only page controls and room identifiers it has actually observed. It matches Needs Assessment Hostel, Room of 2 first, then Room of 4.
5. The student's saved preference is standing authorization for one matching booking submission. The worker stops if the page or result is ambiguous and never retries an uncertain submission.
6. It reports success only after explicit confirmation from the portal. The student handles payment.

## Credentials and session data

- Never commit credentials, browser profiles, session cookies, or secret keys to GitHub.
- A shared `.env` file is for app-level configuration such as database connections or encryption-service access. It cannot represent different student logins safely.
- Student accounts and portal logins must be isolated per user, with strict access controls and encryption in transit and at rest. Browser cookies are kept in memory only and cleared when a job ends.
- The current scaffold stores the portal username and password encrypted in Supabase so the unattended worker can sign in later. The student can remove them from the connection page. Never log plaintext credentials.
- Pause for CAPTCHA or other portal security checks. Do not bypass access controls, rate limits, or portal errors.

## Deployment boundary

Vercel hosts the dashboard. The worker can run continuously on a paid managed service or in bounded GitHub Actions windows on the free plan. The GitHub workflow requires repository secrets and can be delayed by the hosted scheduler. The repo includes the worker scaffold and an encrypted per-user credential flow; Supabase configuration, worker secrets, and the observed accommodation flow remain to be completed. Until the accommodation adapter is implemented and verified, deployment does not enable automatic booking.
