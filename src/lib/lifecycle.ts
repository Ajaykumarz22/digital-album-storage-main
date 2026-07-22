// How long a studio-shared ("Temporary Storage") file stays live before it is
// auto-deleted. Per-file: measured from each file's own upload date.
export const TEMP_STORAGE_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

// When a file uploaded at `createdAt` expires.
export function expiresAt(createdAt: Date | string): Date {
  const t = new Date(createdAt).getTime();
  return new Date(t + TEMP_STORAGE_DAYS * DAY_MS);
}

// Whole days remaining until expiry (0 = expires today; never negative).
export function daysLeft(createdAt: Date | string, now: Date = new Date()): number {
  const ms = expiresAt(createdAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / DAY_MS));
}
