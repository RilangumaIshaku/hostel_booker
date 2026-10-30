# Playwright automation architecture

This is a design outline for later phases. It intentionally contains no portal selectors, accommodation identifiers, or active browser automation.

## Proposed components

- **Browser session**: a local Playwright browser owned by the student. Authentication starts at the official FUTMINNA student portal and remains in that user-controlled session.
- **Authentication monitor**: observes whether the student has reached an authenticated portal state. It does not read, record, or submit the student's password, and it pauses for CAPTCHA or any other security challenge.
- **Availability reader**: added only after accommodation pages become available for inspection. It will use observed page structure and report unknown states as unknown rather than assuming a room is available.
- **Preference matcher**: compares verified availability against Needs Assessment Hostel (NAH), Room of 2 first, then Room of 4. It must not substitute an unverified room identifier.
- **Preference matcher**: the student's saved criteria provide standing authorization to select Needs Assessment Hostel, Room of 2 first, then Room of 4.
- **Submission step**: submits the first clearly verified match automatically, without a second approval pause. If availability or the selection is ambiguous, it stops. It then waits for a clear portal confirmation; without one, the outcome is reported as unconfirmed.
- **Payment handoff**: after the portal confirms the booking, the student completes the payment themselves.

## Control flow

1. Student opens the official portal and completes sign-in and any security checks themselves.
2. The assistant checks the visible authenticated state and, in a later phase, inspects accommodation availability.
3. It identifies the first verified match in the saved preference order.
4. Playwright submits the match automatically, once, without waiting for a second approval. If the result is unclear, it stops and does not resubmit.
5. It reports success only after an explicit portal confirmation, then hands off to the student for payment.

## Session and data handling

- Do not put credentials or browser state in source control, telemetry, logs, shared services, or deployment configuration.
- Keep automation local to the student's device unless a later design establishes an equally user-controlled session model.
- Use the local `portal:prepare` launcher and a dedicated Playwright profile. Prompt for the portal username and masked password at runtime only when no signed-in session exists; do not save the password.
- The dedicated browser profile contains session cookies and is sensitive local data. Keep it outside the repository and do not copy it to Vercel or GitHub.
- Do not automate around CAPTCHA, MFA, access controls, rate limits, or portal errors.
- Treat the student's saved preferences as standing authorization for one matching submission; never retry a submission if its outcome is uncertain.
- Add Playwright and browser installation only when Phase 2 begins and the user approves dependency installation.
