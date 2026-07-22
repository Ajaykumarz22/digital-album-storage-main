import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FileModel } from "@/models/File";
import { Studio } from "@/models/Studio";
import { ArchiveModel } from "@/models/Archive";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getCurrentRole } from "@/lib/roles";
import { getMyAccount, getMyOwner, regularUsedBytes } from "@/lib/account";
import BuyRegularStorage from "./BuyRegularStorage";
import { getCurrency } from "@/lib/geo";
import ArchiveList, { type ArchiveRow } from "@/components/archives/ArchiveList";
import PendingDeepStorage from "@/components/archives/PendingDeepStorage";
import InfoHint from "@/components/InfoHint";
import { getSelectedDeepFiles, folderPathMap } from "@/lib/deepSelection";
import { loadTier } from "@/lib/portalDrive";
import FileManager from "@/components/files/FileManager";
import FileBrowser from "@/components/files/FileBrowser";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

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

  const customerIds = accounts.map((a) => String(a._id));
  const temp = await loadTier(owner.accountId, "temporary");
  const regular = await loadTier(owner.accountId, "regular");
  const regularUsed = await regularUsedBytes(owner.accountId);
  const archives = await loadMyArchives(owner.accountId);
  const studioNameByCustomer = new Map(
    accounts.map((a) => [
      String(a._id),
      studioNameById.get(String(a.studioId)) ?? "Studio",
    ])
  );
  const pending = await loadPendingDeep(
    owner.accountId,
    customerIds,
    studioNameByCustomer
  );
  const sharedRows = await loadSharedRows(
    accounts.map((a) => ({ id: String(a._id), studioId: String(a.studioId) })),
    studioNameById,
    owner.accountId
  );
  const canImport = regularBytes > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <h1 className="text-2xl font-semibold">My Storage</h1>

      {/* Upload — free; lands in Temporary storage */}
      <section className="rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-1 text-sm font-semibold">Upload</h2>
        <p className="mb-4 text-xs text-black/50 dark:text-white/50">
          Uploads land in Temporary storage (free, auto-deletes after 15 days).
          Move them to Regular or Deep storage to keep them.
        </p>
        <FileManager
          currentFolderId={temp.currentFolderId}
          endpoints={{
            presign: "/api/portal/presign",
            confirm: "/api/portal/confirm",
            folders: "/api/portal/folders",
          }}
        />
      </section>

      {/* Temporary Storage — your own uploads + studio deliveries */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Temporary Storage (auto delete after 15 days)
          <InfoHint text="Free landing area. Every file here auto-deletes 15 days after it arrived — move it to Regular or Deep storage to keep it." />
        </h2>

        <div className="mt-4">
          <FileBrowser
            currentFolderId={null}
            base="/portal"
            folderHrefBase="/portal/folder"
            folderHrefSuffix="?tier=temporary"
            showExpiry
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
              deepSelect: "/api/portal/deep-cart/add",
              deepUnselect: "/api/portal/deep-cart/remove",
              moveToRegular: "/api/portal/regular/move",
            }}
          />
        </div>
      </section>

      {/* Deep Storage — long-term frozen archives */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Deep Storage (cheapest, approx Rs 180/1TB/Month)
          <InfoHint text="Long-term frozen archives. Browsing the contents is instant; retrieving the actual files takes up to 48 hours and is billed separately." />
        </h2>
        <div className="mt-4 space-y-4">
          <PendingDeepStorage pending={pending} currency={currency} />
          <ArchiveList
            archives={archives}
            browseBase="/portal/archive"
            emptyHint="No archives yet. Select files in Regular storage and choose “Move to Deep Storage” to keep them long-term at the lowest cost."
          />
        </div>
      </section>

      {/* Regular storage — paid, permanent */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            Regular Storage
            <InfoHint text="Paid, permanent storage. You keep files here as long as you have enough purchased storage. Studios can't see these." />
          </h2>
          <BuyRegularStorage currency={currency} />
        </div>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {formatBytes(regularUsed)} used of {formatBytes(regularBytes)} purchased.
        </p>

        <div className="mt-4">
          <FileBrowser
            currentFolderId={null}
            base="/portal"
            folderHrefBase="/portal/folder"
            folderHrefSuffix="?tier=regular"
            folders={regular.folderRows}
            files={regular.fileRows}
            moveTargets={regular.moveTargets}
            currency={currency}
            endpoints={{
              move: "/api/portal/move",
              folders: "/api/portal/folders",
              delete: "/api/portal/delete",
              deepSelect: "/api/portal/deep-cart/add",
              deepUnselect: "/api/portal/deep-cart/remove",
            }}
          />
        </div>
      </section>
    </div>
  );
}

/* ---------------- Deep Storage (frozen archives) ---------------- */

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

