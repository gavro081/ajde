"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { tripTabClass, tripTabs, tripTabsClass } from "./trip-tabs";
import { TripsSkeleton } from "./trips-skeleton";

/** Page title row; shared with the route's loading state so the swap is seamless. */
export function TripsHeading({ isDriver }: { isDriver: boolean }) {
  return <div className="flex flex-wrap items-end justify-between gap-6">
    <div><h1 className="page-heading">My trips</h1><p className="mt-4 text-slate-500">Your bookings and offered rides, all in one place.</p></div>
    <Link href={isDriver ? "/rides/new" : "/rides"} className="btn-primary">{isDriver ? "Offer a ride" : "Find a ride"}</Link>
  </div>;
}

export function TripViews({ isDriver, children }: { isDriver: boolean; children: ReactNode }) {
  const router = useRouter();
  const [selectedDriver, setSelectedDriver] = useOptimistic(isDriver);
  const [isPending, startTransition] = useTransition();

  return <>
    <TripsHeading isDriver={selectedDriver} />
    <nav aria-label="Trip views" className={tripTabsClass}>
      {tripTabs.map((view) => <Link
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
        className={`${tripTabClass} ${selectedDriver === view.driver ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"}`}
      >{view.label}</Link>)}
    </nav>
    {isPending ? <TripsSkeleton /> : children}
  </>;
}
