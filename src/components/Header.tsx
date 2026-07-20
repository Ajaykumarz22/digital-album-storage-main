import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { getCurrentRole } from "@/lib/roles";

export default async function Header() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);
  const role = isSignedIn ? await getCurrentRole() : null;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Reel Pouches
        </Link>

        <nav className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              {role === "business" && (
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Dashboard
                </Link>
              )}
              {role === "customer" && (
                <Link
                  href="/portal"
                  className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  My photos
                </Link>
              )}
              {!role && (
                <Link
                  href="/setup"
                  className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Finish setup
                </Link>
              )}
              {role && (
                <Link
                  href="/account"
                  className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Subscription
                </Link>
              )}
              <UserButton />
            </>
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
