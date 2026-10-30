# Multi-student automation architecture

This is the intended architecture. Only the dashboard and an early local sign-in prototype exist today. No hosted booking worker or multi-student account system has been implemented.

## What runs where

- **Vercel dashboard**: serves the web interface and each student's preferences and booking status.
- **Application backend**: manages student accounts and securely hands each student's job to that student's isolated worker.
- **Playwright worker**: runs a separate browser profile for each student, signs into the official FUTMINNA portal for that student, watches the observed accommodation flow, and performs the saved preference workflow.
- **Per-student data store**: holds only the data needed to resume that student's session and job. Access is isolated by account and sensitive data is encrypted. Shared app configuration may use environment variables, but student portal passwords do not go in a shared `.env` file.

The current `portal:prepare` command is for development on one Windows PC. It prompts for one student's credentials in a local terminal and keeps that browser session on that PC. It is not invoked by the Vercel site and is not the multi-user worker.

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
- Student accounts and portal sessions must be isolated per user, with strict access controls and encryption in transit and at rest.
- Prefer short-lived session tokens over retaining raw passwords. If the portal requires a password again, request it directly from that student through a protected flow and do not log it.
- Pause for CAPTCHA or other portal security checks. Do not bypass access controls, rate limits, or portal errors.

## Deployment boundary

Vercel hosts the dashboard. A separate managed worker service must run Playwright with the browser dependencies, durable per-student session storage, job scheduling, and monitoring. The worker service, app authentication, secure credential/session handling, and observed accommodation flow are all future work. Until those pieces exist, deployment means dashboard hosting only; it does not enable automatic booking.
