import { S3Client } from "@aws-sdk/client-s3";

// The AWS S3 bucket that holds FROZEN archives (Glacier Deep Archive storage
// class). This is SEPARATE from the iDrive e2 client in src/lib/s3.ts:
//   - iDrive (s3.ts)  = HOT tier, active uploads, $0 egress, instant access.
//   - AWS   (aws.ts)  = COLD tier, long-term archives, 12-48h to restore.
export const AWS_ARCHIVE_BUCKET = process.env.AWS_S3_ARCHIVE_BUCKET as string;

if (!AWS_ARCHIVE_BUCKET) {
  throw new Error("Missing AWS_S3_ARCHIVE_BUCKET in .env.local");
}

// The storage class every archived object is written with. This is what makes
// storage cost ~$0.99/TB/mo (and access slow + paid). Set at PutObject time.
export const DEEP_ARCHIVE = "DEEP_ARCHIVE" as const;

// One shared client for talking to AWS S3 (real AWS, not S3-compatible).
export const awsS3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Every archive is a single .zip object living under its owner's namespace,
// keyed by the stable internal Account id (not email):
//   archives/user-<accountId>/<archiveId>.zip
// One Archive document == one object in Deep Archive.
export function buildArchiveKey(ownerId: string, archiveId: string): string {
  return `archives/user-${safeId(ownerId)}/${archiveId}.zip`;
}

// Studio-owned archives mirror the delivery namespace (stable studio/customer
// ids): archives/studio-<studioId>/customer-<customerId>/<archiveId>.zip
export function buildStudioArchiveKey(
  studioId: string,
  customerId: string,
  archiveId: string
): string {
  return `archives/studio-${safeId(studioId)}/customer-${safeId(
    customerId
  )}/${archiveId}.zip`;
}
