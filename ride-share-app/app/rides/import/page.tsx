import { redirect } from "next/navigation";

import { anonymousRideTestingEnabled } from "@/lib/rides/anonymous-test-mode";
import { createClient } from "@/lib/supabase/server";

import { ImportRideForm } from "./import-ride-form";

export default async function ImportRidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const anonymousTestMode = !user && anonymousRideTestingEnabled();
  if (!user && !anonymousTestMode) redirect("/login?next=/rides/import");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Import a post
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Turn a group post into a ride draft
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Paste a Viber or Facebook post, review every extracted detail, then finish it in the ride
          form. Nothing is published automatically.
        </p>

        {anonymousTestMode ? (
          <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            Temporary anonymous test mode is active. Parsed imports can be reviewed, but final
            rides and cars will not be saved.
          </p>
        ) : null}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <ImportRideForm />
        </div>
      </div>
    </main>
  );
}
