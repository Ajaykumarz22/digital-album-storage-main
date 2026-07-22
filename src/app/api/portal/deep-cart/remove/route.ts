import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyOwner } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { FileModel } from "@/models/File";

// Untag files (the × on a "Selected for deep storage" tag / Remove in the list).
export async function POST(req: Request) {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).filter(
    (x: unknown) => mongoose.isValidObjectId(x)
  ) as string[];
  if (fileIds.length === 0) {
    return NextResponse.json({ error: "Nothing to remove." }, { status: 400 });
  }

  await connectToDatabase();
  const myAccounts = await getMyCustomerAccounts();
  const customerIds = myAccounts.map((a) => String(a._id));

  const res = await FileModel.updateMany(
    {
      _id: { $in: fileIds },
      deepStatus: "selected",
      $or: [
        { ownerType: "customer" as const, ownerAccountId: owner.accountId },
        ...(customerIds.length
          ? [{ ownerType: "studio" as const, customerId: { $in: customerIds } }]
          : []),
      ],
    },
    { $set: { deepStatus: "none" } }
  );
  return NextResponse.json({ ok: true, removed: res.modifiedCount });
}
