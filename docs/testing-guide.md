# Testing and Deployment Guide

This guide walks you through safely testing the FUTMINNA Hostel Booker before race day. Each step gets progressively closer to the real portal, but nothing books unless you explicitly pass `--live`.

## Before You Start

Make sure you have everything ready:

- **Node.js 18 or newer** — Check by running `node --version` in your terminal. If it shows v18.0.0 or higher, you're good. Download from [nodejs.org](https://nodejs.org) if needed.
- **Install project dependencies** — Open your terminal in the project folder and run `npm install`
- **Install Playwright browsers** — Run `npx playwright install chromium`
- **Internet connection** — Even slow connections work. The app has retry logic built in for Nigerian network conditions.
- **Portal credentials ready** — Have your FUTMINNA portal username (matric number) and password ready. You'll type the password into a real browser window — the app never stores it unless you explicitly create a `.env.local` file for unattended runs.

## Step 1: Run the Mock Tests First (no internet needed)

Before touching the real portal, run the mock tests to make sure the booking logic itself works:

```bash
npm test
```

These tests run 17 scenarios against a fake local portal. No internet connection needed. No portal account needed. This proves:

- The app can pick the first available room from your preference list
- It falls back to your second choice when the first is sold out
- It submits nothing when everything is sold out
- It retries through network errors (502/503/504)
- A dry run shows the match without clicking anything
- The fees check reaches the payment gateway without paying
- Failed logins are detected and reported

**What success looks like:**

You'll see output like this:

```
✔ books the first preference when it is available
✔ falls back to the second preference when the first is sold out
✔ never submits when nothing is available
✔ books the chosen girls' hostel from a page that lists both genders
✔ a girls' choice never falls back into a boys' hostel
...
✔ 26 tests passed
```

**Important:** If any test fails, something broke in the code. DO NOT proceed to the real portal. Share the failure output so it can be fixed first.

## Step 2: Test with School Fees (Safest Real-Portal Test)

This is the safest way to verify the system works with the REAL FUTMINNA portal without risking any booking or payment.

### 2.1 Save Your Session

First, sign in once so the app can save your portal session:

```bash
npm run portal:login
```

**What happens:**
- A real Chrome browser window opens and navigates to the FUTMINNA portal
- You type your username and password directly into the browser (the app watches but never stores your password)
- Once you're signed in, the app saves the session to a local browser profile under `.portal/`
- Close the browser when done

Your password is NOT saved anywhere. Only the session cookie is kept, so you don't have to type your password every time.

### 2.2 Run the Fees Check

Now test the full flow with school fees:

```bash
npm run portal:fees
```

**What happens:**
1. The app opens the portal and signs in using your saved session
2. It navigates to the School Fees section
3. It reads your outstanding fees balance
4. It finds and follows the "Pay" or "Generate Invoice" link
5. It reaches the payment gateway page (Remita or similar)
6. **IT STOPS** — it never enters card details, never enters a PIN, never clicks "Pay Now"

**What success looks like:**

You'll see JSON output similar to this:

```json
{
  "status": "fees-check-complete",
  "feesBalance": "₦45,000.00",
  "paymentGateway": "remita",
  "gatewayReached": true,
  "stopped": "before payment form"
}
```

**What it proves:**
- Your saved login session works
- The app can navigate the real portal menu
- It can find and follow links on real portal pages
- The safety boundary works (stops before any payment)

**Safety reminder:** During this check, the portal might generate an invoice or RRR number (a reference for payment). This is normal — the portal does that when you visit the payment page. The app does NOT pay the invoice. No money is charged. You can safely ignore or pay the invoice later through normal channels.

## Step 3: Capture the Real Accommodation Page

The booking engine is complete and tested, but it has never seen the real hostel page (because you need to be logged in to see it). This step safely captures the page structure so the app knows where the room listings and Book buttons are.

### Why This Matters

The mock tests use a fake portal page. The real portal might show rooms differently — as a table, cards, a dropdown list, or something else. The recorder captures the real layout so the booking logic can adapt.

### How to Capture

Make sure you're logged in first (run `npm run portal:login` if your session expired), then:

```bash
npm run portal:record -- --label accommodation
```

**What happens:**
1. A browser window opens and signs into the portal
2. You'll see a message: "Navigate to the page you want to capture, then press Enter"
3. **You** navigate to the accommodation/hostel section yourself (click through the portal menus)
4. Once you can see the room listing page (the page where rooms are shown with Book/Select buttons), go back to the terminal and press Enter
5. The app scans the page structure and saves it to `.portal/captures/accommodation-[timestamp].json`

**What gets saved:**
- The page URL
- Room type names it found (e.g., "Room of 2", "Room of 4")
- The structure of tables, cards, or dropdowns
- Where Book/Select buttons are located
- **What does NOT get saved:** passwords, session cookies, personal details (emails and ID numbers are automatically redacted)

**This step does NOT book anything.** It only reads the page structure.

### What to Look For

After the capture completes, check the output. It should show something like:

```
Found 4 room types:
  - Room of 2 (Book button found)
  - Room of 4 (Book button found)
  - Single Room (sold out, no button)
  - Room of 6 (Book button found)

Saved to .portal/captures/accommodation-2026-11-05T14-23-10.json
```

