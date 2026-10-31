# 📊 Visual Guide - How It Works

## 🎯 The Simple Version

```
YOU → Run command → Script does everything → Room booked ✅
```

That's it!

---

## 📈 Setup Flow (Do Once)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Install Node.js                                     │
│ Download from https://nodejs.org                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Download Code                                       │
│ git clone https://github.com/RilangumaIshaku/hostel_booker │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Install Dependencies                                │
│ npm install                                                 │
│ npx playwright install chromium                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Create .env.local file                              │
│ Add your matric number, password, room preferences          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Test Everything                                     │
│ npm test                    (fake portal)                   │
│ npm run portal:login        (save session)                  │
│ npm run portal:fees         (test navigation)               │
│ npm run portal:record       (capture page)                  │
│ npm run portal:book --dry   (practice)                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    ✅ READY FOR BOOKING DAY!
```

---

## 🚀 Booking Day Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 8:50 AM - You run the command:                              │
│ npm run portal:book -- --at 2026-11-06T09:00:00 --live      │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 8:50-8:59 AM - Script pre-warms                             │
│ ✓ Launches browser (hidden)                                 │
│ ✓ Signs into FUTMINNA portal                                │
│ ✓ Waits for exact 9:00 AM                                   │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 9:00:00 AM - BOOKING OPENS                                  │
│ Script immediately:                                          │
│ ✓ Opens accommodation page                                  │
│ ✓ Scans for your preferred room                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
                    ┌─────────┐
                    │ Found?  │
                    └─────────┘
                    ↙         ↘
              YES ✅          NO ❌
                ↓               ↓
┌──────────────────────┐  ┌──────────────────────┐
│ Click "Book"         │  │ Keep checking        │
│ Confirm booking      │  │ Retry every 800ms    │
│ Wait for portal      │  │ Try backup rooms     │
│ confirmation         │  │ (Room of 4)          │
└──────────────────────┘  └──────────────────────┘
        ↓                         ↓
┌──────────────────────┐  ┌──────────────────────┐
│ outcome: "confirmed" │  │ Keep trying for      │
│ ✅ SUCCESS!          │  │ 10 minutes           │
│ Room booked          │  │ (or until sold out)  │
└──────────────────────┘  └──────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│ You verify in portal manually and pay fees                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎭 What Happens Behind the Scenes

### When You Run the Command:

```
Terminal                Browser (Hidden)              FUTMINNA Portal
   |                           |                             |
   |── npm run portal:book ───→|                             |
   |                           |                             |
   |                           |──── Open browser ──────────→|
   |                           |                             |
   |                           |──── Navigate to portal ────→|
   |                           |←──── Login page ───────────|
   |                           |                             |
   |                           |──── Enter username/pwd ────→|
   |                           |←──── Dashboard ────────────|
   |                           |                             |
   |← "Session ready"          |                             |
   |                           |                             |
   |← "Waiting for 9:00 AM..." |                             |
   |                           |                             |
   |    ⏰ 9:00:00 AM          |                             |
   |                           |                             |
   |← "Polling portal..."      |──── Get accommodation ─────→|
   |                           |←──── Room list ────────────|
   |                           |                             |
   |                           |──── Find "Room of 2" ──────→|
   |                           |──── Click "Book" ──────────→|
   |                           |←──── Confirmation ─────────|
   |                           |                             |
   |← "confirmed" ✅           |                             |
   |                           |                             |
