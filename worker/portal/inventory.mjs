import { isActionLabel, matchesHostel, matchesRoom, normalize } from "./matching.mjs";

const ACTION_SELECTOR = 'button, a[href], input[type="button"], input[type="submit"], input[type="radio"], input[type="checkbox"], [role="button"]';
const ROW_SELECTOR = 'tr, li, article, form, [role="row"], [class*="room" i], [class*="hostel" i], [class*="accommodation" i], [class*="card" i]';

/**
 * Capture room rows and the actions inside them. Nothing is clicked here.
 * Each action gets a temporary data attribute so the caller clicks exactly
 * the control it evaluated, even if the page re-renders.
 */
export async function scanRows(page) {
  return page.evaluate(
    ({ actionSelector, rowSelector }) => {
      const clean = (value) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      const visible = (element) => {
        if (!element || !(element instanceof Element)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
      };

      document.querySelectorAll("[data-booker-scan]").forEach((element) => element.removeAttribute("data-booker-scan"));

      // A <form> nested inside a table row is not its own row: its controls
      // belong to the row that carries the room/hostel text.
      const rowElements = Array.from(document.querySelectorAll(rowSelector))
        .filter(visible)
        .filter((element) => !(element.tagName === "FORM" && element.closest('tr, li, article, [role="row"]')));
      const rowSet = new Set(rowElements);
      const nearestRow = (node, boundary) => {
        let parent = node.parentElement;
        while (parent && parent !== boundary) {
          if (rowSet.has(parent)) return parent;
          parent = parent.parentElement;
        }
        return boundary;
      };

      const rows = [];
      const seen = new Set();
      for (const row of rowElements) {
        if (seen.has(row)) continue;
        seen.add(row);
        const text = clean(row.innerText);
        if (text.length < 2 || text.length > 800) continue;

        const actions = Array.from(row.querySelectorAll(actionSelector))
          .filter((element) => visible(element) && nearestRow(element, row) === row)
          .slice(0, 8)
          .map((element, index) => {
            const id = `r${rows.length}a${index}`;
            element.setAttribute("data-booker-scan", id);
            const kind = element.tagName.toLowerCase() === "input" ? (element.getAttribute("type") ?? "input").toLowerCase() : "click";
            let label = clean(element.innerText) || clean(element.getAttribute("value")) || clean(element.getAttribute("aria-label"));
            if (!label && (kind === "radio" || kind === "checkbox")) {
              label = clean(element.closest("label")?.innerText) || clean(element.parentElement?.innerText);
            }
            return {
              id,
              kind,
              text: label.slice(0, 80),
              href: element.getAttribute("href"),
              name: element.getAttribute("name"),
            };
          });

        if (!actions.length) continue;
        rows.push({ text: text.slice(0, 800), tag: row.tagName.toLowerCase(), actions });
        if (rows.length >= 250) break;
      }

      const forms = Array.from(document.querySelectorAll("form")).filter(visible).slice(0, 30).map((form) => ({
        action: form.getAttribute("action"),
        method: (form.getAttribute("method") ?? "get").toUpperCase(),
        fields: Array.from(form.querySelectorAll("input, select, textarea")).slice(0, 40).map((field) => ({
          tag: field.tagName.toLowerCase(),
          type: field.getAttribute("type"),
          name: field.getAttribute("name"),
          id: field.getAttribute("id"),
          placeholder: field.getAttribute("placeholder"),
          label: clean(field.closest("label")?.innerText).slice(0, 60),
        })),
      }));

      const selects = Array.from(document.querySelectorAll("select")).filter(visible).slice(0, 20).map((select, index) => ({
        index,
        name: select.getAttribute("name"),
        id: select.getAttribute("id"),
        label: clean(select.closest("label")?.innerText) || clean(select.getAttribute("aria-label")),
        context: clean(select.closest("tr, li, form, section, div")?.innerText).slice(0, 160),
        selected: select.selectedIndex,
        options: Array.from(select.options).slice(0, 80).map((option) => ({
          text: clean(option.text).slice(0, 80),
          value: option.value,
          disabled: option.disabled,
        })),
      }));

      return { rows, forms, selects, iframeCount: document.querySelectorAll("iframe").length };
    },
    { actionSelector: ACTION_SELECTOR, rowSelector: ROW_SELECTOR },
  );
}

export function toCandidates(scan, { hostel, preferences }) {
  const candidates = [];
  for (const row of scan.rows) {
    const preference = preferences.find((value) => matchesRoom(row.text, value));
    if (!preference) continue;
    const action = row.actions.find((value) => isActionLabel(value.text)) ?? row.actions[0];
    if (!action) continue;
    const soldOut = /sold\s*out|no\s+(?:space|vacancy|vacancies)|fully\s+(?:booked|allocated)|rooms?\s+(?:are\s+)?full|unavailable/i.test(normalize(row.text));
    candidates.push({
      roomPreference: preference,
      action,
      rowText: row.text,
      available: !soldOut,
      hostelMatched: matchesHostel(row.text, hostel),
      ambiguousHostel: false,
    });
  }
  return candidates;
}

/**
 * Dropdown fallback: some portals make you choose a room type in a <select>
 * and then submit the form. Only options that explicitly match the saved
 * preference are ever selected.
 */
export function planSelectRoute(scan, { hostel, preferences }) {
  for (const select of scan.selects) {
    const context = normalize(`${select.label} ${select.context} ${select.name ?? ""} ${select.id ?? ""}`);
    if (!/room|hostel|accommodation|bed|hall|residence/.test(context)) continue;
    for (const preference of preferences) {
      const option = select.options.find((value) => !value.disabled && matchesRoom(value.text, preference));
      if (option) {
        return {
          selectIndex: select.index,
          name: select.name,
          id: select.id,
          optionText: option.text,
          optionValue: option.value,
          preference,
          hostelMatched: matchesHostel(context, hostel),
        };
      }
    }
  }
  return null;
}

export function redact(text) {
  return String(text ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\b\d{8,}\b/g, "[number]");
}

export async function describePage(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const links = Array.from(document.querySelectorAll("a[href]")).filter(visible).slice(0, 150).map((link) => ({
      text: clean(link.innerText).slice(0, 100),
      href: link.getAttribute("href"),
    }));
    const buttons = Array.from(document.querySelectorAll("button, [role=button], input[type=button], input[type=submit]"))
      .filter(visible).slice(0, 120)
      .map((button) => clean(button.innerText || button.getAttribute("value")).slice(0, 100));
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, legend")).filter(visible).slice(0, 40)
      .map((heading) => clean(heading.innerText).slice(0, 120));
    const inputs = Array.from(document.querySelectorAll("input, select, textarea")).filter(visible).slice(0, 120).map((field) => ({
      tag: field.tagName.toLowerCase(),
      type: field.getAttribute("type"),
      name: field.getAttribute("name"),
      id: field.getAttribute("id"),
      placeholder: field.getAttribute("placeholder"),
      label: clean(field.closest("label")?.innerText).slice(0, 80),
    }));
    return {
      url: location.href,
      title: document.title,
      headings,
      links,
      buttons,
      inputs,
      iframes: document.querySelectorAll("iframe").length,
      text: clean(document.body.innerText).slice(0, 6_000),
    };
  });
}
