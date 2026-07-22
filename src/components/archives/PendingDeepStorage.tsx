"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { formatBytes } from "@/lib/format";
import { useRouter } from "next/navigation";
import { FolderGlyph, FileGlyph, KebabButton } from "@/components/files/rowUi";

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


// Payment Pending list, styled like the My Uploads file list: icon · name ·
// meta rows with a per-row ⋮ menu whose only action is Remove (untag). The
// "Pay & archive" button lives in the tab title row (see ColdPayButton).
export default function PendingDeepStorage({ pending }: { pending: Pending }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [menu, setMenu] = useState<{ id: string; fileIds: string[] } | null>(
    null
  );
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );

  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

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

  function openMenu(
    id: string,
    fileIds: string[],
    e: MouseEvent<HTMLButtonElement>
  ) {
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMenu({ id, fileIds });
  }

  async function remove(fileIds: string[]) {
    setBusy(true);
    const res = await fetch("/api/portal/deep-cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds }),
    });
    setBusy(false);
    setMenu(null);
    if (res.ok) router.refresh();
    else alert("Could not remove.");
  }

  // Every file currently in the Payment Pending list.
  const allFileIds = [
    ...studioGroups.flatMap((g) => g.fileIds),
    ...folderGroups.flatMap((g) => g.fileIds),
    ...ownItems.map((i) => i.id),
  ];

  async function cancelAll() {
    setBusy(true);
    const res = await fetch("/api/portal/deep-cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: allFileIds }),
    });
    setBusy(false);
    setCancelOpen(false);
    if (res.ok) router.refresh();
    else alert("Could not cancel.");
  }

  const rowClass =
    "flex items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]";

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-2 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
        <span>
          Payment pending · {totalCount} file(s) · {formatBytes(totalBytes)}
        </span>
        <button
          type="button"
          onClick={() => setCancelOpen(true)}
          disabled={busy}
          className="shrink-0 font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {studioGroups.map((g) => (
        <div key={`studio-${g.studioSpace}`} className={rowClass}>
          <FolderGlyph />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{g.name}</div>
            <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
              {formatBytes(g.sizeBytes)} · shared · {g.fileCount} file
              {g.fileCount === 1 ? "" : "s"}
            </div>
          </div>
          <KebabButton
            label={`Actions for ${g.name}`}
            disabled={busy}
            onClick={(e) => openMenu(`studio-${g.studioSpace}`, g.fileIds, e)}
          />
        </div>
      ))}

      {folderGroups.map((g) => (
        <div key={`folder-${g.folderId}`} className={rowClass}>
          <FolderGlyph />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{g.name}</div>
            <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
              {formatBytes(g.sizeBytes)} · {g.fileCount} file
              {g.fileCount === 1 ? "" : "s"}
            </div>
          </div>
          <KebabButton
            label={`Actions for ${g.name}`}
            disabled={busy}
            onClick={(e) => openMenu(`folder-${g.folderId}`, g.fileIds, e)}
          />
        </div>
      ))}

      {ownItems.map((f) => (
        <div key={f.id} className={rowClass}>
          <FileGlyph />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{f.filename}</div>
            <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
              {formatBytes(f.size)}
              {f.folderPath ? ` · 📁 ${f.folderPath}` : ""}
            </div>
          </div>
          <KebabButton
            label={`Actions for ${f.filename}`}
            disabled={busy}
            onClick={(e) => openMenu(f.id, [f.id], e)}
          />
        </div>
      ))}

      {cancelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setCancelOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-black/10 bg-background p-6 shadow-xl dark:border-white/10"
          >
            <h2 className="text-lg font-semibold">Cancel Cold Drive?</h2>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              All files selected for Cold Drive will be added back to{" "}
              <strong>My uploads</strong>. Nothing has been charged.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelOpen(false)}
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={cancelAll}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Working…" : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {menu && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 w-40 rounded-md border border-black/10 bg-background p-1 text-left shadow-lg dark:border-white/15"
          >
            <button
              type="button"
              onClick={() => remove(menu.fileIds)}
              disabled={busy}
              className="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
