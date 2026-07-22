import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope } from "@/lib/portal";
import { getMyOwner } from "@/lib/account";
import {
  resolveFolder,
  loadAllFolders,
  collectFolderAndDescendants,
} from "@/lib/folders";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";

export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const targetFolderId = (body?.targetFolderId as string | null | undefined) ?? null;
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  if (fileIds.length === 0 && folderIds.length === 0) {
    return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  }

  const scope = customerScope(owner.accountId);
  const target = await resolveFolder(scope, targetFolderId);
  if (!target.ok) {
    return NextResponse.json({ error: "Invalid destination." }, { status: 400 });
  }

  const all = await loadAllFolders(scope);
  const allIds = new Set(all.map((f) => String(f._id)));
  if (!folderIds.every((id) => allIds.has(id))) {
    return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  }

  const forbidden = collectFolderAndDescendants(all, folderIds);
  if (target.folderId && forbidden.has(target.folderId)) {
    return NextResponse.json(
      { error: "You can't move a folder into itself." },
      { status: 400 }
    );
  }

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
    .filter((f) => folderIds.includes(String(f._id)))
    .map((f) => f.name.toLowerCase());
  if (movingNames.some((n) => existingNamesAtTarget.has(n))) {
    return NextResponse.json(
      { error: "A folder with the same name already exists there." },
      { status: 409 }
    );
  }

  await connectToDatabase();
  if (fileIds.length) {
    await FileModel.updateMany(
      {
        _id: { $in: fileIds },
        ownerType: "customer",
        ownerAccountId: owner.accountId,
      },
      { $set: { folderId: target.folderId } }
    );
  }
  if (folderIds.length) {
    await Folder.updateMany(
      {
        _id: { $in: folderIds },
        ownerType: "customer",
        ownerAccountId: owner.accountId,
      },
      { $set: { parentId: target.folderId } }
    );
  }

  return NextResponse.json({ ok: true });
}