If the capture is empty or shows no rooms, the accommodation section might not be open yet, or you captured the wrong page. Try again when the page clearly shows room options.

## Step 4: Dry Run

Choose the hostel first — on the dashboard picker or with `npm run portal:select` — then dry run to confirm the app can find it on the real page:

```bash
npm run portal:book -- --now
```

**What happens:**
1. The app opens the accommodation page
2. It scans for rows that name your chosen hostel and skips any row from the other gender's list
3. It finds the best available match (the room type only matters for Needs Assessment)
4. It shows you what it would book
5. **IT STOPS** — no clicking, no submission

### Watch It Happen

To see the browser in action, add the `--headed` flag:

```bash
npm run portal:book -- --now --headed
```

### What Success Looks Like

```json
{
  "status": "dry-run-match",
  "matched": "Room of 2",
  "position": "first preference",
  "wouldBook": true,
  "clickedNothing": true
}
```

If the dry run says `"status": "not-open"` or `"status": "sold-out"`, that's also fine — it means the accommodation section isn't open yet, or all rooms are currently taken. The important thing is that the dry run completes without errors.

**This confirms the app can find your preferred room type on the real portal page.**

## Step 5: Race Day — The Real Booking

On booking day, use the timed booking command. This is the ONLY command that actually submits a booking.

### The Command

```bash
npm run portal:book -- --at 2026-11-06T09:00:00 --live
```

Replace `2026-11-06T09:00:00` with the actual opening date and time. The time is interpreted as **Africa/Lagos timezone** by default (Nigerian time).

**Important:** Only this command, with the `--live` flag, will actually click the Book button. Everything else you've run so far (mock tests, fees check, capture, dry run) is safe and clicks nothing.

### Recommended Flags for Race Day

- `--headed` — Watch the browser in real time. Useful to see what's happening and catch any CAPTCHA.
  ```bash
  npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed
  ```

- `--poll 500` — Check the page every 500ms instead of every second. More aggressive, better for heavy competition.
  ```bash
  npm run portal:book -- --at 2026-11-06T09:00:00 --live --poll 500
  ```

- `--window 15` — Keep trying for 15 minutes after opening time (default is 10 minutes). Good if the server is overloaded.
  ```bash
  npm run portal:book -- --at 2026-11-06T09:00:00 --live --window 15
  ```

- `--rooms "Room of 2,Room of 4"` — Specify your preference order explicitly.
  ```bash
  npm run portal:book -- --at 2026-11-06T09:00:00 --live --rooms "Room of 2,Room of 4"
  ```

### Combine Flags

You can use multiple flags together:

```bash
npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed --poll 500 --window 15
```

### Unattended Run (Optional)

If you need to step away from the computer, you can make the run fully unattended by storing your credentials in a file:

1. Copy `.env.example` to `.env.local` (this file is gitignored and stays on your computer only)
2. Open `.env.local` and add:
   ```
   PORTAL_USERNAME=your_matric_number
   PORTAL_PASSWORD=your_password
   ```
3. Run the booking command as usual. If the session expires, the app will sign in again automatically.

**Warning:** Only do this on your personal computer. Never put credentials in `.env.local` on a shared or public server.

### Exit Codes

After the run completes, check the exit code to understand what happened:

- **Exit code 0** — Success! Room booked and confirmed by the portal.
- **Exit code 2** — Submission went through, but the app couldn't confirm whether the portal accepted it. **CHECK THE PORTAL YOURSELF** to see if the booking was recorded.
- **Exit code 1** — Failed (network error, sold out, CAPTCHA, etc.). Check the error message.

### Where Results Are Saved

The app saves a detailed result to `.portal/results/book-[timestamp].json`. Open it to see exactly what happened.

## Step 6: Troubleshooting

### Network Issues (Most Common in Nigeria)

**Symptoms:** 502, 503, 504 errors, "Connection reset", timeouts

**What the app does automatically:**
- Retries failed requests with exponential backoff (1s, 2s, 4s, etc.)
- Adds random jitter so it doesn't hammer the server
- Keeps trying until the `--window` time runs out

**What you should do:**
- Don't panic — the retry logic is built for this
- If your connection drops completely, restart the command. Your session is saved, so it picks up where it left off.
- Use `--window 15` to give more time during congested periods
- Running on a mobile hotspot? The app handles it.

### Portal Is Overloaded / Returning Errors

**Symptoms:** Portal shows "Service Unavailable", blank pages, 500 errors during the rush

**What the app does:**
- This is expected during booking rush hour
- The app retries automatically with jitter
- It keeps trying until the window closes

**What you should do:**
- Be patient — everyone else is also experiencing this
- The app will keep trying
- Consider using `--poll 500` and `--window 15` for more aggressive retry

### CAPTCHA Appears

**Symptoms:** The portal shows a CAPTCHA challenge

**What the app does:**
- It STOPS immediately and reports the CAPTCHA
- It never tries to bypass or solve CAPTCHA automatically

