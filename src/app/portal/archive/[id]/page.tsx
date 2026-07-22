import Link from "next/link";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getMyOwner } from "@/lib/account";
import { getCurrentRole } from "@/lib/roles";
import { getCurrency } from "@/lib/geo";
import { archiveStatus } from "@/lib/archiveStatus";
import { restoreQuote } from "@/lib/archivePricing";
import RestoreControls from "@/components/archives/RestoreControls";
import { ArchiveModel } from "@/models/Archive";
import { ArchiveItemModel } from "@/models/ArchiveItem";

function money(usd: number, inr: number, currency: "USD" | "INR"): string {
  return currency === "INR"
    ? `₹${inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function formatDate(d: unknown): string {
  if (!d) return "—";
  const x = new Date(d as string);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`;
}

export default async function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  await connectToDatabase();
  const archive = await ArchiveModel.findOne({
    _id: id,
    ownerType: "customer",
    ownerAccountId: owner.accountId,
    status: { $ne: "deleted" },
  }).lean();
  if (!archive) notFound();

  const items = await ArchiveItemModel.find({ archiveId: id })
    .select("path filename size")
    .sort({ path: 1, filename: 1 })
    .lean();

  const st = archiveStatus(archive.status);
  const currency = await getCurrency();
  const rQuote = restoreQuote(archive.sizeBytes);
  const feeLabel = money(rQuote.usd, rQuote.inr, currency);
  const availableUntil = formatDate(archive.restore?.availableUntil);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <div>
        <Link href="/portal" className="text-sm text-blue-600 hover:underline">
          ← Back to My Space
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">🧊 {archive.name}</h1>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-black/10 p-5 text-sm dark:border-white/10 sm:grid-cols-4">
        <Stat label="Status" value={st.label} valueCls={st.cls} />
        <Stat label="Files" value={String(archive.fileCount)} />
        <Stat label="Size" value={formatBytes(archive.sizeBytes)} />
        <Stat label="Kept for" value={`${archive.termYears} years`} />
        <Stat label="Archived on" value={formatDate(archive.archivedAt)} />
        <Stat label="Expires" value={formatDate(archive.expiresAt)} />
      </div>

      <RestoreControls
        archiveId={String(archive._id)}
        status={archive.status}
        currency={currency}
        feeLabel={feeLabel}
        availableUntil={
          archive.status === "available" ? availableUntil : null
        }
      />

      {/* Manifest */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Contents</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Folder</th>
                <th className="px-4 py-3 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={String(it._id)}
                  className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">{it.filename}</td>
                  <td className="px-4 py-3 text-black/60 dark:text-white/60">
                    {it.path || "—"}
                  </td>
                  <td className="px-4 py-3">{formatBytes(it.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueCls = "",
}: {
  label: string;
  value: string;
  valueCls?: string;
}) {
  return (
    <div>
      <div className="text-black/50 dark:text-white/50">{label}</div>
      <div className={`mt-0.5 font-medium ${valueCls}`}>{value}</div>
    </div>
  );
}