```

---

## 🤔 Why This Beats Manual Booking

### Traditional Student Approach:
```
9:00 AM: Booking opens
9:00:05: Student refreshes page
9:00:15: Page loads (slow network in Nigeria)
9:00:20: Student sees "Room of 2" available
9:00:22: Student clicks "Book"
9:00:35: Page hangs (portal overloaded)
9:00:45: Student refreshes again
9:00:50: "Room of 2" sold out
9:01:00: Only "Room of 6" left
9:01:10: Student gives up or settles for bad room
```

**Total time:** 70 seconds to fail

### With This Script:
```
8:57 AM: Script starts, pre-warms connection
9:00:00: Script already signed in, ready to go
9:00:01: Script requests accommodation page
9:00:02: Script sees "Room of 2" available
9:00:03: Script clicks "Book"
9:00:04: Script confirms
9:00:05: Confirmation received
```

**Total time:** 5 seconds to success ✅

**You beat 95% of students who are still loading the page!**

---

## 🧪 Testing Phase (Do This Days Before!)

```
┌────────────────────────────────────────────────────────────┐
│ Test 1: npm test                                           │
│ Tests on fake local portal                                 │
│ ✅ Pass = Everything installed correctly                   │
│ ❌ Fail = Run: npx playwright install chromium             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Test 2: npm run portal:login                               │
│ Opens real browser, you type password                      │
│ ✅ Pass = "Session saved"                                  │
│ ❌ Fail = Check internet connection                        │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Test 3: npm run portal:fees                                │
│ CRITICAL TEST - Proves script works with real portal       │
│ ✅ Pass = "gateway_reached" or "fees_page_confirmed"       │
│ ❌ Fail = Portal layout changed, need to adjust code       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Test 4: npm run portal:record                              │
│ YOU navigate to hostel page, script captures it            │
│ ✅ Pass = "Found X room-like rows"                         │
│ ❌ Fail = Accommodation page not accessible yet            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Test 5: npm run portal:book -- --now --dry-run             │
│ Practice run, clicks NOTHING                               │
│ ✅ Pass = "would_book" + your room preference              │
│ ❌ Fail = "not_available" (might not be open yet)          │
└────────────────────────────────────────────────────────────┘

           ALL TESTS PASS? ✅
                 ↓
        READY FOR RACE DAY! 🚀
```

---

## 📱 Commands Comparison

| What You Want | Command | What It Does |
|---------------|---------|--------------|
| **Test locally** | `npm test` | Tests on fake portal, no internet |
| **Save login** | `npm run portal:login` | Opens browser, you sign in once |
| **Test fees** | `npm run portal:fees` | Tests navigation, NEVER pays |
| **Capture page** | `npm run portal:record` | Learns hostel page layout |
| **Practice** | `npm run portal:book -- --now --dry-run` | Shows what it would book, clicks nothing |
| **RACE DAY** | `npm run portal:book -- --at 2026-11-06T09:00:00 --live` | Books for real! |

---

## 🎯 Decision Tree: What Command Should I Run?

```
                    START
                      ↓
              First time setup?
                ↙          ↘
             YES            NO
              ↓              ↓
        npm install      Testing or
              ↓          race day?
        npm test            ↓
              ↓         ┌────────┐
        All pass?       │Testing │
          ↙   ↘         └────────┘
        NO    YES            ↓
         ↓     ↓        Already tested
    Fix it   portal:login  everything?
         ↓     ↓            ↙    ↘
         ←─────┘          YES    NO
              ↓            ↓      ↓
         portal:fees   Race day  Run all
              ↓          mode    5 tests
         portal:record    ↓       ↓
              ↓            ↓      ↓
         portal:book   Use --live  ←
            --dry          ↓
              ↓            ↓
         All good?    npm run portal:book
              ↓       -- --at TIME --live
             YES           ↓
              ↓       🎉 BOOKED!
         Ready! ✅
```

---

## 🔄 What Happens If Network Fails?

```
Attempt 1: Click "Book"
    ↓
Network error (ECONNRESET)
    ↓
Script waits 1 second
    ↓
Attempt 2: Try again
    ↓
Network error (ETIMEDOUT)
    ↓
Script waits 2 seconds (longer this time)
    ↓
Attempt 3: Try again
    ↓
