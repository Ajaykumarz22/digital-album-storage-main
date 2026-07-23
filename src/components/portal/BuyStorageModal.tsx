"use client";

import { useState } from "react";

type Quote = {
  gb: number;
  monthlyUsd: number;
  yearlyUsd: number;
  monthlyInr: number;
  yearlyInr: number;
};

// Generic "buy storage capacity" modal (Hot or Cold). Prefills the capacity
// input (rounded, min), quotes, pays (mock), then calls onPurchased(gb).
export default function BuyStorageModal({
  title,
  quoteEndpoint,
  buyEndpoint,
  currency,
  minGb = 50,
  initialGb,
  intro,
  onClose,
  onPurchased,
}: {
  title: string;
  quoteEndpoint: string;
  buyEndpoint: string;
  currency: "USD" | "INR";
  minGb?: number;
  initialGb?: number;
  intro?: string;
  onClose: () => void;
  onPurchased: (gb: number) => void;
}) {
  const [gb, setGb] = useState(Math.max(minGb, Math.round(initialGb ?? minGb)));
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const money = (usd: number, inr: number) =>
    currency === "INR"
      ? `₹${inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
      : `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  async function getQuote() {
    if (gb < minGb) return;
    setBusy(true);
    const res = await fetch(quoteEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gb }),
    });
    setBusy(false);
    if (res.ok) setQuote(await res.json());
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not price that.");
    }
  }

  async function buy() {
    setBusy(true);
    const res = await fetch(buyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gb, currency }),
    });
    setBusy(false);
    if (res.ok) onPurchased(gb);
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not complete the purchase.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {intro ??
            `Billed yearly. Minimum ${minGb} GB. Adds to your existing quota.`}
        </p>

        <label className="mt-4 block text-sm font-medium">
          How much capacity (GB)
        </label>
        <input
          type="number"
          min={minGb}
          value={gb}
          onChange={(e) => {
            setGb(Number(e.target.value));
            setQuote(null);
          }}
          className="mt-1 w-40 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        {gb < minGb && (
          <p className="mt-1 text-xs text-red-600">Minimum is {minGb} GB.</p>
        )}

        {quote && (
          <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.02] p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex justify-between">
              <span className="text-black/60 dark:text-white/60">
                {quote.gb} GB
              </span>
              <span className="font-semibold">
                {money(quote.monthlyUsd, quote.monthlyInr)}/month
              </span>
            </div>
            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
              Billed yearly — {money(quote.yearlyUsd, quote.yearlyInr)}/year
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-black/50 hover:underline dark:text-white/50"
          >
            Cancel
          </button>
          {!quote ? (
            <button
              type="button"
              onClick={getQuote}
              disabled={busy || gb < minGb}
              className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              {busy ? "Pricing…" : "Get price"}
            </button>
          ) : (
            <button
              type="button"
              onClick={buy}
              disabled={busy}
              className="rounded-md bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? "Working…"
                : `Pay ${money(quote.yearlyUsd, quote.yearlyInr)}/yr`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
