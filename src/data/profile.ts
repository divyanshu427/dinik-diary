import { DEFAULT_DB_NAME } from "./local/db";

/*
 * Profiles: "me" is your own data; "demo" is made-up data for trying the app (Build Phase 9).
 * Each profile is its own browser database, so switching never mixes or deletes anything.
 */

export type Profile = "me" | "demo";

export const PROFILE_STORAGE_KEY = "dinik-diary:profile";
export const DEMO_DB_NAME = `${DEFAULT_DB_NAME}-demo`;

export function dbNameFor(profile: Profile): string {
  return profile === "demo" ? DEMO_DB_NAME : DEFAULT_DB_NAME;
}

/** The profile chosen on this device ("me" when nothing is stored or storage is blocked). */
export function readProfile(): Profile {
  try {
    return window.localStorage.getItem(PROFILE_STORAGE_KEY) === "demo" ? "demo" : "me";
  } catch {
    return "me";
  }
}

export function writeProfile(profile: Profile) {
  try {
    if (profile === "me") window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    else window.localStorage.setItem(PROFILE_STORAGE_KEY, profile);
  } catch {
    // Storage blocked: the switch can't be remembered, so the app stays on your own data.
  }
}
