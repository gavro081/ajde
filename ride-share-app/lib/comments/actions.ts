"use server";

import { revalidatePath } from "next/cache";

import { commentAccess } from "./access";

export type CommentActionState = { error?: string; success?: string };

export async function postRideComment(rideId: string, _previous: CommentActionState, formData: FormData): Promise<CommentActionState> {
  const access = await commentAccess(rideId);
  if ("error" in access) return { error: access.error };
  if (!access.canPost) return { error: access.postError };
  const input = formData.get("body");
  const body = typeof input === "string" ? input.trim() : "";
  if (body.length < 1 || body.length > 2000) return { error: "Write a comment between 1 and 2000 characters." };
  const { error } = await access.supabase.from("ride_comments").insert({ ride_id: rideId, author_id: access.user.id, body });
  if (error) return { error: "Your comment could not be posted. Please try again." };
  revalidatePath(`/rides/${rideId}`);
  return { success: "Comment posted." };
}

export async function deleteRideComment(rideId: string, commentId: string): Promise<CommentActionState> {
  const access = await commentAccess(rideId);
  if ("error" in access) return { error: access.error };
  const { data, error } = await access.supabase.from("ride_comments").delete()
    .eq("id", commentId).eq("ride_id", rideId).eq("author_id", access.user.id).select("id");
  if (error) return { error: "Your comment could not be deleted. Please try again." };
  if (!data?.length) return { error: "Comment unavailable. You can only delete your own comments." };
  revalidatePath(`/rides/${rideId}`);
  return { success: "Comment deleted." };
}
