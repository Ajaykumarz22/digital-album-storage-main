import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET } from "@/lib/s3";
import { getOwnedCustomer } from "@/lib/studio";
import { loadAllFolders, collectFolderAndDescendants } from "@/lib/folders";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";
import { Customer } from "@/models/Customer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const customerId = body?.customerId as string | undefined;
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId." }, { status: 400 });
  }
  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
  }

  const customer = await getOwnedCustomer(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await connectToDatabase();

  // Every folder to remove = the selected folders plus all their descendants
  // (studio-owned only).
  const all = await loadAllFolders({
    customerId: customer._id,
    ownerType: "studio",
  });
  const allIds = new Set(all.map((f) => String(f._id)));
  const startFolderIds = folderIds.filter((id) => allIds.has(id));
  const folderSet = collectFolderAndDescendants(all, startFolderIds);
  const folderIdArray = [...folderSet];

  // Files to remove = explicitly selected files + all files inside those folders
  // (studio-owned only - a studio can never delete a customer's private files).
  const files = await FileModel.find({
    customerId: customer._id,
    ownerType: "studio",
    $or: [
      { _id: { $in: fileIds } },
      ...(folderIdArray.length ? [{ folderId: { $in: folderIdArray } }] : []),
    ],
  }).lean<{ _id: mongoose.Types.ObjectId; key: string; size: number; status: string }[]>();

  // Remove the objects from iDrive in batches of up to 1000.
  const keys = files.map((f) => ({ Key: f.key }));
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
    } catch {
      // Continue cleaning up the database even if some objects were already gone.
    }
  }

  const freed = files
    .filter((f) => f.status === "ready")
    .reduce((sum, f) => sum + (f.size || 0), 0);

  const fileDocIds = files.map((f) => f._id);
  if (fileDocIds.length) {
    await FileModel.deleteMany({ _id: { $in: fileDocIds } });
  }
  if (folderIdArray.length) {
    await Folder.deleteMany({
      _id: { $in: folderIdArray },
      customerId: customer._id,
      ownerType: "studio",
    });
  }

  if (freed > 0) {
    await Customer.updateOne(
      { _id: customer._id },
      { $inc: { storageBytes: -freed } }
    );
  }

  return NextResponse.json({ ok: true, deletedFiles: fileDocIds.length });
}
