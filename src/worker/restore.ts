import { Job } from "bullmq";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { awsS3, AWS_ARCHIVE_BUCKET } from "../lib/aws";
import { restoreQueue, type RestoreJob } from "../lib/queue";
import { RESTORE_AVAILABLE_DAYS } from "../lib/archivePricing";
import { ArchiveModel } from "../models/Archive";

// How often to re-check a thaw in progress. Deep Archive restores take 12-48h,
// so a 15-minute poll is plenty. (In production an S3 event → SNS webhook could
// replace this polling; polling is used here so it works without a public URL.)
const POLL_DELAY_MS = 15 * 60 * 1000;

export async function processRestore(job: Job<RestoreJob>): Promise<void> {
  const { archiveId } = job.data;
  const archive = await ArchiveModel.findById(archiveId);
  if (!archive) return;
  if (archive.status !== "restoring") return; // cancelled / already handled

  let restoreHeader = "";
  try {
    const head = await awsS3.send(
      new HeadObjectCommand({
        Bucket: AWS_ARCHIVE_BUCKET,
        Key: archive.bucketKey,
      })
    );
    restoreHeader = head.Restore || "";
  } catch (e) {
    console.warn(`[restore] head failed for ${archiveId}: ${(e as Error).message}`);
    await requeue(archiveId);
    return;
  }

  // x-amz-restore is 'ongoing-request="true"' while thawing, then
  // 'ongoing-request="false", expiry-date="..."' once the copy is ready.
  const done = /ongoing-request="false"/.test(restoreHeader);
  if (done) {
    const until = new Date();
    until.setDate(until.getDate() + RESTORE_AVAILABLE_DAYS);
    archive.status = "available";
    archive.set("restore.availableUntil", until);
    await archive.save();
    console.log(`[restore] ${archiveId} AVAILABLE until ${until.toISOString()}`);
    return;
  }

  console.log(`[restore] ${archiveId} still thawing — re-checking in 15m`);
  await requeue(archiveId);
}

function requeue(archiveId: string) {
  return restoreQueue.add(
    "check",
    { archiveId },
    { delay: POLL_DELAY_MS, removeOnComplete: true, removeOnFail: true }
  );
}
