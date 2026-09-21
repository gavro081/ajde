import { z } from "zod";

import { createOpenAILocationFallback } from "@/lib/ai/openai-location-fallback";
import {
  parseSearchQuery,
  SearchParserError,
  type SearchLocationCandidate,
} from "@/lib/ai/parse-search-query";
import { isAllowedStudentEmail } from "@/lib/auth/email-domain";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ query: z.string().trim().min(2).max(300) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Sign in before searching." }, { status: 401 });
  if (!user.email || !isAllowedStudentEmail(user.email)) {
    return Response.json({ error: "Use an approved student account." }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, photo_url, university")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return Response.json({ error: "Profile access could not be verified." }, { status: 500 });
  if (!profile?.full_name.trim() || !profile.photo_url.trim() || !profile.university.trim()) {
    return Response.json({ error: "Complete onboarding before searching." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  const input = requestSchema.safeParse(body);
  if (!input.success) {
    return Response.json({ error: "Enter a search between 2 and 300 characters." }, { status: 400 });
  }

  const [{ data: cities, error: cityError }, { data: pickups, error: pickupError }] = await Promise.all([
    supabase.from("cities").select("id, name_mk, name_en, aliases"),
    supabase.from("pickup_points").select("id, city_id, name_mk, name_en, aliases"),
  ]);
  if (cityError || pickupError) {
    return Response.json({ error: "Location options could not be loaded." }, { status: 500 });
  }

  const candidates: SearchLocationCandidate[] = [
    ...cities.map((city) => ({
      kind: "city" as const,
      id: city.id,
      cityId: null,
      nameMk: city.name_mk,
      nameEn: city.name_en,
      aliases: city.aliases,
    })),
    ...pickups.map((pickup) => ({
      kind: "pickup_point" as const,
      id: pickup.id,
      cityId: pickup.city_id,
      nameMk: pickup.name_mk,
      nameEn: pickup.name_en,
      aliases: pickup.aliases,
    })),
  ];

  try {
    const result = await parseSearchQuery(input.data.query, {
      candidates,
      now: new Date(),
      timeZone: "Europe/Skopje",
      locationFallback: createOpenAILocationFallback(),
    });
    return Response.json({ result });
  } catch (error) {
    if (!(error instanceof SearchParserError)) {
      return Response.json({ error: "Search failed unexpectedly." }, { status: 500 });
    }
    const status =
      error.code === "missing_key"
        ? 503
        : error.code === "refusal" || error.code === "invalid_output"
          ? 422
          : error.code === "timeout"
            ? 504
            : 502;
    const messages = {
      missing_key: "AI search is not configured. Use the manual filters instead.",
      refusal: "The query could not be interpreted. Try simpler wording or use manual filters.",
      invalid_output: "The search interpretation was invalid. Review the manual filters.",
      timeout: "AI search timed out. The manual filters are still available.",
      provider_error: "AI search is temporarily unavailable. Use the manual filters instead.",
    } as const;
    return Response.json({ error: messages[error.code], code: error.code }, { status });
  }
}
