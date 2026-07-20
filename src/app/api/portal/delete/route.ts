import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/lib/mongodb";
import { s3, S3_BUCKET } from "@/lib/s3";
import { getMyEmail, customerScope } from "@/lib/portal";
import { loadAllFolders, collectFolderAndDescendants } from "@/lib/folders";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";

export async function POST(req: Request) {
  const email = await getMyEmail();
  if (!email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
  }

  await connectToDatabase();
  const scope = customerScope(email);
  const all = await loadAllFolders(scope);
  const allIds = new Set(all.map((f) => String(f._id)));
  const startFolderIds = folderIds.filter((id) => allIds.has(id));
  const folderSet = collectFolderAndDescendants(all, startFolderIds);
  const folderIdArray = [...folderSet];

  const files = await FileModel.find({
    ownerType: "customer",
    ownerEmail: email,
    $or: [
      { _id: { $in: fileIds } },
      ...(folderIdArray.length ? [{ folderId: { $in: folderIdArray } }] : []),
    ],
  }).lean<{ _id: mongoose.Types.ObjectId; key: string }[]>();

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
      // continue cleaning up DB
    }
  }

  if (files.length) {
    await FileModel.deleteMany({ _id: { $in: files.map((f) => f._id) } });
  }
  if (folderIdArray.length) {
    await Folder.deleteMany({
      _id: { $in: folderIdArray },
      ownerType: "customer",
      ownerEmail: email,
    });
  }

  return NextResponse.json({ ok: true, deletedFiles: files.length });
}
