"use client";

import { useState, type ChangeEvent } from "react";
import { MAX_SCREENSHOT_BYTES, SCREENSHOT_MIME_TYPES, screenshotResponseSchema, type ScreenshotPost } from "@/lib/ai/screenshot-contract";

type Props = {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSelect: (post: ScreenshotPost) => void;
};

export function ScreenshotImport({ disabled, onBusyChange, onSelect }: Props) {
  const [posts, setPosts] = useState<ScreenshotPost[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function read(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    setPosts([]);
    setError("");
    if (!SCREENSHOT_MIME_TYPES.some(type => type === image.type) || image.size === 0 || image.size > MAX_SCREENSHOT_BYTES) {
      setError("Choose one PNG, JPEG, or WebP screenshot up to 4 MB.");
      return;
    }
    setPending(true);
    onBusyChange(true);
    try {
      const form = new FormData();
      form.append("image", image);
      const response = await fetch("/api/parse/screenshot", { method: "POST", body: form });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error : "Couldn't read this screenshot, paste the text instead");
        return;
      }
      const result = screenshotResponseSchema.safeParse(payload);
      if (!result.success || !result.data.posts.length) {
        setError("Couldn't read this screenshot, paste the text instead");
        return;
      }
      setPosts(result.data.posts);
    } catch {
      setError("The screenshot reader could not be reached. Paste the text or try again.");
    } finally {
      setPending(false);
      onBusyChange(false);
    }
  }

  return <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Read a screenshot" aria-busy={pending}>
    <label className="block font-medium text-slate-800">
      Or upload a screenshot
      <input className="mt-2 block w-full min-w-0 max-w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2"
        type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || pending} onChange={read} />
    </label>
    <p className="text-xs text-slate-600">PNG, JPEG, or WebP, up to 4 MB. Choose one post below, then correct its text before creating a review draft.</p>
    <p className="text-xs text-slate-600">The app does not save the image or unselected posts. Only text you submit for a review draft is saved.</p>
    {pending ? <p role="status" className="text-sm text-slate-700">Reading screenshot…</p> : null}
    {error ? <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950">{error}</p> : null}
    {posts.length ? <div className="space-y-3" aria-label="Detected posts">
      <h3 className="font-semibold text-slate-900">Choose a detected post</h3>
      {posts.map((post, index) => <article key={index} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
        <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">{post.kind}</span>
        <p className="my-3 whitespace-pre-wrap break-words text-sm text-slate-900">{post.text}</p>
        <button className="btn-secondary w-full disabled:opacity-50" type="button" disabled={disabled || pending} onClick={() => onSelect(post)}>Use this post</button>
      </article>)}
    </div> : null}
  </section>;
}
