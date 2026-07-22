"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

export type SharedFile = {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
  folderPath: string;
  deepTag?: "selected" | "moved" | null;
};
export type ExpiryGroup = { days: number; label: string; urgent: boolean; files: SharedFile[] };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
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

// Shared files grouped by days-left, with per-file/bulk actions to move them to
// Regular storage or Deep Storage. "Move" pulls files out of here immediately.
export default function SharedFileGroups({
  groups,
  studioSpace,
  canImport,
  locked,
}: {
  groups: ExpiryGroup[];
  studioSpace: string;
  canImport: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // The per-file "Move" popup: which file's menu is open (null = none), and
  // where to render it (fixed, so it escapes the table's overflow clipping).
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
      alert("Choose a storage plan first to move files to Regular storage.");
      return;
    }
    await run("/api/portal/import-files", { studioSpace, fileIds });
  }
  async function moveToDeep(fileIds: string[]) {
    await run("/api/portal/deep-cart/add", { studioSpace, fileIds });
  }
  async function unselectDeep(fileIds: string[]) {
    await run("/api/portal/deep-cart/remove", { fileIds });
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
            Move to Regular storage
          </button>
          <button
            type="button"
            onClick={() => moveToDeep(selected)}
            disabled={busy}
            className="rounded-md border border-blue-500/40 px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
          >
            Move to Deep Storage
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
          <h2 className={`mb-3 text-lg font-semibold ${g.urgent ? "text-red-600" : ""}`}>
            {g.label}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Shared on</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {g.files.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={sel.has(f.id)}
                        onChange={() => toggle(f.id)}
                        aria-label={`Select ${f.filename}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {f.filename}
                        {f.deepTag === "selected" && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">
                            Selected for deep storage
                            <button
                              type="button"
                              onClick={() => unselectDeep([f.id])}
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
                      </div>
                      {f.folderPath && (
                        <div className="text-xs text-black/40 dark:text-white/40">
                          📁 {f.folderPath}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 text-black/60 dark:text-white/60">
                      {formatDate(f.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {locked ? (
                        <span className="text-black/40 dark:text-white/40">Locked</span>
                      ) : (
                        <div className="relative inline-flex items-center gap-4">
                          <a
                            href={`/api/files/${f.id}/download`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={(e) => openMenu(f.id, e)}
                            disabled={busy}
                            className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Move
                          </button>
                          {menuFor === f.id && menuPos && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuFor(null)}
                              />
                              <div
                                style={{
                                  position: "fixed",
                                  top: menuPos.top,
                                  right: menuPos.right,
                                }}
                                className="z-50 w-56 rounded-md border border-black/10 bg-background p-1 text-left shadow-lg dark:border-white/15"
                              >
                                <button
                                  type="button"
                                  onClick={() => moveToRegular([f.id])}
                                  disabled={busy}
                                  className="block w-full rounded px-3 py-2 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                                >
                                  Move to Regular storage
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveToDeep([f.id])}
                                  disabled={busy}
                                  className="block w-full rounded px-3 py-2 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                                >
                                  Move to Deep Storage
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
