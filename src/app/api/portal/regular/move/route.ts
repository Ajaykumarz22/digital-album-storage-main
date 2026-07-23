import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope } from "@/lib/portal";
import { getMyAccount, regularUsedBytes } from "@/lib/account";
import { humanBytes } from "@/lib/archivePricing";
import { loadAllFolders, collectFolderAndDescendants } from "@/lib/folders";
import { FileModel } from "@/models/File";

type TempFile = { _id: mongoose.Types.ObjectId; size: number };

// Move a customer's Temporary-tier files into paid Hot drive. Checks the
// purchased quota; blocks (402) with a "buy more" prompt if there isn't room.
export async function POST(req: Request) {
  const account = await getMyAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const accountId = String(account._id);

  const body = await req.json().catch(() => null);
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];

  await connectToDatabase();
  const scope = customerScope(accountId);
  const all = await loadAllFolders(scope);
  const folderSet = collectFolderAndDescendants(
    all,
    folderIds.filter((id) => new Set(all.map((f) => String(f._id))).has(id))
  );
  const folderIdArray = [...folderSet];

  const files = await FileModel.find({
    ...scope,
    status: "ready",
    tier: "temporary",
    $or: [
      { _id: { $in: fileIds } },
      ...(folderIdArray.length ? [{ folderId: { $in: folderIdArray } }] : []),
    ],
  })
    .select("size")
    .lean<TempFile[]>();

  if (files.length === 0) {
    return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  }

  const incoming = files.reduce((s, f) => s + (f.size || 0), 0);
  const used = await regularUsedBytes(accountId);
  const capacity = account.regularBytes ?? 0;
  if (used + incoming > capacity) {
    const shortBy = used + incoming - capacity;
    return NextResponse.json(
      {
        error: `Not enough Hot drive - you need ${humanBytes(
          shortBy
        )} more. Buy more storage first.`,
        needMore: true,
      },
      { status: 402 }
    );
  }

  await FileModel.updateMany(
    { _id: { $in: files.map((f) => f._id) } },
    { $set: { tier: "regular" } }
  );

  return NextResponse.json({ ok: true, moved: files.length });
}
