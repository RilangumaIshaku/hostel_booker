# Quick Start Guide

Get the FUTMINNA Hostel Booker running today. Follow these steps in order.

## Prerequisites

- **Node.js 18 or newer** — Download from [nodejs.org](https://nodejs.org) if not installed
- Run these commands once in the project folder:
  ```bash
  npm install
  npx playwright install chromium
  ```

## First-Time Setup Checklist

Work through this checklist before booking day:

1. [ ] Node.js installed — check with `node --version` (should show v18.0.0 or higher)
2. [ ] Dependencies installed — `npm install` ran successfully
3. [ ] Playwright browser installed — `npx playwright install chromium` ran successfully
4. [ ] Portal username and password ready (NOT saved anywhere — you type it into the browser)
5. [ ] `.env.local` created from `.env.example` if using cloud features (optional)

## Testing Sequence (Do These in Order)

Run these five steps before booking day to make sure everything works:

### 1. Mock Tests

```bash
npm test
```

**What it does:** Runs 17 tests against a fake local portal. No internet connection needed.

**What success looks like:** All 17 tests pass. If any fail, something broke — do not continue to the real portal.

---

### 2. Login

```bash
npm run portal:login
```

**What it does:** Opens a real browser window. You type your FUTMINNA portal username and password directly into the browser. The app saves the session but NOT your password.

**What success looks like:** Browser opens, you sign in, the app says "Session saved", browser closes.

---

### 3. Fees Check

```bash
npm run portal:fees
```

**What it does:** Signs into the real portal, navigates to School Fees, reads your balance, follows the payment link, and STOPS before entering card details or paying anything.

**What it proves:** The app works end-to-end with the real FUTMINNA portal. Login works, navigation works, link-following works, and the safety boundary works.

**Safety note:** This may generate an invoice/RRR number, but it never pays the invoice. No money is charged.

---

### 4. Capture Accommodation Page

```bash
npm run portal:record -- --label accommodation
```

**What it does:** Opens the portal in a browser and waits for you to navigate to the accommodation/hostel page yourself. Once you see the room listings, press Enter in the terminal. The app saves the page structure (room names, buttons, layout) to `.portal/captures/`.

**What success looks like:** The capture file shows the room types it found (e.g., "Room of 2", "Room of 4") and whether Book buttons are present.

**This step does NOT book anything** — it only reads the page structure.

---

### 5. Dry Run

```bash
npm run portal:book -- --now
```

**What it does:** Opens the accommodation page, finds the best matching room from your preferences, shows what it would book, then STOPS without clicking anything.

**What it proves:** The app can match your preferred room type on the real portal page.

**Add `--headed` to watch it happen:**
```bash
npm run portal:book -- --now --headed
```

---

## On Booking Day

Use this command when accommodation booking opens:

```bash
npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed --poll 500
```

**Replace `2026-11-06T09:00:00` with the real opening date and time** (Africa/Lagos timezone).

### What Each Flag Means

- `--at [time]` — Wait until this time, then start booking
- `--live` — **REQUIRED** to actually submit a booking. Without this flag, nothing is clicked.
- `--headed` — Show the browser (recommended so you can see what's happening and solve CAPTCHA if it appears)
- `--poll 500` — Check every 500ms instead of every second (more aggressive, better for competition)

### Optional Flags

- `--window 15` — Keep trying for 15 minutes after opening time (default is 10 minutes)
- `--rooms "Room of 2,Room of 4"` — Specify your preference order explicitly

### Example: Aggressive Race-Day Command

```bash
npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed --poll 500 --window 15
```

## If Something Goes Wrong

- **Session expired?** → Run `npm run portal:login` again
- **Room not found?** → Re-run the capture step (`npm run portal:record -- --label accommodation`)
- **Network errors (502/503/504)?** → The app retries automatically. Be patient.
- **CAPTCHA appears?** → Solve it manually. If running headless, restart with `--headed`.
- **Need more help?** → See the full guide at `docs/testing-guide.md`

## Understanding Results

After a booking run, check the exit code:

- **Exit code 0** — Success! Room booked and confirmed.
- **Exit code 2** — Submission may have gone through but not confirmed. **Check the portal yourself.**
- **Exit code 1** — Failed. Check the error message.

Results are saved to `.portal/results/book-[timestamp].json` for detailed information.

---

## Safety Reminder

- **Mock tests (`npm test`)** — Completely safe, no network, no account
- **Login (`portal:login`)** — Opens real browser, you type password, app never stores it
- **Fees check (`portal:fees`)** — Reads fees, visits payment page, NEVER pays
- **Recorder (`portal:record`)** — Reads page structure only, never submits anything
- **Dry run (`portal:book --now`)** — Shows matching room, never clicks
- **Live run (`portal:book --live`)** — **THE ONLY COMMAND THAT ACTUALLY BOOKS.** Use on race day only.

---

Good luck with your booking! 🎓
