import "server-only";

import { commentAccess } from "./access";

export async function getRideComments(rideId: string) {
  const access = await commentAccess(rideId);
  if ("error" in access) return { error: access.error };
  const { data, error } = await access.supabase.from("ride_comments")
    .select("id, author_id, body, created_at, author:profiles!ride_comments_author_id_fkey(full_name, photo_url)")
    .eq("ride_id", rideId).order("created_at").order("id");
  if (error) return { error: "Unable to load comments. Please refresh and try again." };
  return {
    canPost: access.canPost,
    postError: access.canPost ? null : access.postError,
    comments: (data ?? []).map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      canDelete: comment.author_id === access.user.id,
      author: comment.author ? { full_name: comment.author.full_name, photo_url: comment.author.photo_url } : null,
    })),
  };
}
