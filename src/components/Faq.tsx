"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "@/lib/faq";

// `alwaysOpen` renders every answer expanded with no toggle (used on the
// welcome screen); otherwise it's a single-open accordion.
export default function Faq({ alwaysOpen = false }: { alwaysOpen?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">FAQs</h2>
      <div className="overflow-hidden rounded-lg border border-black/15 dark:border-white/10">
        {FAQ_ITEMS.map((it, i) => {
          const isOpen = alwaysOpen || open === i;
          return (
            <div
              key={i}
              className="border-b border-black/5 last:border-0 dark:border-white/5"
            >
              {alwaysOpen ? (
                <div className="px-4 py-3 text-sm font-medium">{it.q}</div>
              ) : (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <span>{it.q}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-black/40 transition-transform dark:text-white/40 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
              {isOpen && (
                <p className="px-4 pb-4 text-sm leading-relaxed text-black/60 dark:text-white/60">
                  {it.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
