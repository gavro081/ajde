import "server-only";

import { createClient } from "../supabase/server";

export async function commentAccess(rideId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Sign in to view or write ride comments." } as const;

  const { data: ride, error } = await supabase.from("rides")
    .select("id, driver_id, departure_at, status").eq("id", rideId).maybeSingle();
  if (error || !ride || (!["published", "full"].includes(ride.status) && ride.driver_id !== user.id)) {
    return { error: "This ride's Q&A is unavailable." } as const;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("full_name, photo_url, university").eq("id", user.id).maybeSingle();
  const complete = !profileError && Boolean(profile?.full_name.trim() && profile.photo_url.trim() && profile.university.trim());
  const open = ["published", "full"].includes(ride.status) && new Date(ride.departure_at).getTime() > Date.now();
  return { supabase, user, canPost: complete && open, postError: !complete
    ? "Complete your student profile before posting."
    : "Comments are closed. Only future published or full rides accept new comments." } as const;
}
