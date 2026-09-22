"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { tripStatusFilters, type TripStatusFilter } from "./trip-tabs";
import { TripsSkeleton } from "./trips-skeleton";

/** Highlights the chosen filter at once and swaps the ride list for a skeleton while the server responds. */
export function TripStatusFilterNav({ view, filter, counts, children }: {
  view: "driver" | "passenger"; filter: TripStatusFilter; counts: Record<string, number>; children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useOptimistic(filter);
  const [isPending, startTransition] = useTransition();

  return <>
    <nav aria-label={view === "driver" ? "Filter rides by status" : "Filter passenger trips by status"} className="mt-6 flex flex-wrap gap-2">
      {tripStatusFilters.map((option) => {
        const params = new URLSearchParams();
        if (view === "driver") params.set("view", "driver");
        if (option.value !== "active") params.set("status", option.value);
        const href = `/dashboard/trips${params.size ? `?${params}` : ""}`;
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
          {option.label}{" "}<span className={isSelected ? "text-slate-300" : "text-slate-400"}>{counts[option.value]}</span>
        </Link>;
      })}
    </nav>
    {isPending ? <TripsSkeleton gridClassName="mt-6" /> : children}
  </>;
}
