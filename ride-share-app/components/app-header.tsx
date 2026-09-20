import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/rides" className="text-lg font-black tracking-tight text-slate-950">Student Ride Share</Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold" aria-label="Main navigation">
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/rides">Find a ride</Link>
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/rides/new">Offer a ride</Link>
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard/trips">My trips</Link>
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard/driver">Driver</Link>
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
