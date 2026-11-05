# 👋 START HERE - I Don't Know Anything About Coding

## What Is This?

A program that automatically books your hostel room at FUTMINNA so you don't have to compete with thousands of students refreshing the page.

---

## 🚀 I Just Want To Book My Room - What Do I Do?

### Step 1: Install Node.js (5 minutes)

1. Go to https://nodejs.org in your browser
2. Click the big green button that says "Download"
3. Run the downloaded file
4. Keep clicking "Next" until it installs
5. **Restart your computer**

---

### Step 2: Get This Code (2 minutes)

**Don't know Git? Do this:**

1. Go to https://github.com/RilangumaIshaku/hostel_booker
2. Click the green button "Code"
3. Click "Download ZIP"
4. Extract the ZIP to your Documents folder
5. You should now have a folder called `hostel_booker-main` in Documents

---

### Step 3: Open Command Prompt (30 seconds)

**Windows:**
1. Press Windows Key + R
2. Type `cmd` and press Enter
3. A black window opens - this is the "Command Prompt"

**Mac:**
1. Press Command + Space
2. Type "Terminal" and press Enter

---

### Step 4: Go to the Project Folder (30 seconds)

In the Command Prompt/Terminal, type:

**Windows:**
```
cd Documents\hostel_booker-main
```

**Mac:**
```
cd Documents/hostel_booker-main
```

Press Enter.

---

### Step 5: Install Everything (5 minutes)

Copy and paste these commands **one at a time**, pressing Enter after each:

