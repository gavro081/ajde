import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";

import { parsedRidePostSchema } from "@/lib/ai/parsed-ride-post";
import type { RideDraft } from "@/lib/rides/ride-draft";
import { fuelPriceConfig } from "@/lib/rides/fuel-price-config";
import { createClient } from "@/lib/supabase/server";

import { RideForm } from "./ride-form";

type NewRidePageProps = {
  searchParams: Promise<{ fixture?: string; import?: string }>;
};

function emptyDraft(): RideDraft {
  return {
    source: "native",
    importId: null,
    origin: { cityId: null, pickupPointId: null, rawText: null },
    destination: { cityId: null, pickupPointId: null, rawText: null },
    departureAt: null,
    distanceKm: null,
    seatsTotal: null,
    carId: null,
    car: null,
    pricePerSeatMkd: null,
    notes: null,
    tags: [],
    genderPreference: "any",
    confidence: null,
    fieldConfidence: [],
    warnings: [],
  };
}

function developmentImportFixture(): RideDraft {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  tomorrow.setHours(18, 0, 0, 0);

  return {
    ...emptyDraft(),
    source: "imported",
    origin: { cityId: 1, pickupPointId: 1, rawText: "кај Мавровка" },
    destination: { cityId: 3, pickupPointId: null, rawText: "Битола" },
    departureAt: tomorrow.toISOString(),
    distanceKm: 170,
    seatsTotal: 3,
    pricePerSeatMkd: 500,
    notes: "Development fixture: Skopje to Bitola after 18:00.",
    tags: ["no_smoking", "luggage_space"],
    confidence: 0.82,
    fieldConfidence: [
      { field: "origin", confidence: 0.96 },
      { field: "destination", confidence: 0.98 },
      { field: "departureAt", confidence: 0.7 },
    ],
    warnings: [
      {
        field: "departureAt",
        code: "needs_review",
        message: "Confirm the interpreted date before publishing.",
      },
    ],
  };
}

export default async function NewRidePage({ searchParams }: NewRidePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/rides/new");

  const [
    { data: cities, error: citiesError },
    { data: pickupPoints, error: pickupError },
    carsResult,
    carModelsResult,
  ] = await Promise.all([
      supabase.from("cities").select("id, name_en, name_mk").order("name_en"),
      supabase
        .from("pickup_points")
        .select("id, city_id, name_en, name_mk")
        .order("name_en"),
      supabase
        .from("cars")
        .select("id, make, model, fuel_type, consumption_l_100km, color, plate_last3")
        .eq("owner_id", user.id)
        .order("created_at"),
      supabase
        .from("car_models")
        .select(
          "id, make, model, engine_size_l, fuel_type, consumption_l_100km, release_year",
        )
        .order("make")
        .order("model"),
    ]);

  if (citiesError || pickupError || carsResult.error || carModelsResult.error) {
    throw new Error("Unable to load the ride form catalogs.");
  }

  const { fixture, import: importId } = await searchParams;
  const usingDevelopmentFixture =
    process.env.NODE_ENV !== "production" && fixture === "imported";
  let initialDraft = usingDevelopmentFixture ? developmentImportFixture() : emptyDraft();

  if (importId) {
    const { data: imported } = await supabase
      .from("imports")
      .select("id, parsed_json")
      .eq("id", importId)
      .eq("created_by", user.id)
      .maybeSingle();
    const parsed = parsedRidePostSchema.safeParse(imported?.parsed_json);
    if (imported && parsed.success) {
      initialDraft = { ...parsed.data.draft, importId: imported.id };
    }
  }

  return (
    <><AppHeader /><main id="main-content" className="bg-slate-50 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/dashboard/driver" className="mb-5 inline-flex text-sm font-semibold text-emerald-700 hover:underline">← My rides</Link>
          <h1 className="page-heading mt-3">
            Where are you headed?
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Set your route, choose your car, and offer a seat.
          </p>
          <Link href="/rides/import" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline">Already posted in a group? Import your post →</Link>
        </div>

        <div className="rounded-3xl border border-white bg-white p-5 shadow-sm sm:p-8">
          <RideForm
            carModels={carModelsResult.data}
            cars={carsResult.data}
            cities={cities}
            initialDraft={initialDraft}
            pickupPoints={pickupPoints}
            fuelPrices={fuelPriceConfig()}
            submissionId={randomUUID()}
            isImportedDraft={initialDraft.source === "imported"}
          />
        </div>
      </div>
    </main></>
  );
}
