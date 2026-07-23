// Human-readable byte size: MB up to 1 GB, GB up to 1 TB, then TB.
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deterministic date (UTC) to avoid server/client hydration mismatches.
// Accepts an ISO string or Date; returns "-" for empty values.
export function formatDate(d: unknown): string {
  if (!d) return "-";
  const x = new Date(d as string);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`;
}
