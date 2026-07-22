import type { Currency } from "@/lib/plans";

// ---- Archive pricing config (edit these freely) ----------------------------
//
// Customer rate = (AWS Deep Archive base rate + markup) per TB per month,
// charged upfront for the chosen term. Storage only — RESTORE is billed
// separately when a customer actually pulls data back.
//
// NOTE: verify the exact AWS ap-south-1 (Mumbai) Deep Archive rate and update
// AWS_DEEP_ARCHIVE_USD_PER_TB_MONTH. For MVP we hard-code it rather than calling
// the AWS Price List API on every quote.
const AWS_DEEP_ARCHIVE_USD_PER_TB_MONTH = 0.99; // ~ $0.00099/GB
const MARKUP_USD_PER_TB_MONTH = 2; // customer deep price = $0.99 + $2 = $2.99/TB/mo
// USD→INR for display; make dynamic later.
const USD_TO_INR = 83;

// ---- Restore (retrieval) fee config -----------------------------------------
// Pulling data BACK costs us AWS egress (~$90/TB) + a retrieval fee. Charged to
// the customer per restore. EDIT freely (placeholder until you set the number).
const RESTORE_USD_PER_TB = 150;
const RESTORE_MIN_USD = 5;
// How long the thawed copy stays downloadable before it refreezes.
export const RESTORE_AVAILABLE_DAYS = 7;

export const MIN_TERM_YEARS = 7;
export const MAX_TERM_YEARS = 100;

// Smallest selection allowed per archive. Below this the price rounds to ~$0
// and archiving trivial amounts isn't worth the cold-storage overhead.
export const MIN_ARCHIVE_BYTES = 5 * 1024 ** 3; // 5 GB

const BYTES_PER_TB = 1024 ** 4;

// Compact human size for user-facing messages.
export function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export type ArchiveQuote = {
  sizeBytes: number;
  fileCount: number;
  years: number;
  ratePerTBMonthUsd: number;
  usd: number;
  inr: number;
};

// Clamp a requested term into the allowed 7..100 year window.
export function normalizeTermYears(input: unknown): number {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n)) return MIN_TERM_YEARS;
  return Math.min(MAX_TERM_YEARS, Math.max(MIN_TERM_YEARS, n));
}

// Price a bundle of the given size for the given term.
export function quoteArchive(
  sizeBytes: number,
  fileCount: number,
  yearsInput: unknown
): ArchiveQuote {
  const years = normalizeTermYears(yearsInput);
  const ratePerTBMonthUsd =
    AWS_DEEP_ARCHIVE_USD_PER_TB_MONTH + MARKUP_USD_PER_TB_MONTH;
  const tb = sizeBytes / BYTES_PER_TB;
  const months = years * 12;
  const usd = tb * ratePerTBMonthUsd * months;
  return {
    sizeBytes,
    fileCount,
    years,
    ratePerTBMonthUsd,
    usd: round2(usd),
    inr: round2(usd * USD_TO_INR),
  };
}

// The amount to charge/store in the chosen currency.
export function priceIn(quote: ArchiveQuote, currency: Currency): number {
  return currency === "INR" ? quote.inr : quote.usd;
}

// Our actual Cold Drive price per TB/month (AWS cost + markup), formatted for
// the landing headline. USD in India converts to INR.
export function deepArchivePricePerTBMonth(currency: Currency): string {
  const usd = AWS_DEEP_ARCHIVE_USD_PER_TB_MONTH + MARKUP_USD_PER_TB_MONTH;
  if (currency === "INR") return `₹${Math.round(usd * USD_TO_INR)}`;
  return `$${usd.toFixed(2)}`;
}

export type RestoreQuote = { sizeBytes: number; usd: number; inr: number };

// One-time fee to retrieve a whole archive back from cold drive.
export function restoreQuote(sizeBytes: number): RestoreQuote {
  const tb = sizeBytes / BYTES_PER_TB;
  const usd = Math.max(RESTORE_MIN_USD, round2(tb * RESTORE_USD_PER_TB));
  return { sizeBytes, usd, inr: round2(usd * USD_TO_INR) };
}

export function restorePriceIn(quote: RestoreQuote, currency: Currency): number {
  return currency === "INR" ? quote.inr : quote.usd;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
