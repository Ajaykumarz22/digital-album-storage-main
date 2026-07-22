import Link from "next/link";
import { formatBytes } from "@/lib/format";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getMyAccount, getMyUsedBytes } from "@/lib/account";


export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const account = await getMyAccount();
  if (!account) redirect("/setup");

  const backHref = account.type === "business" ? "/dashboard" : "/portal";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={backHref}
        className="text-sm text-black/50 hover:underline dark:text-white/50"
      >
        ← Back
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">Manage subscription</h1>

      {account.type === "business" ? (
        <BusinessDetails
          businessName={account.businessName}
          avgCustomers={account.avgCustomersMonthly}
          status={account.subscriptionStatus}
        />
      ) : (
        <PersonalDetails
          regularBytes={account.regularBytes ?? 0}
        />
      )}
    </div>
  );
}

async function PersonalDetails({ regularBytes }: { regularBytes: number }) {
  const used = await getMyUsedBytes();

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-black/10 p-6 dark:border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Account type
          </span>
          <span className="font-medium">Personal</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Hot drive
          </span>
          <span className="font-medium">
            {formatBytes(used)} used of {formatBytes(regularBytes)} purchased
          </span>
        </div>
      </div>

      <Link
        href="/portal"
        className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Manage &amp; buy storage
      </Link>

      <p className="text-sm text-black/50 dark:text-white/50">
        Uploading is free — files land in Temporary storage (auto-delete after
        15 days). Buy Hot drive from your storage page to keep files
        permanently.
      </p>
    </div>
  );
}

function BusinessDetails({
  businessName,
  avgCustomers,
  status,
}: {
  businessName: string;
  avgCustomers: number;
  status: string;
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-black/10 p-6 dark:border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Account type
          </span>
          <span className="font-medium">Business</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Business name
          </span>
          <span className="font-medium">{businessName || "—"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Avg. customers / month
          </span>
          <span className="font-medium">{avgCustomers || "—"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Monthly charge
          </span>
          <span className="font-medium">$0</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Status
          </span>
          <span className="font-medium capitalize">{status}</span>
        </div>
      </div>

      <Link
        href="/setup"
        className="inline-block rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      >
        Edit details
      </Link>
    </div>
  );
}