**What you should do:**
1. If the run was headless, restart with `--headed` so you can see and solve the CAPTCHA yourself
2. Solve the CAPTCHA manually when it appears
3. Re-run the booking command
4. The portal usually shows CAPTCHA after multiple failed login attempts — make sure your password is correct

### Session Expired

**Symptoms:** "Login failed", "Session expired", app asks for credentials

**What you should do:**
- Run `npm run portal:login` again to refresh your session
- Your session is stored in `.portal/` (gitignored, safe)
- Sessions usually last several hours or days, but the portal can expire them anytime

### Room Not Found

**Symptoms:** `"status": "sold-out"` even though you can see rooms available on the portal

**What might be wrong:**
- The captured page structure is outdated or incomplete
- The accommodation page layout changed
- The room names don't match exactly

**What you should do:**
1. Check the dry run output — what room types did it see?
   ```bash
   npm run portal:book -- --now --headed
   ```
2. If it sees no rooms, re-run the capture step:
   ```bash
   npm run portal:record -- --label accommodation
   ```
3. The real page structure might differ from what the app expects. Share the `.portal/captures/accommodation-*.json` file (safe to share — emails and IDs are redacted) so the issue can be diagnosed.

### "Accommodation Flow Unavailable" Error

**Symptoms:** `"status": "not-open"`, app says "Accommodation flow unavailable"

**What it means:**
- The accommodation section hasn't opened yet on the portal
- The link might not appear until opening time

**What the app does:**
- With `--live` and a time set (e.g., `--at 2026-11-06T09:00:00`), the app polls the portal repeatedly until the section opens or the window closes
- It checks every second (or every `--poll` milliseconds)

**What you should do:**
- This is normal before opening time
- The app will keep checking
- If you're past opening time and still seeing this, the portal might have moved the accommodation link — re-run the capture step

## Step 7: Understanding Results

After each run, the app saves a detailed result to `.portal/results/` as a JSON file. Here's what each status means:

### Status Values

- **`confirmed`** — Success! The portal showed a confirmation page saying the room was allocated to you. This is the only status that means you definitely got the room.

- **`dry-run-match`** — Dry run completed successfully. The app found your preferred room and would have booked it if `--live` was passed. Nothing was clicked.

- **`not-open`** — The accommodation section isn't open yet. Either the page link doesn't exist, or it says "Booking opens at [time]".

- **`sold-out`** — All rooms in your preference list are sold out or unavailable. The app checked every option and found no Book buttons.

- **`unconfirmed`** — **Important:** The app clicked the Book button and submitted the form, but the portal didn't show a clear confirmation page. The submission MAY have gone through, or it may have failed. **CHECK THE PORTAL YOURSELF** to see if the booking was recorded in your account.

- **`error`** — Something went wrong: network failure, CAPTCHA, login failure, or an unexpected portal response. Check the error message in the result file.

### What "unconfirmed" Means

This is the most ambiguous status. It means:

1. The app found your preferred room
2. It clicked the Book/Select button
3. It submitted the form
4. **But** the portal didn't show a page that clearly says "Booking confirmed" or "Room allocated"

**Why this happens:**
- The portal might be overloaded and returned a blank page
- The confirmation page might have changed its layout
- The network dropped right after submission
- The portal queued the booking without immediate feedback

**What you should do:**
- Log into the portal yourself and check your accommodation status
- Look for emails from the portal (confirmation emails)
- If the booking went through, great! If not, you'll need to book manually or run the app again.

**Only a portal confirmation page saying "Room allocated" or similar counts as true success.** Everything else requires manual verification.

## Step 8: Safety Summary

Here's a quick reference of what each command does and how safe it is:

| Command | What It Does | Safety Level |
| --- | --- | --- |
| `npm test` | Mock tests against fake local portal | ✅ Completely safe. No network, no account needed. |
| `npm run portal:login` | Opens real browser, you type your password | ✅ Safe. Password goes into portal, not the app. |
| `npm run portal:fees` | Reads fees, visits payment page, stops | ✅ Safe. May generate an invoice/RRR but never pays. |
| `npm run portal:record` | Captures page structure | ✅ Safe. Read-only, never submits anything. |
| `npm run portal:book --now` | Finds matching room, shows it, clicks nothing | ✅ Safe. Dry run only. |
| `npm run portal:book --live` | **Actually submits a booking** | ⚠️ **LIVE.** Only use on race day. |

**Key takeaway:** Nothing books unless you pass `--live`. The fees check never pays. The dry run never clicks. The mock tests need no internet connection.

---

## Quick Checklist for Race Day

Use this checklist the day before booking opens:

- [ ] Mock tests passing (`npm test`)
- [ ] Session saved and working (`npm run portal:login`)
- [ ] Fees check completed successfully (`npm run portal:fees`)
- [ ] Accommodation page captured (`npm run portal:record --label accommodation`)
- [ ] Dry run shows your preferred room (`npm run portal:book --now`)
- [ ] Internet connection stable (or mobile hotspot ready as backup)
- [ ] Booking command ready with the correct date/time
- [ ] Flags chosen: `--headed`, `--poll 500`, `--window 15`, etc.
- [ ] Alarm set for 10 minutes before opening time

Good luck! 🎓
