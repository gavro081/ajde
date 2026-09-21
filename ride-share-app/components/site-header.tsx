import { cache, Suspense } from "react";
import { AccountActions, AccountLinks, AppNavigation } from "@/components/app-navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Both slots below need the user; dedupe the auth lookup within one render.
const loadUser = cache(getCurrentUser);

async function UserLinks() {
  const user = await loadUser();
  return user ? <AccountLinks userId={user.id} /> : null;
}

async function UserActions() {
  const user = await loadUser();
  return <AccountActions signedIn={Boolean(user)} />;
}

/**
 * Global glass navbar. It lives in the root layout so it stays mounted across navigations,
 * and the user lookup is streamed so it never blocks a page from rendering.
 */
export function SiteHeader() {
  return <AppNavigation
    userLinks={<Suspense fallback={null}><UserLinks /></Suspense>}
    account={<Suspense fallback={<span aria-hidden="true" className="block h-10 w-36 animate-pulse rounded-full bg-white/60" />}><UserActions /></Suspense>}
  />;
}
