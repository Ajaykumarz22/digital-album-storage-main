import type { Currency } from "@/lib/plans";

// ---- Regular (hot) storage pricing --------------------------------------
// Cost basis: iDrive e2 ≈ $6 / TB / month, plus a flat margin. EDIT freely.
const IDRIVE_USD_PER_TB_MONTH = 6; // your cost
const MARGIN_USD_PER_TB_MONTH = 1.5; // flat margin
const USD_TO_INR = 95;

// Customer-facing per-GB monthly rate (billed yearly = ×12).
// $7.50 / TB / month ⇒ ≈ $0.00732/GB/mo.
export const REGULAR_USD_PER_GB_MONTH =
  (IDRIVE_USD_PER_TB_MONTH + MARGIN_USD_PER_TB_MONTH) / 1024;

export const MIN_REGULAR_GB = 50;
const GiB = 1024 ** 3;

export function gbToBytes(gb: number): number {
  return Math.round(gb * GiB);
}

// Validate a requested GB amount (whole number, at least the minimum).
export function validRegularGb(input: unknown): number | null {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n) || n < MIN_REGULAR_GB) return null;
  return n;
}

export type RegularQuote = {
  gb: number;
  monthlyUsd: number;
  yearlyUsd: number;
  monthlyInr: number;
  yearlyInr: number;
};

export function quoteRegular(gb: number): RegularQuote {
  const monthlyUsd = gb * REGULAR_USD_PER_GB_MONTH;
  const yearlyUsd = monthlyUsd * 12;
  return {
    gb,
    monthlyUsd: round2(monthlyUsd),
    yearlyUsd: round2(yearlyUsd),
    monthlyInr: round2(monthlyUsd * USD_TO_INR),
    yearlyInr: round2(yearlyUsd * USD_TO_INR),
  };
}

// Amount to charge (the yearly total) in the chosen currency.
export function regularYearlyPrice(q: RegularQuote, currency: Currency): number {
  return currency === "INR" ? q.yearlyInr : q.yearlyUsd;
}

// Hot storage price per TB, as raw numbers (month + year total) in the chosen
// currency — for the pricing page.
export function regularPerTB(currency: Currency): { perMonth: number; perYear: number } {
  const q = quoteRegular(1024);
  return currency === "INR"
    ? { perMonth: q.monthlyInr, perYear: q.yearlyInr }
    : { perMonth: q.monthlyUsd, perYear: q.yearlyUsd };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
