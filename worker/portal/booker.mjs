import { bodyText, findEntry, goto, openSection, sleep, showLoginForm } from "./session.mjs";
import { describePage, planSelectRoute, redact, scanRows, toCandidates } from "./inventory.mjs";
import {
  chooseCandidate,
  classifyBookingResult,
  classifyPage,
  detectChallenge,
  extractAmount,
  isFeeAction,
  isPaymentGateway,
  normalize,
} from "./matching.mjs";
import { DeadlineExceededError } from "./retry.mjs";
import { describePreference } from "../../lib/hostels.mjs";

const MODAL_SELECTOR = '[role="dialog"], .modal, .swal2-popup, [class*="modal" i]';
const CONFIRM_LABEL = /^(yes|confirm|ok|okay|proceed|continue|book|submit|allocate|reserve)$/i;

async function settle(page, ms = 400) {
  await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {});
  await sleep(ms);
}

/** Click with native-dialog handling; returns the dialog message if one appeared. */
async function clickWithDialog(page, target) {
  let message = "";
  let challenged = false;
  const handler = async (dialog) => {
    message = dialog.message();
    if (detectChallenge(message)) {
      challenged = true;
      await dialog.dismiss().catch(() => {});
    } else {
      await dialog.accept().catch(() => {});
    }
  };
  const locator = typeof target === "string" ? page.locator(target).first() : target;
  page.on("dialog", handler);
  try {
    await locator.click({ timeout: 10_000 });
  } finally {
    page.off("dialog", handler);
  }
  return { message, challenged };
}

async function answerConfirmModal(page, { deadline, windowMs = 1_200 } = {}) {
  const started = Date.now();
  while (Date.now() - started < windowMs && Date.now() < deadline) {
    await sleep(250);
    const modals = page.locator(MODAL_SELECTOR);
    const count = Math.min(await modals.count().catch(() => 0), 10);
    for (let index = 0; index < count; index += 1) {
      const modal = modals.nth(index);
      if (!(await modal.isVisible().catch(() => false))) continue;
      const modalText = normalize(await modal.innerText().catch(() => ""));
      if (/captcha|otp|verification|security/i.test(modalText)) {
        return { outcome: "security_challenge", text: modalText };
      }
      // A payment confirmation is never auto-accepted here.
      if (/pay\s*[\u20a6n]?\s*[\d,]+|card|cvv|pin\b/i.test(modalText)) {
        return { outcome: "requires_user_confirmation", text: modalText };
      }
      const buttons = modal.locator("button, a, [role=button], input[type=submit]");
      const buttonCount = Math.min(await buttons.count().catch(() => 0), 12);
      for (let button = 0; button < buttonCount; button += 1) {
        const candidate = buttons.nth(button);
        if (!(await candidate.isVisible().catch(() => false))) continue;
        const label = normalize(await candidate.innerText().catch(() => "") || await candidate.getAttribute("value").catch(() => ""));
        if (CONFIRM_LABEL.test(label)) {
          await candidate.click({ timeout: 8_000 }).catch(() => {});
          return { outcome: "answered", label, text: modalText };
        }
      }
      return { outcome: "unanswered_modal", text: modalText };
    }
  }
  return null;
}

async function pollResult(page, { deadline, timeoutMs = 45_000 } = {}) {
  const started = Date.now();
  let lastText = "";
  while (Date.now() - started < timeoutMs && Date.now() < deadline) {
    await sleep(600);
    if (await showLoginForm(page)) {
      return { outcome: "session_expired", reason: "portal_login_form_reappeared" };
    }
    lastText = await bodyText(page);
    if (detectChallenge(lastText)) {
      return { outcome: "security_challenge", reason: "portal_security_challenge" };
    }
    const classified = classifyBookingResult(lastText);
    if (classified.outcome !== "unconfirmed" || /confirmation|receipt|transaction/i.test(lastText)) {
      return { ...classified, url: page.url(), evidence: redact(lastText).slice(0, 900) };
    }
  }
  return { outcome: "unconfirmed", reason: "no_confirmation_seen", url: page.url(), evidence: redact(lastText).slice(0, 900) };
}

