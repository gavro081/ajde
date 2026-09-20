import { z } from "zod";

import { parseRidePost, RideParserError } from "@/lib/ai/parse-ride-post";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  text: z.string().trim().min(10).max(5_000),
  sourceHint: z.enum(["viber", "facebook", "other"]).nullable(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in before importing a ride." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const input = requestSchema.safeParse(body);
  if (!input.success) {
    return Response.json(
      { error: "Paste a post between 10 and 5,000 characters." },
      { status: 400 },
    );
  }

  const [{ data: cities, error: citiesError }, { data: pickupPoints, error: pickupError }] =
    await Promise.all([
      supabase.from("cities").select("id, name_mk, name_en, aliases"),
      supabase.from("pickup_points").select("id, city_id, name_mk, name_en, aliases"),
    ]);

  if (citiesError || pickupError) {
    return Response.json({ error: "Location options could not be loaded." }, { status: 500 });
  }

  let parsed;
  try {
    parsed = await parseRidePost(input.data.text, {
      cities: cities.map((city) => ({
        id: city.id,
        nameMk: city.name_mk,
        nameEn: city.name_en,
        aliases: city.aliases,
      })),
      pickupPoints: pickupPoints.map((point) => ({
        id: point.id,
        cityId: point.city_id,
        nameMk: point.name_mk,
        nameEn: point.name_en,
        aliases: point.aliases,
      })),
      now: new Date(),
      timezone: "Europe/Skopje",
    });
  } catch (error) {
    if (error instanceof RideParserError) {
      const status = error.code === "missing_key" ? 503 : error.code === "refusal" ? 422 : 502;
      const message =
        error.code === "missing_key"
          ? "Ride-post parsing is not configured. Add the server API key."
          : error.code === "refusal"
            ? "The model could not parse this post. Try a clearer post or enter the ride manually."
            : "The parsing service could not complete this request. Try again.";
      return Response.json({ error: message, code: error.code }, { status });
    }
    return Response.json({ error: "The parser failed unexpectedly." }, { status: 500 });
  }

  if ((parsed.draft.confidence ?? 0) < 0.45) {
    parsed.draft.warnings.push({
      field: null,
      code: "low_confidence",
      message: "The parser has low confidence in this result; review every field carefully.",
    });
  }
  const { data: imported, error } = await supabase
    .from("imports")
    .insert({
      raw_text: input.data.text,
      source_hint: input.data.sourceHint,
      parsed_json: parsed,
      confidence: parsed.draft.confidence,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: "The parsed draft could not be saved." }, { status: 500 });
  }

  return Response.json({ importId: imported.id, parsed });
}
