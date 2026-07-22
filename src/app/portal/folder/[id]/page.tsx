import Link from "next/link";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/roles";
import { getMyOwner, getMyAccount } from "@/lib/account";
import { getCurrency } from "@/lib/geo";
import { loadTier, type Tier } from "@/lib/portalDrive";
import FileBrowser from "@/components/files/FileBrowser";

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "customer") redirect("/dashboard");

  const owner = await getMyOwner();
  if (!owner) redirect("/setup");

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();
  const { tier: tierParam } = await searchParams;
  const tier: Tier = tierParam === "regular" ? "regular" : "temporary";

  const drive = await loadTier(owner.accountId, tier, id);
  if (!drive.folderValid || !drive.currentFolderId) notFound();

  const account = await getMyAccount();
  const canImport = (account?.regularBytes ?? 0) > 0;
  const currency = await getCurrency();

  const folderHref = (fid: string) => `/portal/folder/${fid}?tier=${tier}`;
  const tierLabel = tier === "regular" ? "Regular storage" : "Temporary storage";
  const current = drive.breadcrumb[drive.breadcrumb.length - 1];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/portal" className="text-sm text-blue-600 hover:underline">
        ← Back to My Storage
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">📁 {current?.name}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        In {tierLabel}
      </p>

      {/* Breadcrumb */}
      <nav className="mb-3 mt-4 flex flex-wrap items-center gap-1 text-sm">
        <Link href="/portal" className="hover:underline">
          {tierLabel}
        </Link>
        {drive.breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <span className="text-black/30 dark:text-white/30">/</span>
            {b.id === current?.id ? (
              <span className="text-black/60 dark:text-white/60">{b.name}</span>
            ) : (
              <Link href={folderHref(b.id)} className="hover:underline">
                {b.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <FileBrowser
        currentFolderId={drive.currentFolderId}
        base="/portal"
        folderHrefBase="/portal/folder"
        folderHrefSuffix={`?tier=${tier}`}
        showExpiry={tier === "temporary"}
        folders={drive.folderRows}
        files={drive.fileRows}
        moveTargets={drive.moveTargets}
        currency={currency}
        canImport={canImport}
        endpoints={{
          move: "/api/portal/move",
          folders: "/api/portal/folders",
          delete: "/api/portal/delete",
          deepSelect: "/api/portal/deep-cart/add",
          deepUnselect: "/api/portal/deep-cart/remove",
          ...(tier === "temporary"
            ? { moveToRegular: "/api/portal/regular/move" }
            : {}),
        }}
      />
    </div>
  );
}
