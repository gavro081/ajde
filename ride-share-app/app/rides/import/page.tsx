import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";

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
    <><AppHeader /><main id="main-content" className="bg-slate-50 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/rides/new" className="mb-5 inline-flex text-sm font-semibold text-emerald-700 hover:underline">← Create a ride manually</Link>
        <h1 className="page-heading mt-3">
          Import a ride post
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Paste your post. Review the details before publishing.
        </p>

        <div className="mt-8 rounded-3xl border border-white bg-white p-5 shadow-sm sm:p-8">
          <ImportRideForm cities={cities ?? []} />
        </div>
      </div>
    </main></>
  );
}
