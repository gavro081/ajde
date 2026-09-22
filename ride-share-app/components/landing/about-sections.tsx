import { Brand } from "@/components/brand";
import facebookGroups from "@/public/landing/facebook-groups.png";
import postBitolaSchedule from "@/public/landing/post-bitola-schedule.png";
import postBitola from "@/public/landing/post-bitola.png";
import postKavadarci from "@/public/landing/post-kavadarci.png";
import postKocani from "@/public/landing/post-kocani.png";
import postOhrid from "@/public/landing/post-ohrid.png";
import postStrugaPrilep from "@/public/landing/post-struga-prilep.png";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

// Shown beside the groups screenshot on desktop; offsets and tilts make the stack feel hand-placed.
const posts = [
  { src: postBitola, className: "mr-8 -rotate-1", alt: "Post: free seats, Tuesday 22.09, Skopje to Bitola, leaving at 14:00, message me." },
  { src: postOhrid, className: "ml-8 rotate-1", alt: "Post: ride Ohrid to Skopje on 22.09, 3 seats, leaving at 7:30, with a phone number." },
  { src: postKavadarci, className: "mr-4", alt: "Post: looking for one seat tomorrow between 7 and 8 from the DENI terminal to Kavadarci." },
  { src: postStrugaPrilep, className: "ml-4 rotate-1", alt: "Post in Cyrillic: hello, I need a ride tomorrow (22.09) from Struga to Prilep after 16h." },
  { src: postKocani, className: "ml-12 -rotate-1", alt: "Post in Cyrillic shorthand: Tuesday 22.09, Kočani to Skopje 17:00 to 17:15, Skopje to Kočani 19:30 to 20:00." },
  { src: postBitolaSchedule, className: "mr-2 rotate-1", alt: "Post in Cyrillic: Tuesday to Friday, Bitola to Skopje around 05:30 and 13:00 to 14:00, Skopje to Bitola 11:00 to 14:00 or around 18:00." },
];

// Worked example shown in the savings section; the arithmetic mirrors lib/rides/ride-estimate.ts.
const example = { km: 170, consumption: 6, passengers: 3, co2PerLitre: 2.31 };
const exampleLitres = (example.km * example.consumption) / 100;
const exampleCo2 = exampleLitres * example.co2PerLitre;
const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const problems = [
  { title: "Scattered across group chats", body: "Rides get posted in dozens of Viber and Facebook groups and are buried within minutes." },
  { title: "Guesswork on price", body: "Drivers guess what to charge. Passengers cannot tell if the price is fair." },
  { title: "Empty seats, busy roads", body: "Cars leave with free seats while other students drive the same route alone." },
];

const steps = [
  { title: "Post in your own words", body: "Describe the trip like you would in a group chat. We turn it into a ride you review before publishing." },
  { title: "Find a seat that fits", body: "Search by city, date and seats. Only students with a verified university email can join." },
  { title: "Ride and split the fuel", body: "Chat in a private ride room, share the real fuel cost, and rate each other afterwards." },
];

const reasons = [
  { value: "1 car", label: "instead of four", body: "Three passengers in one car keeps three other cars off the road." },
  { value: "¼", label: "the emissions per person", body: "A full car spreads one trip's CO₂ across everyone on board." },
  { value: "Real", label: "data behind every number", body: "We count only completed rides with real distance and car data." },
];

function Label({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`text-sm font-semibold ${dark ? "text-[#86efac]" : "text-[#15803d]"}`}>{children}</p>;
}

function Heading({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return <h2 id={id} className={`mt-3 font-display text-[clamp(2rem,4.2vw,3.4rem)] font-extrabold leading-[1.02] tracking-[-0.045em] ${className}`}>{children}</h2>;
}

/** Sits in the bottom-right corner of the first screen so visitors know there is more below. */
export function ScrollHint() {
  return <a href="#about" aria-label="Scroll to learn more" title="Scroll to learn more"
    className="absolute bottom-5 right-5 z-10 hidden size-11 place-items-center rounded-full border border-white/15 bg-white/10 text-[#86efac] backdrop-blur-md transition-colors hover:bg-white/20 lg:grid">
    <svg className={styles.nudge} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
  </a>;
}

function CarIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
  </svg>;
}

