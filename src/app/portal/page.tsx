import Link from "next/link";
import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";
import { Studio } from "@/models/Studio";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getCurrentRole } from "@/lib/roles";
import { getMyEmail, customerScope } from "@/lib/portal";
import { getMyAccount } from "@/lib/account";
import {
  resolveFolder,
  getBreadcrumb,
  loadAllFolders,
  buildFolderPaths,
} from "@/lib/folders";
import FileManager from "@/components/files/FileManager";
import FileBrowser from "@/components/files/FileBrowser";
import AddToDriveButton from "./AddToDriveButton";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function iso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString();
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "customer") redirect("/dashboard");

  const email = await getMyEmail();
  if (!email) redirect("/sign-in");

  // Uploads are only allowed once the personal account has an active plan.
  const account = await getMyAccount();
  const canUpload = account?.subscriptionStatus === "active";

  const sp = await searchParams;

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

  const drive = await loadMyDrive(email, sp.folder);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <h1 className="text-2xl font-semibold">My Photos</h1>

      {/* Upload — only for customers with an active plan */}
      {canUpload ? (
        <section className="rounded-lg border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 text-sm font-semibold">Upload</h2>
          <FileManager
            currentFolderId={drive.currentFolderId}
            endpoints={{
              presign: "/api/portal/presign",
              confirm: "/api/portal/confirm",
              folders: "/api/portal/folders",
            }}
          />
        </section>
      ) : (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-6">
          <h2 className="text-sm font-semibold">Choose a plan to upload</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            You can view and download files shared with you, but uploading your
            own files needs a storage plan.
          </p>
          <Link
            href="/setup"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Choose a plan
          </Link>
        </section>
      )}

      {/* Shared with me — next */}
      <section>
        <h2 className="text-lg font-semibold">Shared with me</h2>
        <SharedWithMe
          accounts={accounts.map((a) => ({
            id: String(a._id),
            studioId: String(a.studioId),
            storageBytes: a.storageBytes,
          }))}
          studioNameById={studioNameById}
          canImport={canUpload}
        />
      </section>

      {/* My Drive — the file list, last */}
      <section>
        <h2 className="text-lg font-semibold">My Drive</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Your own private files — {formatBytes(drive.usage)} used. Studios
          can&apos;t see these.
        </p>

        <div className="mt-4">
          {drive.breadcrumb.length > 0 && (
            <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm">
              {drive.breadcrumb.map((b, i) => (
                <span key={b.id} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-black/30 dark:text-white/30">/</span>
                  )}
                  <Link
                    href={`/portal?folder=${b.id}`}
                    className="hover:underline"
                  >
                    {b.name}
                  </Link>
                </span>
              ))}
            </nav>
          )}

          <FileBrowser
            currentFolderId={drive.currentFolderId}
            base="/portal"
            folders={drive.folderRows}
            files={drive.fileRows}
            moveTargets={drive.moveTargets}
            endpoints={{
              move: "/api/portal/move",
              folders: "/api/portal/folders",
              delete: "/api/portal/delete",
            }}
          />
        </div>
      </section>
    </div>
  );
}

/* ---------------- My Drive data loader ---------------- */

async function loadMyDrive(email: string, folderParam?: string) {
  const scope = customerScope(email);
  const resolved = await resolveFolder(scope, folderParam);
  const currentFolderId = resolved.ok ? resolved.folderId : null;

  const [folders, files, breadcrumb, allFolders, usageAgg] = await Promise.all([
    Folder.find({ ...scope, parentId: currentFolderId }).sort({ name: 1 }).lean(),
    FileModel.find({ ...scope, folderId: currentFolderId, status: "ready" })
      .sort({ createdAt: -1 })
      .lean(),
    getBreadcrumb(scope, currentFolderId),
    loadAllFolders(scope),
    FileModel.aggregate([
      { $match: { ownerType: "customer", ownerEmail: email, status: "ready" } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]),
  ]);

  return {
    currentFolderId,
    usage: (usageAgg[0]?.total as number) ?? 0,
    breadcrumb,
    moveTargets: buildFolderPaths(allFolders),
    folderRows: folders.map((f) => ({
      id: String(f._id),
      name: f.name,
      createdAt: iso(f.createdAt),
    })),
    fileRows: files.map((f) => ({
      id: String(f._id),
      filename: f.filename,
      size: f.size,
      createdAt: iso(f.createdAt),
    })),
  };
}

/* ---------------- Shared with me (studio deliveries, read-only) ---------------- */

async function SharedWithMe({
  accounts,
  studioNameById,
  canImport,
}: {
  accounts: { id: string; studioId: string; storageBytes: number }[];
  studioNameById: Map<string, string>;
  canImport: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-black/15 p-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        No studio has shared anything with you yet. Make sure you signed in with
        the same email your studio used.
      </p>
    );
  }

  // Count how many files each studio has shared, for the "Files" column.
  const ids = accounts.map((a) => new mongoose.Types.ObjectId(a.id));
  const countAgg = await FileModel.aggregate([
    { $match: { customerId: { $in: ids }, ownerType: "studio", status: "ready" } },
    { $group: { _id: "$customerId", n: { $sum: 1 } } },
  ]);
  const countById = new Map<string, number>(
    countAgg.map((c) => [String(c._id), c.n as number])
  );

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Shared by</th>
            <th className="px-4 py-3 font-medium">Files</th>
            <th className="px-4 py-3 font-medium">Size</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr
              key={a.id}
              className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3 font-medium">
                📁 {studioNameById.get(a.studioId) || "Studio"}
              </td>
              <td className="px-4 py-3">{countById.get(a.id) ?? 0}</td>
              <td className="px-4 py-3">{formatBytes(a.storageBytes)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-4">
                  <Link
                    href={`/portal/shared/${a.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                  <AddToDriveButton studioSpaceId={a.id} canImport={canImport} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
