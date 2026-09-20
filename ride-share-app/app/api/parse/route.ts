import { z } from "zod";

import { stubParseRidePost } from "@/lib/ai/parse-ride-post";
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

  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Ride-post parsing is not configured yet. Try manual ride creation." },
      { status: 503 },
    );
  }

  const parsed = stubParseRidePost(input.data.text);
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
