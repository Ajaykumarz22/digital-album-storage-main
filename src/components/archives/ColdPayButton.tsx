"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";
import DeepArchiveModal from "@/components/archives/DeepArchiveModal";


// "Pay & archive" button for the Cold Drive tab title row. Opens the shared
// pricing/payment modal for everything currently tagged for Cold Drive.
export default function ColdPayButton({
  totalCount,
  totalBytes,
  currency,
}: {
  totalCount: number;
  totalBytes: number;
  currency: "USD" | "INR";
}) {
  const [open, setOpen] = useState(false);
  if (totalCount === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Pay &amp; archive
      </button>

      {open && (
        <DeepArchiveModal
          quoteUrl="/api/portal/deep-cart/quote"
          finalizeUrl="/api/portal/deep-cart/finalize"
          body={{}}
          currency={currency}
          subtitle={`${totalCount} file(s) · ${formatBytes(totalBytes)}. Minimum 5 GB total.`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