function scanSummary(scan, candidates) {
  return {
    rows: scan.rows.length,
    selectCount: scan.selects.length,
    iframeCount: scan.iframeCount,
    candidateCount: candidates.length,
    rowsWithPreference: candidates.map((candidate) => ({
      preference: candidate.roomPreference,
      available: candidate.available,
      action: candidate.action.text,
      text: redact(candidate.rowText).slice(0, 220),
    })),
  };
}

async function submitSelectRoute(page, plan, { deadline, dryRun }) {
  if (dryRun) {
    return { outcome: "would_book", preference: plan.preference, submitted: false, evidence: `Dropdown option: ${plan.optionText}` };
  }
  const selectLocator = plan.name
    ? page.locator(`select[name="${plan.name.replace(/"/g, '\\"')}"]`).first()
    : plan.id
      ? page.locator(`select#${plan.id.replace(/([^\w-])/g, "\\$1")}`).first()
      : page.locator("select").nth(plan.selectIndex);
  await selectLocator.selectOption({ value: plan.optionValue }).catch(async () => {
    await selectLocator.selectOption({ label: plan.optionText });
  });

  const form = selectLocator.locator("xpath=ancestor::form[1]");
  let submit = form.locator('button, input[type="submit"], input[type="button"]').filter({ hasText: /book|reserve|allocate|proceed|submit|apply|continue|next/i }).first();
  if (!(await submit.count().catch(() => 0))) {
    submit = page.locator('button, input[type="submit"], input[type="button"], a[href]').filter({ hasText: /book|reserve|allocate|proceed|submit|apply|continue/i }).first();
  }
  if (!(await submit.count().catch(() => 0))) {
    return { outcome: "needs_attention", reason: "dropdown_submit_not_found", submitted: false, preference: plan.preference };
  }
  try {
    const dialog = await clickWithDialog(page, submit);
    if (dialog.challenged) return { outcome: "security_challenge", reason: "native_dialog_security", submitted: false };
    await settle(page);
    const modal = await answerConfirmModal(page, { deadline });
    if (modal && modal.outcome !== "answered") {
      return { outcome: "needs_attention", reason: modal.outcome, submitted: true, evidence: modal.text };
    }
    return { submitted: true, preference: plan.preference, ...(await pollResult(page, { deadline })) };
  } catch (error) {
    // The submit may have reached the portal before the connection failed.
    // Never retry: report it as an unconfirmed submission for manual checking.
    return { outcome: "unconfirmed", reason: "submit_outcome_unknown", submitted: true, preference: plan.preference, error: redact(error.message) };
  }
}

