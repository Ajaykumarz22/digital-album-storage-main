import { currentUser } from "@clerk/nextjs/server";
import mongoose, { type HydratedDocument } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Account, AccountType } from "@/models/Account";
import { FileModel } from "@/models/File";

// The account-level record for the logged-in user, if any.
export async function getMyAccount(): Promise<HydratedDocument<AccountType> | null> {
  const user = await currentUser();
  if (!user) return null;
  await connectToDatabase();
  return Account.findOne({ clerkUserId: user.id });
}

// The current user's STABLE internal identity (Account._id) plus their current
// email. accountId is what all customer-owned data is scoped by; email is only
// a display hint. Returns null if there's no account yet (e.g. pre-setup).
export async function getMyOwner(): Promise<{
  accountId: string;
  email: string;
} | null> {
  const user = await currentUser();
  if (!user) return null;
  await connectToDatabase();
  const acct = await Account.findOne({ clerkUserId: user.id })
    .select("email")
    .lean<{ _id: mongoose.Types.ObjectId; email: string }>();
  if (!acct) return null;
  const email = (
    user.primaryEmailAddress?.emailAddress ||
    acct.email ||
    ""
  ).toLowerCase();
  return { accountId: String(acct._id), email };
}

// Bytes the person stores in their PAID Regular tier (counts against quota).
export async function getMyUsedBytes(): Promise<number> {
  const owner = await getMyOwner();
  if (!owner) return 0;
  return regularUsedBytes(owner.accountId);
}

// Regular-tier bytes used by a given account (for quota checks).
export async function regularUsedBytes(accountId: string): Promise<number> {
  await connectToDatabase();
  const agg = await FileModel.aggregate([
    {
      $match: {
        ownerType: "customer",
        ownerAccountId: new mongoose.Types.ObjectId(accountId),
        status: "ready",
        tier: "regular",
      },
    },
    { $group: { _id: null, total: { $sum: "$size" } } },
  ]);
  return (agg[0]?.total as number) ?? 0;
}
