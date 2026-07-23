"use client";

import { useState } from "react";

export default function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked - no-op; the text is visible to copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
