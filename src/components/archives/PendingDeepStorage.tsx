"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeepArchiveModal from "@/components/archives/DeepArchiveModal";

type StudioGroup = {
  studioSpace: string;
  name: string;
  fileIds: string[];
  fileCount: number;
  sizeBytes: number;
};
type FolderGroup = {
  folderId: string;
  name: string;
  fileIds: string[];
  fileCount: number;
  sizeBytes: number;
};
type OwnItem = { id: string; filename: string; size: number; folderPath: string };
type Pending = {
  studioGroups: StudioGroup[];
  folderGroups: FolderGroup[];
  ownItems: OwnItem[];
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// Payment Pending list: studio deliveries collapse into one "📁 Studio" row;
// the customer's own selected files stay individual. "Pay & archive" freezes
// everything selected (the shared modal handles pricing + keep/delete).
export default function PendingDeepStorage({
  pending,
  currency,
}: {
  pending: Pending;
  currency: "USD" | "INR";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const { studioGroups, folderGroups, ownItems } = pending;
  if (
    studioGroups.length === 0 &&
    folderGroups.length === 0 &&
    ownItems.length === 0
  )
    return null;

  const totalBytes =
    studioGroups.reduce((s, g) => s + g.sizeBytes, 0) +
    folderGroups.reduce((s, g) => s + g.sizeBytes, 0) +
    ownItems.reduce((s, i) => s + i.size, 0);
  const totalCount =
    studioGroups.reduce((s, g) => s + g.fileCount, 0) +
    folderGroups.reduce((s, g) => s + g.fileCount, 0) +
    ownItems.length;

  async function remove(fileIds: string[]) {
    setBusy(true);
    const res = await fetch("/api/portal/deep-cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Could not remove.");
  }

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">Payment pending</div>
          <div className="text-sm text-black/60 dark:text-white/60">
            {totalCount} file(s) · {formatBytes(totalBytes)} — waiting for
            payment to finish moving to Deep Storage.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          Pay &amp; archive
        </button>
      </div>

      <ul className="mt-3 divide-y divide-black/5 text-sm dark:divide-white/5">
        {studioGroups.map((g) => (
          <li
            key={`studio-${g.studioSpace}`}
            className="flex items-center justify-between py-2"
          >
            <span>
              📁 {g.name}
              <span className="ml-2 text-xs text-black/40 dark:text-white/40">
                shared · {g.fileCount} file(s)
              </span>
            </span>
            <span className="flex items-center gap-4">
              <span className="text-black/50 dark:text-white/50">
                {formatBytes(g.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => remove(g.fileIds)}
                disabled={busy}
                className="text-black/50 hover:underline disabled:opacity-50 dark:text-white/50"
              >
                Remove
              </button>
            </span>
          </li>
        ))}
        {folderGroups.map((g) => (
          <li
            key={`folder-${g.folderId}`}
            className="flex items-center justify-between py-2"
          >
            <span>
              📁 {g.name}
              <span className="ml-2 text-xs text-black/40 dark:text-white/40">
                {g.fileCount} file(s)
              </span>
            </span>
            <span className="flex items-center gap-4">
              <span className="text-black/50 dark:text-white/50">
                {formatBytes(g.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => remove(g.fileIds)}
                disabled={busy}
                className="text-black/50 hover:underline disabled:opacity-50 dark:text-white/50"
              >
                Remove
              </button>
            </span>
          </li>
        ))}
        {ownItems.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-2">
            <span>
              {f.filename}
              {f.folderPath && (
                <span className="ml-2 text-xs text-black/40 dark:text-white/40">
                  📁 {f.folderPath}
                </span>
              )}
            </span>
            <span className="flex items-center gap-4">
              <span className="text-black/50 dark:text-white/50">
                {formatBytes(f.size)}
              </span>
              <button
                type="button"
                onClick={() => remove([f.id])}
                disabled={busy}
                className="text-black/50 hover:underline disabled:opacity-50 dark:text-white/50"
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      {open && (
        <DeepArchiveModal
          quoteUrl="/api/portal/deep-cart/quote"
          finalizeUrl="/api/portal/deep-cart/finalize"
          body={{}}
          currency={currency}
          subtitle={`${totalCount} file(s) · ${formatBytes(totalBytes)}. Minimum 5 GB total.`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
