// Storage plans for personal (customer) accounts. Prices are MONTHLY and
// HARD-CODED for now, set below Google One monthly for comparison. Edit freely.

export type Currency = "INR" | "USD";

export type Plan = {
  id: string;
  label: string; // e.g. "500 GB"
  bytes: number; // capacity
  usd: number; // our monthly price (USD)
  inr: number; // our monthly price (INR)
  googleUsd: number; // comparable Google One monthly price (USD), struck through
  googleInr: number; // comparable Google One monthly price (INR)
};

const GB = 1024 ** 3;
const TB = 1024 ** 4;

export const PLANS: Plan[] = [
  { id: "500gb", label: "500 GB", bytes: 500 * GB, usd: 3.99, inr: 249, googleUsd: 5.99, googleInr: 390 },
  { id: "1tb", label: "1 TB", bytes: 1 * TB, usd: 4.99, inr: 349, googleUsd: 9.99, googleInr: 650 },
  { id: "2tb", label: "2 TB", bytes: 2 * TB, usd: 7.99, inr: 499, googleUsd: 9.99, googleInr: 650 },
  { id: "5tb", label: "5 TB", bytes: 5 * TB, usd: 18.99, inr: 1199, googleUsd: 24.99, googleInr: 1625 },
  { id: "10tb", label: "10 TB", bytes: 10 * TB, usd: 39.99, inr: 2499, googleUsd: 49.99, googleInr: 3250 },
  { id: "20tb", label: "20 TB", bytes: 20 * TB, usd: 79.99, inr: 4999, googleUsd: 99.99, googleInr: 6500 },
  { id: "30tb", label: "30 TB", bytes: 30 * TB, usd: 119.99, inr: 7499, googleUsd: 149.99, googleInr: 9750 },
];

export function getPlan(id: string): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}

export function planPrice(
  plan: Plan,
  currency: Currency
): { ours: string; google: string } {
  return currency === "INR"
    ? { ours: `₹${plan.inr}`, google: `₹${plan.googleInr}` }
    : { ours: `$${plan.usd.toFixed(2)}`, google: `$${plan.googleUsd.toFixed(2)}` };
}
