import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer, CustomerType } from "@/models/Customer";
import type { HydratedDocument } from "mongoose";

// Returns all customer accounts that belong to the logged-in person, matched by
// their email (a studio created these accounts using that email). On first
// visit it also links the accounts to their Clerk user id.
export async function getMyCustomerAccounts(): Promise<
  HydratedDocument<CustomerType>[]
> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!user || !email) return [];

  await connectToDatabase();

  // Link any not-yet-linked accounts with this email to this login.
  await Customer.updateMany(
    { email, clerkUserId: null },
    { $set: { clerkUserId: user.id } }
  );

  return Customer.find({ email }).sort({ createdAt: -1 });
}
