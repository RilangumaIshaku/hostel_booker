# 🎓 FUTMINNA Hostel Booker - Simple Guide for Students

## What This Does

**Automatically books your hostel room at exactly 9:00 AM on booking day.**

Instead of refreshing the portal frantically and competing with thousands of students, this script:
- Signs in automatically
- Waits until exactly the booking time
- Clicks "Book" faster than any human
- Confirms the booking
- Tells you if it worked

---

## 📱 Do This BEFORE Booking Day

### Step 1: Install Node.js (If You Don't Have It)

**Windows:**
1. Go to https://nodejs.org
2. Download the "LTS" version (the green button)
3. Run the installer (keep clicking "Next")
4. Restart your computer

**To check if it worked:**
Open Command Prompt (search "cmd" in Windows) and type:
```
node --version
```
Should show something like `v20.11.0` or higher.

---

### Step 2: Download This Code

**Option A - If you know Git:**
```bash
git clone https://github.com/RilangumaIshaku/hostel_booker.git
cd hostel_booker
```

**Option B - If you don't know Git:**
1. Go to https://github.com/RilangumaIshaku/hostel_booker
2. Click the green "Code" button
3. Click "Download ZIP"
4. Extract the ZIP file to your Documents folder
5. Open Command Prompt/Terminal
6. Type: `cd Documents\hostel_booker-main`

---

### Step 3: Install Dependencies (One Time Only)

In Command Prompt/Terminal, type these commands one by one:

```bash
npm install
```
(Wait 2-5 minutes for download)

```bash
npx playwright install chromium
```
(Wait 1-2 minutes for browser download)

---

### Step 4: Set Your Room Preferences

Create a file called `.env.local` in the project folder:

**Windows:** Right-click in folder → New → Text Document → Name it `.env.local` (delete the `.txt` part)

**Mac/Linux:** In Terminal, type: `touch .env.local`

Open `.env.local` with Notepad and paste this:

```env
# Your portal login (OPTIONAL - you can type it in browser instead)
PORTAL_USERNAME=your-matric-number-here
PORTAL_PASSWORD=your-password-here

# Room preferences (first choice, then backup)
PORTAL_ROOMS=Room of 2,Room of 4

# Hostel name
PORTAL_HOSTEL=Needs Assessment Hostel

# Booking time (set this on booking day)
PORTAL_START=2026-11-06T09:00:00
```

**IMPORTANT:**
- Replace `your-matric-number-here` with your actual matric number
- Replace `your-password-here` with your actual portal password
- Change room preferences if you want different rooms
- This file is ignored by Git (your password stays private)

**OR Skip This:** If you don't want to save your password, skip this step. The script will open a browser where you type your password.

---

### Step 5: Test It (CRITICAL - Do This Days Before!)

Run these tests to make sure everything works:

#### Test 1: Fake Portal Test (No Internet Needed)
```bash
npm test
```
**What you should see:** "17 tests passed" in green

**If it fails:** Run `npx playwright install chromium` again

---

#### Test 2: Login Test (Real Portal)
```bash
npm run portal:login
```
**What happens:**
- Browser opens
- You type your FUTMINNA username and password
- Browser closes
- Terminal says "Session saved"

**This saves your login session so the script can use it later.**

---

#### Test 3: Fees Payment Test (100% SAFE - DOES NOT PAY)
```bash
npm run portal:fees
```

**What happens:**
- Signs into real FUTMINNA portal
- Navigates to School Fees
- Reads your balance
- Clicks "Pay Now"
- **STOPS before entering card details or paying anything**

**What you should see:**
```json
{
  "status": "gateway_reached",
  "amount": 48500
}
```

**This proves the script can navigate your real portal successfully.**

**If this fails:** The portal layout might be different. See TROUBLESHOOTING.md

---

#### Test 4: Capture Accommodation Page (Required Once)
```bash
npm run portal:record -- --label accommodation
```

