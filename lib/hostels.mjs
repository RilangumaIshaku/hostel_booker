/**
 * The FUTMINNA hostel catalogue for the 2026/2027 session.
 *
 * Prices are the ones published by the Students' Union Government (SUG) in
 * November 2026. They are informational: the portal always decides what is
 * actually available and what it charges.
 *
 * Every hostel belongs to exactly one gender. The catalogue, the API and the
 * booking engine all refuse to cross genders, so a boys' hostel can never be
 * booked for a girls' booking or the other way round.
 *
 * This module is pure data plus pure helpers. It has no browser, Node or React
 * imports, so the dashboard, the API routes, the local runner and the cloud
 * worker all share the same list.
 */

/** @typedef {"male" | "female"} Gender */

/** A room type that is not narrowed down: any bed space in the chosen hostel. */
export const ANY_ROOM = "*";

export const GENDERS = /** @type {const} */ (["male", "female"]);

const GENDER_LABELS = { male: "Boys' hostel", female: "Girls' hostel" };

/**
 * @typedef {object} Hostel
 * @property {string} id          Stable id used by the app, the API and jobs.
 * @property {string} name        Name shown in the app.
 * @property {string} portalName  Text expected on the official portal page.
 * @property {Gender} gender
 * @property {number} price       Published price in naira.
 * @property {string[]} rooms     Ordered room preferences; empty means any bed space.
 * @property {string} [detail]    Extra wording shown in the app.
 * @property {string[]} [aliases] Other spellings the portal may use for the same hostel.
 */

/** @type {Hostel[]} */
const CATALOGUE = [
  // ------------------------------------------------------------------ BOYS
  {
    id: "boys-block-a-b",
    name: "Block A & B",
    portalName: "Block A & B",
    gender: "male",
    price: 60_000,
    rooms: [],
    aliases: ["block a and b", "block a&b", "block a", "block b"],
  },
  {
    id: "boys-bosso",
    name: "Bosso Boys Hostel",
    portalName: "Bosso Boys Hostel",
    gender: "male",
    price: 50_000,
    rooms: [],
    aliases: ["bosso boys"],
  },
  {
    id: "boys-tetfund",
    name: "TETFund Hostel",
    portalName: "TETFund",
    gender: "male",
    price: 110_000,
    rooms: [],
    aliases: ["tet fund"],
  },
  {
    id: "boys-medical",
    name: "Medical Hostel",
    portalName: "Medical Hostel",
    gender: "male",
    price: 130_000,
    rooms: [],
  },
  {
    id: "boys-needs-assessment-4",
    name: "Needs Assessment Hostel",
    portalName: "Needs Assessment Hostel",
    gender: "male",
    price: 150_000,
    rooms: ["Room of 4"],
    detail: "4-man room",
  },
  {
    id: "boys-needs-assessment-2",
    name: "Needs Assessment Hostel",
    portalName: "Needs Assessment Hostel",
    gender: "male",
    price: 180_000,
    rooms: ["Room of 2"],
    detail: "2-man room",
  },

  // ----------------------------------------------------------------- GIRLS
  {
    id: "girls-old-girls",
    name: "Old Girls Hostel",
    portalName: "Old Girls Hostel",
    gender: "female",
    price: 50_000,
    rooms: [],
    aliases: ["old girls"],
  },
  {
    id: "girls-bosso",
    name: "Bosso Girls Hostel",
    portalName: "Bosso Girls Hostel",
    gender: "female",
    price: 50_000,
    rooms: [],
    aliases: ["bosso girls"],
  },
  {
    id: "girls-shehu-aliyu",
    name: "Shehu Aliyu Hostel",
    portalName: "Shehu Aliyu",
    gender: "female",
    price: 60_000,
    rooms: [],
    aliases: ["shehu"],
  },
  {
    id: "girls-mallam-ibrahim",
    name: "Mallam Ibrahim Hostel",
    portalName: "Mallam Ibrahim",
    gender: "female",
    price: 110_000,
    rooms: [],
    aliases: ["mallam"],
  },
  {
    id: "girls-medical",
    name: "Medical Hostel",
    portalName: "Medical Hostel",
    gender: "female",
    price: 130_000,
    rooms: [],
  },
  {
    id: "girls-needs-assessment-4",
    name: "Needs Assessment Hostel",
    portalName: "Needs Assessment Hostel",
    gender: "female",
    price: 150_000,
    rooms: ["Room of 4"],
    detail: "4-man room",
  },
  {
    id: "girls-needs-assessment-2",
    name: "Needs Assessment Hostel",
    portalName: "Needs Assessment Hostel",
    gender: "female",
    price: 180_000,
    rooms: ["Room of 2"],
    detail: "2-man room",
  },
];

export const HOSTELS = Object.freeze(CATALOGUE.map((hostel) => Object.freeze({ ...hostel, rooms: Object.freeze([...hostel.rooms]) })));

