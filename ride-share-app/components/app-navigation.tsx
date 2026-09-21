"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Brand } from "@/components/brand";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** True once the page has scrolled past the top, which collapses the navbar into a compact pill. */
function useScrolled() {
  return useSyncExternalStore(subscribeToScroll, () => window.scrollY > 24, () => false);
}

function isActive(pathname: string, href: string) {
  if (href === "/rides") return pathname === href || /^\/rides\/(?!new|import)[^/]+/.test(pathname);
  if (href === "/rides/new") return pathname === href || pathname === "/rides/import";
  if (href === "/dashboard/trips") return pathname.startsWith("/dashboard");
  return pathname === href;
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return <Link href={href} aria-current={active ? "page" : undefined} className={`nav-link ${active ? "nav-link-active" : ""}`}>{children}</Link>;
}

/** Signed-in only links, streamed in once the user is known. */
export function AccountLinks({ userId }: { userId: string }) {
  return <>
    <NavLink href="/dashboard/trips">My trips</NavLink>
    <NavLink href={`/profile/${userId}`}>Profile</NavLink>
  </>;
}

export function AccountActions({ signedIn }: { signedIn: boolean }) {
  if (signedIn) return <form action="/auth/signout" method="post"><button type="submit" className="nav-button">Sign out</button></form>;
  return <>
    <Link href="/login" className="nav-link">Sign in</Link>
    <Link href="/login?mode=signup" className="nav-button">Sign up</Link>
  </>;
}

export function AppNavigation({ userLinks, account }: { userLinks: ReactNode; account: ReactNode }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuOpen = openPath === pathname;
  const scrolled = useScrolled();

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenPath(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  return <header className="site-header" data-scrolled={scrolled || undefined}>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="site-header-bar">
      <Brand />
      <nav id="main-navigation" aria-label="Main navigation" className={`site-nav ${menuOpen ? "site-nav-open" : ""}`}>
        <div className="site-nav-links">
          <NavLink href="/rides">Find a ride</NavLink>
          <NavLink href="/rides/new">Offer a ride</NavLink>
          {userLinks}
        </div>
        <div className="site-nav-account">{account}</div>
      </nav>
      <button type="button" className="site-menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setOpenPath(menuOpen ? null : pathname)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={menuOpen ? "m6 6 12 12M6 18 18 6" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
      </button>
    </div>
  </header>;
}
