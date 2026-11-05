"use client";

import { useSyncExternalStore } from "react";
import { findHostel } from "@/lib/hostels.mjs";

export type HostelGender = "male" | "female";
export type HostelChoice = { gender: HostelGender; hostelId: string };

export const CHOICE_STORAGE_KEY = "futminna.hostelChoice";
export const CHOICE_EVENT = "futminna:hostel-choice";

function parseChoice(raw: string | null): HostelChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { gender?: unknown; hostelId?: unknown };
    const gender = parsed.gender === "male" || parsed.gender === "female" ? parsed.gender : null;
    const hostelId = typeof parsed.hostelId === "string" ? parsed.hostelId : null;
    if (!gender || !hostelId) return null;
    const hostel = findHostel(hostelId);
    // A stale choice, or one left over from the other gender's list, is ignored.
    if (!hostel || hostel.gender !== gender) return null;
    return { gender, hostelId };
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedChoice: HostelChoice | null = null;

/**
 * Cached snapshot of the device copy, so useSyncExternalStore stays stable.
 * The cached raw string is compared first; the catalogue is re-checked only
 * when the stored value actually changes.
 */
export function snapshotChoice(): HostelChoice | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CHOICE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedChoice = parseChoice(raw);
  }
  return cachedChoice;
}

function subscribeChoice(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHOICE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHOICE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function readLocalChoice(): HostelChoice | null {
  return snapshotChoice();
}

export function writeLocalChoice(choice: HostelChoice | null) {
  if (typeof window === "undefined") return;
  try {
    if (choice) window.localStorage.setItem(CHOICE_STORAGE_KEY, JSON.stringify(choice));
    else window.localStorage.removeItem(CHOICE_STORAGE_KEY);
  } catch {
    // A blocked storage area only costs the device copy; the account copy stays.
  }
  window.dispatchEvent(new Event(CHOICE_EVENT));
}

/** The chosen hostel, kept in sync across the picker and the schedule panel. */
export function useHostelChoice(): HostelChoice | null {
  return useSyncExternalStore(subscribeChoice, snapshotChoice, () => null);
}