async function loadPendingDeep(
  accountId: string,
  customerIds: string[],
  studioNameByCustomer: Map<string, string>
) {
  const [files, pathById] = await Promise.all([
    getSelectedDeepFiles(accountId, customerIds),
    folderPathMap(accountId, customerIds),
  ]);

  // Studio deliveries collapse into ONE row each.
  const studio = new Map<
    string,
    { studioSpace: string; name: string; fileIds: string[]; fileCount: number; sizeBytes: number }
  >();
  // Own selected files, grouped by folderId ("root" = no folder).
  const ownByFolder = new Map<string, typeof files>();

  for (const f of files) {
    if (f.ownerType === "studio" && f.customerId) {
      const key = String(f.customerId);
      const g =
        studio.get(key) ??
        {
          studioSpace: key,
          name: studioNameByCustomer.get(key) ?? "Studio",
          fileIds: [],
          fileCount: 0,
          sizeBytes: 0,
        };
      g.fileIds.push(String(f._id));
      g.fileCount += 1;
      g.sizeBytes += f.size || 0;
      studio.set(key, g);
    } else {
      const key = f.folderId ? String(f.folderId) : "root";
      const arr = ownByFolder.get(key) ?? [];
      arr.push(f);
      ownByFolder.set(key, arr);
    }
  }

  // For each folder with selected files, how many files does it hold total? A
  // folder collapses into one row only if EVERY file in it is selected.
  const folderIds = [...ownByFolder.keys()].filter((k) => k !== "root");
  const totalByFolder = new Map<string, number>();
  if (folderIds.length) {
    const agg = await FileModel.aggregate([
      {
        $match: {
          ownerType: "customer",
          ownerAccountId: new mongoose.Types.ObjectId(accountId),
          status: "ready",
          deepStatus: { $ne: "archiving" },
          folderId: { $in: folderIds.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      { $group: { _id: "$folderId", total: { $sum: 1 } } },
    ]);
    for (const a of agg) totalByFolder.set(String(a._id), a.total as number);
  }

  const folderGroups: {
    folderId: string;
    name: string;
    fileIds: string[];
    fileCount: number;
    sizeBytes: number;
  }[] = [];
  const ownItems: {
    id: string;
    filename: string;
    size: number;
    folderPath: string;
  }[] = [];

  for (const [key, sel] of ownByFolder) {
    const asItems = () =>
      sel.forEach((f) =>
        ownItems.push({
          id: String(f._id),
          filename: f.filename,
          size: f.size,
          folderPath: key === "root" ? "" : pathById.get(key) ?? "",
        })
      );
    if (key === "root") {
      asItems();
      continue;
    }
    const total = totalByFolder.get(key) ?? sel.length;
    if (sel.length >= total && total > 0) {
      folderGroups.push({
        folderId: key,
        name: pathById.get(key) ?? "Folder",
        fileIds: sel.map((f) => String(f._id)),
        fileCount: sel.length,
        sizeBytes: sel.reduce((s, f) => s + (f.size || 0), 0),
      });
    } else {
      asItems();
    }
  }

  return {
    studioGroups: [...studio.values()],
    folderGroups,
    ownItems,
  };
}

/* ------- Shared deliveries → folder-style rows inside Temporary Storage ------- */

type SharedRow = {
  id: string;
  name: string;
  fileCount: number;
  sizeBytes: number;
  allSelected: boolean;
};

async function loadSharedRows(
  accounts: { id: string; studioId: string }[],
  studioNameById: Map<string, string>,
  myAccountId: string
): Promise<SharedRow[]> {
  if (accounts.length === 0) return [];
  await connectToDatabase();

  // Files this customer already moved (to Regular/Deep) — exclude from counts.
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
        ...(takenIds.length ? { _id: { $nin: takenIds } } : {}),
      },
    },
    {
      $group: {
        _id: "$customerId",
        n: { $sum: 1 },
        bytes: { $sum: "$size" },
        selectedN: {
          $sum: { $cond: [{ $eq: ["$deepStatus", "selected"] }, 1, 0] },
        },
      },
    },
  ]);
  const statById = new Map<string, { n: number; bytes: number; selectedN: number }>(
    agg.map((c) => [
      String(c._id),
      { n: c.n as number, bytes: c.bytes as number, selectedN: c.selectedN as number },
    ])
  );

  return accounts
    .map((a) => {
      const stat = statById.get(a.id) ?? { n: 0, bytes: 0, selectedN: 0 };
      return {
        id: a.id,
        name: studioNameById.get(a.studioId) || "Studio",
        fileCount: stat.n,
        sizeBytes: stat.bytes,
        allSelected: stat.n > 0 && stat.selectedN === stat.n,
      };
    })
    .filter((r) => r.fileCount > 0);
}
