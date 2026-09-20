import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import type { RideDraft } from "@/lib/rides/ride-draft";
import { createClient } from "@/lib/supabase/server";

import { RideForm } from "./ride-form";

type NewRidePageProps = {
  searchParams: Promise<{ fixture?: string }>;
};

function emptyDraft(): RideDraft {
  return {
    source: "native",
    importId: null,
    origin: { cityId: null, pickupPointId: null, rawText: null },
    destination: { cityId: null, pickupPointId: null, rawText: null },
    departureAt: null,
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
        .select("id, make, model, color, plate_last3")
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

  const { fixture } = await searchParams;
  const usingDevelopmentFixture =
    process.env.NODE_ENV !== "production" && fixture === "imported";
  const initialDraft = usingDevelopmentFixture ? developmentImportFixture() : emptyDraft();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Offer a ride
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Where are you headed?
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Add the trip details now. You can save a private draft or publish it to the student
            feed.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <RideForm
            carModels={carModelsResult.data}
            cars={carsResult.data}
            cities={cities}
            initialDraft={initialDraft}
            pickupPoints={pickupPoints}
            submissionId={randomUUID()}
            usingDevelopmentFixture={usingDevelopmentFixture}
          />
        </div>
      </div>
    </main>
  );
}
