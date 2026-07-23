import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Studio, StudioType } from "@/models/Studio";
import { Customer, CustomerType } from "@/models/Customer";
import mongoose, { type HydratedDocument } from "mongoose";

// Returns the Studio record for the currently logged-in user, creating it on
// first visit. Returns null if nobody is logged in.
export async function getOrCreateCurrentStudio(): Promise<HydratedDocument<StudioType> | null> {
  const user = await currentUser();
  if (!user) return null;

  // Only business accounts have a studio record - never create one for a
  // customer account.
  if (user.publicMetadata?.role !== "business") return null;

  await connectToDatabase();

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "";

  // Find existing, or create a new studio linked to this Clerk account.
  const studio = await Studio.findOneAndUpdate(
    { clerkUserId: user.id },
    { $setOnInsert: { clerkUserId: user.id, email, name } },
    { new: true, upsert: true }
  );

  return studio;
}

// Fetch a customer ONLY if it belongs to the currently logged-in studio.
// Returns null otherwise - this is how we stop one studio from accessing
// another studio's customers or files.
export async function getOwnedCustomer(
  customerId: string
): Promise<HydratedDocument<CustomerType> | null> {
  const studio = await getOrCreateCurrentStudio();
  if (!studio) return null;
  if (!mongoose.isValidObjectId(customerId)) return null;

  await connectToDatabase();
  return Customer.findOne({ _id: customerId, studioId: studio._id });
}
