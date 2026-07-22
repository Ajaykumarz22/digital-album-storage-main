import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getOwnedCustomer } from "@/lib/studio";
import { getMyAccount } from "@/lib/account";
import { resolveArchiveSource, folderDirOf } from "@/lib/archiveSource";
import {
  quoteArchive,
  priceIn,
  normalizeTermYears,
  MIN_ARCHIVE_BYTES,
  humanBytes,
} from "@/lib/archivePricing";
import { buildStudioArchiveKey } from "@/lib/aws";
import { archiveQueue } from "@/lib/queue";
import { ArchiveModel } from "@/models/Archive";
import { ArchiveItemModel } from "@/models/ArchiveItem";
import type { Currency } from "@/lib/plans";

// A studio archives a selection of a customer's DELIVERED files into Deep
// Storage. Studio pays the (mock) 7+ year prepay. Mirrors the customer flow but
// scoped by studioId + customerId.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const customerId = body?.customerId as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId." }, { status: 400 });
  }
  const customer = await getOwnedCustomer(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name your archive." }, { status: 400 });
  }
  const years = normalizeTermYears(body?.years);
  const currency: Currency = body?.currency === "INR" ? "INR" : "USD";
  // Keep the delivered originals only if explicitly chosen; otherwise delete.
  const keepCopies = body?.keepCopies === true;

  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  await connectToDatabase();
  const scope = { customerId: customer._id, ownerType: "studio" as const };
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

  const account = await getMyAccount();
  const accountId = account ? String(account._id) : null;
  const user = await currentUser();
  const ownerEmail =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";

  const archiveId = new mongoose.Types.ObjectId();
  const bucketKey = buildStudioArchiveKey(
    String(customer.studioId),
    String(customer._id),
    String(archiveId)
  );

  // TODO(Phase 9): real Razorpay charge. Mocked as instantly paid.
  await ArchiveModel.create({
    _id: archiveId,
    ownerType: "studio",
    studioId: customer.studioId,
    customerId: customer._id,
    ownerAccountId: accountId,
    ownerEmail,
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
    deleteSources: !keepCopies,
  });

  await ArchiveItemModel.insertMany(
    files.map((f) => ({
      archiveId,
      ownerAccountId: accountId,
      ownerEmail,
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
