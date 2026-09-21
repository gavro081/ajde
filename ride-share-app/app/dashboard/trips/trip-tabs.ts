// Plain module (not "use client") so both the client tab switcher and the server-rendered
// loading state can read these values; values exported from a client module are only
// references on the server.
export const tripTabs = [
  { driver: false, label: "As a passenger", href: "/dashboard/trips" },
  { driver: true, label: "As a driver", href: "/dashboard/trips?view=driver" },
];
export const tripTabsClass = "mt-8 inline-flex max-w-full gap-1 rounded-2xl bg-slate-100 p-1";
export const tripTabClass = "rounded-xl px-4 py-3 text-sm font-semibold transition-colors";
