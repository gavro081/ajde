// Plain module (not "use client") so both the client tab switcher and the server-rendered
// loading state can read these values; values exported from a client module are only
// references on the server.
export const tripTabs = [
  { driver: false, label: "As a passenger", href: "/dashboard/trips" },
  { driver: true, label: "As a driver", href: "/dashboard/trips?view=driver" },
];
export const tripTabsClass = "mt-8 inline-flex max-w-full gap-1 rounded-2xl border border-slate-300 bg-slate-200/70 p-1 shadow-[inset_0_1px_2px_rgb(11_42_23_/_6%)]";
export const tripTabClass = "rounded-xl px-4 py-3 text-sm font-semibold transition-colors";

export const driverRideFilters = [
  { value: "active", label: "Active", statuses: ["draft", "published", "full"] },
  { value: "completed", label: "Completed", statuses: ["completed"] },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
  { value: "all", label: "All", statuses: null },
] as const;
export type DriverRideFilter = (typeof driverRideFilters)[number]["value"];
export function parseDriverRideFilter(value: string | undefined): DriverRideFilter {
  return driverRideFilters.find((filter) => filter.value === value)?.value ?? "active";
}
