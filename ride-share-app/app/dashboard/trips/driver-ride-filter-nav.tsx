"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { driverRideFilters, type DriverRideFilter } from "./trip-tabs";
import { TripsSkeleton } from "./trips-skeleton";

/** Highlights the chosen filter at once and swaps the ride list for a skeleton while the server responds. */
export function DriverRideFilterNav({ filter, counts, children }: {
  filter: DriverRideFilter; counts: Record<string, number>; children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useOptimistic(filter);
  const [isPending, startTransition] = useTransition();

  return <>
    <nav aria-label="Filter rides by status" className="mt-6 flex flex-wrap gap-2">
      {driverRideFilters.map((option) => {
        const href = option.value === "active" ? "/dashboard/trips?view=driver" : `/dashboard/trips?view=driver&status=${option.value}`;
        const isSelected = option.value === selected;
        return <Link key={option.value} href={href} scroll={false}
          onNavigate={(event) => {
            event.preventDefault();
            if (isSelected) return;
            startTransition(() => {
              setSelected(option.value);
              router.push(href, { scroll: false });
            });
          }}
          aria-current={isSelected ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${isSelected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {option.label}<span className={isSelected ? "text-slate-300" : "text-slate-400"}>{counts[option.value]}</span>
        </Link>;
      })}
    </nav>
    {isPending ? <TripsSkeleton gridClassName="mt-6" /> : children}
  </>;
}
