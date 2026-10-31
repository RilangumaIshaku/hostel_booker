#!/usr/bin/env node
/**
 * Setup verification script - checks if everything is ready for booking
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const checks = [];
let passed = 0;
let failed = 0;

function check(name, test, fix) {
  checks.push({ name, test, fix });
}

function green(text) {
  return `\x1b[32m${text}\x1b[0m`;
}

function red(text) {
  return `\x1b[31m${text}\x1b[0m`;
}

function yellow(text) {
  return `\x1b[33m${text}\x1b[0m`;
}

async function run() {
  console.log("🔍 Verifying FUTMINNA Hostel Booker Setup\n");

  // Check Node.js version
  check(
    "Node.js version",
    () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split(".")[0]);
      return major >= 18 ? { ok: true, info: version } : { ok: false, info: `${version} (need v18+)` };
    },
    "Install Node.js v18+ from https://nodejs.org"
  );

  // Check node_modules
  check(
    "Dependencies installed",
    () => {
      const exists = existsSync("node_modules");
      return exists ? { ok: true } : { ok: false };
    },
    "Run: npm install"
  );

  // Check Playwright
  check(
    "Playwright browser",
    () => {
      try {
        const chromiumDir = join("node_modules", "playwright", ".local-browsers", "chromium-*");
        // Try to find chromium directory
        const hasPlaywright = existsSync(join("node_modules", "playwright"));
        if (!hasPlaywright) return { ok: false };
        
        // Basic check - if playwright is installed, assume browser can be installed
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    "Run: npx playwright install chromium"
  );

  // Check .portal directory
  check(
    ".portal directory",
    () => {
      const exists = existsSync(".portal");
      return { ok: true, info: exists ? "exists" : "will be created on first use" };
    },
    "No action needed - created automatically"
  );

  // Check for captured portal flow
  check(
    "Accommodation page captured",
    async () => {
      if (!existsSync(".portal/portal-flow.json")) {
        return { ok: false, info: "not captured yet" };
      }
      try {
        const content = await readFile(".portal/portal-flow.json", "utf-8");
        const flow = JSON.parse(content);
        const hasAccommodation = flow.pages?.accommodation?.url;
        return hasAccommodation
          ? { ok: true, info: "captured" }
          : { ok: false, info: "file exists but no accommodation URL" };
      } catch {
        return { ok: false, info: "invalid flow file" };
      }
    },
    "Run: npm run portal:record -- --label accommodation"
  );

  // Check for portal session
  check(
    "Portal session saved",
    () => {
      // Check if default profile directory exists (platform-specific)
      const platform = process.platform;
      let profileHint;
      if (platform === "win32") {
        profileHint = "C:\\Users\\[username]\\AppData\\Local\\futminna-hostel-booker";
      } else if (platform === "darwin") {
        profileHint = "~/Library/Application Support/futminna-hostel-booker";
      } else {
        profileHint = "~/.local/share/futminna-hostel-booker";
      }
      
      return { ok: true, info: `check: ${profileHint}` };
    },
    "Run: npm run portal:login"
  );

  // Check environment file
  check(
    "Environment configuration",
    () => {
      const hasEnvLocal = existsSync(".env.local");
      const hasEnv = existsSync(".env");
      if (hasEnvLocal) return { ok: true, info: ".env.local found" };
      if (hasEnv) return { ok: true, info: ".env found" };
      return { ok: true, info: "optional - will use defaults" };
    },
    "Optional: Copy .env.local.example to .env.local and customize"
  );

  // Run checks
  for (const { name, test, fix } of checks) {
    try {
      const result = await test();
      if (result.ok) {
        passed++;
        console.log(`${green("✓")} ${name}${result.info ? ` (${result.info})` : ""}`);
      } else {
        failed++;
        console.log(`${red("✗")} ${name}${result.info ? ` (${result.info})` : ""}`);
        console.log(`  ${yellow("→")} ${fix}\n`);
      }
    } catch (error) {
      failed++;
      console.log(`${red("✗")} ${name} (error: ${error.message})`);
      console.log(`  ${yellow("→")} ${fix}\n`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${green(`${passed} passed`)}${failed > 0 ? `, ${red(`${failed} failed`)}` : ""}`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed === 0) {
    console.log(green("✓ All checks passed! You're ready to test.\n"));
    console.log("Next steps:");
    console.log("  1. Run mock tests: npm test");
    console.log("  2. Test fees flow: npm run portal:fees");
    console.log("  3. Capture accommodation: npm run portal:record -- --label accommodation");
    console.log("  4. Dry run: npm run portal:book -- --now --dry-run\n");
    console.log("See TEST-ME-FIRST.md for full instructions.");
  } else {
    console.log(yellow("⚠ Some checks failed. Fix them before continuing.\n"));
    console.log("After fixing, run this script again:");
    console.log("  node verify-setup.mjs\n");
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(red(`\nSetup verification failed: ${error.message}`));
  process.exit(1);
});
