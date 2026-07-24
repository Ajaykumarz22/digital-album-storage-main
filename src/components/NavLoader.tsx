"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getLoadingCount, subscribeLoading } from "@/lib/loadingStore";

// A small spinner shown in the header while a route navigation is in flight, so
// the app never feels "stuck". It appears on internal link clicks and
// back/forward, and clears once the URL actually changes.
function NavLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navKey = `${pathname}?${searchParams}`;
  const [loading, setLoading] = useState(false);
  const [prevNavKey, setPrevNavKey] = useState(navKey);
  // In-flight API mutations (moves, deletes, uploads, purchases, …).
  const apiCount = useSyncExternalStore(
    subscribeLoading,
    getLoadingCount,
    () => 0
  );

  // Navigation finished → the path or query changed. Reset during render
  // (React's recommended alternative to a state-setting effect).
  if (navKey !== prevNavKey) {
    setPrevNavKey(navKey);
    setLoading(false);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same URL → no navigation.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      setLoading(true);
    }

    function onPop() {
      setLoading(true);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  if (!loading && apiCount === 0) return null;
  return (
    <span
      role="status"
      aria-label="Loading"
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-black/20 border-t-foreground dark:border-white/25 dark:border-t-white"
    />
  );
}

export default function NavLoader() {
  return (
    <Suspense fallback={null}>
      <NavLoaderInner />
    </Suspense>
  );
}