/** @param {unknown} gender */
export function isGender(gender) {
  return gender === "male" || gender === "female";
}

/** @param {unknown} gender */
export function oppositeGender(gender) {
  if (gender === "male") return "female";
  if (gender === "female") return "male";
  return null;
}

/** @param {Gender} gender */
export function genderLabel(gender) {
  return GENDER_LABELS[gender] ?? "Hostel";
}

/**
 * Every hostel a student of this gender may choose, cheapest first so the app
 * shows the same order every time.
 * @param {Gender} gender
 * @returns {Hostel[]}
 */
export function hostelsFor(gender) {
  return HOSTELS.filter((hostel) => hostel.gender === gender);
}

/** @param {string} id */
export function findHostel(id) {
  return HOSTELS.find((hostel) => hostel.id === id) ?? null;
}

/**
 * Portal names that belong only to the other gender. The engine uses this to
 * refuse rows that name the wrong hostel, even when the page is a mixed list.
 * Names that exist for both genders (Medical, Needs Assessment) are excluded,
 * so they never block a legitimate booking.
 * @param {Gender} gender
 */
export function exclusiveHostelNames(gender) {
  const other = oppositeGender(gender);
  if (!other) return [];
  const mine = new Set(hostelsFor(gender).map((hostel) => normalizeName(hostel.portalName)));
  return [...new Set(hostelsFor(other).map((hostel) => hostel.portalName))]
    .filter((name) => !mine.has(normalizeName(name)));
}

function normalizeName(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** @param {number} amount */
export function formatNaira(amount) {
  return `\u20a6${Number(amount).toLocaleString("en-NG")}`;
}

/**
 * Strict check for "does this row name the chosen hostel": the row must contain
 * the portal name or one of its aliases, so a loose word match can never point
 * the booker at a different hostel.
 * @param {string} text
 * @param {string} portalName
 * @param {string[]} [aliases]
 */
export function textNamesHostel(text, portalName, aliases = []) {
  const value = normalizeName(text);
  return [portalName, ...aliases]
    .map(normalizeName)
    .filter(Boolean)
    .some((name) => value.includes(name));
}

/** @param {string} preference */
export function describePreference(preference) {
  return !preference || preference === ANY_ROOM ? "any room type" : preference;
}

/**
 * Resolve a saved choice into everything the booker needs, or throw a labelled
 * error. This is the single gate that keeps boys' and girls' hostels apart.
 *
 * @param {{ gender?: string | null, hostelId?: string | null }} choice
 * @returns {{ gender: Gender, hostelId: string, name: string, portalName: string,
 *   rooms: string[], roomNote: string, price: number }}
 */
export function resolveBookingTarget({ gender, hostelId } = {}) {
  if (!isGender(gender)) throw bookingTargetError("gender_required", "Choose whether you are booking a boys' or a girls' hostel.");
  if (!hostelId) throw bookingTargetError("hostel_required", "Choose the hostel you want to book.");
  const hostel = findHostel(hostelId);
  if (!hostel) throw bookingTargetError("hostel_unknown", `Unknown hostel "${hostelId}".`);
  if (hostel.gender !== gender) {
    throw bookingTargetError(
      "hostel_gender_mismatch",
      `${hostel.name} is ${hostel.gender === "male" ? "a boys'" : "a girls'"} hostel and cannot be booked for a ${gender === "male" ? "boys'" : "girls'"} booking.`,
    );
  }
  return {
    gender: hostel.gender,
    hostelId: hostel.id,
    name: hostel.detail ? `${hostel.name} \u00b7 ${hostel.detail}` : hostel.name,
    portalName: hostel.portalName,
    aliases: [...(hostel.aliases ?? [])],
    rooms: [...hostel.rooms],
    roomNote: hostel.detail ?? "any bed space",
    price: hostel.price,
  };
}

/**
 * Look a hostel up the way a person would type it: by id first, then by the
 * name shown in the app, then by the portal spelling.
 * @param {string} value
 * @param {Gender} [gender] narrows an ambiguous name such as "Medical Hostel"
 * @returns {Hostel | null}
 */
export function findHostelByAnyName(value, gender) {
  const wanted = String(value ?? "").trim();
  if (!wanted) return null;
  const byId = findHostel(wanted);
  if (byId) return byId;
  const needle = normalizeName(wanted);
  const matches = HOSTELS.filter((hostel) => {
    if (gender && hostel.gender !== gender) return false;
    return [hostel.name, hostel.portalName, hostel.detail ? `${hostel.name} ${hostel.detail}` : ""]
      .some((name) => normalizeName(name) === needle);
  });
  if (matches.length === 1) return matches[0];
  return null;
}

/** @param {string} code @param {string} message */
function bookingTargetError(code, message) {
  const error = new Error(message);
  // @ts-expect-error custom error code used by the API and the worker
  error.code = code;
  return error;
}
