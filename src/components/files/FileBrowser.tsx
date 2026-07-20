"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type FolderRow = { id: string; name: string; createdAt: string };
type FileRow = { id: string; filename: string; size: number; createdAt: string };
type MoveTarget = { id: string; path: string };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deterministic date format (UTC) to avoid server/client hydration mismatches.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function FileBrowser({
  currentFolderId,
  base,
  folders,
  files,
  moveTargets,
  endpoints,
  baseBody = {},
}: {
  currentFolderId: string | null;
  base: string;
  folders: FolderRow[];
  files: FileRow[];
  moveTargets: MoveTarget[];
  endpoints: { move: string; folders: string; delete: string };
  baseBody?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [selFiles, setSelFiles] = useState<Set<string>>(new Set());
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState<string>(""); // "" = root
  const [busy, setBusy] = useState(false);

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
  const toggleAll = () => {
    if (allSelected) {
      setSelFiles(new Set());
      setSelFolders(new Set());
    } else {
      setSelFiles(new Set(files.map((f) => f.id)));
      setSelFolders(new Set(folders.map((f) => f.id)));
    }
  };
  const clearSelection = () => {
    setSelFiles(new Set());
    setSelFolders(new Set());
  };

  const payload = () => ({
    ...baseBody,
    fileIds: [...selFiles],
    folderIds: [...selFolders],
  });

  async function doMove(targetFolderId: string | null) {
    setBusy(true);
    const res = await fetch(endpoints.move, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload(), targetFolderId }),
    });
    setBusy(false);
    if (res.ok) {
      clearSelection();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move.");
    }
  }

  async function onMoveExisting() {
    await doMove(moveTo === "" ? null : moveTo);
  }

  async function onNewFolderAndMove() {
    const name = window.prompt("New folder name (selected items will move into it)");
    if (!name || !name.trim()) return;
    setBusy(true);
    const res = await fetch(endpoints.folders, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        parentId: currentFolderId,
        name: name.trim(),
      }),
    });
    if (!res.ok) {
      setBusy(false);
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not create folder.");
      return;
    }
    const { folderId } = await res.json();
    setBusy(false);
    await doMove(folderId);
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Delete ${selectedCount} item(s)? Folders will delete their contents too. This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(endpoints.delete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    setBusy(false);
    if (res.ok) {
      clearSelection();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not delete.");
    }
  }

  // Delete a single file straight from its row.
  async function deleteOneFile(fileId: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(endpoints.delete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...baseBody, fileIds: [fileId], folderIds: [] }),
    });
    setBusy(false);
    if (res.ok) {
      setSelFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not delete the file.");
    }
  }

  // Delete a single folder (and its contents) straight from its row.
  async function deleteOneFolder(folderId: string, name: string) {
    if (
      !window.confirm(
        `Delete folder "${name}" and everything inside it? This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(endpoints.delete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...baseBody, folderIds: [folderId], fileIds: [] }),
    });
    setBusy(false);
    if (res.ok) {
      setSelFolders((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not delete the folder.");
    }
  }

  // Move targets exclude any folder that is currently selected (can't move into
  // itself); descendant checks are enforced server-side too.
  const targets = useMemo(
    () => moveTargets.filter((t) => !selFolders.has(t.id)),
    [moveTargets, selFolders]
  );

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        This folder is empty. Upload files or create a folder above.
      </p>
    );
  }

  return (
    <div>
      {/* Selection toolbar */}
      {selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          <span className="font-medium">{selectedCount} selected</span>

          <div className="flex items-center gap-2">
            <select
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              disabled={busy}
              className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
            >
              <option value="">Root</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.path}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onMoveExisting}
              disabled={busy}
              className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              Move here
            </button>
          </div>

          <button
            type="button"
            onClick={onNewFolderAndMove}
            disabled={busy}
            className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
          >
            New folder &amp; move
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-red-500/40 px-3 py-1.5 font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete
          </button>

          <button
            type="button"
            onClick={clearSelection}
            disabled={busy}
            className="text-black/50 hover:underline dark:text-white/50"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {folders.map((fld) => (
              <tr
                key={fld.id}
                className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selFolders.has(fld.id)}
                    onChange={() => toggleFolder(fld.id)}
                    aria-label={`Select folder ${fld.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`${base}?folder=${fld.id}`}
                    className="font-medium hover:underline"
                  >
                    📁 {fld.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-black/40 dark:text-white/40">—</td>
                <td className="px-4 py-3 text-black/60 dark:text-white/60">
                  {formatDate(fld.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => deleteOneFolder(fld.id, fld.name)}
                    disabled={busy}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {files.map((f) => (
              <tr
                key={f.id}
                className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selFiles.has(f.id)}
                    onChange={() => toggleFile(f.id)}
                    aria-label={`Select file ${f.filename}`}
                  />
                </td>
                <td className="px-4 py-3">{f.filename}</td>
                <td className="px-4 py-3">{formatBytes(f.size)}</td>
                <td className="px-4 py-3 text-black/60 dark:text-white/60">
                  {formatDate(f.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => deleteOneFile(f.id, f.filename)}
                    disabled={busy}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
