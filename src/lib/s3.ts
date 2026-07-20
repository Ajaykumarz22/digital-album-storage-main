import { S3Client } from "@aws-sdk/client-s3";

function normalizeEndpoint(raw: string | undefined): string {
  if (!raw) throw new Error("Missing S3_ENDPOINT in .env.local");
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

export const S3_BUCKET = process.env.S3_BUCKET as string;

if (!S3_BUCKET) {
  throw new Error("Missing S3_BUCKET in .env.local");
}

// One shared client for talking to iDrive e2 (S3-compatible).
export const s3 = new S3Client({
  endpoint: normalizeEndpoint(process.env.S3_ENDPOINT),
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
  },
});

// Sanitize a filename so it is safe to use inside a storage key.
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
}

// Every file lives under a strict per-tenant path so one customer's data can
// never collide with or be reached from another's:
//   studio-<studioId>/customer-<customerId>/<timestamp>-<random>-<filename>
export function buildObjectKey(
  studioId: string,
  customerId: string,
  filename: string,
  uniquePart: string
): string {
  return `studio-${studioId}/customer-${customerId}/${uniquePart}-${safeName(
    filename
  )}`;
}

// A customer's own private drive lives under its own namespace, keyed by email.
export function buildUserObjectKey(
  ownerEmail: string,
  filename: string,
  uniquePart: string
): string {
  const safeEmail = ownerEmail.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `user-${safeEmail}/${uniquePart}-${safeName(filename)}`;
}
