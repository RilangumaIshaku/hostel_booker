# Troubleshooting Common Issues

## Installation Problems

### "npm: command not found"
**Problem:** Node.js is not installed.

**Solution:**
1. Download Node.js from https://nodejs.org (LTS version)
2. Install it
3. Close and reopen PowerShell/Terminal
4. Run `node --version` to verify (should show v18 or higher)

### "npm install" fails with network errors
**Problem:** Nigerian network issues or NPM registry slow.

**Solution:**
```powershell
# Try with longer timeout
npm install --fetch-timeout=600000

# Or use a different registry
npm config set registry https://registry.npmmirror.com
npm install
# Then switch back
npm config set registry https://registry.npmjs.org
```

### "npx playwright install chromium" fails
**Problem:** Large download over slow network.

**Solution:**
```powershell
# Try with retries
npx playwright install chromium --force
```

---

## Test Failures

### Mock tests fail ("npm test")
**Problem:** Playwright browser not installed or something broke.

**Solutions:**
1. Install browser: `npx playwright install chromium`
2. Check Node version: `node --version` (must be 18+)
3. Reinstall: `rm -rf node_modules` then `npm install`

### "Session expired" during portal tests
**Problem:** Portal logged you out between tests.

**Solution:**
```powershell
# Login again
npm run portal:login
```

---

## Portal Connection Issues

### "portal:fees" shows "no_pay_action"
**Problem:** The portal layout changed or is different than expected.

**What to check:**
1. Does the fees page load in browser? Try `--headed` flag:
   ```powershell
   npm run portal:fees -- --headed
   ```
2. Watch what happens in browser
3. Look for any error messages

**Next steps:**
- If page loads but doesn't find payment button, the portal layout might be different
- Run `npm run portal:discover` to capture full portal structure
- Share the output from `.portal/captures/discovery-*.json` (it's safe - no passwords)

### "Session expired" or "Login failed"
**Possible causes:**
1. Portal credentials changed
2. Portal down/maintenance
3. Network blocked the portal

**Solutions:**
1. Try logging in manually at https://eportal.futminna.edu.ng/ePortal_V2/
2. If manual login works, try `npm run portal:login` again
3. If manual login fails, portal might be down

### "portal_section_not_found" error
**Problem:** The app couldn't find the accommodation/hostel link.

**Solution:**
1. Run with visible browser to see what happened:
   ```powershell
   npm run portal:record -- --label accommodation --headed
   ```
2. Manually navigate to accommodation page
3. Let it capture the page structure

---

## Booking Issues

### Dry run shows "not_available" with reason "not_open"
**This is expected behavior.** Booking hasn't opened yet. The system will wait until opening time.

### Dry run shows "not_available" with reason "sold_out"
**Possible causes:**
1. Booking hasn't opened yet and page shows no rooms
2. All rooms actually sold out
3. Page structure different than expected

**Check:**
```powershell
# Watch it in browser
npm run portal:book -- --now --dry-run --headed
```

### Dry run shows "portal_section_not_found"
**Problem:** Can't find accommodation page.

**Solution:** Capture it manually:
```powershell
npm run portal:record -- --label accommodation
```

### Live booking: "unconfirmed" result
**What this means:** The submit button was clicked but we didn't see a confirmation message.

**IMPORTANT:** 
1. **DO NOT RUN IT AGAIN** - it might have already booked
2. Check the portal manually to see if room was allocated
3. Check `.portal/results/result-*.json` for more details

---

## Network Issues (Nigeria-Specific)

### Portal loads slowly or times out
**Solutions:**
1. Use your most stable network connection (not mobile data if possible)
2. Test during off-peak hours (not 8-10am, not 5-7pm)
3. Increase timeouts:
   ```powershell
   npm run portal:book -- --now --window 15
   ```
   (keeps trying for 15 minutes)

### "ECONNRESET" or "ETIMEDOUT" errors
**This is normal with Nigerian networks.** The system retries automatically.

If it happens repeatedly:
- Switch to a different network
- Try from campus network if available
- Test at different time of day

### Portal works manually but app fails
**Possible causes:**
1. Portal blocking automation (rare)
2. CAPTCHA appearing
3. Portal behavior different in automation

**Check:**
```powershell
# Watch in visible browser
npm run portal:fees -- --headed
```

---

## Race Day Issues

### "Too late, booking already closed"
**Problem:** System started too late.

**Prevention:**
```powershell
# Start 3 minutes early with 15-minute window
npm run portal:book -- --at 2026-11-06T08:57:00 --live --window 15
```

### Multiple "attempt X failed" messages
**This is normal during rush hour.** Portal is overloaded. The system retries.

**When to worry:**
- 8+ consecutive failures = might need to stop and try manually
- "security_challenge" = CAPTCHA appeared, must solve manually

### Booking confirmed but asked to pay immediately
Some portals require immediate payment after booking. This is expected.

**The app:**
1. ✅ Books the room
2. ✅ Gets confirmation 
3. ❌ Does NOT pay (you do this manually)

---

## Cloud Deployment Issues

### Supabase errors
If you're trying to use the cloud worker (Render/GitHub Actions), you need:
1. Supabase project created
2. Migrations applied from `supabase/migrations/`
3. Environment variables set (see `.env.example`)

**For local testing, ignore cloud features.** Just use the local runner commands.

---

## Getting Help

### What to include when asking for help:

1. **What command you ran:**
   ```
   npm run portal:fees
   ```

2. **What happened (copy the output):**
   ```
   Include the actual error message or JSON result
   ```

3. **What you expected:**
   ```
   Expected it to reach the payment gateway
   ```

4. **Your environment:**
   - Node version: `node --version`
   - Operating system: Windows/Mac/Linux
   - Network: Campus/Home/Mobile data

### Safe files to share:
- `.portal/captures/discovery-*.json` ✅ (emails/IDs redacted)
- `.portal/results/result-*.json` ✅ (no passwords)
- Terminal output ✅ (credentials are never printed)

### NEVER share:
- `.env.local` ❌ (contains your password)
- Browser profile folder ❌ (contains session cookies)
- Actual portal username/password ❌

---

## Still Not Working?

1. **Try the absolute basics:**
   ```powershell
   npm test
   ```
   If this fails, something is wrong with installation.

2. **Try the safest real test:**
   ```powershell
   npm run portal:login
   ```
   If this fails, portal connection is the issue.

3. **Check the detailed logs:**
   - Results saved in `.portal/results/`
   - Captures saved in `.portal/captures/`
   - Each file has full details of what happened

4. **Test manually:**
   - Can you log in to portal manually?
   - Can you see the accommodation page manually?
   - Is booking actually open?
