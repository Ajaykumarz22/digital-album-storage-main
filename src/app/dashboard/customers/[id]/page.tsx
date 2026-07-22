import Link from "next/link";
import { formatBytes } from "@/lib/format";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";
import { ArchiveModel } from "@/models/Archive";
import { getOwnedCustomer } from "@/lib/studio";
import { getCurrentRole } from "@/lib/roles";
import { getCurrency } from "@/lib/geo";
import ArchiveList, { type ArchiveRow } from "@/components/archives/ArchiveList";
import {
  resolveFolder,
  getBreadcrumb,
  loadAllFolders,
  buildFolderPaths,
} from "@/lib/folders";
import FileManager from "@/components/files/FileManager";
import FileBrowser from "@/components/files/FileBrowser";
import CopyButton from "@/components/CopyButton";
import Tabs from "@/components/Tabs";
import Faq from "@/components/Faq";


function iso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString();
}

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "business") redirect("/portal");

  const { id } = await params;
  const customer = await getOwnedCustomer(id);
  if (!customer) notFound();

  const scope = { customerId: customer._id, ownerType: "studio" as const };
  const { folder: folderParam } = await searchParams;
  const resolved = await resolveFolder(scope, folderParam);
  const currentFolderId = resolved.ok ? resolved.folderId : null;

  await connectToDatabase();
  // Studio only ever sees its OWN uploads — never the customer's private files.
  const [folders, files, breadcrumb, allFolders] = await Promise.all([
    Folder.find({
      customerId: customer._id,
      ownerType: "studio",
      parentId: currentFolderId,
    })
      .sort({ name: 1 })
      .lean(),
    FileModel.find({
      customerId: customer._id,
      ownerType: "studio",
      folderId: currentFolderId,
      status: "ready",
    })
      .sort({ createdAt: -1 })
      .lean(),
    getBreadcrumb(scope, currentFolderId),
    loadAllFolders(scope),
  ]);

  const base = `/dashboard/customers/${String(customer._id)}`;
  const moveTargets = buildFolderPaths(allFolders);
  const currency = await getCurrency();

  const archiveDocs = await ArchiveModel.find({
    ownerType: "studio",
    studioId: customer.studioId,
    customerId: customer._id,
    status: { $ne: "deleted" },
  })
    .sort({ createdAt: -1 })
    .select("name fileCount sizeBytes status termYears")
    .lean();
  const archives: ArchiveRow[] = archiveDocs.map((a) => ({
    id: String(a._id),
    name: a.name,
    fileCount: a.fileCount,
    sizeBytes: a.sizeBytes,
    status: a.status,
    termYears: a.termYears,
  }));

  const folderRows = folders.map((f) => ({
    id: String(f._id),
    name: f.name,
    createdAt: iso(f.createdAt),
  }));
  const fileRows = files.map((f) => ({
    id: String(f._id),
    filename: f.filename,
    size: f.size,
    createdAt: iso(f.createdAt),
  }));

  // Absolute portal link to share with the customer.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const portalUrl = `${proto}://${host}/portal`;

  return (
    <div className="mx-auto max-w-5xl px-6 pb-12">
      <Tabs
        tabs={[
          {
            key: "uploads",
            label: "My Uploads",
            content: (
              <div className="space-y-4">
                <div>
                  <Link
                    href="/dashboard"
                    className="mt-4 inline-block text-sm text-black/50 hover:underline dark:text-white/50"
                  >
                    ← Back to dashboard
                  </Link>
                  {/* Customer name (title) + email (subtitle) with the Upload
                      button aligned right */}
                  <FileManager
                    title={customer.name || customer.email}
                    subtitle={`${customer.email} · ${formatBytes(
                      customer.storageBytes
                    )} used`}
                    currentFolderId={currentFolderId}
                    endpoints={{
                      presign: "/api/uploads/presign",
                      confirm: "/api/uploads/confirm",
                      folders: "/api/folders",
                    }}
                    baseBody={{ customerId: String(customer._id) }}
                  />
                </div>

                <section>
                  {/* Breadcrumb — only when inside a folder */}
                  {breadcrumb.length > 0 && (
                    <nav className="mb-3 mt-3 flex flex-wrap items-center gap-1 text-sm">
                      <Link href={base} className="hover:underline">
                        Hot drive
                      </Link>
                      {breadcrumb.map((b) => (
                        <span key={b.id} className="flex items-center gap-1">
                          <span className="text-black/30 dark:text-white/30">/</span>
                          <Link
                            href={`${base}?folder=${b.id}`}
                            className="hover:underline"
                          >
                            {b.name}
                          </Link>
                        </span>
                      ))}
                    </nav>
                  )}

                  <div>
                    <FileBrowser
                      currentFolderId={currentFolderId}
                      base={base}
                      folders={folderRows}
                      files={fileRows}
                      moveTargets={moveTargets}
                      currency={currency}
                      endpoints={{
                        move: "/api/items/move",
                        folders: "/api/folders",
                        delete: "/api/items/delete",
                        archiveQuote: "/api/studio/archive/quote",
                        archiveCreate: "/api/studio/archive/create",
                      }}
                      baseBody={{ customerId: String(customer._id) }}
                    />
                  </div>
                </section>
                <Faq />
              </div>
            ),
          },
          {
            key: "cold",
            label: "Cold Drive",
            content: (
              <div className="mt-6 space-y-4">
                <h1 className="text-lg font-semibold">Cold Drive</h1>
                <ArchiveList
                  archives={archives}
                  browseBase={`${base}/archive`}
                  emptyHint="No archives yet. Select delivered files in My Uploads and choose “Move to Cold Drive”."
                />
                <Faq />
              </div>
            ),
          },
        ]}
      />

      <section className="mt-10 rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-sm font-semibold">Share access with your customer</h2>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Tell your customer to open the link below and sign in with{" "}
          <span className="font-medium text-black/80 dark:text-white/80">
            {customer.email}
          </span>{" "}
          to view and download their files.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-md bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
            {portalUrl}
          </code>
          <CopyButton text={portalUrl} label="Copy link" />
          <CopyButton text={customer.email} label="Copy email" />
        </div>
      </section>
    </div>
  );
}
