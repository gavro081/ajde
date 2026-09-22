import type { ReactNode } from "react";

// Route-level loading states. They mirror each page's container and card layout so content
// swaps in without a jump, and never paint their own background (the body gradient shows through).

export function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function SkeletonMain({ label, className, bodyClassName, children }: { label: string; className: string; bodyClassName?: string; children: ReactNode }) {
  // w-full: <main> sits directly in the flex-column body, where mx-auto alone would shrink it to its content.
  return <main id="main-content" aria-busy="true" className={`w-full ${className}`}>
    <p role="status" className="sr-only">{label}</p>
    <div aria-hidden="true" className={bodyClassName}>{children}</div>
  </main>;
}

function Heading({ subtitle = true }: { subtitle?: boolean }) {
  return <>
    <Bone className="h-12 w-72 max-w-full rounded-xl sm:h-14" />
    {subtitle ? <Bone className="mt-4 h-5 w-96 max-w-full" /> : null}
  </>;
}

export function RideCardSkeleton() {
  return <div className="surface-card p-5 sm:p-6">
    <div className="flex items-center gap-3"><Bone className="size-12 rounded-full sm:size-14" /><div className="flex-1"><Bone className="h-4 w-40" /><Bone className="mt-2 h-3 w-28" /></div></div>
    <div className="mt-6 flex justify-between"><Bone className="h-4 w-36" /><Bone className="h-7 w-24" /></div>
    <Bone className="mt-5 h-32 rounded-2xl" />
    <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4"><Bone className="h-9 w-28" /><Bone className="h-[52px] w-36 rounded-[.9rem]" /></div>
  </div>;
}

export function RideFeedSkeleton() {
  return <SkeletonMain label="Loading rides…" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
    <h1 className="page-heading">Find a ride</h1>
    <p className="mt-4 text-slate-500">A seat, some company, and a way home.</p>
    <Bone className="mt-10 h-5 w-64" />
    <div className="mt-4 flex gap-4"><Bone className="h-[52px] flex-1 rounded-xl" /><Bone className="h-[52px] w-28 rounded-[.9rem]" /></div>
    <Bone className="mt-6 h-16 rounded-[1.25rem]" />
    <Bone className="mt-8 h-7 w-48" /><Bone className="mt-2 h-4 w-56" />
    <div className="mt-7 grid gap-7 lg:grid-cols-2">{[0, 1, 2, 3].map((card) => <RideCardSkeleton key={card} />)}</div>
  </SkeletonMain>;
}

export function RideDetailSkeleton() {
  return <SkeletonMain label="Loading ride…" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <Bone className="h-4 w-28" />
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_350px]">
      <div className="surface-card p-6 sm:p-8">
        <div className="flex justify-between"><Bone className="h-4 w-52" /><Bone className="h-6 w-20 rounded-full" /></div>
        <Bone className="mt-4 h-9 w-2/3" />
        <Bone className="mt-6 h-36 rounded-xl" />
        <div className="mt-6 flex justify-between border-b border-slate-100 pb-6"><Bone className="h-10 w-32" /><Bone className="h-10 w-28" /></div>
        <Bone className="mt-6 h-4 w-32" /><Bone className="mt-3 h-4 w-full" /><Bone className="mt-2 h-4 w-4/5" />
      </div>
      <div className="space-y-5">
        <div className="surface-card p-6"><div className="flex items-center gap-4"><Bone className="size-16 rounded-full" /><Bone className="h-4 w-24" /></div><Bone className="mt-5 h-6 w-40" /><Bone className="mt-2 h-4 w-32" /></div>
        <div className="surface-card p-5"><Bone className="h-5 w-32" /><Bone className="mt-4 h-[52px] rounded-xl" /><Bone className="mt-4 h-24 rounded-xl" /><Bone className="mt-4 h-[52px] rounded-[.9rem]" /></div>
      </div>
    </div>
  </SkeletonMain>;
}

