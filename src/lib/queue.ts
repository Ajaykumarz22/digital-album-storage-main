import { Queue } from "bullmq";
import IORedis from "ioredis";

// Redis backs the job queue. Local dev uses Homebrew Redis on the default port;
// production overrides REDIS_URL.
export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Queue names shared between the producer (Next.js API routes add jobs) and the
// consumer (the worker process in src/worker processes them).
export const ARCHIVE_QUEUE = "archive";
export const THUMBNAIL_QUEUE = "thumbnail";
export const RESTORE_QUEUE = "restore";
export const SWEEP_QUEUE = "sweep";

// Job payload shapes.
export type ArchiveJob = { archiveId: string };
export type ThumbnailJob = { fileId: string };
export type RestoreJob = { archiveId: string };
export type SweepJob = Record<string, never>; // scheduled maintenance, no payload

// A fresh Redis connection. WORKERS must each get their own (they issue blocking
// commands that would tie up a shared connection); producers can share one.
export function createConnection(): IORedis {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

// Cache the producer-side connection + queues on the global object so Next.js
// hot-reloads in dev don't open a new Redis connection every time (same trick
// as the Mongoose cache in mongodb.ts).
type QueueCache = {
  connection: IORedis;
  archiveQueue: Queue<ArchiveJob>;
  thumbnailQueue: Queue<ThumbnailJob>;
  restoreQueue: Queue<RestoreJob>;
  sweepQueue: Queue<SweepJob>;
};

const globalWithQueues = global as typeof globalThis & { _queues?: QueueCache };

function buildQueues(): QueueCache {
  const connection = createConnection();
  return {
    connection,
    archiveQueue: new Queue<ArchiveJob>(ARCHIVE_QUEUE, { connection }),
    thumbnailQueue: new Queue<ThumbnailJob>(THUMBNAIL_QUEUE, { connection }),
    restoreQueue: new Queue<RestoreJob>(RESTORE_QUEUE, { connection }),
    sweepQueue: new Queue<SweepJob>(SWEEP_QUEUE, { connection }),
  };
}

const cache = globalWithQueues._queues ?? buildQueues();
globalWithQueues._queues = cache;

export const archiveQueue = cache.archiveQueue;
export const thumbnailQueue = cache.thumbnailQueue;
export const restoreQueue = cache.restoreQueue;
export const sweepQueue = cache.sweepQueue;
