# FUTMINNA Hostel Booker

An independent student-facing hostel booking assistant for FUTMINNA. Phase 1 provides a responsive dashboard only. Availability, authentication, and booking are not connected.

## Booking behavior

After the student signs in and configures the criteria, the intended workflow automatically submits the first verified match: Needs Assessment Hostel, Room of 2 first, then Room of 4. It does not pause for a second approval during the booking rush. The student completes payment after the portal confirms the booking. If availability or the portal state is ambiguous, the assistant must stop rather than guess.

The student-provided opening time is Friday, 6 November 2026 at 9:00 a.m. Africa/Lagos. Availability and the exact opening behavior have not been verified on the portal.

## Requirements

- Node.js 20.9 or newer and npm
- Next.js, React, TypeScript, Tailwind CSS, and ESLint (declared in `package.json`)
- Playwright and its local session launcher are included for browser automation
- Git and GitHub for source control; a Vercel account for deployment

## Start locally

After approving dependency installation, run `npm install`, then `npm run dev` and open `http://localhost:3000`.

To open the local Playwright browser and prepare a signed-in FUTMINNA session, run `npm run portal:prepare` in a local terminal. It prompts for the username and a masked password only when the browser profile is not already signed in. The password is not written to the repository or by this script; the browser profile stores the portal's session data under the current Windows user profile.

## Security direction

- Never place student credentials in source code, environment files committed to Git, logs, or browser automation configuration.
- Portal authentication should remain user initiated and use the official portal origin. The assistant should not collect or persist the portal password.
- CAPTCHA and other portal security checks remain manual.
- The Playwright launcher opens a local browser at the official portal and keeps its session profile on the student's Windows account, not in this repository or a shared server.
- Use the student's saved hostel and room criteria as standing authorization for the booking submission; do not add an approval pause at submission time.
- Do not submit if the portal's availability or selected room cannot be verified clearly.
- Report booking success only after the portal itself displays a clear confirmation.

## Phases

1. Project setup and dashboard (current)
2. Portal inspection and authentication
3. Accommodation availability detection
4. Room selection and automatic submission using the saved hostel and room preference
5. Testing, security, and reliability
6. GitHub and Vercel deployment

The current Phase 1 dashboard does not connect to the portal. No accommodation page selectors or room identifiers are included because the booking interface is not available to inspect yet.
