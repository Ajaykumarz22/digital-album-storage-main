import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { getCurrentRole } from "@/lib/roles";
import HeaderMenu from "./HeaderMenu";

export default async function Header() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);
  const role = isSignedIn ? await getCurrentRole() : null;

  const menuItems: { href: string; label: string }[] = [];
  if (role === "business") menuItems.push({ href: "/dashboard", label: "Dashboard" });
  if (!role && isSignedIn) menuItems.push({ href: "/setup", label: "Finish setup" });
  if (role) menuItems.push({ href: "/setup", label: "Welcome & FAQs" });
  if (role) menuItems.push({ href: "/account", label: "Subscription" });

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-background dark:border-white/10">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          {isSignedIn && <HeaderMenu items={menuItems} />}
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Reel Pouches
          </Link>
        </div>

        <nav className="flex items-center gap-3">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10">
                  Log in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90">
                  Sign up
                </button>
              </SignUpButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
