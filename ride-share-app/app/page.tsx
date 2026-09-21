import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { LandingMap } from "@/components/landing/landing-map";
import { WhereToForm } from "@/components/landing/where-to-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "A little closer, together" };

// Marketing figures — placeholders until they are wired to lib/impact.
const savings: { icon: ReactNode; value: string; label: string }[] = [
  { icon: <path d="M4 17a4 4 0 0 1 1-7.9A6 6 0 0 1 16.7 8 4.5 4.5 0 0 1 19 17H4Z" />, value: "1,284 t", label: "CO₂ saved" },
  { icon: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />, value: "548,210 L", label: "Fuel saved" },
  { icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6m2 3c2 .8 3 2.8 3 6" /></>, value: "86,412", label: "Riders connected" },
  { icon: <path d="M12 21V11m0 0c-4 0-7-3-7-7 4 0 7 3 7 7Zm0 0c0-4 3-7 7-7 0 4-3 7-7 7Z" />, value: "58,400", label: "Trees' worth" },
];

async function CitySearch() {
  const supabase = await createClient();
  const { data: cities } = await supabase.from("cities").select("id, name_en").order("name_en");
  return <WhereToForm cities={cities ?? []} />;
}

export default function Home() {
  // The hero slides up under the sticky glass navbar so the map fills the whole first screen.
  return <div className="-mt-[var(--header-h)] flex min-h-svh flex-col bg-[#0f1511] text-[#16201a] lg:h-svh lg:min-h-[44rem]">
    <section className="relative isolate flex flex-1 flex-col overflow-hidden rounded-b-[2rem] bg-[linear-gradient(180deg,#b9e3fb_0%,#d9f0f4_45%,#e7f6de_100%)] lg:min-h-0">
      <LandingMap />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(0deg,#e7f6de_0%,rgb(231_246_222/0.85)_40%,transparent_100%)]" />

      <main id="main-content" className="relative mt-auto grid items-end gap-10 px-5 pb-10 pt-[calc(var(--header-h)+15rem)] sm:px-10 sm:pt-[calc(var(--header-h)+9rem)] lg:grid-cols-[1fr_auto] lg:pb-12 lg:pt-[calc(var(--header-h)+1.5rem)]">
        <div>
          <h1 className="font-display text-[clamp(3.1rem,min(7vw,10.5vh),6.4rem)] font-extrabold leading-[0.95] tracking-[-0.055em]">
            Share the ride.<br /><span className="underline decoration-[0.07em] underline-offset-[0.12em]">Spare the air.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#3c4a41]">Fill the empty seats on your way home. Split the fuel, meet other students, and leave a smaller footprint on every trip.</p>
        </div>
        <Suspense fallback={<WhereToForm cities={[]} loading />}>
          <CitySearch />
        </Suspense>
      </main>
    </section>

    <section aria-label="Savings so far" className="shrink-0 px-5 py-7 text-white sm:px-10 lg:py-6">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-5 lg:flex lg:flex-nowrap lg:items-center lg:justify-center lg:gap-x-[clamp(2rem,4vw,4.5rem)]">
        {savings.map((s) => <li key={s.label} className="flex items-center gap-3.5">
          <svg className="shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
          <span className="flex flex-col min-[1400px]:flex-row min-[1400px]:items-center min-[1400px]:gap-3.5">
            <span className="whitespace-nowrap font-display text-[clamp(1.4rem,2.2vw,1.9rem)] font-extrabold leading-tight tracking-[-0.03em]" style={{ fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
            <span className="whitespace-nowrap font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[#a3b8aa] sm:text-xs">{s.label}</span>
          </span>
        </li>)}
      </ul>
    </section>
  </div>;
}
