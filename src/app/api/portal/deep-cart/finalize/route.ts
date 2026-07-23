import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyOwner } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getSelectedDeepFiles, folderPathMap } from "@/lib/deepSelection";
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
import { FileModel } from "@/models/File";
import type { Currency } from "@/lib/plans";

// Pay for + start freezing everything tagged "selected for cold drive".
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
  // Default: keep the originals in place. false only if the user opts to delete.
  const keepCopies = body?.keepCopies !== false;

  await connectToDatabase();
  const myAccounts = await getMyCustomerAccounts();
  const customerIds = myAccounts.map((a) => String(a._id));
  const selected = await getSelectedDeepFiles(owner.accountId, customerIds);

  if (selected.length === 0) {
    return NextResponse.json(
      { error: "Nothing selected for Cold Drive." },
      { status: 400 }
    );
  }

  const sizeBytes = selected.reduce((s, f) => s + (f.size || 0), 0);
  if (sizeBytes < MIN_ARCHIVE_BYTES) {
    return NextResponse.json(
      {
        error: `Cold Drive needs at least ${humanBytes(
          MIN_ARCHIVE_BYTES
        )} total. Selected: ${humanBytes(sizeBytes)} - select more before paying.`,
      },
      { status: 400 }
    );
  }

  const quote = quoteArchive(sizeBytes, selected.length, years);
  const price = priceIn(quote, currency);
  const pathById = await folderPathMap(owner.accountId, customerIds);

  const archiveId = new mongoose.Types.ObjectId();
  const bucketKey = buildArchiveKey(owner.accountId, String(archiveId));

  // TODO(Phase 9): real Razorpay charge. Mocked as instantly paid.
  await ArchiveModel.create({
    _id: archiveId,
    ownerType: "customer",
    ownerAccountId: owner.accountId,
    ownerEmail: owner.email,
    name,
    source: "active",
    bucketKey,
    sizeBytes,
    fileCount: selected.length,
    status: "paid",
    termYears: years,
    pricePaid: price,
    currency,
    paidAt: new Date(),
    deleteSources: !keepCopies,
  });

  await ArchiveItemModel.insertMany(
    selected.map((f) => ({
      archiveId,
      ownerAccountId: owner.accountId,
      ownerEmail: owner.email,
      path: f.folderId ? pathById.get(String(f.folderId)) ?? "" : "",
      filename: f.filename,
      size: f.size,
      contentType: f.contentType,
      sourceKey: f.key,
    }))
  );

  // keep → tag "moved" (stays in place); delete → "archiving" (worker removes).
  await FileModel.updateMany(
    { _id: { $in: selected.map((f) => f._id) } },
    { $set: { deepStatus: keepCopies ? "moved" : "archiving" } }
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
    fileCount: selected.length,
    keepCopies,
  });
}
