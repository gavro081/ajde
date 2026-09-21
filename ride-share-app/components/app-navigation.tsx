"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export function AppNavigation({ userId }: { userId: string | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: "/rides", label: "Find a ride" },
    { href: "/rides/new", label: "Offer a ride" },
    ...(userId ? [
      { href: "/dashboard/trips", label: "My trips" },
      { href: "/dashboard/driver", label: "My rides" },
      { href: `/profile/${userId}`, label: "Profile" },
    ] : []),
  ];
  function active(href: string) {
    if (href === "/rides") return pathname === href || /^\/rides\/(?!new|import)[^/]+$/.test(pathname);
    if (href === "/rides/new") return pathname === href || pathname === "/rides/import";
    return pathname === href;
  }
  return <header className="site-header">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="header-inner">
      <Brand />
      <button type="button" className="site-menu-button lg:hidden" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={menuOpen ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
        {menuOpen ? "Close" : "Menu"}
      </button>
      <nav id="main-navigation" aria-label="Main navigation" className={`${menuOpen ? "flex" : "hidden"} w-full flex-col gap-3 lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-5`}>
        <div className="nav-links">{links.map(({ href, label }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active(href) ? "page" : undefined} className={`site-nav-link ${active(href) ? "site-nav-link-active" : ""}`}>{label}</Link>)}</div>
        <div className="nav-account">
          {userId ? <SignOutButton /> : <><Link href="/login" className="btn-quiet" onClick={() => setMenuOpen(false)}>Sign in</Link><Link href="/login?mode=signup" className="btn-primary" onClick={() => setMenuOpen(false)}>Sign up</Link></>}
        </div>
      </nav>
    </div>
  </header>;
}
