import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { getCurrentRole, homePathForRole, type Role } from "@/lib/roles";
import { getCurrency } from "@/lib/geo";
import { deepPerTB } from "@/lib/archivePricing";
import FaqAccordion from "@/components/FaqAccordion";

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);
  const role = isSignedIn ? await getCurrentRole() : null;
  const homeHref = role ? homePathForRole(role) : "/setup";

  const currency = await getCurrency();
  const cold = deepPerTB(currency);
  const coldPerGb = cold.perMonth / 1024;
  const coldRate =
    currency === "INR"
      ? `₹${coldPerGb.toFixed(3)}`
      : `$${coldPerGb.toFixed(3)}`;

  const ctaProps = { isSignedIn, role, homeHref };
  const tealBtn =
    "rounded-2xl bg-teal-700 px-7 py-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800";

  return (
    <div className="flex flex-col bg-emerald-50/50 dark:bg-neutral-950">
      {/* ---------- HERO ---------- */}
      <section className="bg-gradient-to-br from-emerald-50 via-emerald-50 to-teal-100/70 dark:from-teal-950/40 dark:via-transparent dark:to-transparent">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 py-12 sm:py-16 lg:flex-row lg:gap-16 lg:py-20">
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <span className="rounded-full bg-teal-100 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              Status: Deep Freeze
            </span>

            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Your memories,
              <br />
              <span className="text-teal-600 dark:text-teal-400">preserved</span>
              <br />
              in ice.
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-black/60 dark:text-white/60">
              Cold Drive storage for the wedding reels, baby photos, festival
              clips and trips you rarely open but never want to lose - up to{" "}
              <span className="font-semibold text-foreground">9× cheaper</span>{" "}
              than everyday cloud drives.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 lg:justify-start">
              <Cta {...ctaProps} label="Start Your First Pouch" className={tealBtn} />
              <div className="text-left">
                <p className="text-[11px] font-medium uppercase tracking-widest text-black/40 dark:text-white/40">
                  Current rate
                </p>
                <p className="text-base font-bold text-foreground">
                  {coldRate} / GB · month
                </p>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-md lg:max-w-lg lg:flex-1">
            <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[2rem] bg-teal-200/60 dark:bg-teal-800/30" />
            <div className="relative rounded-[2rem] bg-white p-3 shadow-2xl dark:bg-white/10">
              <div className="overflow-hidden rounded-[1.5rem] bg-emerald-100 dark:bg-emerald-900/30">
                <Image
                  src="/logo.png"
                  alt="Reel Pouches Cold Drive"
                  width={640}
                  height={640}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- COLD DRIVE TRADE-OFF ---------- */}
      <section className="px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-neutral-900 p-8 text-white sm:p-12 dark:bg-black">
            <span className="absolute right-6 top-6 font-mono text-[11px] uppercase tracking-widest text-teal-400/70">
              Archive spec · v.03
            </span>
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              The Cold Drive trade-off
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/60">
              To offer storage this durable and inexpensive, we keep your data
              physically frozen. This isn&apos;t for files you need every day.
              When you want a pouch back, it takes{" "}
              <span className="font-semibold text-white">12 to 24 hours</span> to
              wake up - for a small retrieval fee.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              <Step n="01" title="Request" body="Tap 'Wake Up' on any pouch in your vault." />
              <Step n="02" title="Thaw" body="Our infrastructure prepares your files (12-24 h)." />
              <Step n="03" title="Retrieve" body="Download for a short window, then it refreezes." />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- WHY NOT THE USUAL OPTIONS ---------- */}
      <section className="px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Cheaper than the cloud. Safer than a drive.
            </h2>
            <p className="mt-3 text-black/50 dark:text-white/50">
              For the photos and videos you back up but rarely open, the usual
              options don&apos;t fit.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            <CompareRow
              label="Hard disks"
              note="Cheap, but they fail, corrupt or get misplaced - one drop and years of memories are gone."
            />
            <CompareRow
              label="Cloud drives"
              note="Google Drive, iCloud, Amazon Photos are built for daily use - and overpriced for files you barely touch."
            />
            <CompareRow
              label="Reel Pouches"
              note="Purpose-built for rarely-opened backups: triple-redundant, safe, and a fraction of the cost."
              highlight
            />
          </div>
        </div>
      </section>

      {/* ---------- MEMORY TYPES ---------- */}
      <section className="px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MemoryCard
              letter="W"
              title="Weddings"
              body="Every RAW photo and 4K reel from the big day, safely vaulted."
            />
            <MemoryCard
              letter="B"
              title="Baby Years"
              body="The thousands of clips you'll want to show them when they're 20."
            />
            <MemoryCard
              letter="F"
              title="Festivals"
              body="The shaky concert footage and crowd photos that belong in your history."
            />
            <MemoryCard
              letter="T"
              title="Trips"
              body="Six months of travel across a continent - every frame preserved."
            />
          </div>
        </div>
      </section>

      {/* ---------- REDUNDANCY ---------- */}
      <section className="px-6 py-10 text-center sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="flex justify-center">
            <span className="h-8 w-8 rounded-full bg-teal-600" />
            <span className="-ml-3 h-8 w-8 rounded-full bg-teal-600/80" />
            <span className="-ml-3 h-8 w-8 rounded-full bg-teal-600/60" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Triple-redundant. Safe for your full term.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-black/60 dark:text-white/60">
            Your files are copied into deep cold storage with multiple redundant
            copies on highly durable infrastructure - kept safe and intact for
            the whole period you sign up for. Cheaper because it&apos;s frozen,
            not because it&apos;s fragile.
          </p>
        </div>
      </section>

      {/* ---------- INFRASTRUCTURE ---------- */}
      <section className="px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-black/50 dark:text-white/50">
            Built on infrastructure you already trust
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-black/60 dark:text-white/60">
            Your pouches are stored on enterprise-grade cold storage from the
            same providers that power global banks, hospitals and studios.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <InfraCard name="AWS" sub="Glacier Deep Archive" icon={<AwsIcon />} />
            <InfraCard name="Azure" sub="Blob Archive Tier" icon={<AzureIcon />} />
            <InfraCard name="iDrive" sub="E2 Cold Storage" icon={<DriveIcon />} />
          </div>
        </div>
      </section>

      {/* ---------- SECURITY ---------- */}
      <section className="px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm sm:p-12 dark:border-white/10 dark:bg-white/5">
            <span className="absolute right-6 top-6 font-mono text-[11px] uppercase tracking-widest text-black/30 dark:text-white/30">
              Security · v.01
            </span>
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-teal-600 dark:text-teal-400">
                  Built to protect
                </p>
                <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                  100% secure.
                  <br />
                  <span className="text-teal-600 dark:text-teal-400">
                    Zero compromise.
                  </span>
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-black/60 dark:text-white/60">
                  Your memories are encrypted, copied across multiple separate
                  locations, and stored on the same enterprise-grade
                  infrastructure trusted by banks and hospitals. They&apos;re
                  never accessed or shared - and stay safe for the full period
                  you sign up for.
                </p>
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <SecurityFeature
                    title="Encrypted at rest & in transit"
                    body="Your files are protected every step of the way."
                  />
                  <SecurityFeature
                    title="Triple-redundant vaults"
                    body="Multiple copies across separate locations."
                  />
                  <SecurityFeature
                    title="You're in control"
                    body="Retrieve or remove your memories whenever you like."
                  />
                  <SecurityFeature
                    title="Enterprise infrastructure"
                    body="Built on AWS, Azure and iDrive cold storage."
                  />
                </div>
              </div>

              <div className="relative hidden h-[26rem] items-center justify-center lg:flex">
                <div className="absolute h-96 w-96 rounded-full border border-teal-200/60 dark:border-teal-800/40" />
                <div className="absolute h-72 w-72 rounded-full bg-teal-100/50 dark:bg-teal-900/20" />
                <div className="absolute h-52 w-52 rounded-full bg-teal-100/70 dark:bg-teal-900/30" />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-teal-600 text-white shadow-xl shadow-teal-600/20">
                  <LockIcon />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="px-6 py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-teal-600 dark:text-teal-400">
              FAQ
            </p>
            <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
              What Cold Drive actually means.
            </h2>
            <p className="mt-4 text-black/60 dark:text-white/60">
              The honest answers before you trust us with a decade of memories.
            </p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-teal-700 p-10 text-center text-white sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start keeping your memories today.
          </h2>
          <p className="mt-4 text-white/70">
            Free to try. Freeze terabytes for the price of a coffee.
          </p>
          <div className="mt-8 flex justify-center">
            <Cta
              {...ctaProps}
              label="Start Your First Pouch"
              className="rounded-2xl bg-white px-7 py-4 text-sm font-semibold text-teal-700 hover:opacity-90"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- building blocks ---------- */