**What you do:**
1. Browser opens and signs you in
2. **YOU** navigate to the hostel/accommodation page manually
3. Once you see the room listings, press Enter in the terminal
4. Terminal says "Captured accommodation page"

**Why?** The script needs to "learn" what your accommodation page looks like once.

---

#### Test 5: Dry Run (Practice Booking - Clicks NOTHING)
```bash
npm run portal:book -- --now --dry-run --headed
```

**What happens:**
- Browser opens (you can watch because of `--headed`)
- Goes to accommodation page
- Finds your preferred room
- Shows what it WOULD click
- **Does NOT actually click anything**

**What you should see:**
```json
{
  "outcome": "would_book",
  "preference": "Room of 2",
  "submitted": false
}
```

**This proves the script found your room and knows what to book.**

---

## 🚀 Booking Day - THE REAL THING

### The Night Before
1. Make sure your laptop is fully charged
2. Connect to most reliable network (WiFi better than mobile data)
3. Close all other programs
4. Know the exact booking time (e.g., 9:00 AM)

### On Booking Day

#### Option 1: Automatic Login (If You Saved Password in .env.local)

Open Command Prompt/Terminal in the project folder and run:

```bash
npm run portal:book -- --at 2026-11-06T09:00:00 --live
```

Replace `2026-11-06T09:00:00` with the actual date and time.

**Example times:**
- `2026-11-06T09:00:00` = November 6, 2026 at 9:00 AM
- `2026-11-10T08:30:00` = November 10, 2026 at 8:30 AM

#### Option 2: Manual Login (Safer)

If you didn't save your password:

```bash
npm run portal:login
npm run portal:book -- --at 2026-11-06T09:00:00 --live
```

---

### What Happens When You Run It

```
09:00:00 Pre-warming the portal session...
09:00:05 Session ready (existing_session).
09:00:06 Booking window reached. Polling the portal.
09:00:07 Attempt 1: not_available (not_open)
09:00:08 Attempt 2: not_available (not_open)
09:00:09 Attempt 3: confirmed (Room of 2)
```

**If it says "confirmed":** ✅ SUCCESS! Room booked!

**Check the portal manually to verify and pay if required.**

---

### Understanding Results

The script saves a result file in `.portal/results/` with one of these outcomes:

| Outcome | What It Means | What You Do |
|---------|---------------|-------------|
| `confirmed` | ✅ Room booked successfully! | Verify in portal, pay if needed |
| `would_book` | Dry run - nothing was clicked | This was just practice |
| `not_available` | No rooms available yet or sold out | Script keeps trying |
| `rejected` | Portal rejected the booking | Check portal for error message |
| `unconfirmed` | Submit clicked but no confirmation seen | **CHECK PORTAL IMMEDIATELY** - might be booked |
| `session_expired` | Login expired | Run `npm run portal:login` again |
| `security_challenge` | CAPTCHA appeared | Must solve manually |

---

## 🎯 Quick Command Reference

```bash
# Setup (once)
npm install
npx playwright install chromium

# Testing (before booking day)
npm test                           # Fake portal test
npm run portal:login               # Save your login
npm run portal:fees                # Test fees flow (safe)
npm run portal:record              # Capture hostel page
npm run portal:book -- --now --dry-run  # Practice run

# Booking day
npm run portal:book -- --at 2026-11-06T09:00:00 --live

# Watch it work (shows browser)
npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed

# Start 3 minutes early, try for 15 minutes
npm run portal:book -- --at 2026-11-06T08:57:00 --live --window 15

# Different room preferences
npm run portal:book -- --at 2026-11-06T09:00:00 --live --rooms "Room of 4,Room of 2"
```

---

## ⚠️ IMPORTANT SAFETY NOTES

### What This Script DOES:
✅ Signs into portal
✅ Waits for exact booking time
✅ Clicks "Book" on your preferred room
✅ Confirms the booking
✅ Reports success or failure

