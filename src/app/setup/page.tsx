import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/models/Customer";
import { getMyAccount, getMyUsedBytes } from "@/lib/account";
import { getCurrency } from "@/lib/geo";
import { PLANS, planPrice, type Currency } from "@/lib/plans";
import CurrencySelect from "@/components/CurrencySelect";
import { chooseType, selectPlan, skipPlan, saveBusiness } from "./actions";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";

  // Currency: user override (?currency=) wins, else auto-detect from geo.
  const { currency: currencyParam } = await searchParams;
  const currency: Currency =
    currencyParam === "INR" || currencyParam === "USD"
      ? currencyParam
      : await getCurrency();

  const account = await getMyAccount();

  // Setup is complete once a subscription is active → go to the right home.
  if (account?.subscriptionStatus === "active") {
    redirect(account.type === "business" ? "/dashboard" : "/portal");
  }

  let role = user?.publicMetadata?.role as "business" | "customer" | undefined;

  // If a studio already added this email as a customer, force personal type.
  if (!role) {
    await connectToDatabase();
    const invited = await Customer.exists({ email });
    if (invited) {
      const client = await clerkClient();
      await client.users.updateUser(userId, {
        publicMetadata: { role: "customer" },
      });
      role = "customer";
    }
  }

  const effectiveType: "personal" | "business" | null =
    account?.type ?? (role === "business" ? "business" : role === "customer" ? "personal" : null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-center text-4xl font-semibold">
        Set up your account
      </h1>

      {/* Step 1 — choose type (only if not chosen yet) */}
      {!effectiveType && (
        <>
          <p className="mt-3 text-center text-xl text-black/60 dark:text-white/60">
            How will you use Reel Pouches?
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <form
              action={chooseType.bind(null, "personal")}
              className="flex flex-col rounded-xl border border-black/10 p-7 dark:border-white/10"
            >
              <h2 className="text-2xl font-semibold">Personal use</h2>
              <p className="mt-3 flex-1 text-lg text-black/60 dark:text-white/60">
                Store your own photos and videos, and receive files shared by a
                studio.
              </p>
              <button className="mt-6 rounded-md bg-foreground px-5 py-3 text-base font-medium text-background hover:opacity-90">
                Continue — Personal
              </button>
            </form>

            <form
              action={chooseType.bind(null, "business")}
              className="flex flex-col rounded-xl border border-black/10 p-7 dark:border-white/10"
            >
              <h2 className="text-2xl font-semibold">Business purpose</h2>
              <p className="mt-3 flex-1 text-lg text-black/60 dark:text-white/60">
                A photo/video studio sharing galleries with your clients.
              </p>
              <button className="mt-6 rounded-md border border-black/15 px-5 py-3 text-base font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
                Continue — Business
              </button>
            </form>
          </div>
        </>
      )}

      {/* Personal — choose a storage plan */}
      {effectiveType === "personal" && (
        <PersonalPlans
          email={email}
          currentPlanId={account?.planId ?? null}
          currency={currency}
        />
      )}

      {/* Business — details + $0 subscribe */}
      {effectiveType === "business" && (
        <BusinessSetup
          businessName={account?.businessName ?? ""}
          avgCustomers={account?.avgCustomersMonthly ?? 0}
        />
      )}
    </div>
  );
}

async function PersonalPlans({
  email,
  currentPlanId,
  currency,
}: {
  email: string;
  currentPlanId: string | null;
  currency: Currency;
}) {
  const used = await getMyUsedBytes(email);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl text-black/60 dark:text-white/60">
          Choose a monthly storage plan — cheaper than Google Drive.
        </p>
        <CurrencySelect value={currency} />
      </div>
      {used > 0 && (
        <p className="mt-2 text-base text-amber-600">
          You&apos;re already using {formatBytes(used)} — pick a plan at least
          that large.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {PLANS.map((plan) => {
          const price = planPrice(plan, currency);
          const tooSmall = plan.bytes < used;
          const isCurrent = plan.id === currentPlanId;
          return (
            <form key={plan.id} action={selectPlan.bind(null, plan.id)}>
              <button
                disabled={tooSmall}
                className={`flex w-full items-center justify-between gap-4 rounded-lg border p-5 text-left transition-colors ${
                  isCurrent
                    ? "border-foreground"
                    : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
                } ${tooSmall ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <div className="flex items-center gap-5">
                  <span className="w-24 text-xl font-semibold">
                    {plan.label}
                  </span>
                  <span className="text-base text-black/40 line-through dark:text-white/40">
                    Google One {price.google}/month
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <span className="text-2xl font-semibold">
                    {price.ours}
                    <span className="text-base font-medium text-black/70 dark:text-white/70">
                      /month
                    </span>
                  </span>
                  {isCurrent ? (
                    <span className="w-28 text-right text-sm font-medium text-green-600">
                      Current plan
                    </span>
                  ) : tooSmall ? (
                    <span className="w-28 text-right text-sm font-medium text-red-600">
                      Too small
                    </span>
                  ) : (
                    <span className="w-28 text-right text-base font-medium text-blue-600">
                      Select →
                    </span>
                  )}
                </div>
              </button>
            </form>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <form action={skipPlan}>
          <button className="text-base text-black/50 hover:underline dark:text-white/50">
            Skip for now (you can pick a plan later, but you won&apos;t be able
            to upload)
          </button>
        </form>
      </div>
    </div>
  );
}

function BusinessSetup({
  businessName,
  avgCustomers,
}: {
  businessName: string;
  avgCustomers: number;
}) {
  return (
    <div className="mx-auto mt-8 max-w-lg">
      <p className="text-lg text-black/60 dark:text-white/60">
        Your business account is set up to share photos with your customers.
        Note: business accounts don&apos;t get personal storage for permanent
        uploads.
      </p>

      <form action={saveBusiness} className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-base font-medium">
            Business name <span className="text-red-600">*</span>
          </label>
          <input
            name="businessName"
            required
            defaultValue={businessName}
            placeholder="e.g. Ajay Kumar Studios"
            className="w-full rounded-md border border-black/15 px-3 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-base font-medium">
            On average, how many customers do you share photos with monthly?
          </label>
          <input
            name="avgCustomers"
            type="number"
            min="0"
            defaultValue={avgCustomers || ""}
            placeholder="e.g. 20"
            className="w-full rounded-md border border-black/15 px-3 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
          />
        </div>

        <div className="rounded-lg border border-black/10 p-5 dark:border-white/10">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-medium">Monthly charge</span>
            <span className="text-3xl font-semibold">$0</span>
          </div>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            Free for now.
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-foreground px-5 py-3 text-base font-medium text-background hover:opacity-90"
        >
          Subscribe &amp; continue
        </button>
      </form>
    </div>
  );
}
