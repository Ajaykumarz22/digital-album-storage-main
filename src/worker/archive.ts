import { PassThrough, type Readable } from "node:stream";
import mongoose from "mongoose";
import { Job } from "bullmq";
import { ZipArchive } from "archiver";
import {
  GetObjectCommand,
  DeleteObjectsCommand,
  S3Client,
  type StorageClass,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { s3, S3_BUCKET } from "../lib/s3";
import { awsS3, AWS_ARCHIVE_BUCKET, DEEP_ARCHIVE } from "../lib/aws";
import type { ArchiveJob } from "../lib/queue";
import { ArchiveModel } from "../models/Archive";
import { ArchiveItemModel } from "../models/ArchiveItem";
import { FileModel } from "../models/File";
import { Folder } from "../models/Folder";
import { Customer } from "../models/Customer";

type ManifestItem = {
  sourceKey: string | null;
  path: string;
  filename: string;
  size: number;
};

// Where a zip stream is written. Deep Archive in production; the test harness
// points this at iDrive so the resulting zip can be downloaded and verified.
type ZipTarget = {
  client: S3Client;
  bucket: string;
  key: string;
  storageClass?: StorageClass;
};

// Upload part sizing: 128MB parts, 2 in flight ≈ 256MB peak RAM, supports
// archives up to ~1.2TB (10000 parts). Raise partSize for larger bundles.
const PART_SIZE = 128 * 1024 * 1024;
const QUEUE_SIZE = 2;

export async function processArchive(job: Job<ArchiveJob>): Promise<void> {
  const { archiveId } = job.data;
  const archive = await ArchiveModel.findById(archiveId);
  if (!archive) {
    console.warn(`[archive] ${archiveId} not found — skipping`);
    return;
  }
  // Only process a paid archive; guards against double-runs / bad state.
  if (archive.status !== "paid") {
    console.warn(`[archive] ${archiveId} status=${archive.status} — skipping`);
    return;
  }

  archive.status = "archiving";
  await archive.save();

  const items = await ArchiveItemModel.find({ archiveId })
    .select("sourceKey path filename size")
    .lean<ManifestItem[]>();

  console.log(
    `[archive] ${archiveId} zipping ${items.length} files → ${archive.bucketKey}`
  );

  try {
    await streamZipTo(
      {
        client: awsS3,
        bucket: AWS_ARCHIVE_BUCKET,
        key: archive.bucketKey,
        storageClass: DEEP_ARCHIVE,
      },
      items
    );
  } catch (err) {
    archive.status = "failed";
    archive.error = err instanceof Error ? err.message : String(err);
    await archive.save();
    console.error(`[archive] ${archiveId} FAILED: ${archive.error}`);
    throw err; // BullMQ records the failure; hot originals are left intact
  }

  // Frozen safely. Remove the source files ONLY if this archive asked to
  // ("delete copies" / studio direct-archive). "Keep a copy" leaves them in
  // place (they were already tagged deepStatus "moved").
  const sourceKeys = items
    .map((i) => i.sourceKey)
    .filter((k): k is string => Boolean(k));

  if (archive.deleteSources !== false) {
    // Look up owners BEFORE deleting so we can free studio storage counters.
    const srcFiles = await FileModel.find({ key: { $in: sourceKeys } })
      .select("key size ownerType customerId")
      .lean<
        {
          key: string;
          size: number;
          ownerType: string;
          customerId: mongoose.Types.ObjectId | null;
        }[]
      >();

    await deleteFromIdrive(sourceKeys);
    await FileModel.deleteMany({ key: { $in: sourceKeys } });

    // Studio-delivered files count toward Customer.storageBytes; free it.
    const freedByCustomer = new Map<string, number>();
    for (const f of srcFiles) {
      if (f.ownerType === "studio" && f.customerId) {
        const id = String(f.customerId);
        freedByCustomer.set(id, (freedByCustomer.get(id) ?? 0) + (f.size || 0));
      }
    }
    await Promise.all(
      [...freedByCustomer].map(([id, freed]) =>
        Customer.updateOne({ _id: id }, { $inc: { storageBytes: -freed } })
      )
    );

    if (archive.sourceFolderIds?.length) {
      await Folder.deleteMany({ _id: { $in: archive.sourceFolderIds } });
    }
  }

  archive.status = "archived";
  archive.archivedAt = new Date();
  archive.expiresAt = addYears(new Date(), archive.termYears);
  archive.error = "";
  await archive.save();
  console.log(`[archive] ${archiveId} DONE — ${items.length} files frozen.`);
}

// Stream each file out of iDrive, zip on the fly (store = no compression, since
// photos/videos are already compressed), and multipart-upload the growing zip
// straight into the target bucket. Never touches disk; RAM stays bounded.
export async function streamZipTo(
  target: ZipTarget,
  items: ManifestItem[]
): Promise<void> {
  const zip = new ZipArchive({ store: true, forceZip64: true });
  // archiver uses the readable-stream polyfill, which lib-storage won't accept
  // as a Body; pipe it through a native PassThrough that it does accept.
  const passthrough = new PassThrough();
  let zipError: Error | null = null;
  zip.on("warning", (e) => console.warn("[archive] zip warning:", e.message));
  zip.on("error", (e) => {
    zipError = e;
    passthrough.destroy(e);
  });
  zip.pipe(passthrough);

  const upload = new Upload({
    client: target.client,
    params: {
      Bucket: target.bucket,
      Key: target.key,
      Body: passthrough as unknown as Readable,
      StorageClass: target.storageClass,
    },
    queueSize: QUEUE_SIZE,
    partSize: PART_SIZE,
  });

  // Feed the zip one file at a time so only a single iDrive stream is open at
  // any moment (append → wait for archiver to drain that entry → next).
  const feed = (async () => {
    for (const item of items) {
      if (zipError) throw zipError;
      if (!item.sourceKey) continue;
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: item.sourceKey })
      );
      const entryDone = new Promise<void>((resolve) =>
        zip.once("entry", () => resolve())
      );
      const name = item.path ? `${item.path}/${item.filename}` : item.filename;
      zip.append(obj.Body as Readable, { name });
      await entryDone;
    }
    await zip.finalize();
  })();

  await Promise.all([upload.done(), feed]);
  if (zipError) throw zipError;
}

async function deleteFromIdrive(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000).map((Key) => ({ Key }));
    if (chunk.length === 0) continue;
    try {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: chunk, Quiet: true },
        })
      );
    } catch (e) {
      console.warn("[archive] iDrive cleanup issue:", (e as Error).message);
    }
  }
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + years);
  return r;
}
