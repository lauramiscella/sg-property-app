// Access control: trial vs full.
//
// If the ACCESS_CODE env var is set, visitors without the unlock cookie get a
// TRIAL view — every API route serves only the last TRIAL_MONTHS of data,
// enforced server-side (nothing to bypass in the browser). Entering the code
// once sets an httpOnly cookie that unlocks the full dataset.
//
// If ACCESS_CODE is NOT set, the app is fully open for everyone — so a fresh
// deployment never locks the owner out.
import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { Dataset } from "./types";
import { getDataset } from "./store";

export const TRIAL_MONTHS = 12;
export const ACCESS_COOKIE = "sga_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function configuredCode(): string | null {
  const c = process.env.ACCESS_CODE?.trim();
  return c ? c : null;
}

// The cookie stores an HMAC of the code, not the code itself.
export function tokenFor(code: string): string {
  return createHmac("sha256", "sg-property-app-access-v1")
    .update(code.trim().toLowerCase())
    .digest("hex");
}

export function checkCode(input: string): "ok" | "wrong" | "open" {
  const code = configuredCode();
  if (!code) return "open"; // no code configured — nothing to unlock
  return input.trim().toLowerCase() === code.toLowerCase() ? "ok" : "wrong";
}

export function cookieSettings() {
  return {
    name: ACCESS_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function hasFullAccess(): Promise<boolean> {
  const code = configuredCode();
  if (!code) return true;
  const jar = await cookies();
  const tok = jar.get(ACCESS_COOKIE)?.value;
  return !!tok && tok === tokenFor(code);
}

function shiftMonth(m: string, back: number): string {
  const [y, mo] = m.split("-").map(Number);
  const idx = y * 12 + (mo - 1) - back;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export interface AccessDataset extends Dataset {
  full: boolean;
  trialFrom?: string; // first month included in the trial slice
}

// The one entry point data routes should use instead of getDataset():
// full access → the whole archive; trial → last TRIAL_MONTHS only.
export async function getAccessDataset(): Promise<AccessDataset> {
  const ds = await getDataset();
  const full = await hasFullAccess();
  if (full || !ds.transactionMonths) return { ...ds, full };

  const from = shiftMonth(ds.transactionMonths.max, TRIAL_MONTHS - 1);
  const txns = ds.txns.filter((t) => t.month >= from);
  const quarters = ds.rentalQuarters.slice(-4); // last 4 quarters ≈ 12 months
  const qset = new Set(quarters);
  const rentals = ds.rentals.filter((r) => qset.has(r.quarter));
  const months = txns.map((t) => t.month).sort();
  return {
    ...ds,
    txns,
    rentals,
    rentalQuarters: quarters,
    transactionMonths: months.length
      ? { min: months[0], max: months[months.length - 1] }
      : null,
    full,
    trialFrom: from,
  };
}
