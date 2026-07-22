"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The restore / download action block on an archive detail page. Adapts to the
// archive's status. Shared by the customer portal and the studio side.
export default function RestoreControls({
  archiveId,
  status,
  currency,
  feeLabel,
  availableUntil,
}: {
  archiveId: string;
  status: string;
  currency: "USD" | "INR";
  feeLabel: string; // pre-formatted restore fee, e.g. "$150.00"
  availableUntil: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function requestRestore() {
    if (
      !window.confirm(
        `Retrieving this archive costs ${feeLabel} and takes up to 48 hours. ` +
          `Start the restore now?`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/archives/${archiveId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    setBusy(false);
    if (res.ok) {
      alert(
        "Restore started (payment mocked). This takes up to 48 hours — the status will update to “Ready to download” when it's done."
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not start the restore.");
    }
  }

  if (status === "restoring") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <span className="font-medium">Restoring…</span> This can take up to 48
        hours. Check back — the status will change to “Ready to download” when
        the files are ready.
      </div>
    );
  }

  if (status === "available") {
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            <span className="font-medium text-green-700 dark:text-green-500">
              Ready to download.
            </span>{" "}
            {availableUntil && `Available until ${availableUntil}.`}
          </span>
          <a
            href={`/api/archives/${archiveId}/download`}
            className="rounded-md bg-foreground px-4 py-2 font-medium text-background hover:opacity-90"
          >
            Download archive (.zip)
          </a>
        </div>
      </div>
    );
  }

  if (status === "archived") {
    return (
      <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
        <p className="text-black/60 dark:text-white/60">
          These files are frozen in cold drive. Retrieving them takes up to 48
          hours and costs <span className="font-medium">{feeLabel}</span>{" "}
          (covers the retrieval + transfer out).
        </p>
        <button
          type="button"
          onClick={requestRestore}
          disabled={busy}
          className="mt-3 rounded-md border border-blue-500/40 px-4 py-2 font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
        >
          {busy ? "Starting…" : "Restore files"}
        </button>
      </div>
    );
  }

  // paid / archiving / failed
  return (
    <div className="rounded-lg border border-black/10 p-4 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
      {status === "failed"
        ? "This archive failed to complete. Please contact support."
        : "This archive is still being created. Restore will be available once it's frozen."}
    </div>
  );
}