```
npm install
```
(Wait 2-5 minutes - you'll see downloading progress)

```
npx playwright install chromium
```
(Wait 1-2 minutes - downloads a browser)

---

### Step 6: Test It Works (2 minutes)

Type this and press Enter:

```
npm test
```

**If you see:** "26 tests passed" with green checkmarks ✅
→ **SUCCESS! Continue to Step 7**

**If you see:** Red errors ❌
→ Something went wrong. Read TROUBLESHOOTING.md or ask for help

---

### Step 7: Save Your Login Info (2 minutes)

1. In the `hostel_booker-main` folder, create a new text file
2. Name it `.env.local` (yes, start with a dot)
   - **Windows:** Right-click → New → Text Document → Name it `.env.local`
   - **Mac:** In Terminal, type `touch .env.local`
3. Open `.env.local` with Notepad
4. Copy and paste this:

```
PORTAL_USERNAME=your-matric-number
PORTAL_PASSWORD=your-password
PORTAL_ROOMS=Room of 2,Room of 4
PORTAL_HOSTEL=Needs Assessment Hostel
```

5. Replace:
   - `your-matric-number` with your actual matric number
   - `your-password` with your actual portal password
   - Change `Room of 2,Room of 4` if you want different rooms

6. Save and close

**IMPORTANT:** This file stays on YOUR computer only. Nobody else can see it.

---

### Step 8: Test With Real Portal (5 minutes)

**Test 1: Choose Your Hostel**
```
npm run portal:select
```
- Type `b` for boys' hostels or `g` for girls' hostels
- Type the number of the hostel you want (for example `2`)
- Only hostels from the list you picked can ever be booked

**Test 2: Save Your Login**
```
npm run portal:login
```
- Browser opens
- Type your username and password
- Close browser
- Should say "Session saved"

**Test 3: Check Portal Navigation (CRITICAL TEST)**
```
npm run portal:fees
```
- This tests if the script can navigate the FUTMINNA portal
- **DOES NOT PAY ANYTHING** - just opens fees page and stops
- Should show: `"status": "gateway_reached"`

**If Test 3 works → The script CAN interact with FUTMINNA portal! ✅**

**Test 4: Capture Hostel Page**
```
npm run portal:record -- --label accommodation
```
- Browser opens
- **YOU** manually go to the hostel/accommodation page
- Press Enter in Command Prompt
- Should say "Captured accommodation page"

---

### Step 9: Practice Run (SAFE - Doesn't Book Anything)

```
npm run portal:book -- --now
```

This shows what it WOULD book without actually clicking anything.

**If it says:** `"outcome": "would_book"` and the log line names your hostel
→ **PERFECT! You're ready for race day!** ✅

If it says `No hostel chosen yet`, run `npm run portal:select` first.

---

## 🏁 RACE DAY - The Real Booking

### On Booking Day Morning:

1. Open Command Prompt/Terminal
2. Go to project folder:
   ```
   cd Documents\hostel_booker-main
   ```
3. Run this command (replace date/time with actual booking time):
   ```
   npm run portal:book -- --at 2026-11-06T09:00:00 --live
   ```

**Example:** If booking opens November 6, 2026 at 9:00 AM:
```
npm run portal:book -- --at 2026-11-06T09:00:00 --live
```

4. Let it run - DON'T close the window!
5. Wait for the result

---

## ✅ Understanding Results

After booking, you'll see one of these:

**"outcome": "confirmed"** ✅
- **SUCCESS!** Room booked
- Check the portal to verify
- Pay fees if needed

**"outcome": "not_available"**
- No rooms available yet
- Script keeps checking automatically
- Just wait

**"outcome": "unconfirmed"** ⚠️
- Might be booked, might not be
- **CHECK PORTAL IMMEDIATELY**
- **DO NOT RUN THE COMMAND AGAIN**

**"outcome": "session_expired"**
- Login died
- Run: `npm run portal:login` again

---

## 🆘 Something Went Wrong?

### "npm: command not found"
- Node.js not installed
- Install from https://nodejs.org
- Restart computer

### Tests fail
- Run: `npx playwright install chromium`

### "Session expired" 
- Run: `npm run portal:login` again

### Portal page looks different
- Run: `npm run portal:record -- --label accommodation`

### Still stuck?
- Read **TROUBLESHOOTING.md** for detailed help
- Or ask someone who knows coding

---

## 📋 Quick Command Reference

```bash
# Setup (once)
npm install
npx playwright install chromium

# Testing (before race day)
npm test                                    # Check installation
npm run portal:login                        # Save login
npm run portal:fees                         # Test navigation
npm run portal:record                       # Capture page
npm run portal:book -- --now --dry-run      # Practice

# Race day (REAL BOOKING)
npm run portal:book -- --at 2026-11-06T09:00:00 --live
```

---

## 🎯 Why This Works Better Than Manual

**Manual booking:**
- 9:00:00 AM - Booking opens
- 9:00:05 AM - You refresh page
- 9:00:15 AM - Page finally loads (slow network)
- 9:00:20 AM - You see "Room of 2"
- 9:00:22 AM - You click "Book"
- 9:00:30 AM - Page hangs
- 9:00:45 AM - You refresh
- 9:00:50 AM - "Room of 2" sold out 😭

**With this script:**
- 8:57:00 AM - Script starts, pre-warms connection
- 9:00:00 AM - Already signed in, immediately checks
- 9:00:01 AM - Sees "Room of 2"
- 9:00:02 AM - Clicks "Book"
- 9:00:03 AM - Confirmed ✅

**You save 20-30 seconds = You win! 🎉**

---

## 📚 More Detailed Guides

If you want to understand more:

- **SIMPLE-GUIDE.md** - Full step-by-step with explanations
- **VISUAL-GUIDE.md** - Diagrams showing how it works
- **RACE-DAY-CHECKLIST.md** - Print this for booking day
- **TROUBLESHOOTING.md** - Fix any errors

But honestly, if you just follow the 9 steps above, you're good!

---

## ⚠️ Important Notes

**This script:**
- ✅ Automatically books your room
- ✅ Stops if CAPTCHA appears (you solve it)
- ✅ Retries if network fails
- ✅ Only submits once (never double-books)
- ❌ Does NOT pay your fees (you do that after)
- ❌ Does NOT bypass security

**Your password:**
- Saved locally on YOUR computer only
- Never uploaded to GitHub
- Never sent anywhere except FUTMINNA portal
- You can delete `.env.local` after booking

---

## 🎉 That's It!

Follow the 9 steps above and you're ready to book.

**Test everything BEFORE booking day!**

If all tests pass, you'll beat 90% of students still loading the page. 🚀

**Good luck! 🍀**

---

**Questions?** Read the detailed guides or ask someone technical.

**Remember:** Test → Test → Test → THEN use on race day!
