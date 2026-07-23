"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shared "freeze to Cold Drive" modal - used by the studio side (direct
// archive of selected files) AND the customer Payment Pending list. Only the
// quote/finalize endpoints + extra body differ. Parent mounts it when open.
export default function DeepArchiveModal({
  quoteUrl,
  finalizeUrl,
  body,
  currency,
  subtitle,
  onClose,
  onDone,
}: {
  quoteUrl: string;
  finalizeUrl: string;
  body: Record<string, unknown>;
  currency: "USD" | "INR";
  subtitle?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [years, setYears] = useState(7);
  const [quote, setQuote] = useState<null | {
    years: number;
    usd: number;
    inr: number;
  }>(null);

  const money = (usd: number, inr: number) =>
    currency === "INR"
      ? `₹${inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
      : `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  async function getQuote() {
    setBusy(true);
    const res = await fetch(quoteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, years }),
    });
    setBusy(false);
    if (res.ok) setQuote(await res.json());
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not price the selection.");
    }
  }

  async function pay() {
    if (!name.trim()) {
      alert("Name your archive first.");
      return;
    }
    setBusy(true);
    const res = await fetch(finalizeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        name: name.trim(),
        years,
        currency,
        keepCopies: false,
      }),
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      onDone?.();
      alert(
        "Payment received (mock). The files are being frozen into Cold Drive in the background."
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not finish.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15">
        <h3 className="text-lg font-semibold">Freeze to Cold Drive</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {subtitle}
          </p>
        )}

        <label className="mt-4 block text-sm font-medium">Archive name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 2019 Wedding"
          className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />

        <label className="mt-4 block text-sm font-medium">
          Keep for (years) - min 7, max 100
        </label>
        <input
          type="number"
          min={7}
          max={100}
          value={years}
          onChange={(e) => {
            setYears(Number(e.target.value));
            setQuote(null);
          }}
          className="mt-1 w-32 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />

        {quote && (
          <div className="mt-4 flex justify-between rounded-lg border border-black/10 bg-black/[0.02] p-4 text-sm font-semibold dark:border-white/10 dark:bg-white/[0.03]">
            <span>{quote.years}-year price</span>
            <span>{money(quote.usd, quote.inr)}</span>
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
              disabled={busy}
              className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              {busy ? "Pricing…" : "Get price"}
            </button>
          ) : (
            <button
              type="button"
              onClick={pay}
              disabled={busy || !name.trim()}
              className="rounded-md bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working…" : `Pay ${money(quote.usd, quote.inr)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
