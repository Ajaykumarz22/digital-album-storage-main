import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FileModel } from "@/models/File";
import { Folder } from "@/models/Folder";
import { Studio } from "@/models/Studio";
import { getMyCustomerAccounts } from "@/lib/customer";
import { getCurrentRole } from "@/lib/roles";
import { resolveFolder, getBreadcrumb } from "@/lib/folders";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(d: unknown): string {
  const date = d instanceof Date ? d : new Date(String(d));
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default async function SharedSpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ studioSpace: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "customer") redirect("/dashboard");

  const { studioSpace } = await params;
  const { folder: folderParam } = await searchParams;

  // The studioSpace must be one of this person's own delivery accounts.
  const accounts = await getMyCustomerAccounts();
  const account = accounts.find((a) => String(a._id) === studioSpace);
  if (!account) notFound();

  await connectToDatabase();
  const studio = await Studio.findById(account.studioId)
    .select("name email")
    .lean<{ name: string; email: string } | null>();
  const studioName = studio?.name || studio?.email || "Studio";

  const scope = { customerId: studioSpace, ownerType: "studio" as const };
  const resolved = await resolveFolder(scope, folderParam);
  const currentFolderId = resolved.ok ? resolved.folderId : null;
  const locked = account.status === "locked";

  const [folders, files, breadcrumb] = await Promise.all([
    Folder.find({ ...scope, parentId: currentFolderId }).sort({ name: 1 }).lean(),
    FileModel.find({ ...scope, folderId: currentFolderId, status: "ready" })
      .sort({ createdAt: -1 })
      .lean(),
    getBreadcrumb(scope, currentFolderId),
  ]);

  const base = `/portal/shared/${studioSpace}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/portal"
        className="text-sm text-black/50 hover:underline dark:text-white/50"
      >
        ← Back to My Photos
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">Shared by {studioName}</h1>

      {/* Breadcrumb */}
      <nav className="mb-3 mt-4 flex flex-wrap items-center gap-1 text-sm">
        <Link href={base} className="hover:underline">
          {studioName}
        </Link>
        {breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <span className="text-black/30 dark:text-white/30">/</span>
            <Link href={`${base}?folder=${b.id}`} className="hover:underline">
              {b.name}
            </Link>
          </span>
        ))}
      </nav>

      {locked && (
        <p className="mb-3 rounded-md border border-red-500/40 bg-red-500/5 px-4 py-2 text-sm text-red-600">
          Your access is locked. Subscribe to download these files.
        </p>
      )}

      {folders.length === 0 && files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          This folder is empty.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {folders.map((fld) => (
                <tr
                  key={String(fld._id)}
                  className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`${base}?folder=${String(fld._id)}`}
                      className="font-medium hover:underline"
                    >
                      📁 {fld.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-black/40 dark:text-white/40">—</td>
                  <td className="px-4 py-3 text-black/60 dark:text-white/60">
                    {formatDate(fld.createdAt)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))}
              {files.map((f) => (
                <tr
                  key={String(f._id)}
                  className="border-b border-black/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-4 py-3">{f.filename}</td>
                  <td className="px-4 py-3">{formatBytes(f.size)}</td>
                  <td className="px-4 py-3 text-black/60 dark:text-white/60">
                    {formatDate(f.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {locked ? (
                      <span className="text-black/40 dark:text-white/40">
                        Locked
                      </span>
                    ) : (
                      <a
                        href={`/api/files/${String(f._id)}/download`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
