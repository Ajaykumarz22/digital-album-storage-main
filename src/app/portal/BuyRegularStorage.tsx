"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MIN_GB = 50;

// "Buy Hot drive" button + modal. User enters GB (min 50), gets a price
// (shown monthly, billed yearly), and pays (mock). Tops up their quota.
export default function BuyRegularStorage({
  currency,
}: {
  currency: "USD" | "INR";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gb, setGb] = useState(MIN_GB);
  const [quote, setQuote] = useState<null | {
    gb: number;
    monthlyUsd: number;
    yearlyUsd: number;
    monthlyInr: number;
    yearlyInr: number;
  }>(null);

  const money = (usd: number, inr: number) =>
    currency === "INR"
      ? `₹${inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
      : `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  async function getQuote() {
    if (gb < MIN_GB) {
      alert(`Enter at least ${MIN_GB} GB.`);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/portal/regular/quote", {
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
    const res = await fetch("/api/portal/regular/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gb, currency }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      alert(`Added ${gb} GB of Hot drive (mock payment).`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not complete the purchase.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setGb(MIN_GB);
          setQuote(null);
          setOpen(true);
        }}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Buy Hot drive
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15">
            <h3 className="text-lg font-semibold">Buy Hot drive</h3>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Billed yearly. Minimum {MIN_GB} GB — enter any amount from there.
              Adds to your existing quota.
            </p>

            <label className="mt-4 block text-sm font-medium">
              How much storage (GB)
            </label>
            <input
              type="number"
              min={MIN_GB}
              value={gb}
              onChange={(e) => {
                setGb(Number(e.target.value));
                setQuote(null);
              }}
              className="mt-1 w-40 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
            {gb < MIN_GB && (
              <p className="mt-1 text-xs text-red-600">Minimum is {MIN_GB} GB.</p>
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
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-black/50 hover:underline dark:text-white/50"
              >
                Cancel
              </button>
              {!quote ? (
                <button
                  type="button"
                  onClick={getQuote}
                  disabled={busy || gb < MIN_GB}
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
      )}
    </>
  );
}
