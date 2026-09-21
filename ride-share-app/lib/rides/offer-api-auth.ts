import { isAllowedStudentEmail } from "@/lib/auth/email-domain";
import { createClient } from "@/lib/supabase/server";

/** Match the authenticated search API's student/onboarding boundary. */
export async function offerApiContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in before preparing a ride." }, { status: 401 });
  if (!user.email || !isAllowedStudentEmail(user.email)) return Response.json({ error: "Use an approved student account." }, { status: 403 });
  const { data: profile, error } = await supabase.from("profiles").select("full_name, photo_url, university").eq("id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Profile access could not be verified." }, { status: 503 });
  if (!profile?.full_name.trim() || !profile.photo_url.trim() || !profile.university.trim()) return Response.json({ error: "Complete onboarding before preparing a ride." }, { status: 403 });
  return { supabase, user };
}
