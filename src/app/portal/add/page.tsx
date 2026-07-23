import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/roles";
import { getMyOwner } from "@/lib/account";
import { loadTier } from "@/lib/portalDrive";
import AddFilesPicker from "@/components/portal/AddFilesPicker";

export default async function AddFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "customer") redirect("/dashboard");
  const owner = await getMyOwner();
  if (!owner) redirect("/setup");

  const { to: toParam } = await searchParams;
  const to: "cold" | "hot" = toParam === "hot" ? "hot" : "cold";
  const label = to === "cold" ? "Cold Drive" : "Hot Drive";

  const temp = await loadTier(owner.accountId, "temporary");

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/portal"
        className="text-sm text-black/50 hover:underline dark:text-white/50"
      >
        ← Back
      </Link>
      <h1 className="mb-1 mt-3 text-lg font-semibold">Add files to {label}</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Choose items from My uploads to move into {label}.
      </p>

      <AddFilesPicker to={to} folders={temp.folderRows} files={temp.fileRows} />
    </div>
  );
}