export function FormPageSkeleton({ width = "max-w-4xl", fields = 6, title, subtitle, backLink = true }: { width?: string; fields?: number; title?: string; subtitle?: string; backLink?: boolean }) {
  return <SkeletonMain label="Loading form…" className="px-4 py-10 sm:px-6">
    <div className={`mx-auto ${width}`}>
      {backLink ? <Bone className="mb-8 h-4 w-24" /> : null}
      <div>{title ? <><h1 className="page-heading">{title}</h1>{subtitle ? <p className="mt-3 max-w-2xl text-slate-600">{subtitle}</p> : null}</> : <Heading />}</div>
      <div className="surface-card mt-8 p-5 sm:p-8">
        {Array.from({ length: fields }, (_, index) => <div key={index} className={index ? "mt-6" : ""}><Bone className="h-4 w-32" /><Bone className="mt-2 h-[52px] rounded-[.9rem]" /></div>)}
        <Bone className="mt-8 h-[52px] w-44 rounded-[.9rem]" />
      </div>
    </div>
  </SkeletonMain>;
}

export function ProfileSkeleton() {
  return <SkeletonMain label="Loading profile…" className="px-5 py-8 sm:py-12">
    <div className="mx-auto max-w-xl">
      <div className="flex h-11 items-center"><Bone className="h-4 w-28" /></div>
      <div className="surface-card mt-20">
        <div className="px-6 pb-8 sm:px-8 sm:pb-10">
          <div className="flex justify-center"><Bone className="-mt-14 size-28 rounded-full ring-[6px] ring-white sm:-mt-16 sm:size-32" /></div>
          <Bone className="mx-auto mt-6 h-10 w-64 max-w-full" />
          <Bone className="mx-auto mt-3 h-7 w-48 max-w-full" />
          <div className="mt-8 grid grid-cols-1 gap-8 border-t border-slate-200 pt-8">
            <div><Bone className="h-7 w-20" /><Bone className="mt-4 h-4 w-full" /><Bone className="mt-3 h-4 w-4/5" /><Bone className="mt-3 h-4 w-3/5" /></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><Bone className="h-7 w-28" /><Bone className="mt-4 h-12 w-24" /><Bone className="mt-4 h-5 w-32" /><Bone className="mt-3 h-4 w-full" /></div>
          </div>
        </div>
      </div>
      <Bone className="mx-auto mt-6 h-12 w-full max-w-2xl" />
    </div>
  </SkeletonMain>;
}

export function ChatSkeleton() {
  return <SkeletonMain label="Loading ride room…" bodyClassName="flex min-h-0 flex-1 flex-col" className="mx-auto flex h-[calc(100svh-var(--header-h))] min-h-[32rem] w-full max-w-6xl flex-col px-3 pb-3 pt-4 sm:px-6 sm:pb-6">
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-5">
      <div className="surface-card flex shrink-0 flex-col gap-3 p-4 lg:order-last lg:gap-5 lg:p-5"><Bone className="h-4 w-32" /><div className="flex gap-2 lg:flex-col"><Bone className="h-10 w-40 rounded-full lg:w-full lg:rounded-xl" /><Bone className="h-10 w-40 rounded-full lg:w-full lg:rounded-xl" /></div><Bone className="h-4 w-48" /></div>
      <div className="surface-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><Bone className="h-6 w-32" /></div>
        <div className="flex-1 space-y-3 p-5">{["w-3/5", "ml-auto w-2/5", "w-2/3", "ml-auto w-1/3"].map((width) => <Bone key={width} className={`h-14 rounded-2xl ${width}`} />)}</div>
        <div className="flex gap-2 border-t border-slate-100 p-4"><Bone className="h-[52px] flex-1 rounded-[.9rem]" /><Bone className="h-[52px] w-36 rounded-[.9rem]" /></div>
      </div>
    </div>
  </SkeletonMain>;
}
export function SplitCardSkeleton({ label }: { label: string }) {
  return <SkeletonMain label={label} className="mx-auto grid max-w-5xl gap-10 px-4 py-8 sm:px-6 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
    <div><Bone className="h-4 w-36" /><Bone className="mt-4 h-12 w-full max-w-sm" /><Bone className="mt-3 h-12 w-3/4 max-w-xs" /></div>
    <div className="surface-card p-6 sm:p-9"><Bone className="h-12 rounded-full" /><Bone className="mt-7 h-8 w-56" /><Bone className="mt-4 h-4 w-full" /><Bone className="mt-8 h-[52px] rounded-[.9rem]" /><Bone className="mt-4 h-[52px] rounded-[.9rem]" /></div>
  </SkeletonMain>;
}

