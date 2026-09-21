"use client";
export default function RoomError({ reset }: { reset: () => void }) {
  return <section className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Could not load the ride room</h1><p role="alert" className="mt-2">Check your connection and try again.</p><button onClick={reset} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-white">Try again</button></section>;
}
