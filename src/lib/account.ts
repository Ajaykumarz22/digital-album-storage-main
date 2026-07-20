import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Account, AccountType } from "@/models/Account";
import { FileModel } from "@/models/File";
import type { HydratedDocument } from "mongoose";

// The account-level record for the logged-in user, if any.
export async function getMyAccount(): Promise<HydratedDocument<AccountType> | null> {
  const user = await currentUser();
  if (!user) return null;
  await connectToDatabase();
  return Account.findOne({ clerkUserId: user.id });
}

// Total bytes the person already stores in their own (customer-owned) drive.
// Used to force selecting a plan large enough for their existing data.
export async function getMyUsedBytes(email: string): Promise<number> {
  await connectToDatabase();
  const agg = await FileModel.aggregate([
    { $match: { ownerType: "customer", ownerEmail: email, status: "ready" } },
    { $group: { _id: null, total: { $sum: "$size" } } },
  ]);
  return (agg[0]?.total as number) ?? 0;
}
