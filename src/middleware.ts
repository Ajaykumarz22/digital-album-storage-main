import { clerkMiddleware } from "@clerk/nextjs/server";

// clerkMiddleware sets up the auth context for every request so that
// `auth()` works in pages, layouts, and API routes.
// Actual "is the user allowed here?" checks live inside each protected
// page/route (see src/app/dashboard/page.tsx) — the current Clerk-recommended
// pattern.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|map)).*)",
    // ...and always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
