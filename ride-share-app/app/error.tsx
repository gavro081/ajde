"use client";
import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-slate-600">We could not load this page. Check your connection and try again.</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-coral-600 px-4 py-2.5 font-semibold text-white hover:bg-coral-700">Try again</button>
        <Link href="/" className="btn-quiet mt-3 block">Back to home</Link>
      </div>
    </main>
  );
}
