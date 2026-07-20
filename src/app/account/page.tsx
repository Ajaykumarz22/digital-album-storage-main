import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getMyAccount, getMyUsedBytes } from "@/lib/account";
import { getCurrency } from "@/lib/geo";
import { getPlan, planPrice } from "@/lib/plans";
import { cancelPlan } from "./actions";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const account = await getMyAccount();
  if (!account) redirect("/setup");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
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
          email={email}
          planId={account.planId ?? null}
          status={account.subscriptionStatus}
        />
      )}
    </div>
  );
}

async function PersonalDetails({
  email,
  planId,
  status,
}: {
  email: string;
  planId: string | null;
  status: string;
}) {
  const currency = await getCurrency();
  const used = await getMyUsedBytes(email);
  const plan = planId ? getPlan(planId) : null;
  const active = status === "active" && plan;

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
            Current plan
          </span>
          <span className="font-medium">
            {active ? plan!.label : "No active plan"}
          </span>
        </div>
        {active && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-black/50 dark:text-white/50">
              Price
            </span>
            <span className="font-medium">
              {planPrice(plan!, currency).ours}/month
            </span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/50 dark:text-white/50">
            Storage used
          </span>
          <span className="font-medium">
            {formatBytes(used)}
            {active ? ` of ${plan!.label}` : ""}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/setup"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          {active ? "Change plan" : "Choose a plan"}
        </Link>
        {active && (
          <form action={cancelPlan}>
            <button className="rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10">
              Cancel plan
            </button>
          </form>
        )}
      </div>

      {!active && (
        <p className="text-sm text-amber-600">
          Without a plan you can view and download shared files, but you
          can&apos;t upload your own.
        </p>
      )}
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
