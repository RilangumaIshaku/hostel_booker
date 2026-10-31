# 🏁 Race Day Checklist - Hostel Booking

## Pre-Race (Do Days Before)

- [ ] ✅ Tested on mock portal (`npm test` - all 17 tests passed)
- [ ] ✅ Tested fees payment flow (`npm run portal:fees` - reached gateway)
- [ ] ✅ Captured accommodation page (`npm run portal:record`)
- [ ] ✅ Dry run successful (`npm run portal:book -- --now --dry-run`)
- [ ] ✅ Confirmed room preferences in `.env.local` (e.g., "Room of 2,Room of 4")
- [ ] ✅ Portal session saved (`npm run portal:login`)
- [ ] ✅ Laptop fully charged or plugged in
- [ ] ✅ Backup network ready (in case primary fails)

## Race Day Morning (2 Hours Before)

- [ ] Close all unnecessary programs (to free up RAM and network)
- [ ] Disable Windows updates / automatic restarts
- [ ] Connect to most stable network (campus/home WiFi > mobile data)
- [ ] Test network speed (speedtest.net - need at least 2 Mbps)
- [ ] Open PowerShell in project folder
- [ ] Run quick connectivity test:
  ```powershell
  npm run portal:login
  ```

## 30 Minutes Before Booking Opens

- [ ] Verify current time matches Lagos time
  - Check: https://time.is/Lagos
  - Or run: `date` (should show correct time)

- [ ] Prepare the booking command (replace time with actual):
  ```powershell
  npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed
  ```

- [ ] Have portal open in regular browser (backup manual booking)

- [ ] Close all other apps and browser tabs

## 10 Minutes Before

- [ ] **RUN THE COMMAND NOW** (system starts early to pre-warm)
  ```powershell
  npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed
  ```

- [ ] Watch terminal output for:
  - ✅ "Pre-warming the portal session..."
  - ✅ "Session ready"
  - ✅ "Booking window reached. Polling the portal."

## During Booking Rush

**Normal to see:**
- "Attempt 1: not_available (not_open)" ← Booking hasn't opened yet
- "Attempt 5: not_available (portal_503)" ← Portal overloaded (auto-retries)
- Multiple attempts rapidly

**Stop and check if you see:**
- "security_challenge" → CAPTCHA appeared (must solve manually)
- "session_expired" → Session died (run manual backup)
- 8+ consecutive failures → Portal might be blocking, try manual

**SUCCESS looks like:**
```json
{
  "outcome": "confirmed",
  "preference": "Room of 2",
  "submitted": true
}
```

## After Booking

### If outcome = "confirmed"
- [ ] ✅ **SUCCESS!** Room booked
- [ ] Check portal manually to verify
- [ ] Check if payment required immediately
- [ ] Screenshot the confirmation page
- [ ] Save result file from `.portal/results/`

### If outcome = "unconfirmed"
- [ ] ⚠️ **STOP - DO NOT RE-RUN**
- [ ] Check portal manually (might have booked already)
- [ ] Check `.portal/results/result-*.json` for details
- [ ] If not booked, booking window might still be open

### If outcome = "not_available" (sold_out)
- [ ] Check if booking window still open
- [ ] System keeps trying until window closes
- [ ] Consider manual backup if system stops

### If outcome = "rejected"
- [ ] Portal rejected the booking (might be duplicate, wrong eligibility, etc.)
- [ ] Check portal for error message
- [ ] Try manual booking if needed

## Backup Plan (Manual Booking)

If automation fails, have regular browser ready:

1. Already signed in to portal
2. Accommodation page bookmarked
3. Fingers ready to click "Book" manually
4. Multiple tabs open (in case one freezes)

## Commands Quick Reference

```powershell
# Login before race day
npm run portal:login

# Dry run (test - clicks nothing)
npm run portal:book -- --now --dry-run

# Live booking (RACE DAY)
npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed

# Start 3 minutes early, try for 15 minutes
npm run portal:book -- --at 2026-11-06T08:57:00 --live --window 15

# Use different room preferences
npm run portal:book -- --at 2026-11-06T09:00:00 --live --rooms "Room of 4,Room of 2"

# Faster polling (checks every 500ms instead of 800ms)
npm run portal:book -- --at 2026-11-06T09:00:00 --live --poll 500
```

## Emergency Contacts

**If system fails:**
1. Try manual booking immediately
2. Check TROUBLESHOOTING.md
3. Check `.portal/results/` for error details

**DO NOT:**
- ❌ Re-run if result is "unconfirmed" (might double-book)
- ❌ Run multiple instances simultaneously
- ❌ Panic and close terminal mid-booking
- ❌ Change network during booking rush

**DO:**
- ✅ Let it finish the attempt
- ✅ Check portal manually after any "submitted: true" result
- ✅ Save the result file for reference
- ✅ Have backup manual booking ready

---

## Network Tips for Nigeria

**Best practices:**
- Use wired connection if possible (LAN > WiFi > Mobile)
- Test during similar traffic hours beforehand
- Position laptop near WiFi router
- Close WhatsApp/YouTube/anything using bandwidth
- Disable Windows update during rush hour
- Have backup: mobile hotspot ready if primary network fails

**If portal keeps timing out:**
- System auto-retries (this is expected)
- Consider increasing window: `--window 15`
- Last resort: manual booking

---

## Time Zone Note

System uses **Africa/Lagos timezone** by default.

**If you specify time as HH:MM (e.g., `--at 09:00`):**
- Interpreted as Lagos time ✅

**If you specify full ISO time (e.g., `--at 2026-11-06T09:00:00`):**
- Add `+01:00` to be explicit: `--at 2026-11-06T09:00:00+01:00`

**To check current Lagos time:**
```powershell
# In terminal (shows current time in Nigeria)
node -e "console.log(new Date().toLocaleString('en-NG', {timeZone:'Africa/Lagos'}))"
```

---

## Final Checklist (5 Minutes Before)

- [ ] Command typed and ready to press Enter
- [ ] OR already running and showing "Booking window reached"
- [ ] Browser backup ready (signed in, page open)
- [ ] Network stable
- [ ] Laptop not going to sleep
- [ ] Nothing else using heavy bandwidth
- [ ] Terminal visible to see results

## Good Luck! 🍀

Remember: Even if automation fails, you have manual backup. The automation just gives you an edge in the race.
