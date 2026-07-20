"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/models/Customer";
import { getOrCreateCurrentStudio } from "@/lib/studio";

const TRIAL_DAYS = 15;

export type CreateCustomerResult = { ok: true } | { ok: false; error: string };

export async function createCustomer(
  _prev: CreateCustomerResult | null,
  formData: FormData
): Promise<CreateCustomerResult> {
  const studio = await getOrCreateCurrentStudio();
  if (!studio) {
    return { ok: false, error: "You must be logged in." };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();

  // Basic email sanity check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  await connectToDatabase();

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  try {
    await Customer.create({
      studioId: studio._id,
      email,
      name,
      status: "trial",
      trialEndsAt,
    });
  } catch (err: unknown) {
    // Duplicate key => this studio already has a customer with that email.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return {
        ok: false,
        error: "You already have a customer with that email.",
      };
    }
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
