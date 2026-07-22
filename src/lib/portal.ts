import { currentUser } from "@clerk/nextjs/server";

// The logged-in person's email (lowercased) — the identity of their own drive.
export async function getMyEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
}

// Ownership filter for a customer's own private drive. Scoped by the stable
// internal Account id (NOT email), so a changed email never loses access.
export function customerScope(accountId: string) {
  return { ownerType: "customer" as const, ownerAccountId: accountId };
}
