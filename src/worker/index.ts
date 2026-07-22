import { Worker, Job } from "bullmq";
import {
  ARCHIVE_QUEUE,
  THUMBNAIL_QUEUE,
  RESTORE_QUEUE,
  SWEEP_QUEUE,
  createConnection,
  sweepQueue,
  type ArchiveJob,
  type ThumbnailJob,
  type RestoreJob,
} from "../lib/queue";
import { connectToDatabase } from "../lib/mongodb";
import { processArchive } from "./archive";
import { processRestore } from "./restore";
import { processSweep } from "./sweep";

// The background worker. Runs as its OWN long-lived process (not inside
// Next.js), because it streams multi-GB files and runs jobs far longer than any
// serverless/API timeout allows. Start it with:  npm run worker
async function main() {
  await connectToDatabase();
  console.log("[worker] connected to MongoDB");

  // Door A/B: stream files out of iDrive, zip on the fly, push into Deep
  // Archive, then delete the hot originals.
  const archiveWorker = new Worker<ArchiveJob>(
    ARCHIVE_QUEUE,
    async (job: Job<ArchiveJob>) => {
      console.log(`[archive] job ${job.id}`, job.data);
      await processArchive(job);
    },
    { connection: createConnection(), concurrency: 2 }
  );

  // Poll AWS for Deep Archive restore ("thaw") completion, then mark the
  // archive downloadable.
  const restoreWorker = new Worker<RestoreJob>(
    RESTORE_QUEUE,
    async (job: Job<RestoreJob>) => {
      await processRestore(job);
    },
    { connection: createConnection(), concurrency: 4 }
  );

  // Sweep expired studio-shared files (per-file 15-day window).
  const sweepWorker = new Worker(
    SWEEP_QUEUE,
    async () => {
      await processSweep();
    },
    { connection: createConnection(), concurrency: 1 }
  );

  // Run the sweep hourly (a fixed jobId keeps a single repeatable schedule).
  await sweepQueue.add(
    "sweep",
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: "temp-storage-sweep",
      removeOnComplete: true,
      removeOnFail: true,
    }
  );

  // Generate a small preview so frozen galleries stay browsable. Real FFmpeg
  // logic lands in Phase 8.
  const thumbnailWorker = new Worker<ThumbnailJob>(
    THUMBNAIL_QUEUE,
    async (job: Job<ThumbnailJob>) => {
      console.log(`[thumbnail] job ${job.id}`, job.data);
      return { ok: true, stub: true };
    },
    { connection: createConnection(), concurrency: 4 }
  );

  for (const w of [archiveWorker, restoreWorker, sweepWorker, thumbnailWorker]) {
    w.on("completed", (job) => console.log(`[${w.name}] completed ${job.id}`));
    w.on("failed", (job, err) =>
      console.error(`[${w.name}] failed ${job?.id}: ${err.message}`)
    );
  }

  console.log(
    "[worker] listening on queues: archive, restore, sweep (hourly), thumbnail"
  );

  const shutdown = async () => {
    console.log("\n[worker] shutting down...");
    await Promise.all([
      archiveWorker.close(),
      restoreWorker.close(),
      sweepWorker.close(),
      thumbnailWorker.close(),
    ]);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
