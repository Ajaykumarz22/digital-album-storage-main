import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { getCurrentRole, homePathForRole } from "@/lib/roles";
import { getCurrency } from "@/lib/geo";
import { deepArchivePricePerTBMonth } from "@/lib/archivePricing";

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);
  const role = isSignedIn ? await getCurrentRole() : null;
  const homeHref = role ? homePathForRole(role) : "/setup";

  const currency = await getCurrency();
  const price = deepArchivePricePerTBMonth(currency);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-10 sm:py-16 lg:flex-row lg:gap-16 lg:py-24">
      {/* Left — text */}
      <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/60 dark:border-white/10 dark:text-white/60">
          Bulk cloud storage
        </span>

        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Archive Your Unused Important Data For Cheapest Price.
        </h1>

        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {price}/TB/month
        </h1>

        <p className="mt-5 max-w-xl text-lg text-black/60 dark:text-white/60">
          Keep terabytes of photos, videos and raw files safe for a fraction of
          what Google Drive costs. Store it privately, or share it securely with
          your clients — all in one place.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isSignedIn ? (
            <Link
              href={homeHref}
              className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
            >
              {role === "customer" ? "View my space" : "Go to your dashboard"}
            </Link>
          ) : (
            <SignUpButton mode="modal">
              <button className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90">
                Get started
              </button>
            </SignUpButton>
          )}
        </div>
      </div>

      {/* Right — image (on top for mobile) */}
      <div className="order-first w-full max-w-sm lg:order-none lg:max-w-none lg:flex-1">
        <Image
          src="/logo.png"
          alt="reel pouches"
          width={640}
          height={640}
          priority
          className="h-auto w-full rounded-2xl object-contain"
        />
      </div>
    </div>
  );
}
