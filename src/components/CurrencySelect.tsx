"use client";

import { useRouter } from "next/navigation";
import type { Currency } from "@/lib/plans";

// Lets the user override the auto-detected currency. Reloads /setup with the
// chosen currency as a query param.
export default function CurrencySelect({ value }: { value: Currency }) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => router.push(`/setup?currency=${e.target.value}`)}
      className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
      aria-label="Currency"
    >
      <option value="INR">₹ INR</option>
      <option value="USD">$ USD</option>
    </select>
  );
}
