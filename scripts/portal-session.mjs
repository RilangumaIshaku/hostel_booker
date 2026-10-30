import { createInterface } from "node:readline";
import { emitKeypressEvents } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const portalUrl = "https://eportal.futminna.edu.ng/ePortal_V2/std/index.php";
const profileRoot = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "FUTMINNA Hostel Booker", "browser-profile")
  : join(homedir(), ".local", "share", "futminna-hostel-booker", "browser-profile");

function ask(question) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(question, (answer) => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Run this command in a local terminal so the password can be entered without echoing it.");
  }

  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write(question);

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (result, error) => {
      input.off("keypress", onKeypress);
      input.setRawMode(false);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") return finish("", new Error("Sign-in cancelled."));
      if (key.name === "return" || key.name === "enter") return finish(value);
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        process.stdout.write("\b \b");
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
        process.stdout.write("•");
      }
    };
    input.on("keypress", onKeypress);
  });
}

async function main() {
  const context = await chromium.launchPersistentContext(profileRoot, {
    headless: false,
    viewport: null,
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(portalUrl, { waitUntil: "domcontentloaded" });

    const dashboardHeading = page.getByRole("heading", { name: "Welcome," });
    if (await dashboardHeading.count() === 0) {
      const usernameField = page.getByPlaceholder("Enter User ID/Username", { exact: true }).filter({ visible: true });
      const passwordField = page.getByPlaceholder("Enter Password", { exact: true }).filter({ visible: true });
      if (await usernameField.count() !== 1 || await passwordField.count() !== 1) {
        const inputs = await page.locator("input").evaluateAll((nodes) => nodes.map((node) => ({
          type: node.type,
          placeholder: node.getAttribute("placeholder"),
          name: node.getAttribute("name"),
          ariaLabel: node.getAttribute("aria-label"),
        })));
        process.stderr.write(`Portal page: ${page.url()} (${await page.title()})\n`);
        process.stderr.write(`Visible input metadata: ${JSON.stringify(inputs)}\n`);
        throw new Error("The expected student sign-in fields were not found. The portal page may have changed; no credentials were entered.");
      }

      const username = await ask("FUTMINNA username: ");
      let password = await askHidden("FUTMINNA password (hidden): ");
      await usernameField.fill(username);
      await passwordField.fill(password);
      password = "";
      await page.getByRole("button", { name: "Login", exact: true }).click();
      await dashboardHeading.waitFor({ state: "visible", timeout: 60_000 });
      await passwordField.fill("").catch(() => {});
    }

    process.stdout.write("Signed-in portal session is ready in the local browser profile. Password was not saved by this script. No booking was submitted.\n");
    process.stdout.write("Keep the browser profile on this PC. Run this command again before the booking window to reopen the session.\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.stderr.write("The browser is being kept open so you can inspect the portal or complete any manual sign-in step.\n");
    await ask("Press Enter in this terminal when you are done with the browser...");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
