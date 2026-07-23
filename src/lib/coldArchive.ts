import mongoose from "mongoose";
import { coldUsedBytes } from "@/lib/account";
import { MIN_TERM_YEARS } from "@/lib/archivePricing";
import { MIN_COLD_GB } from "@/lib/coldPricing";
import { buildArchiveKey } from "@/lib/aws";
import { archiveQueue } from "@/lib/queue";
import { ArchiveModel } from "@/models/Archive";
import { ArchiveItemModel } from "@/models/ArchiveItem";
import { FileModel } from "@/models/File";
import type { Currency } from "@/lib/plans";

const GiB = 1024 ** 3;

export type ColdFile = {
  _id: mongoose.Types.ObjectId;
  key: string;
  filename: string;
  size: number;
  contentType: string;
  folderId: mongoose.Types.ObjectId | null;
};

export type ColdArchiveResult =
  | { ok: true; moved: number }
  | { ok: false; requiredGb: number };

// Freeze the given files into Cold Drive, drawing from the account's prepaid
// capacity. If capacity is short, returns { ok:false, requiredGb } (rounded-up
// GB to buy, at least the minimum) instead of archiving.
export async function archiveToCold(opts: {
  accountId: string;
  ownerEmail: string;
  coldBytes: number;
  files: ColdFile[];
  pathById: Map<string, string>;
  currency: Currency;
  name: string;
}): Promise<ColdArchiveResult> {
  const { accountId, ownerEmail, coldBytes, files, pathById, currency, name } =
    opts;

  const sizeBytes = files.reduce((s, f) => s + (f.size || 0), 0);
  const used = await coldUsedBytes(accountId);
  if (used + sizeBytes > coldBytes) {
    const shortBy = used + sizeBytes - coldBytes;
    return {
      ok: false,
      requiredGb: Math.max(MIN_COLD_GB, Math.ceil(shortBy / GiB)),
    };
  }

  const archiveId = new mongoose.Types.ObjectId();
  const bucketKey = buildArchiveKey(accountId, String(archiveId));

  await ArchiveModel.create({
    _id: archiveId,
    ownerType: "customer",
    ownerAccountId: accountId,
    ownerEmail,
    name,
    source: "active",
    bucketKey,
    sizeBytes,
    fileCount: files.length,
    status: "paid",
    termYears: MIN_TERM_YEARS,
    pricePaid: 0,
    currency,
    paidAt: new Date(),
    deleteSources: false,
  });

  await ArchiveItemModel.insertMany(
    files.map((f) => ({
      archiveId,
      ownerAccountId: accountId,
      ownerEmail,
      path: f.folderId ? pathById.get(String(f.folderId)) ?? "" : "",
      filename: f.filename,
      size: f.size,
      contentType: f.contentType,
      sourceKey: f.key,
    }))
  );

  await FileModel.updateMany(
    { _id: { $in: files.map((f) => f._id) } },
    { $set: { deepStatus: "moved" } }
  );

  await archiveQueue.add(
    "archive",
    { archiveId: String(archiveId) },
    { removeOnComplete: true, removeOnFail: false }
  );

  return { ok: true, moved: files.length };
}
