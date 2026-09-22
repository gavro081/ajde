import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { OfferRideHeading } from "./offer-heading";

import { parsedRidePostSchema } from "@/lib/ai/parsed-ride-post";
import type { RideDraft } from "@/lib/rides/ride-draft";
import { fuelPriceConfig } from "@/lib/rides/fuel-price-config";
import { createClient } from "@/lib/supabase/server";

import { OfferWorkspace } from "./offer-workspace";

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
        .select("id, make, model, fuel_type, consumption_l_100km, color, plate_last3, seats_total")
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
    <><main id="main-content" className="px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <OfferRideHeading />

        <div className="surface-card mt-8 p-4 sm:p-6">
          <OfferWorkspace
            userId={user.id}
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
