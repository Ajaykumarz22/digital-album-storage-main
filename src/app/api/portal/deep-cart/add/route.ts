import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { customerScope } from "@/lib/portal";
import { getMyOwner } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { resolveArchiveSource } from "@/lib/archiveSource";
import { FileModel } from "@/models/File";

// "Move to Cold Drive" = TAG the selected files "selected for cold drive".
// Nothing is copied or moved; the files stay visible where they are and show up
// in the Payment Pending list until paid for (or unselected).
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
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

  await connectToDatabase();

  // ----- Studio-shared files: tag the studio-owned files in place -----
  if (studioSpace) {
    if (!mongoose.isValidObjectId(studioSpace)) {
      return NextResponse.json({ error: "Invalid source." }, { status: 400 });
    }
    const myAccounts = await getMyCustomerAccounts();
    if (!myAccounts.some((a) => String(a._id) === studioSpace)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    // Empty fileIds = the WHOLE delivery (studio-row "Move to Cold Drive").
    const q: Record<string, unknown> = {
      customerId: studioSpace,
      ownerType: "studio",
      status: "ready",
      deepStatus: "none",
    };
    if (fileIds.length) q._id = { $in: fileIds };
    const res = await FileModel.updateMany(q, {
      $set: { deepStatus: "selected" },
    });
    return NextResponse.json({ ok: true, selected: res.modifiedCount });
  }

  // ----- Customer's own Regular-storage files -----
  const { files } = await resolveArchiveSource(
    customerScope(owner.accountId),
    fileIds,
    folderIds
  );
  const ids = files.map((f) => f._id);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Nothing selected." }, { status: 400 });
  }
  const res = await FileModel.updateMany(
    {
      _id: { $in: ids },
      ownerType: "customer",
      ownerAccountId: owner.accountId,
      deepStatus: "none",
    },
    { $set: { deepStatus: "selected" } }
  );
  return NextResponse.json({ ok: true, selected: res.modifiedCount });
}
