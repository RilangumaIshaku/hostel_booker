import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SPEC_DIR = ".portal";
export const SPEC_FILE = join(SPEC_DIR, "portal-flow.json");

export function specPath() {
  return process.env.PORTAL_FLOW_SPEC_PATH || SPEC_FILE;
}

export function emptySpec() {
  return { version: 1, portalUrl: null, pages: {} };
}

/** Reads the local spec, or a JSON spec supplied entirely through env. */
export function readSpec() {
  const inline = process.env.PORTAL_FLOW_SPEC;
  if (inline && inline.trim().startsWith("{")) {
    try {
      return normalizeSpec(JSON.parse(inline));
    } catch {
      return emptySpec();
    }
  }
  const path = specPath();
  if (!existsSync(path)) return emptySpec();
  try {
    return normalizeSpec(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return emptySpec();
  }
}

function normalizeSpec(value) {
  return {
    version: 1,
    portalUrl: typeof value.portalUrl === "string" ? value.portalUrl : null,
    pages: value.pages && typeof value.pages === "object" ? value.pages : {},
  };
}

export function sectionUrl(spec, name) {
  const url = spec?.pages?.[name]?.url;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

export function mergeSpecPage(name, page, { portalUrl } = {}) {
  const path = specPath();
  const spec = readSpec();
  mkdirSync(dirname(path), { recursive: true });
  const next = {
    ...spec,
    version: 1,
    portalUrl: portalUrl ?? spec.portalUrl ?? page.url ?? null,
    pages: {
      ...spec.pages,
      [name]: {
        url: page.url,
        title: page.title ?? null,
        capturedAt: new Date().toISOString(),
      },
    },
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}
