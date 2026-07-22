"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import DeepArchiveModal from "@/components/archives/DeepArchiveModal";
import TempStorageMove from "@/components/archives/TempStorageMove";
import { daysLeft } from "@/lib/lifecycle";

// A studio delivery shown as a folder-style row inside Temporary Storage.
type SharedRow = {
  id: string;
  name: string;
  fileCount: number;
  sizeBytes: number;
  allSelected: boolean;
};
type FolderRow = {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes?: number;
};
type FileRow = {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  deepTag?: "selected" | "moved" | null;
};
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
  currency = "USD",
  folderParam = "folder",
  folderHrefBase,
  folderHrefSuffix = "",
  showExpiry = false,
  sharedRows = [],
  canImport = false,
}: {
  currentFolderId: string | null;
  base: string;
  folders: FolderRow[];
  files: FileRow[];
  moveTargets: MoveTarget[];
  endpoints: {
    move: string;
    folders: string;
    delete: string;
    // Studio side: direct archive with a price/pay modal (both present).
    archiveQuote?: string;
    archiveCreate?: string;
    // Customer side: tag selection for Deep Storage / untag it.
    deepSelect?: string;
    deepUnselect?: string;
    // Temporary tier: move selection into paid Regular storage.
    moveToRegular?: string;
  };
  baseBody?: Record<string, unknown>;
  currency?: "USD" | "INR";
  // Which query param folder links use (lets two browsers coexist on a page).
  folderParam?: string;
  // Open folders at `${folderHrefBase}/<id>${folderHrefSuffix}` (e.g. a
  // dedicated folder page). Strings, not a function, to stay serializable
  // across the server→client boundary. Falls back to `${base}?${folderParam}=`.
  folderHrefBase?: string;
  folderHrefSuffix?: string;
  // Show a per-file "Expires" column (Temporary tier).
  showExpiry?: boolean;
  // Studio deliveries to list as folder-style rows (Temporary tier only).
  sharedRows?: SharedRow[];
  // Whether the user can copy shared files to Regular storage (has quota).
  canImport?: boolean;
}) {
  const router = useRouter();
  const [selFiles, setSelFiles] = useState<Set<string>>(new Set());
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState<string>(""); // "" = root
  const [busy, setBusy] = useState(false);
  const folderLink = (id: string) =>
    folderHrefBase
      ? `${folderHrefBase}/${id}${folderHrefSuffix}`
      : `${base}?${folderParam}=${id}`;

  // "Move to Deep Storage" modal state (studio side = direct archive).
  const canArchive = Boolean(endpoints.archiveQuote && endpoints.archiveCreate);
  // Customer side: move selection into the Payment Pending list.
  const canDeepSelect = Boolean(endpoints.deepSelect);
  const canMoveRegular = Boolean(endpoints.moveToRegular);

  // override omitted → act on the current selection; given → act on one item.
  type Ov = { fileIds?: string[]; folderIds?: string[] };
  const bodyFor = (ov?: Ov) =>
    ov
      ? { ...baseBody, fileIds: ov.fileIds ?? [], folderIds: ov.folderIds ?? [] }
      : payload();

  async function moveToRegular(ov?: Ov) {
    setBusy(true);
    const res = await fetch(endpoints.moveToRegular as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyFor(ov)),
    });
    setBusy(false);
    setMoveMenu(null);
    if (res.ok) {
      if (!ov) clearSelection();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move to Regular storage.");
    }
  }

  async function moveToDeep(ov?: Ov) {
    setBusy(true);
    const res = await fetch(endpoints.deepSelect as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyFor(ov)),
    });
    setBusy(false);
    setMoveMenu(null);
    if (res.ok) {
      if (!ov) clearSelection();
      alert(
        "Tagged for Deep Storage. They stay here, marked “Selected for deep storage”, and appear in your Payment Pending list — pay there to freeze them."
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move to Deep Storage.");
    }
  }
  const [archiveOpen, setArchiveOpen] = useState(false);
  // One "Move" popup shared by file + folder rows (fixed-positioned so it
  // escapes the table's overflow clipping).
  const [moveMenu, setMoveMenu] = useState<{
    id: string;
    kind: "file" | "folder";
  } | null>(null);
  const [movePos, setMovePos] = useState<{ top: number; right: number } | null>(
    null
  );
  function openMoveMenu(
    id: string,
    kind: "file" | "folder",
    e: MouseEvent<HTMLButtonElement>
  ) {
    if (moveMenu?.id === id) {
      setMoveMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMovePos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMoveMenu({ id, kind });
  }
  const canFileMove = canMoveRegular || canDeepSelect;

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

  // Snapshot the selection for the archive modal at the moment it opens.
  const [archiveBody, setArchiveBody] = useState<Record<string, unknown>>({});
  function openArchive() {
    setArchiveBody(payload());
    setArchiveOpen(true);
  }

  async function unselectDeep(id: string) {
    if (!endpoints.deepUnselect) return;
    setBusy(true);
    const res = await fetch(endpoints.deepUnselect, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: [id] }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Could not update.");
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

  if (total === 0 && sharedRows.length === 0) {
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

          {canArchive && (
            <button
              type="button"
              onClick={openArchive}
              disabled={busy}
              className="rounded-md border border-blue-500/40 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
            >
              Move to Deep Storage
            </button>
          )}

          {canMoveRegular && (
            <button
              type="button"
              onClick={() => moveToRegular()}
              disabled={busy}
              className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              Move to Regular storage
            </button>
          )}

          {canDeepSelect && (
            <button
              type="button"
              onClick={() => moveToDeep()}
              disabled={busy}
              className="rounded-md border border-blue-500/40 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
            >
              Move to Deep Storage
            </button>
          )}

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
              {showExpiry && <th className="px-4 py-3 font-medium">Expires</th>}
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {/* Studio deliveries as folder-style rows (Temporary tier) */}
            {sharedRows.map((sr) => (
              <tr
                key={`shared-${sr.id}`}
                className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3">
                  <Link
                    href={`/portal/shared/${sr.id}`}
                    className="font-medium hover:underline"
                  >
                    📁 {sr.name}
                  </Link>
                  <span className="ml-2 text-xs text-black/40 dark:text-white/40">
                    shared · {sr.fileCount} file(s)
                  </span>
                  {sr.allSelected && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
                      Selected for deep storage
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{formatBytes(sr.sizeBytes)}</td>
                <td className="px-4 py-3 text-black/40 dark:text-white/40">—</td>
                {showExpiry && (
                  <td className="px-4 py-3 text-black/40 dark:text-white/40">
                    varies
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={`/portal/shared/${sr.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    <TempStorageMove
                      studioSpace={sr.id}
                      studioName={sr.name}
                      canImport={canImport}
                    />
                  </div>
                </td>
              </tr>
            ))}
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
                    href={folderLink(fld.id)}
                    className="font-medium hover:underline"
                  >
                    📁 {fld.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {fld.sizeBytes ? formatBytes(fld.sizeBytes) : "—"}
                </td>
                <td className="px-4 py-3 text-black/60 dark:text-white/60">
                  {formatDate(fld.createdAt)}
                </td>
                {showExpiry && (
                  <td className="px-4 py-3 text-black/40 dark:text-white/40">—</td>
                )}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      href={folderLink(fld.id)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    {canFileMove && (
                      <button
                        type="button"
                        onClick={(e) => openMoveMenu(fld.id, "folder", e)}
                        disabled={busy}
                        className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Move
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteOneFolder(fld.id, fld.name)}
                      disabled={busy}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
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
                <td className="px-4 py-3">
                  {f.filename}
                  {f.deepTag === "selected" && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
                      Selected for deep storage
                      <button
                        type="button"
                        onClick={() => unselectDeep(f.id)}
                        disabled={busy}
                        aria-label="Remove from Deep Storage selection"
                        className="font-semibold hover:opacity-70 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {f.deepTag === "moved" && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-black/15 px-2 py-0.5 text-xs text-black/50 dark:border-white/20 dark:text-white/50">
                      Moved to deep
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{formatBytes(f.size)}</td>
                <td className="px-4 py-3 text-black/60 dark:text-white/60">
                  {formatDate(f.createdAt)}
                </td>
                {showExpiry &&
                  (() => {
                    const d = daysLeft(f.createdAt);
                    return (
                      <td
                        className={`px-4 py-3 ${
                          d <= 3 ? "text-red-600" : "text-black/60 dark:text-white/60"
                        }`}
                      >
                        {d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"} left`}
                      </td>
                    );
                  })()}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <a
                      href={`/api/files/${f.id}/download`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View
                    </a>
                    {canFileMove && (
                      <button
                        type="button"
                        onClick={(e) => openMoveMenu(f.id, "file", e)}
                        disabled={busy}
                        className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Move
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteOneFile(f.id, f.filename)}
                      disabled={busy}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Shared Move popup for a single file/folder row */}
      {moveMenu && movePos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoveMenu(null)} />
          <div
            style={{ position: "fixed", top: movePos.top, right: movePos.right }}
            className="z-50 w-56 rounded-md border border-black/10 bg-background p-1 text-left shadow-lg dark:border-white/15"
          >
            {canMoveRegular && (
              <button
                type="button"
                onClick={() =>
                  moveToRegular(
                    moveMenu.kind === "file"
                      ? { fileIds: [moveMenu.id] }
                      : { folderIds: [moveMenu.id] }
                  )
                }
                disabled={busy}
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
              >
                Move to Regular storage
              </button>
            )}
            {canDeepSelect && (
              <button
                type="button"
                onClick={() =>
                  moveToDeep(
                    moveMenu.kind === "file"
                      ? { fileIds: [moveMenu.id] }
                      : { folderIds: [moveMenu.id] }
                  )
                }
                disabled={busy}
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
              >
                Move to Deep Storage
              </button>
            )}
          </div>
        </>
      )}

      {/* Move to Deep Storage — shared modal (studio direct archive) */}
      {archiveOpen && canArchive && (
        <DeepArchiveModal
          quoteUrl={endpoints.archiveQuote as string}
          finalizeUrl={endpoints.archiveCreate as string}
          body={archiveBody}
          currency={currency}
          subtitle="Minimum 5 GB. Retrieving later takes up to 48 hours and is billed separately."
          onClose={() => setArchiveOpen(false)}
          onDone={clearSelection}
        />
      )}
    </div>
  );
}