function Cta({
  isSignedIn,
  role,
  homeHref,
  label,
  className,
}: {
  isSignedIn: boolean;
  role: Role | null;
  homeHref: string;
  label: string;
  className?: string;
}) {
  const cls =
    className ??
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

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold text-teal-400">{n}</div>
      <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/50">{body}</p>
    </div>
  );
}

function CompareRow({
  label,
  note,
  highlight = false,
}: {
  label: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="w-24 shrink-0 text-right font-mono text-[11px] uppercase tracking-widest text-black/40 dark:text-white/40 sm:w-28">
        {label}
      </div>
      <div
        className={`flex flex-1 items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
          highlight
            ? "bg-teal-600 text-white"
            : "bg-black/[0.05] text-black/70 dark:bg-white/10 dark:text-white/70"
        }`}
      >
        <span className="shrink-0">
          {highlight ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-black/30 dark:text-white/30">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          )}
        </span>
        <span>{note}</span>
      </div>
    </div>
  );
}

function MemoryCard({
  letter,
  title,
  body,
}: {
  letter: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-base font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
        {letter}
      </div>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-black/60 dark:text-white/60">
        {body}
      </p>
    </div>
  );
}

function InfraCard({
  name,
  sub,
  icon,
}: {
  name: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-black/5 bg-white px-6 py-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
        {icon}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight">{name}</div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-black/40 dark:text-white/40">
        {sub}
      </div>
    </div>
  );
}

function SecurityFeature({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
        <ShieldIcon />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-black/55 dark:text-white/55">
          {body}
        </p>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function AwsIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 15.5a3.5 3.5 0 0 1-.7-6.9 5 5 0 0 1 9.6-1.2A3.3 3.3 0 0 1 18 15.5H6Z" />
      <path d="M4 19c5 1.8 11 1.8 16 0" />
    </svg>
  );
}

function AzureIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.6 3.5 4 20h4.2l1.4-4.4 4.1 3.7L6.9 20.5H20L13.5 3.5H9.6Z" />
    </svg>
  );
}

function DriveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="16.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
