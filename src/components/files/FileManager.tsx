"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type UploadItem = {
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

// A single file to upload, plus the folder path (relative to the current
// folder) it should end up in.
type PlannedFile = { file: File; relPath: string[] };

function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

// Read every entry from a directory reader (it returns in batches).
function readAllEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const read = () =>
      reader.readEntries((entries) => {
        if (entries.length === 0) resolve(all);
        else {
          all.push(...entries);
          read();
        }
      }, reject);
    read();
  });
}

function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

// Walk a dropped entry (file or directory) into a flat list of planned files.
async function collectEntry(
  entry: FileSystemEntry,
  prefix: string[],
  out: PlannedFile[]
): Promise<void> {
  if (entry.isFile) {
    const file = await getFile(entry as FileSystemFileEntry);
    out.push({ file, relPath: prefix });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await readAllEntries(reader);
    for (const child of entries) {
      await collectEntry(child, [...prefix, entry.name], out);
    }
  }
}

export type UploadEndpoints = {
  presign: string;
  confirm: string;
  folders: string;
};

export default function FileManager({
  currentFolderId,
  endpoints,
  baseBody = {},
  title,
  subtitle,
  moveAllRegularEndpoint,
  moveAllDeepEndpoint,
}: {
  currentFolderId: string | null;
  endpoints: UploadEndpoints;
  baseBody?: Record<string, unknown>;
  title?: string;
  subtitle?: string;
  // When set, the dropdown becomes an "Actions" menu with a "move ALL uploads"
  // item that POSTs here (auto-selects everything, no manual checkboxes).
  moveAllRegularEndpoint?: string;
  moveAllDeepEndpoint?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // "Move all uploads" confirm modal + its in-flight flag.
  const [confirm, setConfirm] = useState<
    | { title: string; body: string; endpoint: string; label: string }
    | null
  >(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hasBulkActions = Boolean(moveAllRegularEndpoint || moveAllDeepEndpoint);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Close the Upload menu on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // webkitdirectory/directory aren't in the React types, so set them directly.
  useEffect(() => {
    const el = folderInputRef.current;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
    }
  }, []);

  // Resolve a relative folder path into a folderId, creating folders as needed.
  // Cached so each folder is only created once per upload batch.
  async function resolvePath(
    relPath: string[],
    cache: Map<string, string | null>
  ): Promise<string | null> {
    let parentId: string | null = currentFolderId;
    let keySoFar = "";
    for (const name of relPath) {
      keySoFar += "/" + name;
      const cached = cache.get(keySoFar);
      if (cached !== undefined) {
        parentId = cached;
        continue;
      }
      const res = await fetch(endpoints.folders, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, parentId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create folder");
      parentId = data.folderId as string;
      cache.set(keySoFar, parentId);
    }
    return parentId;
  }

  async function uploadOne(
    file: File,
    folderId: string | null,
    index: number
  ) {
    const update = (patch: Partial<UploadItem>) =>
      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
      );
    try {
      const presignRes = await fetch(endpoints.presign, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseBody,
          folderId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error || "Could not start upload");

      await putWithProgress(presign.url, file, (pct) => update({ progress: pct }));

      const confirmRes = await fetch(endpoints.confirm, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: presign.fileId }),
      });
      if (!confirmRes.ok) {
        const c = await confirmRes.json();
        throw new Error(c.error || "Could not confirm upload");
      }
      update({ progress: 100, status: "done" });
    } catch (e) {
      update({ status: "error", error: (e as Error).message });
    }
  }

  async function runUploads(planned: PlannedFile[]) {
    if (planned.length === 0) return;
    setItems(
      planned.map((p) => ({
        name: [...p.relPath, p.file.name].join("/"),
        progress: 0,
        status: "uploading",
      }))
    );
    setBusy(true);

    const folderCache = new Map<string, string | null>();
    for (let i = 0; i < planned.length; i++) {
      try {
        const folderId = await resolvePath(planned[i].relPath, folderCache);
        await uploadOne(planned[i].file, folderId, i);
      } catch (e) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "error", error: (e as Error).message }
              : it
          )
        );
      }
    }

    setBusy(false);
    router.refresh();
  }

  // --- Drag & drop (supports files and folders) ---
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;

    // Capture entries synchronously before the event data is cleared.
    const roots: FileSystemEntry[] = [];
    const plainFiles: File[] = [];
    const dtItems = e.dataTransfer.items;
    if (dtItems && dtItems.length) {
      for (let i = 0; i < dtItems.length; i++) {
        const entry = dtItems[i].webkitGetAsEntry?.();
        if (entry) roots.push(entry);
      }
    }
    if (roots.length === 0) {
      // Fallback for browsers without entry support.
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        plainFiles.push(e.dataTransfer.files[i]);
      }
    }

    const planned: PlannedFile[] = [];
    for (const entry of roots) await collectEntry(entry, [], planned);
    for (const f of plainFiles) planned.push({ file: f, relPath: [] });

    await runUploads(planned);
  }

  // --- "Upload files" button (multiple, into current folder) ---
  function onFilesChosen(list: FileList | null) {
    if (!list) return;
    const planned = Array.from(list).map((file) => ({ file, relPath: [] }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    runUploads(planned);
  }

  // --- "Upload folder" button (recreates structure from relative paths) ---
  function onFolderChosen(list: FileList | null) {
    if (!list) return;
    const planned = Array.from(list).map((file) => {
      const rel = (file as File & { webkitRelativePath?: string })
        .webkitRelativePath;
      const parts = rel ? rel.split("/") : [file.name];
      return { file, relPath: parts.slice(0, -1) }; // drop the filename
    });
    if (folderInputRef.current) folderInputRef.current.value = "";
    runUploads(planned);
  }

  async function onNewFolder() {
    const name = window.prompt("New folder name");
    if (!name || !name.trim()) return;
    const res = await fetch(endpoints.folders, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...baseBody,
        parentId: currentFolderId,
        name: name.trim(),
      }),
    });
    if (res.ok) router.refresh();
    else {
      const j = await res.json();
      alert(j.error || "Could not create folder");
    }
  }

  // Run a "move ALL uploads" action (confirmed via the modal).
  async function runMoveAll(endpoint: string, label: string) {
    setActionBusy(true);
    const res = await fetch(endpoint, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setActionBusy(false);
    setConfirm(null);
    if (!res.ok) {
      alert(j.error || `Could not move to ${label}.`);
      return;
    }
    if (!j.moved && !j.selected) {
      alert("Nothing to move - upload some files first.");
      return;
    }
    setToast(
      label === "Cold Drive"
        ? "Payment pending - review & pay on the Cold Drive tab."
        : `Moved to ${label}.`
    );
    router.refresh();
  }

  const uploadMenu = (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={busy}
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Uploading…" : hasBulkActions ? "Actions" : "Upload"}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-md border border-black/10 bg-background py-1 shadow-lg dark:border-white/10"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              fileInputRef.current?.click();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Upload files
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              folderInputRef.current?.click();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Upload folder
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onNewFolder();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            New folder
          </button>

          {hasBulkActions && (
            <div className="my-1 border-t border-black/10 dark:border-white/10" />
          )}

          {moveAllRegularEndpoint && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirm({
                  title: "Move all uploads to Hot drive?",
                  body: "Every file in My uploads will be moved into your paid Hot drive. This uses your purchased quota.",
                  endpoint: moveAllRegularEndpoint,
                  label: "Hot drive",
                });
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              Move to Hot drive
            </button>
          )}
          {moveAllDeepEndpoint && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setConfirm({
                  title: "Move all uploads to Cold Drive?",
                  body: "Every file in My uploads will be selected for Cold Drive and moved to the payment step. You can review and pay on the Cold Drive tab. Nothing is charged yet.",
                  endpoint: moveAllDeepEndpoint,
                  label: "Cold Drive",
                });
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              Move to Cold Drive
            </button>
          )}
        </div>
      )}

      {/* Hidden inputs triggered by the menu items */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => onFilesChosen(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        disabled={busy}
        onChange={(e) => onFolderChosen(e.target.files)}
      />
    </div>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-3">{uploadMenu}</div>
  );

  return (
    <div>
      {title ? (
        <div className="mb-3 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">{title}</h1>
            {controls}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              {subtitle}
            </p>
          )}
        </div>
      ) : (
        controls
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mt-4 hidden rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors sm:block ${
          dragOver
            ? "border-blue-500 bg-blue-500/5"
            : "border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
        }`}
      >
        Drag & drop files or folders here to upload
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{it.name}</span>
                <span
                  className={
                    it.status === "error"
                      ? "shrink-0 text-red-600"
                      : it.status === "done"
                        ? "shrink-0 text-green-600"
                        : "shrink-0 text-black/50 dark:text-white/50"
                  }
                >
                  {it.status === "error"
                    ? it.error
                    : it.status === "done"
                      ? "Done"
                      : `${it.progress}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-black/10 dark:bg-white/10">
                <div
                  className={`h-full ${it.status === "error" ? "bg-red-500" : "bg-green-500"}`}
                  style={{ width: `${it.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !actionBusy && setConfirm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-black/10 bg-background p-6 shadow-xl dark:border-white/10"
          >
            <h2 className="text-lg font-semibold">{confirm.title}</h2>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              {confirm.body}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirm(null)}
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => runMoveAll(confirm.endpoint, confirm.label)}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {actionBusy ? "Moving…" : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="status"
            className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg"
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
