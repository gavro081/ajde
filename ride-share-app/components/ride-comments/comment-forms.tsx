"use client";

import { useActionState, useState } from "react";

import { deleteRideComment, postRideComment, type CommentActionState } from "@/lib/comments/actions";

const initialState: CommentActionState = {};

export function CommentForm({ rideId }: { rideId: string }) {
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState(async (previous: CommentActionState, formData: FormData) => {
    try {
      const result = await postRideComment(rideId, previous, formData);
      if (result.success) setBody("");
      return result;
    } catch {
      return { error: "Your comment could not be posted. Please try again." };
    }
  }, initialState);

  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block text-sm font-semibold" htmlFor="ride-comment">Ask a question or answer</label>
      <textarea id="ride-comment" name="body" value={body} onChange={(event) => setBody(event.target.value)}
        required maxLength={2000} rows={3} disabled={pending} aria-describedby="comment-audience"
        className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 disabled:opacity-60" />
      <p id="comment-audience" className="text-sm text-slate-600">Other students who can view this ride can read your comment. Avoid sharing private contact details.</p>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="w-full btn-primary disabled:opacity-60 sm:w-auto">
        {pending ? "Posting..." : "Post comment"}
      </button>
    </form>
  );
}

export function DeleteCommentForm({ rideId, commentId }: { rideId: string; commentId: string }) {
  const [state, action, pending] = useActionState(async () => {
    try {
      return await deleteRideComment(rideId, commentId);
    } catch {
      return { error: "Your comment could not be deleted. Please try again." };
    }
  }, initialState);
  return (
    <form action={action} className="mt-2">
      <button type="submit" disabled={pending} className="min-h-11 text-sm font-semibold text-red-700 hover:underline disabled:opacity-60">
        {pending ? "Deleting..." : "Delete my comment"}
      </button>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}
