"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BuyStorageModal from "@/components/portal/BuyStorageModal";

// "Buy Cold Drive" button + modal. Tops up the account's Cold Drive capacity.
export default function BuyColdDrive({
  currency,
  label = "Buy Cold Drive",
}: {
  currency: "USD" | "INR";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        {label}
      </button>

      {open && (
        <BuyStorageModal
          title="Buy Cold Drive"
          quoteEndpoint="/api/portal/cold/quote"
          buyEndpoint="/api/portal/cold/buy"
          currency={currency}
          intro="Cheap long-term capacity, billed yearly. Minimum 50 GB. Adds to your existing quota, then your files move in for free."
          onClose={() => setOpen(false)}
          onPurchased={(gb) => {
            setOpen(false);
            alert(`Added ${gb} GB of Cold Drive (mock payment).`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
