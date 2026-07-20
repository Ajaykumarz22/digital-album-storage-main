"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddToDriveButton({
  studioSpaceId,
  canImport,
}: {
  studioSpaceId: string;
  canImport: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!canImport) {
      alert("Choose a storage plan first to save these files to My Drive.");
      return;
    }
    const name = window.prompt(
      "Folder name for these files in your My Drive:"
    );
    if (!name || !name.trim()) return;

    setBusy(true);
    const res = await fetch("/api/portal/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioSpace: studioSpaceId, name: name.trim() }),
    });
    setBusy(false);

    if (res.ok) {
      const data = await res.json();
      alert(`Added ${data.copied ?? 0} file(s) to My Drive.`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not add to My Drive.");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="font-medium text-blue-600 hover:underline disabled:opacity-50"
    >
      {busy ? "Adding…" : "Add to My Drive"}
    </button>
  );
}
