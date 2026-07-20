"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Account } from "@/models/Account";

// Cancel a personal storage plan → subscription goes back to pending.
// (Existing files stay, but uploading is disabled until a plan is chosen again.)
export async function cancelPlan(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await connectToDatabase();
  await Account.updateOne(
    { clerkUserId: userId },
    { $set: { subscriptionStatus: "pending", planId: null, planBytes: 0 } }
  );

  redirect("/account");
}
