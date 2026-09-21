import { ImpactSummarySkeleton } from "@/components/impact-summary";
import { TripsSkeleton } from "./trips/trips-skeleton";
import { tripTabClass, tripTabs, tripTabsClass } from "./trips/trip-tabs";
import { TripsHeading } from "./trips/trip-views";

// Same markup the trips page renders while its data streams, so navigation shows one
// continuous skeleton instead of a page skeleton followed by a second card skeleton.
export default function DashboardLoading() {
  return <div className="text-slate-950">
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <TripsHeading isDriver={false} />
      <div aria-hidden="true" className={tripTabsClass}>{tripTabs.map((tab) => <span key={tab.href} className={`${tripTabClass} text-slate-600`}>{tab.label}</span>)}</div>
      <TripsSkeleton />
      <ImpactSummarySkeleton />
    </main>
  </div>;
}
