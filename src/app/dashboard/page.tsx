import Link from "next/link";
import { formatBytes } from "@/lib/format";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/models/Customer";
import { getOrCreateCurrentStudio } from "@/lib/studio";
import { getCurrentRole } from "@/lib/roles";
import CreateCustomerForm from "./CreateCustomerForm";


function statusLabel(status: string, trialEndsAt: Date): string {
  if (status === "subscribed") return "Subscribed";
  if (status === "locked") return "Locked";
  const daysLeft = Math.ceil(
    (new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  return daysLeft > 0 ? `Trial - ${daysLeft} days left` : "Trial ended";
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Only business accounts belong here.
  const role = await getCurrentRole();
  if (!role) redirect("/setup");
  if (role !== "business") redirect("/portal");

  const studio = await getOrCreateCurrentStudio();
  if (!studio) redirect("/sign-in");

  await connectToDatabase();
  const customers = await Customer.find({ studioId: studio._id })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Studio dashboard</h1>
      <p className="mt-2 text-black/60 dark:text-white/60">
        Create an account for each client, then upload their photos and videos.
      </p>

      <section className="mt-8 rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-sm font-semibold">Add a customer</h2>
        <p className="mb-4 mt-1 text-sm text-black/50 dark:text-white/50">
          They get 15 days free, then subscribe to keep their files.
        </p>
        <CreateCustomerForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">
          Your customers ({customers.length})
        </h2>

        {customers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 p-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            No customers yet. Add your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={String(c._id)}
                    className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/customers/${String(c._id)}`}
                        className="block"
                      >
                        <div className="font-medium hover:underline">
                          {c.name || "-"}
                        </div>
                        <div className="text-black/50 dark:text-white/50">
                          {c.email}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatBytes(c.storageBytes)}</td>
                    <td className="px-4 py-3">
                      {statusLabel(c.status, c.trialEndsAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
