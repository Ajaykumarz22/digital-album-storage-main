import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyOwner } from "@/lib/account";
import { getMyCustomerAccounts } from "@/lib/customer";
import { FileModel } from "@/models/File";

// "Move ALL my uploads to Cold Drive" - one click, no manual selection. Tags
// everything shown in My Uploads "selected for cold drive" so it enters the
// Payment Pending list: the customer's own Temporary-tier files AND the studio
// deliveries shared with them (same mechanism as the per-selection button).
export async function POST() {
  const owner = await getMyOwner();
  if (!owner) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  await connectToDatabase();
  const myAccounts = await getMyCustomerAccounts();
  const customerIds = myAccounts.map((a) => new mongoose.Types.ObjectId(String(a._id)));

  const res = await FileModel.updateMany(
    {
      status: "ready",
      deepStatus: "none",
      $or: [
        // The customer's own uploads sitting in Temporary storage.
        {
          ownerType: "customer" as const,
          ownerAccountId: owner.accountId,
          tier: "temporary" as const,
        },
        // Studio deliveries shared with this customer.
        ...(customerIds.length
          ? [{ ownerType: "studio" as const, customerId: { $in: customerIds } }]
          : []),
      ],
    },
    { $set: { deepStatus: "selected" } }
  );

  return NextResponse.json({ ok: true, selected: res.modifiedCount });
}
