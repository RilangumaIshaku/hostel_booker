# FUTMINNA Hostel Booker

An independent student-facing hostel booking assistant for FUTMINNA. Phase 1 provides a responsive dashboard only. Portal authentication, availability detection, and booking are not connected.

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

The `npm run portal:prepare` command is an early local prototype. It opens Playwright on the same PC, prompts for one student's portal login, and keeps that browser session in that Windows user's profile. It is not connected to the dashboard, cannot be run by visitors to a Vercel-hosted site, and does not perform hostel booking.

## Hosting and multiple students

Vercel can serve the dashboard. Automatic booking for multiple students needs a separate hosted Playwright worker and per-student accounts, with isolated portal sessions and encrypted per-student data storage. The worker, app sign-in, account isolation, and secret storage have not been built yet. A `.env` file is not where student logins belong: environment variables configure shared app services, while every student must connect their own portal account. The current repo is a dashboard prototype, not a hosted multi-user booking service.

## Security direction

- Never place student credentials in source code, environment files, logs, or shared browser configuration.
- A future hosted worker must isolate every student's portal session and protect any stored student data with per-user access controls and encryption.
- CAPTCHA and other portal security checks remain manual.
- The prototype Playwright launcher opens a local browser at the official portal and keeps its session profile on the student's Windows account.
- Use the student's saved hostel and room criteria as standing authorization for the booking submission; do not add an approval pause at submission time.
- Do not submit if the portal's availability or selected room cannot be verified clearly.
- Report booking success only after the portal itself displays a clear confirmation.

## Phases

1. Project setup and dashboard (current)
2. Portal inspection and authentication
3. Accommodation availability detection
4. Room selection and automatic submission using the saved hostel and room preference
5. Testing, security, and reliability
6. GitHub, Vercel dashboard deployment, and hosted worker deployment

The current Phase 1 dashboard does not connect to the portal. No accommodation page selectors or room identifiers are included because the booking interface is not available to inspect yet.
