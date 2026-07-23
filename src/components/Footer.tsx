import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/roles";

export default async function Footer() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);
  const role = isSignedIn ? await getCurrentRole() : null;
  const year = new Date().getFullYear();

  // Same links as the header hamburger, plus Home.
  const links: { href: string; label: string }[] = [{ href: "/", label: "Home" }];
  if (role === "business") links.push({ href: "/dashboard", label: "Dashboard" });
  if (role === "customer") links.push({ href: "/portal", label: "My Uploads" });
  if (!role && isSignedIn) links.push({ href: "/setup", label: "Finish setup" });
  if (role) links.push({ href: "/setup", label: "Welcome & FAQs" });
  if (role) links.push({ href: "/account", label: "Subscription" });
  links.push({ href: "/pricing", label: "Pricing" });

  return (
    <footer className="border-t border-black/10 bg-background dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Reel Pouches</div>
          <p className="mt-1 max-w-xs text-sm text-black/50 dark:text-white/50">
            Cold storage for the memories you can&apos;t lose.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-black/60 hover:text-foreground dark:text-white/60 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-black/5 dark:border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-5 text-xs text-black/40 dark:text-white/40">
          © {year} VulcanX Technology. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
