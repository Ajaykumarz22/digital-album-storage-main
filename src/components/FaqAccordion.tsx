"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "@/lib/faq";

// Marketing-style FAQ: full-width rows with a teal +/- toggle. Uses the shared
// FAQ content. (The compact accordion in the app tabs is components/Faq.tsx.)
export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      {FAQ_ITEMS.map((it, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="border-t border-black/10 last:border-b dark:border-white/10"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-lg font-semibold">{it.q}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="2" y1="7" x2="12" y2="7" />
                  {!isOpen && <line x1="7" y1="2" x2="7" y2="12" />}
                </svg>
              </span>
            </button>
            {isOpen && (
              <p className="pb-6 pr-12 text-sm leading-relaxed text-black/60 dark:text-white/60">
                {it.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
