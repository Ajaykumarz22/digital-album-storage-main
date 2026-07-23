"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/format";
import { FolderGlyph, FileGlyph } from "@/components/files/rowUi";

type FileRow = { id: string; filename: string; size: number };
type FolderRow = { id: string; name: string; sizeBytes?: number };

// Pick items from My Uploads to move into Cold or Hot Drive. Prepaid: if there
// isn't enough capacity we show an inline error (no auto-buy) telling the user
// to purchase first; otherwise it moves the selection and returns to the portal.
export default function AddFilesPicker({
  to,
  folders,
  files,
}: {
  to: "cold" | "hot";
  folders: FolderRow[];
  files: FileRow[];
}) {
  const router = useRouter();
  const [selFiles, setSelFiles] = useState<Set<string>>(new Set());
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = folders.length + files.length;
  const selectedCount = selFiles.size + selFolders.size;
  const allSelected = total > 0 && selectedCount === total;

  const toggleFile = (id: string) =>
    setSelFiles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleFolder = (id: string) =>
    setSelFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectAll = () => {
    if (allSelected) {
      setSelFiles(new Set());
      setSelFolders(new Set());
    } else {
      setSelFiles(new Set(files.map((f) => f.id)));
      setSelFolders(new Set(folders.map((f) => f.id)));
    }
  };

  const label = to === "cold" ? "Cold Drive" : "Hot Drive";
  const endpoint =
    to === "cold" ? "/api/portal/cold/archive" : "/api/portal/regular/move";

  async function proceed() {
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: [...selFiles], folderIds: [...selFolders] }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 402) {
      setError("You don't have enough storage. Please purchase first.");
      return;
    }
    if (!res.ok) {
      setError(j.error || "Could not add files.");
      return;
    }
    router.push("/portal");
  }

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        Nothing in My uploads to add.
      </p>
    );
  }

  const rowClass =
    "flex cursor-pointer items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={selectAll}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <button
            type="button"
            onClick={proceed}
            disabled={busy || selectedCount === 0}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding…" : `Add to ${label}`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        {folders.map((f) => (
          <label key={`folder-${f.id}`} className={rowClass}>
            <input
              type="checkbox"
              checked={selFolders.has(f.id)}
              onChange={() => toggleFolder(f.id)}
              className="h-4 w-4 shrink-0"
            />
            <FolderGlyph />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{f.name}</div>
              <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                {f.sizeBytes ? formatBytes(f.sizeBytes) : "Folder"}
              </div>
            </div>
          </label>
        ))}
        {files.map((f) => (
          <label key={f.id} className={rowClass}>
            <input
              type="checkbox"
              checked={selFiles.has(f.id)}
              onChange={() => toggleFile(f.id)}
              className="h-4 w-4 shrink-0"
            />
            <FileGlyph />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{f.filename}</div>
              <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                {formatBytes(f.size)}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
