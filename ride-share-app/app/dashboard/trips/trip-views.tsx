"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { TripsSkeleton } from "./trips-skeleton";

export function TripViews({ isDriver, children }: { isDriver: boolean; children: ReactNode }) {
  const router = useRouter();
  const [selectedDriver, setSelectedDriver] = useOptimistic(isDriver);
  const [isPending, startTransition] = useTransition();

  return <>
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div><h1 className="page-heading">My trips</h1><p className="mt-4 text-slate-500">Your bookings and offered rides, all in one place.</p></div>
      <Link href={selectedDriver ? "/rides/new" : "/rides"} className="btn-primary">{selectedDriver ? "Offer a ride" : "Find a ride"} <span aria-hidden="true">↗</span></Link>
    </div>
    <nav aria-label="Trip views" className="mt-8 inline-flex max-w-full gap-1 rounded-2xl bg-slate-100 p-1">
      {[{ driver: false, label: "As a passenger", href: "/dashboard/trips" }, { driver: true, label: "As a driver", href: "/dashboard/trips?view=driver" }].map((view) => <Link
        key={view.href}
        href={view.href}
        scroll={false}
        onNavigate={(event) => {
          event.preventDefault();
          if (view.driver === selectedDriver) return;
          startTransition(() => {
            setSelectedDriver(view.driver);
            router.push(view.href, { scroll: false });
          });
        }}
        aria-current={selectedDriver === view.driver ? "page" : undefined}
        className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${selectedDriver === view.driver ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"}`}
      >{view.label}</Link>)}
    </nav>
    {isPending ? <TripsSkeleton /> : children}
  </>;
}
