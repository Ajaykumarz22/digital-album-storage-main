import type { Metadata } from "next";
import { getCurrency } from "@/lib/geo";
import { deepPerTB } from "@/lib/archivePricing";
import { regularPerTB } from "@/lib/regularPricing";

export const metadata: Metadata = { title: "Pricing · Reel Pouches" };

export default async function PricingPage() {
  const currency = await getCurrency();
  const money = (n: number) =>
    currency === "INR"
      ? `₹${Math.round(n).toLocaleString("en-IN")}`
      : `$${n.toFixed(2)}`;

  const hot = regularPerTB(currency);
  const cold = deepPerTB(currency);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pricing</h1>
      <p className="mt-3 text-base text-black/50 dark:text-white/50">
        Pay only for what you keep.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {/* My Uploads — free, temporary */}
        <section className="rounded-2xl border border-black/10 p-8 dark:border-white/10">
          <h2 className="text-xl font-semibold">My Uploads</h2>
          <div className="mt-8 text-5xl font-bold tracking-tight">Free</div>
          <p className="mt-4 text-base text-black/60 dark:text-white/60">
            Auto-deletes after 15 days.
          </p>
        </section>

        {/* Hot storage — regular */}
        <PriceCard title="Hot storage" perMonth={money(hot.perMonth)} perYear={money(hot.perYear)} />

        {/* Cold storage — deep archive */}
        <PriceCard title="Cold storage" perMonth={money(cold.perMonth)} perYear={money(cold.perYear)} />
      </div>
    </div>
  );
}

function PriceCard({
  title,
  perMonth,
  perYear,
}: {
  title: string;
  perMonth: string;
  perYear: string;
}) {
  return (
    <section className="rounded-2xl border border-black/10 p-8 dark:border-white/10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-8 flex items-baseline gap-1.5">
        <span className="text-5xl font-bold tracking-tight">{perMonth}</span>
        <span className="text-lg text-black/50 dark:text-white/50">/TB/mo</span>
      </div>
      <p className="mt-4 text-base text-black/60 dark:text-white/60">
        <span className="font-semibold text-foreground">{perYear}</span> /TB per year
      </p>
    </section>
  );
}
