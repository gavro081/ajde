import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { aiImportPipelineEnabled } from "@/lib/ai/import-pipeline-config";

import { ImportRideForm } from "./import-ride-form";

export default async function ImportRidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/rides/import");
  const { data: cities } = await supabase.from("cities").select("id, name_en");
  const pipelineEnabled = aiImportPipelineEnabled();

  return (
    <><main id="main-content" className="px-4 py-7 text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-xl">
        <Link href="/rides/new" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-700"><span aria-hidden="true">←</span> Back to ride form</Link>
        <h1 className="page-heading">
          Import a ride post
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          {pipelineEnabled ? "Choose a Facebook screenshot or paste your Viber post." : "Paste your Viber post to fill in the ride details."}
        </p>

        <div className="mt-6 surface-card p-5 sm:p-7">
          <ImportRideForm cities={cities ?? []} pipelineEnabled={pipelineEnabled} />
        </div>
      </div>
    </main></>
  );
}
