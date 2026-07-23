import mongoose from "mongoose";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FileModel } from "@/models/File";
import { Studio } from "@/models/Studio";
import { ArchiveModel } from "@/models/Archive";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getCurrentRole } from "@/lib/roles";
import { getMyAccount, getMyOwner } from "@/lib/account";
import BuyRegularStorage from "./BuyRegularStorage";
import BuyColdDrive from "@/components/portal/BuyColdDrive";
import { getCurrency } from "@/lib/geo";
import ArchiveList, { type ArchiveRow } from "@/components/archives/ArchiveList";
import { loadTier } from "@/lib/portalDrive";
import FileManager from "@/components/files/FileManager";
import FileBrowser from "@/components/files/FileBrowser";
import PortalTabs from "@/components/portal/PortalTabs";
import Faq from "@/components/Faq";

export default async function PortalPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "customer") redirect("/dashboard");

  const owner = await getMyOwner();
  if (!owner) redirect("/setup");

  const account = await getMyAccount();
  const regularBytes = account?.regularBytes ?? 0;
  const currency = await getCurrency();

  // Studio deliveries to this person (each Customer doc = one studio).
  const accounts = await getMyCustomerAccounts();
  await connectToDatabase();
  const studioIds = accounts.map((a) => a.studioId);
  const studios = await Studio.find({ _id: { $in: studioIds } })
    .select("name email")
    .lean<{ _id: unknown; name: string; email: string }[]>();
  const studioNameById = new Map(
    studios.map((s) => [String(s._id), s.name || s.email || "Studio"])
  );

  const temp = await loadTier(owner.accountId, "temporary");
  const regular = await loadTier(owner.accountId, "regular");
  const purchasedGb = Number((regularBytes / 1024 ** 3).toFixed(1));
  const coldPurchasedGb = Number(((account?.coldBytes ?? 0) / 1024 ** 3).toFixed(1));
  const archives = await loadMyArchives(owner.accountId);
  const sharedRows = await loadSharedRows(
    accounts.map((a) => ({ id: String(a._id), studioId: String(a.studioId) })),
    studioNameById,
    owner.accountId
  );
  const canImport = regularBytes > 0;

  const uploadTab = (
    <div className="space-y-4">
      {/* "My uploads" title with a right-aligned "Actions" dropdown */}
      <FileManager
        title="My uploads"
        currentFolderId={temp.currentFolderId}
        endpoints={{
          presign: "/api/portal/presign",
          confirm: "/api/portal/confirm",
          folders: "/api/portal/folders",
        }}
        moveAllRegularEndpoint="/api/portal/regular/move-all"
        moveAllDeepEndpoint="/api/portal/cold/archive-all"
        coldBuyCurrency={currency}
      />

      {/* Temporary Storage - your own uploads + studio deliveries */}
      <section>
        <div>
          <FileBrowser
            currentFolderId={null}
            base="/portal"
            folderHrefBase="/portal/folder"
            folderHrefSuffix="?tier=temporary"
            showExpiry
            selectable={false}
            folders={temp.folderRows}
            files={temp.fileRows}
            moveTargets={temp.moveTargets}
            currency={currency}
            sharedRows={sharedRows}
            canImport={canImport}
            endpoints={{
              move: "/api/portal/move",
              folders: "/api/portal/folders",
              delete: "/api/portal/delete",
              deepSelect: "/api/portal/cold/archive",
              moveToRegular: "/api/portal/regular/move",
              importShared: "/api/portal/import",
            }}
          />
        </div>
      </section>
      <Faq />
    </div>
  );

  const deepTab = (
    <div className="mt-6 space-y-4">
      {/* Title row: "Cold Drive · Own X GB" + right-aligned "Buy Cold Drive" */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">Cold Drive</h1>
          <span className="text-xs text-black/50 dark:text-white/50">
            {coldPurchasedGb} GB
          </span>
        </div>
        <BuyColdDrive currency={currency} />
      </div>
      <ArchiveList
        archives={archives}
        browseBase="/portal/archive"
        emptyHint="No files in Cold Drive yet."
        emptyAction={
          <Link
            href="/portal/add?to=cold"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add files
          </Link>
        }
      />
      <Faq />
    </div>
  );

  const regularTab = (
    <div className="mt-6">
      {/* Title row: "Hot Drive · Own X GB" + right-aligned "Buy Hot drive" */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">Hot Drive</h1>
          <span className="text-xs text-black/50 dark:text-white/50">
            {purchasedGb} GB
          </span>
        </div>
        <BuyRegularStorage currency={currency} />
      </div>

      <section>
        <div>
          <FileBrowser
            currentFolderId={null}
            base="/portal"
            folderHrefBase="/portal/folder"
            folderHrefSuffix="?tier=regular"
            folders={regular.folderRows}
            files={regular.fileRows}
            moveTargets={regular.moveTargets}
            currency={currency}
            emptyHint="No files in Hot Drive yet."
            emptyAction={
              <Link
                href="/portal/add?to=hot"
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add files
              </Link>
            }
            endpoints={{
              move: "/api/portal/move",
              folders: "/api/portal/folders",
              delete: "/api/portal/delete",
              deepSelect: "/api/portal/cold/archive",
            }}
          />
        </div>
      </section>
      <Faq />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 pb-12">
      <PortalTabs upload={uploadTab} deep={deepTab} regular={regularTab} />
    </div>
  );
}

/* ---------------- Cold Drive (frozen archives) ---------------- */

async function loadMyArchives(accountId: string): Promise<ArchiveRow[]> {
  await connectToDatabase();
  const rows = await ArchiveModel.find({
    ownerType: "customer",
    ownerAccountId: accountId,
    status: { $ne: "deleted" },
  })
    .sort({ createdAt: -1 })
    .select("name fileCount sizeBytes status termYears")
    .lean();
  return rows.map((a) => ({
    id: String(a._id),
    name: a.name,
    fileCount: a.fileCount,
    sizeBytes: a.sizeBytes,
    status: a.status,
    termYears: a.termYears,
  }));
}

/* ------- Shared deliveries → folder-style rows inside Temporary Storage ------- */

type SharedRow = {
  id: string;
  name: string;
  fileCount: number;
  sizeBytes: number;
};

async function loadSharedRows(
  accounts: { id: string; studioId: string }[],
  studioNameById: Map<string, string>,
  myAccountId: string
): Promise<SharedRow[]> {
  if (accounts.length === 0) return [];
  await connectToDatabase();

  // Files this customer already moved (to Regular/Deep) - exclude from counts.
  const takenDocs = await FileModel.find({
    ownerType: "customer",
    ownerAccountId: myAccountId,
    sourceFileId: { $ne: null },
  })
    .select("sourceFileId")
    .lean<{ sourceFileId: mongoose.Types.ObjectId }[]>();
  const takenIds = takenDocs.map((d) => d.sourceFileId);

  const ids = accounts.map((a) => new mongoose.Types.ObjectId(a.id));
  const agg = await FileModel.aggregate([
    {
      $match: {
        customerId: { $in: ids },
        ownerType: "studio",
        status: "ready",
        // Files tagged for Cold Drive are hidden here - they show in the
        // Payment Pending list instead (same as the customer's own uploads).
        deepStatus: "none",
        ...(takenIds.length ? { _id: { $nin: takenIds } } : {}),
      },
    },
    {
      $group: {
        _id: "$customerId",
        n: { $sum: 1 },
        bytes: { $sum: "$size" },
      },
    },
  ]);
  const statById = new Map<string, { n: number; bytes: number }>(
    agg.map((c) => [
      String(c._id),
      { n: c.n as number, bytes: c.bytes as number },
    ])
  );

  return accounts
    .map((a) => {
      const stat = statById.get(a.id) ?? { n: 0, bytes: 0 };
      return {
        id: a.id,
        name: studioNameById.get(a.studioId) || "Studio",
        fileCount: stat.n,
        sizeBytes: stat.bytes,
      };
    })
    .filter((r) => r.fileCount > 0);
}
