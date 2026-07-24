"use client";

import { useEffect } from "react";
import { incLoading, decLoading } from "@/lib/loadingStore";

// Patches window.fetch once so every same-origin API mutation (non-GET call to
// /api/…) flips the global loading state. This lets the header spinner reflect
// moves, deletes, archives, purchases, uploads, etc. without wiring each one.
export default function FetchLoadingProvider() {
  useEffect(() => {
    const w = window as unknown as { __fetchPatched?: boolean };
    if (w.__fetchPatched) return;
    w.__fetchPatched = true;

    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let track = false;
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = (
          init?.method ??
          (typeof input === "object" && "method" in input
            ? input.method
            : "GET")
        ).toUpperCase();
        const u = new URL(url, window.location.href);
        track =
          u.origin === window.location.origin &&
          u.pathname.startsWith("/api/") &&
          method !== "GET";
      } catch {
        // ignore — leave untracked
      }

      if (track) incLoading();
      try {
        return await orig(input, init);
      } finally {
        if (track) decLoading();
      }
    };
    // Intentionally left patched for the app's lifetime.
  }, []);

  return null;
}