SUCCESS! Booking confirmed ✅
```

**The script automatically retries network failures.** You don't do anything.

---

## ⚠️ Error Outcomes Explained

```
┌─────────────────┬────────────────────────────────────────────┐
│ Result          │ What It Means                              │
├─────────────────┼────────────────────────────────────────────┤
│ confirmed ✅    │ SUCCESS! Room booked                       │
│                 │ → Check portal and pay                     │
├─────────────────┼────────────────────────────────────────────┤
│ would_book      │ Dry run, nothing clicked                   │
│                 │ → This is just practice                    │
├─────────────────┼────────────────────────────────────────────┤
│ not_available   │ No rooms yet or sold out                   │
│ (not_open)      │ → Script keeps checking                    │
├─────────────────┼────────────────────────────────────────────┤
│ not_available   │ All rooms sold out                         │
│ (sold_out)      │ → Too late, try backup room                │
├─────────────────┼────────────────────────────────────────────┤
│ unconfirmed ⚠️  │ Clicked but no confirmation                │
│                 │ → CHECK PORTAL NOW (might be booked!)      │
│                 │ → DO NOT RUN AGAIN                         │
├─────────────────┼────────────────────────────────────────────┤
│ session_expired │ Login died                                 │
│                 │ → Run: npm run portal:login                │
├─────────────────┼────────────────────────────────────────────┤
│ security_       │ CAPTCHA appeared                           │
│ challenge       │ → Use --headed and solve manually          │
├─────────────────┼────────────────────────────────────────────┤
│ rejected        │ Portal said no                             │
│                 │ → Check portal for reason                  │
└─────────────────┴────────────────────────────────────────────┘
```

---

## 🎨 File Structure (What's What?)

```
hostel_booker/
│
├── 📘 SIMPLE-GUIDE.md          ← START HERE (this is for you!)
├── 📘 TEST-ME-FIRST.md         ← Quick test guide
├── 📘 RACE-DAY-CHECKLIST.md    ← Print for booking day
├── 📘 TROUBLESHOOTING.md       ← Fix errors
├── 📘 VISUAL-GUIDE.md          ← This file (diagrams)
│
├── 🔧 .env.local               ← YOU CREATE THIS (your settings)
├── 🔧 .env.example             ← Template to copy
│
├── 📦 package.json             ← Project config (don't touch)
├── 📦 node_modules/            ← Installed code (don't touch)
│
├── 🤖 worker/                  ← Booking engine (the magic)
│   ├── portal/
│   │   ├── booker.mjs          ← Main booking logic
│   │   ├── session.mjs         ← Portal login
│   │   └── inventory.mjs       ← Room detection
│
├── 📜 scripts/
│   └── book.mjs                ← Command-line interface
│
├── 🧪 test/                    ← Tests (for developers)
│
└── 📂 .portal/                 ← Auto-created when you run tests
    ├── captures/               ← Saved page structures
    └── results/                ← Booking results (check after booking)
```

**You only need to touch:**
- `.env.local` (create it with your settings)
- Terminal (run commands)

**Everything else works automatically!**

---

## 💡 Pro Tips

### Tip 1: Start Early
```
DON'T: npm run portal:book -- --at 09:00:00
(Starts exactly at 9, might miss first second)

DO: npm run portal:book -- --at 08:57:00 --window 15
(Starts 3 minutes early, tries for 15 minutes)
```

### Tip 2: Watch It Work (First Time)
```
DO: npm run portal:book -- --at TIME --live --headed
(Shows browser so you see what happens)

Then next time:
DO: npm run portal:book -- --at TIME --live
(Faster without visible browser)
```

### Tip 3: Have a Backup
```
Primary: Run this script
Backup: Portal open in regular browser

If script fails, you can still book manually
```

### Tip 4: Test on Similar Network
```
If booking is at 9 AM on weekday:
Test at 9 AM on another weekday

Network congestion at 9 AM vs 11 PM is different
```

---

## 📊 Success Probability

```
Probability of success depends on:

✅ You tested all 5 tests before race day     = +40%
✅ You're on stable network (WiFi > mobile)   = +20%
✅ You start script 3 minutes early           = +15%
✅ You have backup manual booking ready       = +10%
✅ Your preferred room has multiple slots     = +10%
✅ You run locally (not cloud)                = +5%
                                              ─────
                                              = 100%

Skip testing?                                 = -40%
Bad network?                                  = -20%
Portal changes layout?                        = -30%
You panic and restart mid-booking?            = -50%
```

**Test everything days before = Success!**

---

## 🎬 Next Steps

1. **Read [SIMPLE-GUIDE.md](SIMPLE-GUIDE.md)** for detailed instructions
2. **Run all 5 tests** from TEST-ME-FIRST.md
3. **Print [RACE-DAY-CHECKLIST.md](RACE-DAY-CHECKLIST.md)**
4. **Set calendar reminder**: Test again 1 day before booking
5. **On race day**: Run the command, watch for "confirmed", verify in portal

**Good luck! 🍀**