### What This Script DOES NOT Do:
❌ Pay your fees (you do this manually after booking)
❌ Register for exams
❌ Steal your password (it's saved locally, never uploaded)
❌ Submit multiple bookings (only submits once)
❌ Bypass CAPTCHA (stops if CAPTCHA appears)

### Security:
- Your password is saved locally on YOUR computer only
- `.env.local` is ignored by Git (never uploaded to GitHub)
- The script never sends your credentials anywhere except FUTMINNA portal
- You can delete `.env.local` after booking if you want

---

## 🆘 Common Problems

### "npm: command not found"
**Fix:** Install Node.js from https://nodejs.org and restart terminal

### Tests fail
**Fix:** Run `npx playwright install chromium`

### "Session expired" during booking
**Fix:** Run `npm run portal:login` again 10 minutes before booking time

### Booking shows "not_available (not_open)"
**This is normal before 9:00 AM.** The script keeps checking until rooms appear.

### "security_challenge" or CAPTCHA
**You must solve it manually.** Use the `--headed` flag to see the browser and solve the CAPTCHA.

### Network keeps failing in Nigeria
**Solutions:**
- Use wired connection if possible
- Close WhatsApp, YouTube, anything using bandwidth
- Try campus network instead of home
- Increase retry window: `--window 15` (tries for 15 minutes)

---

## 📞 Need Help?

1. **Read TROUBLESHOOTING.md** - Detailed solutions for every error
2. **Check `.portal/results/`** - Contains detailed logs of what happened
3. **Open an issue on GitHub** - Include the error message (not your password!)

---

## 🎓 Tips for Success

### Days Before Booking:
- ✅ Test everything (all 5 test steps above)
- ✅ Confirm your room preferences
- ✅ Know exact booking date and time
- ✅ Test during similar network conditions

### Morning of Booking:
- ✅ Laptop fully charged or plugged in
- ✅ Connect to stable network
- ✅ Close all other programs
- ✅ Run the command 10 minutes BEFORE booking time
- ✅ Have backup: portal open in regular browser too

### During Booking:
- ✅ Don't close the terminal window
- ✅ Don't switch networks mid-booking
- ✅ Let it run - it retries automatically on errors
- ✅ Watch for "confirmed" message

### After "confirmed":
- ✅ Check portal manually to verify
- ✅ Screenshot the confirmation page
- ✅ Pay fees if required immediately

---

## 🎉 Success Rate

**Mock Portal Tests:** 100% (17/17 tests pass)

**Real Portal:** Unknown until you test it

**That's why you MUST test before booking day!**

Run through all 5 test steps above. If all tests pass, you're ready.

---

## 💡 Why This Works

Most students:
1. Wait for 9:00 AM
2. Refresh the page
3. Page loads after 5-10 seconds (network lag)
4. Click "Book"
5. Page hangs
6. Portal crashes
7. Try again
8. Rooms sold out

This script:
1. Signs in at 8:57 AM (session already warm)
2. At 9:00:00, immediately requests accommodation page
3. Clicks "Book" within 1 second of page loading
4. Retries automatically if network fails
5. Only reports success when portal confirms

**You get a 5-10 second head start** while others are still loading the page.

---

## 📚 Additional Documentation

- **TEST-ME-FIRST.md** - Quick 15-minute test guide
- **TROUBLESHOOTING.md** - Detailed error solutions
- **RACE-DAY-CHECKLIST.md** - Step-by-step checklist for booking day
- **docs/quick-start.md** - Alternative quick start
- **docs/testing-guide.md** - Comprehensive testing guide
- **README.md** - Technical documentation

---

## ⚖️ Disclaimer

This tool automates the booking process but does not guarantee a room. Success depends on:
- Room availability
- Network connection quality
- Portal server capacity
- Whether you tested it beforehand

**Use at your own risk. Test thoroughly before race day.**

---

**Made with ❤️ for FUTMINNA students tired of the hostel booking chaos.**

**Good luck! 🍀**
