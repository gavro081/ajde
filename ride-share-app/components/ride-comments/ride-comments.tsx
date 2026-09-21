import { getRideComments } from "@/lib/comments/queries";

import { CommentForm, DeleteCommentForm } from "./comment-forms";

export async function RideComments({ rideId }: { rideId: string }) {
  const thread = await getRideComments(rideId);
  return (
    <section aria-labelledby="ride-questions" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="ride-questions" className="text-xl font-bold">Ride Q&amp;A</h2>
      {"error" in thread ? <p role="alert" className="mt-4 text-sm text-red-700">{thread.error}</p> : <>
        {thread.comments.length === 0 ? <p className="mt-4 text-sm text-slate-600">No questions yet. Start the conversation about this ride.</p> : (
          <ol className="mt-5 space-y-5">
            {thread.comments.map((comment) => (
              <li key={comment.id} className="border-b border-slate-100 pb-5 last:border-0">
                <div className="flex items-center gap-3">
                  {comment.author?.photo_url ? <>
                    {/* Profile photos have user-specific hosts. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={comment.author.photo_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  </> : null}
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{comment.author?.full_name ?? "Student"}</p>
                    <time dateTime={comment.createdAt} className="text-xs text-slate-500">
                      {new Date(comment.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Skopje", dateStyle: "medium", timeStyle: "short" })} (Skopje)
                    </time>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-slate-700">{comment.body}</p>
                {comment.canDelete ? <DeleteCommentForm rideId={rideId} commentId={comment.id} /> : null}
              </li>
            ))}
          </ol>
        )}
        {thread.canPost ? <CommentForm rideId={rideId} /> : <p className="mt-5 text-sm text-slate-600">{thread.postError}</p>}
      </>}
    </section>
  );
}
