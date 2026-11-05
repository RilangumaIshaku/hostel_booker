# 🚀 TEST THIS NOW - Before Booking Day

**The system has never been tested on the real FUTMINNA portal. Do these tests TODAY.**

## ⚡ Super Quick Test (15 minutes)

Open PowerShell/Terminal in this folder and run these commands **in order**:

### 1. Install (5 min)
```powershell
npm install
npx playwright install chromium
```

### 2. Test Locally (2 min)
```powershell
npm test
```
✅ Should see: "✔ tests passed" - All 26 tests green

### 3. Login to Real Portal (2 min)
```powershell
npm run portal:login
```
✅ Browser opens → You type your FUTMINNA credentials → "Session saved"

### 4. Test School Fees (3 min) - **DOES NOT PAY ANYTHING**
```powershell
npm run portal:fees
```
✅ Should see: `"status": "gateway_reached"` or `"fees_page_confirmed"`

**This is the CRITICAL test.** If this works, your system can interact with the real portal.

### 5. Capture Hostel Page (3 min)
```powershell
npm run portal:record -- --label accommodation
```
✅ Browser opens → Navigate to hostel/accommodation page → Press Enter
✅ Should see: "Found X room-like rows"

---

## 🎯 After Testing

### Dry Run (Practice)
```powershell
npm run portal:book -- --now --dry-run
```
Shows what it WOULD book. Clicks nothing.

### Live Booking (Race Day ONLY)
```powershell
# Replace time with actual booking time
npm run portal:book -- --at 2026-11-06T09:00:00 --live --headed
```

Use `--headed` to watch it work. Remove it for speed.

---

## 🔴 Common Issues

### "npm: command not found"
Install Node.js from https://nodejs.org

### "Tests fail"
Try: `npx playwright install chromium`

### "Session expired" during fees test
Run `npm run portal:login` again

### Fees test shows "no_pay_action"
The portal layout might be different. Share the output with someone who can help adjust the code.

### Network issues in Nigeria
- Use your most reliable network connection
- Test during off-peak hours first
- On booking day, run locally (not from cloud) for lowest latency

---

## 📚 Need More Details?

- **Quick overview**: `docs/quick-start.md`
- **Full testing guide**: `docs/testing-guide.md`
- **Technical details**: `README.md`

---

## ⚠️ Safety Reminders

✅ Fees check STOPS before payment - no money is charged
✅ Dry run NEVER clicks submit - just shows what it would do
✅ Your password goes INTO the portal - not stored by this tool
✅ Nothing books unless you use `--live` flag
✅ Tests run on a fake local portal - completely safe
