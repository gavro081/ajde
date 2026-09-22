import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ImportRideForm } from "./import-ride-form";

export default async function ImportRidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/rides/import");
  const { data: cities } = await supabase.from("cities").select("id, name_en");

  return (
    <><main id="main-content" className="px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="page-heading">
          Import a ride post
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Paste your post. Review the details before publishing.
        </p>

        <div className="mt-8 surface-card p-5 sm:p-8">
          <ImportRideForm cities={cities ?? []} />
        </div>
      </div>
    </main></>
  );
}
