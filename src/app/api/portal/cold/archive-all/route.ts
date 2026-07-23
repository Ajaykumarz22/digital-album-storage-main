import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyOwner, getMyAccount } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { folderPathMap } from "@/lib/deepSelection";
import { archiveToCold, type ColdFile } from "@/lib/coldArchive";
import { FileModel } from "@/models/File";
import type { Currency } from "@/lib/plans";

// "Move ALL my uploads to Cold Drive": archives everything visible in My
// Uploads (own Temporary files + shared studio deliveries) if the prepaid
// capacity fits, else reports the shortfall (402 + requiredGb).
export async function POST(req: Request) {
  const owner = await getMyOwner();
  const account = await getMyAccount();
  if (!owner || !account) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const currency: Currency =
    (await req.json().catch(() => ({})))?.currency === "INR" ? "INR" : "USD";

  await connectToDatabase();
  const myAccounts = await getMyCustomerAccounts();
  const customerIds = myAccounts.map((a) => String(a._id));

  const [own, shared] = await Promise.all([
    FileModel.find({
      ownerType: "customer",
      ownerAccountId: owner.accountId,
      tier: "temporary",
      status: "ready",
      deepStatus: "none",
    })
      .select("key filename size contentType folderId")
      .lean<ColdFile[]>(),
    customerIds.length
      ? FileModel.find({
          ownerType: "studio",
          customerId: {
            $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          status: "ready",
          deepStatus: "none",
        })
          .select("key filename size contentType folderId")
          .lean<ColdFile[]>()
      : Promise.resolve([] as ColdFile[]),
  ]);
  const files = [...own, ...shared];

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
    name: "My uploads",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Not enough Cold Drive capacity.", needMore: true, requiredGb: result.requiredGb },
      { status: 402 }
    );
  }
  return NextResponse.json({ ok: true, moved: result.moved });
}
