import Link from "next/link";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FileModel } from "@/models/File";
import { Studio } from "@/models/Studio";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getCurrentRole } from "@/lib/roles";
import { getMyOwner, getMyAccount } from "@/lib/account";
import { loadAllFolders, buildFolderPaths } from "@/lib/folders";
import { daysLeft } from "@/lib/lifecycle";
import SharedFileGroups, {
  type ExpiryGroup,
  type SharedFile,
} from "@/components/archives/SharedFileGroups";

function groupLabel(d: number): string {
  if (d === 0) return "Expires today";
  return `${d} day${d === 1 ? "" : "s"} left`;
}

export default async function SharedSpacePage({
  params,
}: {
  params: Promise<{ studioSpace: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "customer") redirect("/dashboard");

  const owner = await getMyOwner();
  if (!owner) redirect("/setup");

  const { studioSpace } = await params;

  const accounts = await getMyCustomerAccounts();
  const account = accounts.find((a) => String(a._id) === studioSpace);
  if (!account) notFound();

  await connectToDatabase();
  const studio = await Studio.findById(account.studioId)
    .select("name email")
    .lean<{ name: string; email: string } | null>();
  const studioName = studio?.name || studio?.email || "Studio";
  const locked = account.status === "locked";
  const myAccount = await getMyAccount();
  const canImport = myAccount?.subscriptionStatus === "active";

  const scope = { customerId: studioSpace, ownerType: "studio" as const };

  // Files the customer has already taken (moved to Regular or Deep) — hide them.
  const takenDocs = await FileModel.find({
    ownerType: "customer",
    ownerAccountId: owner.accountId,
    sourceFileId: { $ne: null },
  })
    .select("sourceFileId")
    .lean<{ sourceFileId: mongoose.Types.ObjectId }[]>();
  const taken = new Set(takenDocs.map((d) => String(d.sourceFileId)));

  const [files, allFolders] = await Promise.all([
    FileModel.find({ ...scope, status: "ready", deepStatus: { $ne: "archiving" } })
      .select("filename size createdAt folderId deepStatus")
      .sort({ filename: 1 })
      .lean<
        {
          _id: mongoose.Types.ObjectId;
          filename: string;
          size: number;
          createdAt: Date;
          folderId: mongoose.Types.ObjectId | null;
          deepStatus: string;
        }[]
      >(),
    loadAllFolders(scope),
  ]);
  const pathById = new Map(
    buildFolderPaths(allFolders).map((p) => [p.id, p.path])
  );

  // Bucket the (not-yet-taken) files by whole days remaining.
  const byDays = new Map<number, SharedFile[]>();
  for (const f of files) {
    if (taken.has(String(f._id))) continue;
    const days = daysLeft(f.createdAt);
    const row: SharedFile = {
      id: String(f._id),
      filename: f.filename,
      size: f.size,
      createdAt: f.createdAt.toISOString(),
      folderPath: f.folderId ? pathById.get(String(f.folderId)) ?? "" : "",
      deepTag:
        f.deepStatus === "selected"
          ? "selected"
          : f.deepStatus === "moved"
            ? "moved"
            : null,
    };
    const arr = byDays.get(days) ?? [];
    arr.push(row);
    byDays.set(days, arr);
  }
  const groups: ExpiryGroup[] = [...byDays.keys()]
    .sort((a, b) => b - a)
    .map((days) => ({
      days,
      label: groupLabel(days),
      urgent: days <= 3,
      files: byDays.get(days)!,
    }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/portal"
        className="text-sm text-black/50 hover:underline dark:text-white/50"
      >
        ← Back to My Uploads
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">Shared by {studioName}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        These files auto-delete when their time runs out. Move them to Hot
        or Cold Drive, or download them, before they expire.
      </p>

      {locked && (
        <p className="mb-3 mt-4 rounded-md border border-red-500/40 bg-red-500/5 px-4 py-2 text-sm text-red-600">
          Your access is locked. Subscribe to download these files.
        </p>
      )}

      <SharedFileGroups
        groups={groups}
        studioSpace={studioSpace}
        canImport={canImport}
        locked={locked}
      />
    </div>
  );
}
