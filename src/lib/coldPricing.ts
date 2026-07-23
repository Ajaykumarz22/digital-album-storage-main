import type { Currency } from "@/lib/plans";

// ---- Cold Drive (prepaid capacity) pricing ------------------------------
// Mirrors the Hot-drive top-up model, but at the Cold Drive rate (AWS Deep
// Archive base + markup ≈ $1.99 / TB / month). Billed yearly (×12).
const COLD_USD_PER_TB_MONTH = 1.99;
const USD_TO_INR = 95;

export const COLD_USD_PER_GB_MONTH = COLD_USD_PER_TB_MONTH / 1024;

export const MIN_COLD_GB = 50;
const GiB = 1024 ** 3;

export function gbToBytes(gb: number): number {
  return Math.round(gb * GiB);
}

// Validate a requested GB amount (whole number, at least the minimum).
export function validColdGb(input: unknown): number | null {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n) || n < MIN_COLD_GB) return null;
  return n;
}

export type ColdQuote = {
  gb: number;
  monthlyUsd: number;
  yearlyUsd: number;
  monthlyInr: number;
  yearlyInr: number;
};

export function quoteCold(gb: number): ColdQuote {
  const monthlyUsd = gb * COLD_USD_PER_GB_MONTH;
  const yearlyUsd = monthlyUsd * 12;
  return {
    gb,
    monthlyUsd: round2(monthlyUsd),
    yearlyUsd: round2(yearlyUsd),
    monthlyInr: round2(monthlyUsd * USD_TO_INR),
    yearlyInr: round2(yearlyUsd * USD_TO_INR),
  };
}

// The yearly total to charge in the chosen currency.
export function coldYearlyPrice(q: ColdQuote, currency: Currency): number {
  return currency === "INR" ? q.yearlyInr : q.yearlyUsd;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
