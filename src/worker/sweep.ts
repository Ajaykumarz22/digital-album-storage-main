import mongoose from "mongoose";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../lib/s3";
import { TEMP_STORAGE_DAYS } from "../lib/lifecycle";
import { FileModel } from "../models/File";
import { Customer } from "../models/Customer";

type ExpiredFile = {
  _id: mongoose.Types.ObjectId;
  key: string;
  size: number;
  customerId: mongoose.Types.ObjectId | null;
};

// Delete studio-shared ("Temporary Storage") files that are past their per-file
// 15-day window. Each file is measured from its OWN upload date. Customer-owned
// files in paid Hot Drive are never touched here.
export async function processSweep(): Promise<void> {
  const cutoff = new Date(Date.now() - TEMP_STORAGE_DAYS * 24 * 60 * 60 * 1000);

  // Studio deliveries AND customers' own Temporary-tier uploads expire per-file.
  const expired = await FileModel.find({
    status: "ready",
    createdAt: { $lt: cutoff },
    // Skip only files mid-freeze ("archiving"); selected/moved temporary files
    // still expire normally.
    deepStatus: { $ne: "archiving" },
    $or: [
      { ownerType: "studio" },
      { ownerType: "customer", tier: "temporary" },
    ],
  })
    .select("key size customerId")
    .lean<ExpiredFile[]>();

  if (expired.length === 0) {
    console.log("[sweep] nothing expired");
    return;
  }
  console.log(`[sweep] deleting ${expired.length} expired shared file(s)`);

  // Remove the objects from iDrive in batches of up to 1000.
  const keys = expired.map((f) => ({ Key: f.key }));
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    if (chunk.length === 0) continue;
    try {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: chunk, Quiet: true },
        })
      );
    } catch (e) {
      console.warn(`[sweep] iDrive delete issue: ${(e as Error).message}`);
    }
  }

  // Delete the File documents.
  await FileModel.deleteMany({ _id: { $in: expired.map((f) => f._id) } });

  // Decrement each customer's storage counter by the bytes we freed.
  const freedByCustomer = new Map<string, number>();
  for (const f of expired) {
    if (!f.customerId) continue;
    const id = String(f.customerId);
    freedByCustomer.set(id, (freedByCustomer.get(id) ?? 0) + (f.size || 0));
  }
  await Promise.all(
    [...freedByCustomer].map(([id, freed]) =>
      Customer.updateOne({ _id: id }, { $inc: { storageBytes: -freed } })
    )
  );

  console.log(`[sweep] done — ${expired.length} file(s) removed`);
}
