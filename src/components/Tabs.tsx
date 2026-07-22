"use client";

import { useState, type ReactNode } from "react";

export type TabDef = { key: string; label: string; content: ReactNode };

// Mobile-friendly tab bar: full-width, edge-to-edge, sticky just below the
// sticky site header (h-16 = 64px). Active tab gets a white panel + underline.
export default function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.key);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-6 border-b border-black/10 bg-[whitesmoke] dark:border-white/10 dark:bg-background">
        <div role="tablist" aria-label="Sections" className="flex w-full">
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.key)}
                className={`relative flex-1 whitespace-nowrap px-2 py-3 text-center text-xs font-medium transition-colors sm:text-sm ${
                  isActive
                    ? "bg-white text-foreground dark:bg-white/10"
                    : "text-black/50 hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
                }`}
              >
                {t.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          hidden={t.key !== active}
          className="space-y-10"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
