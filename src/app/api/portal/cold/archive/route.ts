import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope } from "@/lib/portal";
import { getMyOwner, getMyAccount } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { folderPathMap } from "@/lib/deepSelection";
import { resolveArchiveSource } from "@/lib/archiveSource";
import { archiveToCold, type ColdFile } from "@/lib/coldArchive";
import { FileModel } from "@/models/File";
import type { Currency } from "@/lib/plans";

// Move a specific selection into Cold Drive (per-row ⋮ menu / a shared
// delivery). Prepaid: archives if capacity fits, else 402 + requiredGb.
export async function POST(req: Request) {
  const owner = await getMyOwner();
  const account = await getMyAccount();
  if (!owner || !account) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const folderIds = (Array.isArray(body?.folderIds) ? body.folderIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  const studioSpace = body?.studioSpace as string | undefined;
  const currency: Currency = body?.currency === "INR" ? "INR" : "USD";

  await connectToDatabase();
  const myAccounts = await getMyCustomerAccounts();
  const customerIds = myAccounts.map((a) => String(a._id));

  let files: ColdFile[] = [];

  if (studioSpace) {
    if (!customerIds.includes(String(studioSpace))) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const q: Record<string, unknown> = {
      customerId: new mongoose.Types.ObjectId(studioSpace),
      ownerType: "studio",
      status: "ready",
      deepStatus: "none",
    };
    if (fileIds.length) q._id = { $in: fileIds };
    files = await FileModel.find(q)
      .select("key filename size contentType folderId")
      .lean<ColdFile[]>();
  } else {
    const src = await resolveArchiveSource(
      customerScope(owner.accountId),
      fileIds,
      folderIds
    );
    files = src.files as ColdFile[];
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Nothing to move." }, { status: 400 });
  }

  const pathById = await folderPathMap(owner.accountId, customerIds);
  const result = await archiveToCold({
    accountId: owner.accountId,
    ownerEmail: owner.email,
    coldBytes: account.coldBytes ?? 0,
    files,
    pathById,
    currency,
    name: studioSpace ? "Shared delivery" : "Cold Drive",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Not enough Cold Drive capacity.", needMore: true, requiredGb: result.requiredGb },
      { status: 402 }
    );
  }
  return NextResponse.json({ ok: true, moved: result.moved });
}
