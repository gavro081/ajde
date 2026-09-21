import type { Metadata } from "next";
import { Suspense } from "react";

import { ImpactSummaryPanel, ImpactSummarySkeleton } from "@/components/impact-summary";
import { requireCompleteProfile } from "@/lib/auth/session";
import { DriverRides } from "./driver-trips";
import { PassengerTrips } from "./passenger-trips";
import { parseDriverRideFilter } from "./trip-tabs";
import { TripViews } from "./trip-views";
import { TripsSkeleton } from "./trips-skeleton";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsDashboard({ searchParams }: {
  searchParams: Promise<{ view?: string; status?: string; success?: string; error?: string }>;
}) {
  const notice = await searchParams;
  const isDriver = notice.view === "driver";
  const rideFilter = parseDriverRideFilter(notice.status);
  const user = await requireCompleteProfile(isDriver ? "/dashboard/trips?view=driver" : "/dashboard/trips");

  return <div className="text-slate-950">
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <TripViews isDriver={isDriver}>
        {notice.success ? <p role="status" className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-800">{notice.success}</p> : null}
        {notice.error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-red-800">{notice.error}</p> : null}
        <Suspense key={isDriver ? "driver" : "passenger"} fallback={<TripsSkeleton />}>
          {isDriver ? <DriverRides userId={user.id} filter={rideFilter} /> : <PassengerTrips userId={user.id} />}
        </Suspense>
      </TripViews>
      <Suspense fallback={<ImpactSummarySkeleton />}>
        <ImpactSummaryPanel />
      </Suspense>
    </main>
  </div>;
}
