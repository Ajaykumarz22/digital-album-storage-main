import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { getCurrentRole, homePathForRole, type Role } from "@/lib/roles";
import { getCurrency } from "@/lib/geo";
import { deepPerTB } from "@/lib/archivePricing";
import { regularPerTB } from "@/lib/regularPricing";
import Faq from "@/components/Faq";

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);
  const role = isSignedIn ? await getCurrentRole() : null;
  const homeHref = role ? homePathForRole(role) : "/setup";

  const currency = await getCurrency();
  const money = (n: number) =>
    currency === "INR"
      ? `₹${Math.round(n).toLocaleString("en-IN")}`
      : `$${n.toFixed(2)}`;
  const hot = regularPerTB(currency);
  const cold = deepPerTB(currency);

  const ctaProps = { isSignedIn, role, homeHref };

  return (
    <div className="flex flex-col">
      {/* ---------- HERO ---------- */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 py-12 sm:py-16 lg:flex-row lg:gap-16 lg:py-24">
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/60 dark:border-white/10 dark:text-white/60">
            Long-term storage for your memories
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Keep every memory.
            <br />
            Pay almost nothing to store it.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-black/60 dark:text-white/60">
            Weddings, birthdays, trips — the moments you never want to lose but
            rarely open. Reel Pouches keeps them safe for up to{" "}
            <span className="font-semibold text-foreground">9× less</span> than
            Google Drive.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <Cta {...ctaProps} label="Get started free" />
            <Link
              href="/pricing"
              className="text-sm font-medium text-black/60 underline-offset-4 hover:underline dark:text-white/60"
            >
              See pricing →
            </Link>
          </div>

          <p className="mt-6 text-sm text-black/50 dark:text-white/50">
            Cold Drive from{" "}
            <span className="font-semibold text-foreground">
              {money(cold.perMonth)}/TB per month
            </span>
          </p>
        </div>

        <div className="order-first w-full max-w-sm lg:order-none lg:max-w-none lg:flex-1">
          <Image
            src="/logo.png"
            alt="Reel Pouches"
            width={640}
            height={640}
            priority
            className="h-auto w-full rounded-2xl object-contain"
          />
        </div>
      </section>

      {/* ---------- PROBLEM ---------- */}
      <section className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            We all keep paying to store photos we never open.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-black/60 dark:text-white/60">
            Hard disks fail. Everyday cloud drives get more expensive every year
            — and force you to buy space in big chunks. So we keep paying premium
            prices to protect memories we look at maybe once a year. There should
            be a cheaper way to simply <em>keep</em> them.
          </p>
        </div>
      </section>

      {/* ---------- THREE WAYS TO STORE ---------- */}
      <section className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Three ways to store — pick what each memory needs
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <StoreCard
              icon={<ClockIcon />}
              title="My Uploads"
              price="Free"
              priceNote=""
              lines={[
                "Upload instantly, share in seconds.",
                "Auto-deletes after 15 days.",
              ]}
            />
            <StoreCard
              icon={<BoltIcon />}
              title="Hot Drive"
              price={money(hot.perMonth)}
              priceNote="/TB per month"
              highlight
              lines={[
                "Instant access, just like Google Drive.",
                "Buy exactly what you need — from 50 GB.",
              ]}
            />
            <StoreCard
              icon={<SnowIcon />}
              title="Cold Drive"
              price={money(cold.perMonth)}
              priceNote="/TB per month"
              lines={[
                "Up to 9× cheaper — for memories you rarely open.",
                "Wake them up in 12–24 h when you need them.",
              ]}
            />
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              See full pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- WHY REEL POUCHES ---------- */}
      <section className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-8 sm:grid-cols-3">
            <Value
              title="Up to 9× cheaper"
              body="Cold Drive costs a fraction of the everyday drives you already pay for."
            />
            <Value
              title="Only pay for what you need"
              body="Start from just 50 GB. No forced 200 GB or 1 TB plans you don't use yet."
            />
            <Value
              title="Private, or shared"
              body="Keep memories to yourself, or share them securely with family and clients."
            />
          </div>
        </div>
      </section>

      {/* ---------- FOR STUDIOS ---------- */}
      <section className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <div className="rounded-2xl border border-black/10 bg-background p-8 sm:p-12 dark:border-white/10">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              For photo &amp; video studios
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Deliver galleries. Let clients keep them for years.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-black/60 dark:text-white/60">
              Hand off finished shoots to your clients and let them archive their
              own memories — without it eating into your storage or your costs.
            </p>
            <div className="mt-8">
              <Cta {...ctaProps} label="Start delivering" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <Faq />
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="border-t border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Start keeping your memories today.
          </h2>
          <p className="mt-4 text-lg text-black/60 dark:text-white/60">
            Free to try. Archive terabytes for the price of a coffee.
          </p>
          <div className="mt-8 flex justify-center">
            <Cta {...ctaProps} label="Get started free" />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function Cta({
  isSignedIn,
  role,
  homeHref,
  label,
}: {
  isSignedIn: boolean;
  role: Role | null;
  homeHref: string;
  label: string;
}) {
  const cls =
    "rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90";
  if (isSignedIn) {
    return (
      <Link href={homeHref} className={cls}>
        {role === "customer" ? "View my space" : "Go to your dashboard"}
      </Link>
    );
  }
  return (
    <SignUpButton mode="modal">
      <button className={cls}>{label}</button>
    </SignUpButton>
  );
}

function StoreCard({
  icon,
  title,
  price,
  priceNote,
  lines,
  highlight = false,
}: {
  icon: ReactNode;
  title: string;
  price: string;
  priceNote: string;
  lines: string[];
  highlight?: boolean;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border bg-background p-8 dark:border-white/10 ${
        highlight ? "border-foreground/30" : "border-black/10"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5 text-foreground dark:bg-white/10">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight">{price}</span>
        {priceNote && (
          <span className="text-sm text-black/50 dark:text-white/50">
            {priceNote}
          </span>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {lines.map((l) => (
          <li
            key={l}
            className="text-sm leading-relaxed text-black/60 dark:text-white/60"
          >
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center sm:text-left">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-black/60 dark:text-white/60">
        {body}
      </p>
    </div>
  );
}

/* ---------- icons ---------- */

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}
