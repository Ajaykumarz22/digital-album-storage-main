import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getOwnedCustomer } from "@/lib/studio";
import {
  resolveFolder,
  loadAllFolders,
  collectFolderAndDescendants,
} from "@/lib/folders";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const customerId = body?.customerId as string | undefined;
  const targetFolderId = (body?.targetFolderId as string | null | undefined) ?? null;
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []) as string[];

  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId." }, { status: 400 });
  }
  const validFileIds = fileIds.filter((x) => mongoose.isValidObjectId(x));
  const validFolderIds = folderIds.filter((x) => mongoose.isValidObjectId(x));
  if (validFileIds.length === 0 && validFolderIds.length === 0) {
    return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  }

  const customer = await getOwnedCustomer(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const scope = { customerId: customer._id, ownerType: "studio" as const };
  const target = await resolveFolder(scope, targetFolderId);
  if (!target.ok) {
    return NextResponse.json({ error: "Invalid destination." }, { status: 400 });
  }

  const all = await loadAllFolders(scope);
  const allIds = new Set(all.map((f) => String(f._id)));

  // All moving folders must belong to this customer.
  if (!validFolderIds.every((id) => allIds.has(id))) {
    return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  }

  // Cannot move a folder into itself or one of its own descendants.
  const forbidden = collectFolderAndDescendants(all, validFolderIds);
  if (target.folderId && forbidden.has(target.folderId)) {
    return NextResponse.json(
      { error: "You can't move a folder into itself." },
      { status: 400 }
    );
  }

  // Name-collision check: destination can't already contain a folder with the
  // same name as one being moved.
  const existingNamesAtTarget = new Set(
    all
      .filter(
        (f) =>
          (f.parentId ? String(f.parentId) : null) === target.folderId &&
          !forbidden.has(String(f._id))
      )
      .map((f) => f.name.toLowerCase())
  );
  const movingNames = all
    .filter((f) => validFolderIds.includes(String(f._id)))
    .map((f) => f.name.toLowerCase());
  if (movingNames.some((n) => existingNamesAtTarget.has(n))) {
    return NextResponse.json(
      { error: "A folder with the same name already exists there." },
      { status: 409 }
    );
  }

  await connectToDatabase();
  if (validFileIds.length) {
    await FileModel.updateMany(
      { _id: { $in: validFileIds }, customerId: customer._id, ownerType: "studio" },
      { $set: { folderId: target.folderId } }
    );
  }
  if (validFolderIds.length) {
    await Folder.updateMany(
      { _id: { $in: validFolderIds }, customerId: customer._id, ownerType: "studio" },
      { $set: { parentId: target.folderId } }
    );
  }

  return NextResponse.json({ ok: true });
}
