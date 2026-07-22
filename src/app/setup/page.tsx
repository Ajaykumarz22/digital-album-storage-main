import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/models/Customer";
import { getMyAccount } from "@/lib/account";
import { chooseType, activatePersonal, saveBusiness } from "./actions";

export default async function SetupPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";

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

      {/* Personal — nothing to buy here; uploads are free (Temporary tier) */}
      {effectiveType === "personal" && <PersonalSetup />}

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

function PersonalSetup() {
  return (
    <div className="mx-auto mt-8 max-w-lg">
      <div className="rounded-xl border border-black/10 p-7 dark:border-white/10">
        <h2 className="text-2xl font-semibold">You&apos;re all set</h2>
        <ul className="mt-4 space-y-2 text-base text-black/60 dark:text-white/60">
          <li>• Uploads are free and land in Temporary storage.</li>
          <li>• Temporary files auto-delete 15 days after upload.</li>
          <li>
            • Keep files by moving them to Regular storage (buy space anytime)
            or Deep Storage.
          </li>
        </ul>
        <form action={activatePersonal} className="mt-6">
          <button className="w-full rounded-md bg-foreground px-5 py-3 text-base font-medium text-background hover:opacity-90">
            Continue to my storage
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
