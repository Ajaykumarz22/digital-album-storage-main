"use client";

import Link from "next/link";
import { formatBytes, formatDate } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import DeepArchiveModal from "@/components/archives/DeepArchiveModal";
import { daysLeft } from "@/lib/lifecycle";
import { FolderGlyph, FileGlyph, KebabButton } from "@/components/files/rowUi";

// A studio delivery shown as a folder-style row inside Temporary Storage.
type SharedRow = {
  id: string;
  name: string;
  fileCount: number;
  sizeBytes: number;
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
  selectable = true,
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
    // Customer side: tag selection for Cold Drive / untag it.
    deepSelect?: string;
    deepUnselect?: string;
    // Temporary tier: move selection into paid Hot drive.
    moveToRegular?: string;
    // Studio-shared deliveries: copy the whole delivery into Hot drive.
    importShared?: string;
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
  // Whether the user can copy shared files to Hot drive (has quota).
  canImport?: boolean;
  // Multi-select checkboxes + bulk toolbar. Off for My Uploads (uses the
  // top "Actions" dropdown + per-row ⋮ menu instead).
  selectable?: boolean;
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

  // "Move to Cold Drive" modal state (studio side = direct archive).
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
    setRowMenu(null);
    if (res.ok) {
      if (!ov) clearSelection();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move to Hot drive.");
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
    setRowMenu(null);
    if (res.ok) {
      if (!ov) clearSelection();
      alert(
        "Tagged for Cold Drive. They stay here, marked “Selected for cold drive”, and appear in your Payment Pending list — pay there to freeze them."
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move to Cold Drive.");
    }
  }
  const [archiveOpen, setArchiveOpen] = useState(false);
  // One per-row actions menu (⋮), fixed-positioned so it escapes the table's
  // overflow clipping. Holds everything the menu needs to act on that row.
  type RowMenu = {
    id: string;
    kind: "file" | "folder" | "shared";
    name: string;
    viewHref: string;
  };
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  function openRowMenu(row: RowMenu, e: MouseEvent<HTMLButtonElement>) {
    if (rowMenu?.id === row.id) {
      setRowMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setRowMenu(row);
  }

  // ----- Studio-shared delivery actions (act on the WHOLE delivery) -----
  const canImportShared = Boolean(endpoints.importShared);
  async function sharedMoveToRegular(studioSpace: string, studioName: string) {
    if (!canImport) {
      alert("Choose a storage plan first to move files to Hot drive.");
      return;
    }
    const name = window.prompt("Folder name in Hot drive", studioName);
    if (!name || !name.trim()) return;
    setBusy(true);
    const res = await fetch(endpoints.importShared as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioSpace, name: name.trim() }),
    });
    setBusy(false);
    setRowMenu(null);
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Moved ${j.copied ?? ""} file(s) to Hot drive.`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move.");
    }
  }
  async function sharedMoveToDeep(studioSpace: string, studioName: string) {
    if (
      !window.confirm(
        `Move all of ${studioName}'s files to Cold Drive? They'll wait in your Payment Pending list.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(endpoints.deepSelect as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioSpace }),
    });
    setBusy(false);
    setRowMenu(null);
    if (res.ok) {
      alert(
        "All files tagged “Selected for cold drive” — pay in your Payment Pending list to freeze them."
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move.");
    }
  }

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
      {selectable && selectedCount > 0 && (
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
              Move to Cold Drive
            </button>
          )}

          {canMoveRegular && (
            <button
              type="button"
              onClick={() => moveToRegular()}
              disabled={busy}
              className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              Move to Hot drive
            </button>
          )}

          {canDeepSelect && (
            <button
              type="button"
              onClick={() => moveToDeep()}
              disabled={busy}
              className="rounded-md border border-blue-500/40 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
            >
              Move to Cold Drive
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

      <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        {/* Select-all header */}
        <div className="flex items-center gap-3 border-b border-black/10 px-3 py-2 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
          {selectable && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all"
              className="h-4 w-4 shrink-0"
            />
          )}
          <span>
            {total} item{total === 1 ? "" : "s"}
            {sharedRows.length > 0 && ` · ${sharedRows.length} shared`}
          </span>
        </div>

        {/* Studio deliveries */}
        {sharedRows.map((sr) => (
          <div
            key={`shared-${sr.id}`}
            className="flex items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
          >
            {selectable && <span className="w-4 shrink-0" />}
            <FolderGlyph />
            <div className="min-w-0 flex-1">
              <Link
                href={`/portal/shared/${sr.id}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {sr.name}
              </Link>
              <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                {formatBytes(sr.sizeBytes)} · shared · {sr.fileCount} file
                {sr.fileCount === 1 ? "" : "s"}
                {showExpiry && " · varies"}
              </div>
            </div>
            <KebabButton
              label={`Actions for ${sr.name}`}
              disabled={busy}
              onClick={(e) =>
                openRowMenu(
                  {
                    id: sr.id,
                    kind: "shared",
                    name: sr.name,
                    viewHref: `/portal/shared/${sr.id}`,
                  },
                  e
                )
              }
            />
          </div>
        ))}

        {/* Folders */}
        {folders.map((fld) => (
          <div
            key={fld.id}
            className="flex items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
          >
            {selectable && (
              <input
                type="checkbox"
                checked={selFolders.has(fld.id)}
                onChange={() => toggleFolder(fld.id)}
                aria-label={`Select folder ${fld.name}`}
                className="h-4 w-4 shrink-0"
              />
            )}
            <FolderGlyph />
            <div className="min-w-0 flex-1">
              <Link
                href={folderLink(fld.id)}
                className="block truncate text-sm font-medium hover:underline"
              >
                {fld.name}
              </Link>
              <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                {fld.sizeBytes ? formatBytes(fld.sizeBytes) : "—"} ·{" "}
                {formatDate(fld.createdAt)}
              </div>
            </div>
            <KebabButton
              label={`Actions for ${fld.name}`}
              disabled={busy}
              onClick={(e) =>
                openRowMenu(
                  {
                    id: fld.id,
                    kind: "folder",
                    name: fld.name,
                    viewHref: folderLink(fld.id),
                  },
                  e
                )
              }
            />
          </div>
        ))}

        {/* Files */}
        {files.map((f) => {
          const d = showExpiry ? daysLeft(f.createdAt) : null;
          return (
            <div
              key={f.id}
              className="flex items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
            >
              {selectable && (
                <input
                  type="checkbox"
                  checked={selFiles.has(f.id)}
                  onChange={() => toggleFile(f.id)}
                  aria-label={`Select file ${f.filename}`}
                  className="h-4 w-4 shrink-0"
                />
              )}
              <FileGlyph />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm">{f.filename}</span>
                  {f.deepTag === "selected" && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
                      Selected for cold drive
                      <button
                        type="button"
                        onClick={() => unselectDeep(f.id)}
                        disabled={busy}
                        aria-label="Remove from Cold Drive selection"
                        className="font-semibold hover:opacity-70 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {f.deepTag === "moved" && (
                    <span className="shrink-0 rounded-full border border-black/15 px-2 py-0.5 text-xs text-black/50 dark:border-white/20 dark:text-white/50">
                      Moved to cold
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                  {formatBytes(f.size)}
                  {d !== null ? (
                    <>
                      {" · "}
                      <span className={d <= 3 ? "text-red-600" : ""}>
                        {d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"} left`}
                      </span>
                    </>
                  ) : (
                    ` · ${formatDate(f.createdAt)}`
                  )}
                </div>
              </div>
              <KebabButton
                label={`Actions for ${f.filename}`}
                disabled={busy}
                onClick={(e) =>
                  openRowMenu(
                    {
                      id: f.id,
                      kind: "file",
                      name: f.filename,
                      viewHref: `/api/files/${f.id}/download`,
                    },
                    e
                  )
                }
              />
            </div>
          );
        })}
      </div>

      {/* Per-row actions menu (⋮): View / Move / Delete */}
      {rowMenu && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 w-52 rounded-md border border-black/10 bg-background p-1 text-left shadow-lg dark:border-white/15"
          >
            {rowMenu.kind === "file" ? (
              <a
                href={rowMenu.viewHref}
                onClick={() => setRowMenu(null)}
                className="block rounded px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                View
              </a>
            ) : (
              <Link
                href={rowMenu.viewHref}
                onClick={() => setRowMenu(null)}
                className="block rounded px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                View
              </Link>
            )}

            {rowMenu.kind === "shared" ? (
              <>
                {canImportShared && (
                  <button
                    type="button"
                    onClick={() =>
                      sharedMoveToRegular(rowMenu.id, rowMenu.name)
                    }
                    disabled={busy}
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                  >
                    Move to Hot drive
                  </button>
                )}
                {canDeepSelect && (
                  <button
                    type="button"
                    onClick={() => sharedMoveToDeep(rowMenu.id, rowMenu.name)}
                    disabled={busy}
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                  >
                    Move to Cold Drive
                  </button>
                )}
              </>
            ) : (
              <>
                {canMoveRegular && (
                  <button
                    type="button"
                    onClick={() =>
                      moveToRegular(
                        rowMenu.kind === "file"
                          ? { fileIds: [rowMenu.id] }
                          : { folderIds: [rowMenu.id] }
                      )
                    }
                    disabled={busy}
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                  >
                    Move to Hot drive
                  </button>
                )}
                {canDeepSelect && (
                  <button
                    type="button"
                    onClick={() =>
                      moveToDeep(
                        rowMenu.kind === "file"
                          ? { fileIds: [rowMenu.id] }
                          : { folderIds: [rowMenu.id] }
                      )
                    }
                    disabled={busy}
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                  >
                    Move to Cold Drive
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const { id, kind, name } = rowMenu;
                    setRowMenu(null);
                    if (kind === "file") deleteOneFile(id, name);
                    else deleteOneFolder(id, name);
                  }}
                  disabled={busy}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Move to Cold Drive — shared modal (studio direct archive) */}
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
