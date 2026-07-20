import { currentUser } from "@clerk/nextjs/server";

export type Role = "business" | "customer";

// The account type is stored on the Clerk user's public metadata.
export async function getCurrentRole(): Promise<Role | null> {
  const user = await currentUser();
  const role = user?.publicMetadata?.role;
  return role === "business" || role === "customer" ? role : null;
}

export function homePathForRole(role: Role): string {
  return role === "business" ? "/dashboard" : "/portal";
}
