"use server";

import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Account } from "@/models/Account";
import { Studio } from "@/models/Studio";

async function me() {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  return { userId, email };
}

// Step 1: pick Personal or Business. Sets the Clerk role and creates the
// account record (subscription still pending).
export async function chooseType(
  type: "personal" | "business"
): Promise<void> {
  const { userId, email } = await me();
  if (!userId) redirect("/sign-in");

  const role = type === "business" ? "business" : "customer";
  const client = await clerkClient();
  await client.users.updateUser(userId, { publicMetadata: { role } });

  await connectToDatabase();
  await Account.findOneAndUpdate(
    { clerkUserId: userId },
    {
      $set: { type, email },
      $setOnInsert: { clerkUserId: userId, subscriptionStatus: "pending" },
    },
    { upsert: true }
  );

  redirect("/setup");
}

// Personal: finish setup and go to storage. Uploading is free (Temporary
// tier); Regular storage is purchased later on the portal, so there's no plan
// to choose here.
export async function activatePersonal(): Promise<void> {
  const { userId, email } = await me();
  if (!userId) redirect("/sign-in");

  await connectToDatabase();
  await Account.findOneAndUpdate(
    { clerkUserId: userId },
    { $set: { type: "personal", email, subscriptionStatus: "active" } },
    { upsert: true }
  );

  redirect("/portal");
}

// Business: capture business name + avg customers, then activate ($0 for now).
export async function saveBusiness(formData: FormData): Promise<void> {
  const { userId, email } = await me();
  if (!userId) redirect("/sign-in");

  const businessName = String(formData.get("businessName") ?? "").trim();
  const avg = parseInt(String(formData.get("avgCustomers") ?? "0"), 10);
  const avgCustomersMonthly = Number.isFinite(avg) && avg > 0 ? avg : 0;

  if (!businessName) redirect("/setup"); // required

  await connectToDatabase();
  await Account.findOneAndUpdate(
    { clerkUserId: userId },
    {
      $set: {
        type: "business",
        email,
        businessName,
        avgCustomersMonthly,
        subscriptionStatus: "active",
      },
    },
    { upsert: true }
  );

  // Keep the studio record's display name in sync.
  await Studio.findOneAndUpdate(
    { clerkUserId: userId },
    {
      $set: { name: businessName, planStatus: "active" },
      $setOnInsert: { clerkUserId: userId, email },
    },
    { upsert: true }
  );

  redirect("/dashboard");
}