/** Find and (optionally) submit one matching room. Never resubmits. */
export async function bookRoom({ page, hostel, hostelAliases = [], preferences = [], gender = null, deadline = Number.POSITIVE_INFINITY, dryRun = false, onBeforeSubmit }) {
  if (Date.now() >= deadline) throw new DeadlineExceededError();
  if (!hostel) return { outcome: "needs_attention", reason: "hostel_not_chosen", submitted: false };
  const scan = await scanRows(page);
  const candidates = toCandidates(scan, { hostel, hostelAliases, preferences, gender });
  const choice = chooseCandidate(candidates, preferences);

  if (!choice) {
    const plan = planSelectRoute(scan, { hostel, hostelAliases, preferences, gender });
    if (plan) return { ...(await submitSelectRoute(page, plan, { deadline, dryRun })), scan: scanSummary(scan, candidates) };
    const text = await bodyText(page);
    return {
      outcome: "not_available",
      reason: classifyPage(text, { hasBookableAction: candidates.some((candidate) => candidate.available) }),
      submitted: false,
      scan: scanSummary(scan, candidates),
      url: page.url(),
    };
  }

  if (dryRun) {
    return {
      outcome: "would_book",
      preference: choice.preference,
      preferenceLabel: describePreference(choice.preference),
      submitted: false,
      evidence: `Would click "${choice.candidate.action.text}" in row: ${redact(choice.candidate.rowText).slice(0, 300)}`,
      scan: scanSummary(scan, candidates),
    };
  }

  await onBeforeSubmit?.({
    preference: choice.preference,
    row: redact(choice.candidate.rowText).slice(0, 300),
    action: choice.candidate.action.text,
  });

  const action = choice.candidate.action;
  const isChoiceControl = action.kind === "radio" || action.kind === "checkbox";
  if (isChoiceControl) {
    await page.locator(`[data-booker-scan="${action.id}"]`).first().check({ timeout: 8_000 }).catch(async () => {
      await page.locator(`[data-booker-scan="${action.id}"]`).first().click({ timeout: 8_000 });
    });
    const submit = page.locator('button, input[type="submit"], input[type="button"], a[href]')
      .filter({ hasText: /book|reserve|allocate|proceed|submit|apply|continue|next/i }).first();
    if (!(await submit.count().catch(() => 0))) {
      return { outcome: "needs_attention", reason: "room_selected_but_no_submit_control", submitted: false, preference: choice.preference };
    }
    try {
      const dialog = await clickWithDialog(page, submit);
      if (dialog.challenged) return { outcome: "security_challenge", reason: "native_dialog_security", submitted: false, preference: choice.preference };
      await settle(page);
      const modal = await answerConfirmModal(page, { deadline });
      if (modal?.outcome === "requires_user_confirmation") {
        return { outcome: "requires_user_confirmation", reason: "payment_prompt_on_booking_page", submitted: true, preference: choice.preference, evidence: modal.text };
      }
      return { submitted: true, preference: choice.preference, ...(await pollResult(page, { deadline })) };
    } catch (error) {
      return { outcome: "unconfirmed", reason: "submit_outcome_unknown", submitted: true, preference: choice.preference, error: redact(error.message) };
    }
  }

  try {
    const dialog = await clickWithDialog(page, `[data-booker-scan="${action.id}"]`);
    if (dialog.challenged) {
      return { outcome: "security_challenge", reason: "native_dialog_security", submitted: false, preference: choice.preference };
    }
    await settle(page);
    const modal = await answerConfirmModal(page, { deadline });
    if (modal?.outcome === "security_challenge") {
      return { outcome: "security_challenge", reason: "portal_security_challenge", submitted: false, preference: choice.preference };
    }
    if (modal?.outcome === "requires_user_confirmation") {
      return { outcome: "requires_user_confirmation", reason: "payment_prompt_on_booking_page", submitted: true, preference: choice.preference, evidence: modal.text };
    }

    const result = await pollResult(page, { deadline });
    return {
      ...result,
      submitted: true,
      preference: choice.preference,
      clicked: choice.candidate.action.text,
      row: redact(choice.candidate.rowText).slice(0, 300),
      ...(dialog.message ? { nativeDialog: dialog.message } : {}),
    };
  } catch (error) {
    // A click that timed out may still have submitted. Treat it as unconfirmed
    // and never retry the submission automatically.
    return {
      outcome: "unconfirmed",
      reason: "submit_outcome_unknown",
      submitted: true,
      preference: choice.preference,
      clicked: choice.candidate.action.text,
      row: redact(choice.candidate.rowText).slice(0, 300),
      error: redact(error.message),
    };
  }
}

/**
 * School-fees pipeline check. This intentionally stops at the cashier:
 * it never types card details, a PIN, or confirms a charge.
 */