export function ItinerarySkeleton() {
  return <SkeletonMain label="Loading shared itinerary…" className="mx-auto w-full max-w-xl px-4 py-12">
    <Bone className="h-9 w-64" /><Bone className="mt-3 h-4 w-full" />
    <div className="surface-card mt-6 p-6"><Bone className="h-7 w-48" /><Bone className="mt-5 h-4 w-40" /><Bone className="mt-2 h-4 w-56" /><Bone className="mt-5 h-12 w-48" /></div>
  </SkeletonMain>;
}

function FieldSkeleton({ label = "w-24", className = "", children }: { label?: string; className?: string; children?: ReactNode }) {
  return <div className={className}><Bone className={`h-5 ${label}`} /><Bone className="mt-2 h-[59px] rounded-xl" />{children}</div>;
}

function CollapsedSectionSkeleton({ width, className = "mt-5" }: { width: string; className?: string }) {
  return <div className={`flex h-[53px] items-center border-t border-slate-100 ${className}`}><Bone className={`h-5 ${width}`} /></div>;
}

/**
 * Mirrors app/rides/new for a driver with one saved car: heading, the AI description box with the
 * import prompt, then the ride form. Heights match the rendered page so content swaps in without a jump.
 */
export function OfferRideSkeleton({ heading }: { heading: ReactNode }) {
  return <SkeletonMain label="Loading ride form…" className="px-4 py-10 sm:px-6">
    <div className="mx-auto max-w-4xl">
      {heading}
      <div className="surface-card mt-8 p-4 sm:p-6">
        <div className="rounded-xl bg-slate-50 p-4">
          <Bone className="h-[23px] w-44" />
          <Bone className="mt-2 h-[84px] rounded-[.9rem]" />
          <div className="mt-[15px] flex items-center justify-between gap-2"><Bone className="h-4 w-72 max-w-[60%]" /><Bone className="h-11 w-24 rounded-[.9rem]" /></div>
          <Bone className="mt-3 h-[118px] rounded-xl sm:h-[70px]" />
        </div>
        <div className="mt-[67px]">
          <Bone className="h-[38px] w-32" />
          <div className="mt-[17px] grid gap-4 sm:grid-cols-2"><FieldSkeleton label="w-12" /><FieldSkeleton label="w-8" /></div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FieldSkeleton className="col-span-2" label="w-20" /><FieldSkeleton label="w-28" />
            <FieldSkeleton label="w-32"><Bone className="mt-1 h-[39px]" /></FieldSkeleton>
          </div>
          <Bone className="mt-4 h-[19px] w-56" />
          <CollapsedSectionSkeleton className="mt-4" width="w-64" />
        </div>
        <div className="mt-5 flex h-[133px] flex-col justify-center gap-3 rounded-2xl border border-slate-200 p-4 sm:p-5">
          <Bone className="h-8 w-28" />
          <div className="flex items-center justify-between"><div><Bone className="h-5 w-36" /><Bone className="mt-2 h-4 w-48" /></div><Bone className="h-9 w-20 rounded-lg" /></div>
        </div>
        {["w-64", "w-28", "w-52"].map((width) => <CollapsedSectionSkeleton key={width} width={width} />)}
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
          <Bone className="h-4 w-44 sm:mr-auto sm:self-center" />
          <Bone className="h-[52px] rounded-[.9rem] sm:w-32" />
          <Bone className="h-[52px] rounded-[.9rem] sm:w-36" />
        </div>
      </div>
    </div>
  </SkeletonMain>;
}
