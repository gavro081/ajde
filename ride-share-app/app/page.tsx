import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { UiIcon } from "@/components/ui-icon";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "A little closer, together" };

export default async function Home() {
  const supabase = await createClient();
  const { data: cities } = await supabase.from("cities").select("id, name_en").order("name_en");

  return <div className="landing-shell">
    <AppHeader />
    <main id="main-content" className="landing-main">
      <section className="landing-hero" aria-labelledby="home-title">
        <div className="landing-copy">
          <h1 id="home-title" className="landing-title">Going home?<br /><span>Go together.</span></h1>
          <p className="landing-lede">Share a ride. Split the cost. Travel with students across North Macedonia.</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a href="#find-a-ride" className="btn-primary">Find your ride <UiIcon name="arrow" size={22} /></a>
            <Link href="/rides/new" className="btn-secondary">Offer a seat</Link>
          </div>
        </div>
        <div className="journey-scene">
          <Image src="/images/shared-journey.png" width={1254} height={1254} alt="A coral car on a winding road, with a blue location pin and a green tree" className="journey-art" sizes="(max-width: 767px) 100vw, 55vw" preload />
        </div>
      </section>

      <section id="find-a-ride" className="home-search" aria-labelledby="search-heading">
        <div className="home-search-heading"><h2 id="search-heading" className="text-2xl font-medium tracking-tight">Where are you headed?</h2></div>
        <form action="/rides" className="home-search-form">
          <div className="home-search-field"><UiIcon name="pin" /><label>Leaving from<select name="origin" defaultValue=""><option value="">Choose a city</option>{cities?.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}</select></label></div>
          <div className="home-search-field"><UiIcon name="pin" /><label>Going to<select name="destination" defaultValue=""><option value="">Choose a city</option>{cities?.map((city) => <option key={city.id} value={city.id}>{city.name_en}</option>)}</select></label></div>
          <div className="home-search-field"><UiIcon name="calendar" /><label>When<input name="date" type="date" /></label></div>
          <button type="submit" className="btn-primary"><UiIcon name="search" size={18} /> Find a ride</button>
        </form>
      </section>

    </main>
    <footer className="landing-footer"><span className="font-medium text-slate-700">Student Ride Share</span><span>For students. For the way home.</span><Link href="/rides/import" className="hover:text-slate-950">Import a ride post ↗</Link></footer>
  </div>;
}
