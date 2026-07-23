"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { formatBytes, formatDate } from "@/lib/format";
import { FileGlyph, KebabButton } from "@/components/files/rowUi";
import BuyStorageModal from "@/components/portal/BuyStorageModal";

export type SharedFile = {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  folderPath: string;
  deepTag?: "moved" | null;
};
export type ExpiryGroup = { days: number; label: string; urgent: boolean; files: SharedFile[] };

// Shared files grouped by days-left, styled like the My Uploads list: a row per
// file (checkbox · icon · name/meta · ⋮ menu) with bulk + per-file actions to
// move them to Hot drive or Cold Drive.
export default function SharedFileGroups({
  groups,
  studioSpace,
  canImport,
  locked,
  currency,
}: {
  groups: ExpiryGroup[];
  studioSpace: string;
  canImport: boolean;
  locked: boolean;
  currency: "USD" | "INR";
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [coldBuy, setColdBuy] = useState<{
    gb: number;
    retry: () => void;
  } | null>(null);
  // Per-file ⋮ menu: which file's menu is open, fixed-positioned so it escapes
  // the list's clipping.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );

  function openMenu(id: string, e: MouseEvent<HTMLButtonElement>) {
    if (menuFor === id) {
      setMenuFor(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMenuFor(id);
  }

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clear = () => setSel(new Set());

  async function moveToRegular(fileIds: string[]) {
    if (!canImport) {
      alert("Choose a storage plan first to move files to Hot drive.");
      return;
    }
    await run("/api/portal/import-files", { studioSpace, fileIds });
  }
  async function moveToDeep(fileIds: string[]) {
    setBusy(true);
    const res = await fetch("/api/portal/cold/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioSpace, fileIds, currency }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMenuFor(null);
    if (res.status === 402 && j.requiredGb) {
      setColdBuy({ gb: j.requiredGb as number, retry: () => moveToDeep(fileIds) });
      return;
    }
    if (res.ok) {
      clear();
      router.refresh();
    } else {
      alert(j.error || "Could not move to Cold Drive.");
    }
  }
  async function run(url: string, body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    setMenuFor(null);
    if (res.ok) {
      clear();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move the files.");
    }
  }

  if (groups.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-black/15 p-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        Nothing shared here.
      </p>
    );
  }

  const selected = [...sel];
  const rowClass =
    "flex items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]";

  return (
    <div className="mt-6 space-y-8">
      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-background/95 px-4 py-3 text-sm shadow-sm dark:border-white/10">
          <span className="font-medium">{selected.length} selected</span>
          <button
            type="button"
            onClick={() => moveToRegular(selected)}
            disabled={busy}
            className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
          >
            Move to Hot drive
          </button>
          <button
            type="button"
            onClick={() => moveToDeep(selected)}
            disabled={busy}
            className="rounded-md border border-blue-500/40 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
          >
            Move to Cold Drive
          </button>
          <button
            type="button"
            onClick={clear}
            className="text-black/50 hover:underline dark:text-white/50"
          >
            Clear
          </button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.days}>
          <h2
            className={`mb-2 text-sm font-semibold ${
              g.urgent ? "text-red-600" : ""
            }`}
          >
            {g.label}
          </h2>
          <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
            {g.files.map((f) => (
              <div key={f.id} className={rowClass}>
                <input
                  type="checkbox"
                  checked={sel.has(f.id)}
                  onChange={() => toggle(f.id)}
                  aria-label={`Select ${f.filename}`}
                  className="h-4 w-4 shrink-0"
                />
                <FileGlyph />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm">{f.filename}</span>
                    {f.deepTag === "moved" && (
                      <span className="shrink-0 rounded-full border border-black/15 px-2 py-0.5 text-xs text-black/50 dark:border-white/20 dark:text-white/50">
                        Moved to cold
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                    {formatBytes(f.size)} · {formatDate(f.createdAt)}
                    {f.folderPath ? ` · 📁 ${f.folderPath}` : ""}
                  </div>
                </div>
                {locked ? (
                  <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                    Locked
                  </span>
                ) : (
                  <KebabButton
                    label={`Actions for ${f.filename}`}
                    disabled={busy}
                    onClick={(e) => openMenu(f.id, e)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {menuFor && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
          <div
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 w-52 rounded-md border border-black/10 bg-background p-1 text-left shadow-lg dark:border-white/15"
          >
            <a
              href={`/api/files/${menuFor}/download`}
              onClick={() => setMenuFor(null)}
              className="block rounded px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              Download
            </a>
            <button
              type="button"
              onClick={() => moveToRegular([menuFor])}
              disabled={busy}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
            >
              Move to Hot drive
            </button>
            <button
              type="button"
              onClick={() => moveToDeep([menuFor])}
              disabled={busy}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
            >
              Move to Cold Drive
            </button>
          </div>
        </>
      )}

      {coldBuy && (
        <BuyStorageModal
          title="Buy Cold Drive"
          quoteEndpoint="/api/portal/cold/quote"
          buyEndpoint="/api/portal/cold/buy"
          currency={currency}
          initialGb={coldBuy.gb}
          intro="You need more Cold Drive capacity to move these files. Buy the capacity below, then they'll move in automatically."
          onClose={() => setColdBuy(null)}
          onPurchased={() => {
            const retry = coldBuy.retry;
            setColdBuy(null);
            retry();
          }}
        />
      )}
    </div>
  );
}