export async function feesCheck({ page, portalOrigin, deadline = Number.POSITIVE_INFINITY, url }) {
  if (Date.now() >= deadline) throw new DeadlineExceededError();
  const here = await bodyText(page);
  const alreadyOnFees = /fee|payment/i.test(new URL(page.url()).pathname) && /outstanding|balance|amount\s*due|pay\s*now/i.test(here);
  const opened = alreadyOnFees
    ? { url: page.url(), page }
    : await openSection(page, {
      pattern: /school\s*fees?|fees?|payments?/i,
      url,
      label: "school fees",
      deadline,
    });
  const subject = opened.page ?? page;
  await settle(subject, 800);

  if (await showLoginForm(subject)) {
    return { status: "session_expired", reason: "portal_login_form_reappeared" };
  }
  const text = await bodyText(subject);
  if (detectChallenge(text)) return { status: "security_challenge", reason: "portal_security_challenge" };
  const amount = extractAmount(text);

  const scan = await scanRows(subject);
  const feeRows = scan.rows.filter((row) => /fee|outstanding|balance|amount|pay/i.test(row.text));
  let action = null;
  for (const row of feeRows) {
    const found = row.actions.find((value) => isFeeAction(value.text));
    if (found) {
      action = found;
      break;
    }
  }
  if (!action) {
    const pageAction = await findEntry(subject, /pay|proceed|make\s*payment|generate\s*(rrr|invoice)|continue/i);
    if (pageAction?.href && !/^javascript:/i.test(pageAction.href)) {
      await goto(subject, new URL(pageAction.href, subject.url()).toString(), { deadline });
      return finishFees(subject, { amount, portalOrigin, clicked: pageAction.text });
    }
    if (!pageAction) {
      return { status: "no_pay_action", amount, reason: "fees_page_has_no_payment_control", url: subject.url(), evidence: redact(text).slice(0, 700) };
    }
    await pageAction.element.click();
    return finishFees(subject, { amount, portalOrigin, clicked: pageAction.text });
  }

  await clickWithDialog(subject, `[data-booker-scan="${action.id}"]`);
  return finishFees(subject, { amount, portalOrigin, clicked: action.text });
}

async function finishFees(page, { amount, portalOrigin, clicked }) {
  await settle(page, 1_200);
  const text = await bodyText(page);
  if (detectChallenge(text)) return { status: "security_challenge", reason: "portal_security_challenge" };
  if (await showLoginForm(page)) return { status: "session_expired", reason: "portal_login_form_reappeared" };

  const cardField = page.locator('input[autocomplete="cc-number"], input[name*="card" i], input[placeholder*="card" i], input[name*="cvv" i], input[name*="pin" i]');
  if ((await cardField.count().catch(() => 0)) > 0) {
    return { status: "card_form_reached", amount, clicked, url: page.url(), reason: "Stopped before entering any payment details." };
  }
  if (isPaymentGateway({ url: page.url(), text, portalOrigin })) {
    return { status: "gateway_reached", amount, clicked, url: page.url(), reason: "The portal handed off to a payment page. No payment details were entered and nothing was charged." };
  }
  if (/outstanding|balance|amount\s*due|invoice|rrr/i.test(text)) {
    return { status: "fees_page_confirmed", amount, clicked, url: page.url(), reason: "The fees page and its payment control worked. No charge was made.", evidence: redact(text).slice(0, 700) };
  }
  return { status: "needs_attention", amount, clicked, url: page.url(), reason: "The fees flow did not reach a recognizable payment page.", evidence: redact(text).slice(0, 700) };
}

/** Read-only capture of the signed-in portal for mapping the real flow. */
export async function discoverPortal(page, { portalUrl, portalOrigin, deep = true } = {}) {
  const dashboard = await describePage(page);
  const pages = [{ name: "dashboard", ...dashboard }];
  if (deep) {
    for (const [name, pattern] of [["accommodation", /hostel|accommodation|residence|room\s*allocation/i], ["fees", /school\s*fees|fees|payments?/i]]) {
      const entry = await findEntry(page, pattern);
      if (!entry) {
        pages.push({ name, error: "link_not_found" });
        continue;
      }
      try {
        if (entry.href && !/^javascript:/i.test(entry.href)) {
          await goto(page, new URL(entry.href, page.url()).toString());
        } else {
          await entry.element.click();
          await settle(page, 800);
        }
        const description = await describePage(page);
        const scan = await scanRows(page);
        pages.push({ name, ...description, rows: scan.rows.slice(0, 120), selects: scan.selects, forms: scan.forms });
        await goto(page, portalUrl).catch(() => {});
      } catch (error) {
        pages.push({ name, error: redact(error.message) });
        await goto(page, portalUrl).catch(() => {});
      }
    }
  }
  return {
    capturedAt: new Date().toISOString(),
    portalUrl,
    portalOrigin,
    pages: pages.map((entry) => ({
      ...entry,
      ...(entry.text ? { text: redact(entry.text) } : {}),
    })),
  };
}
