import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope } from "@/lib/portal";
import { getMyOwner } from "@/lib/account";
import { resolveArchiveSource, folderDirOf } from "@/lib/archiveSource";
import {
  quoteArchive,
  priceIn,
  normalizeTermYears,
  MIN_ARCHIVE_BYTES,
  humanBytes,
} from "@/lib/archivePricing";
import { buildArchiveKey } from "@/lib/aws";
import { archiveQueue } from "@/lib/queue";
import { ArchiveModel } from "@/models/Archive";
import { ArchiveItemModel } from "@/models/ArchiveItem";
import type { Currency } from "@/lib/plans";

// Create an archive from selected active files, take the (mock) 7+ year prepay,
// write the manifest, and queue the transfer worker. The worker does the actual
// zip → Deep Archive move and only then deletes the hot originals.
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name your archive." }, { status: 400 });
  }
  const years = normalizeTermYears(body?.years);
  const currency: Currency = body?.currency === "INR" ? "INR" : "USD";

  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  await connectToDatabase();
  const scope = customerScope(owner.accountId);
  const { files, folderIdArray, pathByFolderId, sizeBytes, fileCount } =
    await resolveArchiveSource(scope, fileIds, folderIds);

  if (fileCount === 0) {
    return NextResponse.json(
      { error: "Nothing to archive in the selection." },
      { status: 400 }
    );
  }

  if (sizeBytes < MIN_ARCHIVE_BYTES) {
    return NextResponse.json(
      {
        error: `Cold Drive needs at least ${humanBytes(
          MIN_ARCHIVE_BYTES
        )} per archive. Your selection is ${humanBytes(sizeBytes)}.`,
      },
      { status: 400 }
    );
  }

  const quote = quoteArchive(sizeBytes, fileCount, years);
  const price = priceIn(quote, currency);

  const archiveId = new mongoose.Types.ObjectId();
  const bucketKey = buildArchiveKey(owner.accountId, String(archiveId));

  // TODO(Phase 9): replace this instant "paid" with a real Razorpay charge.
  // For now the payment is mocked — we mark it paid immediately.
  await ArchiveModel.create({
    _id: archiveId,
    ownerType: "customer",
    ownerAccountId: owner.accountId,
    ownerEmail: owner.email,
    name,
    source: "active",
    bucketKey,
    sizeBytes,
    fileCount,
    sourceFolderIds: folderIdArray,
    status: "paid",
    termYears: years,
    pricePaid: price,
    currency,
    paidAt: new Date(),
  });

  // Write the manifest (one row per file) BEFORE freezing, so the archive stays
  // browsable and the worker knows what to stream.
  await ArchiveItemModel.insertMany(
    files.map((f) => ({
      archiveId,
      ownerAccountId: owner.accountId,
      ownerEmail: owner.email,
      path: folderDirOf(f, pathByFolderId),
      filename: f.filename,
      size: f.size,
      contentType: f.contentType,
      sourceKey: f.key,
    }))
  );

  await archiveQueue.add(
    "archive",
    { archiveId: String(archiveId) },
    { removeOnComplete: true, removeOnFail: false }
  );

  return NextResponse.json({
    ok: true,
    archiveId: String(archiveId),
    price,
    currency,
    sizeBytes,
    fileCount,
    years,
  });
}
