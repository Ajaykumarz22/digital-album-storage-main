"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The per-studio-row "Move" popup in Temporary Storage. Moves that studio's
// WHOLE delivery to Regular storage or Deep Storage (Payment Pending).
export default function TempStorageMove({
  studioSpace,
  studioName,
  canImport,
}: {
  studioSpace: string;
  studioName: string;
  canImport: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  }

  async function moveToRegular() {
    if (!canImport) {
      alert("Choose a storage plan first to move files to Regular storage.");
      return;
    }
    const name = window.prompt("Folder name in Regular storage", studioName);
    if (!name || !name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/portal/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioSpace, name: name.trim() }),
    });
    setBusy(false);
    setOpen(false);
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Moved ${j.copied ?? ""} file(s) to Regular storage.`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move.");
    }
  }

  async function moveToDeep() {
    if (
      !window.confirm(
        `Move all of ${studioName}'s files to Deep Storage? They'll wait in your Payment Pending list.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch("/api/portal/deep-cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioSpace }),
    });
    setBusy(false);
    setOpen(false);
    if (res.ok) {
      alert(
        "All files tagged “Selected for deep storage” — pay in your Payment Pending list to freeze them."
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not move.");
    }
  }

  return (
    <span className="inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={busy}
        className="font-medium text-blue-600 hover:underline disabled:opacity-50"
      >
        Move
      </button>
      {open && pos && (
        <>
          {/* transparent backdrop to catch outside clicks */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 w-56 rounded-md border border-black/10 bg-background p-1 text-left shadow-lg dark:border-white/15"
          >
            <button
              type="button"
              onClick={moveToRegular}
              disabled={busy}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
            >
              Move to Regular storage
            </button>
            <button
              type="button"
              onClick={moveToDeep}
              disabled={busy}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
            >
              Move to Deep Storage
            </button>
          </div>
        </>
      )}
    </span>
  );
}
