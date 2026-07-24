"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BuyStorageModal from "@/components/portal/BuyStorageModal";

// "Add files" button in the Cold/Hot Drive empty state. If the user already
// owns storage, it goes straight to the file picker. If they own none, it opens
// the Buy popup first (so they don't pick files only to be blocked).
export default function AddFilesButton({
  to,
  hasCapacity,
  currency,
}: {
  to: "cold" | "hot";
  hasCapacity: boolean;
  currency: "USD" | "INR";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isCold = to === "cold";

  const cls =
    "inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90";
  const plus = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  if (hasCapacity) {
    return (
      <Link href={`/portal/add?to=${to}`} className={cls}>
        {plus}
        Add files
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        {plus}
        Add files
      </button>

      {open && (
        <BuyStorageModal
          title={isCold ? "Buy Cold Drive" : "Buy Hot drive"}
          quoteEndpoint={isCold ? "/api/portal/cold/quote" : "/api/portal/regular/quote"}
          buyEndpoint={isCold ? "/api/portal/cold/buy" : "/api/portal/regular/buy"}
          currency={currency}
          minGb={isCold ? 50 : 20}
          intro={`Buy ${
            isCold ? "Cold Drive" : "Hot drive"
          } capacity first, then choose which files to move into it.`}
          onClose={() => setOpen(false)}
          onPurchased={() => {
            setOpen(false);
            router.push(`/portal/add?to=${to}`);
          }}
        />
      )}
    </>
  );
}