export function AboutSections() {
  return <div className="bg-[#0f1511]">
    <section id="about" aria-labelledby="vision-heading" className={`${styles.reveal} mx-auto max-w-5xl px-5 pb-24 pt-20 text-center text-white sm:px-10 lg:pb-32 lg:pt-28`}>
      <Label dark>Our vision</Label>
      <h2 id="vision-heading" className="mx-auto mt-4 max-w-4xl font-display text-[clamp(2.3rem,5.4vw,4.4rem)] font-extrabold leading-[1] tracking-[-0.05em]">
        Every trip home, with <span className="text-[#86efac]">every seat filled.</span>
      </h2>
      <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#a3b8aa]">
        Every weekend, students leave Skopje for their hometowns, mostly in cars with empty seats. We want each of those seats to carry someone.
      </p>
    </section>

    <div className="rounded-[2rem] bg-[#f4f7f3] text-[#16201a]">
      <section aria-labelledby="problem-heading" className={`${styles.reveal} mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-10 lg:pt-28`}>
        <Label>The problem</Label>
        <Heading id="problem-heading" className="max-w-3xl">Getting home should not take six group chats.</Heading>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {problems.map((item) => <li key={item.title} className="rounded-3xl border border-[#16201a]/6 bg-white p-7 shadow-sm">
            <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{item.title}</h3>
            <p className="mt-3 text-[#4f5b4f]">{item.body}</p>
          </li>)}
        </ul>
      </section>

      <section aria-labelledby="familiar-heading" className={`${styles.reveal} mx-auto max-w-6xl px-5 py-20 sm:px-10`}>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-16">
          <div>
            <Label>Sound familiar?</Label>
            <Heading id="familiar-heading">A group for every route. A format for every post.</Heading>
          </div>
          <div>
            <p className="text-[#4f5b4f]">One Facebook search turns up group after group, each covering a single route. Dates, times and free seats hide in free text, written differently every time.</p>
            <ul className="mt-6 grid grid-cols-3 gap-4 border-t border-[#16201a]/10 pt-5" style={{ fontVariantNumeric: "tabular-nums" }}>
              {[["100K+", "members"], ["200+", "posts a day"], ["6", "groups, one search"]].map(([value, label]) => <li key={label}>
                <p className="font-display text-3xl font-extrabold tracking-[-0.04em]">{value}</p>
                <p className="mt-1 text-sm text-[#647063]">{label}</p>
              </li>)}
            </ul>
          </div>
        </div>
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <figure className="rounded-[1.75rem] bg-[#242526] p-3 shadow-xl sm:p-4">
            <Image src={facebookGroups} alt="Facebook search results showing six ride-sharing groups between Macedonian cities, each with thousands of members and 10 to 20 posts a day." sizes="(min-width: 1024px) 36rem, 100vw" className="h-auto w-full rounded-2xl" />
          </figure>
          <figure className="hidden lg:block">
            <ul aria-label="Example ride posts" className="grid gap-4">
              {posts.map((post) => <li key={post.alt} className={`overflow-hidden rounded-2xl bg-[#252728] px-3 py-2 shadow-lg ring-1 ring-black/5 ${post.className}`}>
                <Image src={post.src} alt={post.alt} sizes="26rem" className="h-auto w-full" />
              </li>)}
            </ul>
            <figcaption className="mt-5 text-center text-sm text-[#647063]">Real posts from this week.</figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="how-heading" className={`${styles.reveal} mx-auto max-w-6xl px-5 py-20 sm:px-10`}>
        <Label>How it works</Label>
        <Heading id="how-heading" className="max-w-3xl">One place for every ride between cities.</Heading>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => <li key={step.title} className="relative flex gap-5 md:flex-col md:gap-0">
            {index < steps.length - 1 ? <span aria-hidden="true" className="absolute left-6 top-14 h-[calc(100%_-_1.5rem)] border-l-2 border-dashed border-[#16a34a]/35 md:left-16 md:top-6 md:h-0 md:w-[calc(100%_-_3rem)] md:border-l-0 md:border-t-2" /> : null}
            <span aria-hidden="true" className={`relative grid size-12 shrink-0 place-items-center rounded-full border-2 border-[#16a34a] ${index === steps.length - 1 ? "bg-[#16a34a] text-white" : "bg-white text-[#15803d]"}`}>
              <CarIcon />
            </span>
            <div className="min-w-0 md:mt-6">
              <p className="text-sm font-semibold text-[#15803d]">Step {index + 1}</p>
              <h3 className="mt-1 font-display text-2xl font-bold tracking-[-0.03em]">{step.title}</h3>
              <p className="mt-3 text-[#4f5b4f]">{step.body}</p>
            </div>
          </li>)}
        </ol>
      </section>

      <section aria-labelledby="savings-heading" className={`${styles.reveal} mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16`}>
        <div>
          <Label>How we calculate savings</Label>
          <Heading id="savings-heading">Simple math, shown openly.</Heading>
          <p className="mt-6 max-w-md text-[#4f5b4f]">Every accepted passenger seat counts as one car trip that did not happen. We estimate what that trip would have burned using the shared car&apos;s real consumption.</p>
          <dl className="mt-8 space-y-5">
            {[
              ["Fuel", "distance × consumption ÷ 100"],
              ["CO₂", "fuel × 2.31 kg per litre of petrol, or 2.68 kg for diesel"],
              ["Saved", "trip CO₂ × passenger seats filled"],
            ].map(([term, formula]) => <div key={term} className="flex gap-5 border-b border-[#16201a]/10 pb-5">
              <dt className="w-16 shrink-0 font-semibold">{term}</dt>
              <dd className="text-[#4f5b4f]">{formula}</dd>
            </div>)}
          </dl>
          <p className="mt-6 max-w-md text-sm text-[#647063]">Only completed rides with petrol or diesel cars and a valid distance count. Demo rides are excluded.</p>
        </div>

        <figure className="rounded-[1.75rem] bg-[#0f1511] p-8 text-white shadow-xl sm:p-10">
          <figcaption className="text-sm font-semibold text-[#86efac]">Example trip</figcaption>
          <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.04em]">Skopje <span className="text-[#647063]">to</span> Bitola</p>
          <p className="mt-2 text-[#a3b8aa]">{example.km} km · petrol car using {example.consumption} L/100 km · {example.passengers} passengers</p>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10" style={{ fontVariantNumeric: "tabular-nums" }}>
            {[
              ["Fuel for the trip", `${one.format(exampleLitres)} L`],
              ["CO₂ for the trip", `${one.format(exampleCo2)} kg`],
              ["Fuel saved", `${one.format(exampleLitres * example.passengers)} L`],
              ["CO₂ saved", `${one.format(exampleCo2 * example.passengers)} kg`],
            ].map(([label, value], index) => <div key={label} className="bg-[#16201a] p-5">
              <dt className="text-sm text-[#a3b8aa]">{label}</dt>
              <dd className={`mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] ${index > 1 ? "text-[#86efac]" : ""}`}>{value}</dd>
            </div>)}
          </dl>
          <p className="mt-6 text-sm text-[#a3b8aa]">The fuel cost is split the same way, so every seat pays a fair share.</p>
        </figure>
      </section>

      <section aria-labelledby="green-heading" className={`${styles.reveal} mx-auto max-w-6xl px-5 pb-28 pt-20 sm:px-10`}>
        <Label>Why it is greener</Label>
        <Heading id="green-heading" className="max-w-3xl">The cleanest car trip is the one nobody needs to drive.</Heading>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {reasons.map((item) => <li key={item.label} className="rounded-3xl bg-[#e3f1df] p-7">
            <p className="font-display text-5xl font-extrabold tracking-[-0.05em] text-[#166534]">{item.value}</p>
            <p className="mt-1 font-semibold">{item.label}</p>
            <p className="mt-3 text-[#4f5b4f]">{item.body}</p>
          </li>)}
        </ul>
      </section>
    </div>

    <section aria-labelledby="cta-heading" className={`${styles.reveal} mx-auto max-w-4xl px-5 py-24 text-center text-white sm:px-10 lg:py-32`}>
      <h2 id="cta-heading" className="font-display text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[1] tracking-[-0.05em]">Your next trip home has room for more.</h2>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/rides" className="inline-flex min-h-[52px] items-center rounded-[.9rem] bg-white px-6 font-semibold text-[#16201a] hover:bg-[#e7f6de]">Find a ride</Link>
        <Link href="/rides/new" className="inline-flex min-h-[52px] items-center rounded-[.9rem] border border-white/25 px-6 font-semibold text-white hover:bg-white/10">Offer a ride</Link>
      </div>
    </section>

    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-[#a3b8aa] sm:px-10 md:flex-row md:items-center md:justify-between">
        <Brand inverse />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/rides" className="hover:text-white">Find a ride</Link>
          <Link href="/rides/new" className="hover:text-white">Offer a ride</Link>
          <a href="#about" className="hover:text-white">About</a>
        </nav>
        <p>© {new Date().getFullYear()} ajde. Made in Skopje.</p>
      </div>
    </footer>
  </div>;
}
